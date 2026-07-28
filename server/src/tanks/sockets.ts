import type { Server, Socket } from 'socket.io';

import { ARENA, type Direction, type Upgrade } from './arena.js';
import { MAX_CHESTS, MAX_TANKS, MIN_TANKS, TANK_COLORS, TankMatch } from './match.js';

/**
 * Todo lo que tiene que ver con la red en las partidas de tanques.
 *
 * Va aparte del ajedrez y las damas porque funciona al revés: en vez de esperar
 * a que alguien juegue, el servidor adelanta el mundo veinte veces por segundo
 * y reparte cómo va quedando.
 */

/** Sin I, O, 0 ni 1: se confunden al dictarlos en voz alta. */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Una sala terminada o vacía se recoge pasado este tiempo. */
const STALE_MS = 20 * 60 * 1000;

export class TankServer {
  private matches = new Map<string, TankMatch>();
  private socketMatch = new Map<string, string>();
  private loop: NodeJS.Timeout | null = null;

  constructor(private readonly io: Server) {}

  get stats() {
    return {
      matches: this.matches.size,
      playing: [...this.matches.values()].filter((m) => m.status === 'playing').length,
    };
  }

  // -------------------------------------------------------------------------

  register(socket: Socket): void {
    socket.on('tank_create', (payload) => {
      const match = new TankMatch(
        this.freshCode(),
        Number(payload?.tankCount ?? 4),
        {
          life: Number(payload?.chests?.life),
          defense: Number(payload?.chests?.defense),
          attack: Number(payload?.chests?.attack),
        },
      );
      this.matches.set(match.id, match);

      const player = match.addPlayer(cleanName(payload?.name), socket.id);
      if (!player) return this.fail(socket, 'No se pudo crear la sala.');

      this.socketMatch.set(socket.id, match.id);
      socket.emit('tank_joined', {
        matchId: match.id,
        code: match.id,
        token: player.token,
      });
      this.sendLobby(match);
    });

    socket.on('tank_join', (payload) => {
      const match = this.matches.get(String(payload?.code ?? '').toUpperCase().trim());
      if (!match) return this.fail(socket, 'No existe ninguna sala con ese código.');
      if (match.status !== 'lobby') return this.fail(socket, 'Esa partida ya ha empezado.');
      if (match.playerBySocket(socket.id)) return this.fail(socket, 'Ya estás en esa sala.');

      const player = match.addPlayer(cleanName(payload?.name), socket.id);
      if (!player) return this.fail(socket, 'La sala está completa.');

      this.socketMatch.set(socket.id, match.id);
      socket.emit('tank_joined', {
        matchId: match.id,
        code: match.id,
        token: player.token,
      });
      this.sendLobby(match);
    });

    socket.on('tank_pick_color', (payload) => {
      const { match, player } = this.find(socket);
      if (!match || !player) return;
      if (!match.pickColor(player.token, String(payload?.color ?? ''))) {
        this.fail(socket, 'Ese color ya lo ha cogido otro.');
      }
      this.sendLobby(match);
    });

    socket.on('tank_set_chests', (payload) => {
      const { match, player } = this.find(socket);
      if (!match || !player) return;
      match.setChestCount(player.token, String(payload?.kind), Number(payload?.count));
      this.sendLobby(match);
    });

    socket.on('tank_set_count', (payload) => {
      const { match, player } = this.find(socket);
      if (!match || !player) return;
      if (!match.setTankCount(player.token, Number(payload?.tankCount))) {
        this.fail(socket, 'No se pudo cambiar el número de tanques.');
      }
      this.sendLobby(match);
    });

    socket.on('tank_start', () => {
      const { match, player } = this.find(socket);
      if (!match || !player) return;
      if (!match.start(player.token)) {
        return this.fail(socket, 'Faltan jugadores o alguien no ha elegido color.');
      }
      this.ensureLoop();
      this.broadcastState(match);
    });

    socket.on('tank_input', (payload) => {
      const { match, player } = this.find(socket);
      if (!match || !player) return;
      match.setInput(player.token, {
        dir: cleanDirection(payload?.dir),
        firing: payload?.firing === true,
      });
    });

    socket.on('tank_upgrade', (payload) => {
      const { match, player } = this.find(socket);
      if (!match || !player) return;
      const upgrade = payload?.upgrade;
      if (upgrade === 'life' || upgrade === 'defense' || upgrade === 'attack') {
        match.upgrade(player.token, upgrade as Upgrade);
      }
    });

    socket.on('tank_leave', () => this.detach(socket));

    socket.on('disconnect', () => this.detach(socket, { keepSeat: true }));
  }

  // -------------------------------------------------------------------------

  /**
   * Un solo temporizador para todas las partidas. Con uno por sala, veinte
   * salas serían veinte temporizadores compitiendo entre sí.
   */
  private ensureLoop(): void {
    if (this.loop) return;
    this.loop = setInterval(() => {
      let anyPlaying = false;

      for (const match of this.matches.values()) {
        if (match.status !== 'playing') continue;
        anyPlaying = true;
        match.tick();
        this.broadcastState(match);
      }

      this.sweep();
      if (!anyPlaying) {
        clearInterval(this.loop!);
        this.loop = null;
      }
    }, ARENA.tickMs);
  }

  private broadcastState(match: TankMatch): void {
    const arena = match.arena;
    if (!arena) return;

    // Los muros solo viajan cuando han cambiado: son 676 casillas y mandarlas
    // veinte veces por segundo sería tirar ancho de banda a la basura.
    const walls = match.wallsDirty ? match.wallsAsText() : undefined;
    match.wallsDirty = false;

    // El estado se arma por jugador porque lo que ve cada uno cambia: un tanque
    // metido en un arbusto está oculto para los demás pero no para sí mismo.
    const describe = (tank: (typeof arena.tanks)[number]) => ({
      id: tank.id,
      color: tank.color,
      name: match.players.find((p) => p.token === tank.playerId)?.name ?? null,
      // Dos decimales bastan para dibujar y ahorran la mitad del mensaje.
      x: round(tank.x),
      y: round(tank.y),
      dir: tank.dir,
      hp: tank.hp,
      maxHp: tank.maxHp,
      attack: tank.attack,
      defense: tank.defense,
      alive: tank.alive,
      // Para pintar la barra de carga del propio jugador.
      charging: tank.charging ?? 0,
      chargeMs: ARENA.chargeMs,
      kills: tank.kills,
      upgrades: tank.pendingUpgrades,
    });

    const bullets = arena.bullets.map((b) => ({
      x: round(b.x),
      y: round(b.y),
      charged: b.charged,
    }));
    const pickups = arena.pickups.map((p) => ({
      kind: p.kind,
      x: round(p.x),
      y: round(p.y),
      hp: p.hp,
    }));

    for (const player of match.players) {
      if (!player.socketId) continue;
      const yourTankId = match.tankIdOf(player.token) ?? null;

      this.io.to(player.socketId).emit('tank_state', {
        status: match.status,
        size: ARENA.size,
        tankSize: ARENA.tankSize,
        yourTankId,
        tanks: arena.tanks
          .filter((tank) => !arena.isHiddenFrom(tank, yourTankId))
          .map(describe),
        bullets,
        pickups,
        walls,
        events: arena.events,
        winner: match.winner,
      });
    }
  }

  private sendLobby(match: TankMatch): void {
    const payload = {
      code: match.id,
      status: match.status,
      tankCount: match.tankCount,
      chests: match.chests,
      minTanks: MIN_TANKS,
      maxTanks: MAX_TANKS,
      maxChests: MAX_CHESTS,
      colors: TANK_COLORS,
      taken: match.takenColors(),
      canStart: match.canStart,
      players: match.players.map((p) => ({
        name: p.name,
        color: p.color,
        connected: p.socketId !== null,
        isHost: match.hostToken === p.token,
      })),
    };

    for (const player of match.players) {
      if (!player.socketId) continue;
      this.io.to(player.socketId).emit('tank_lobby', {
        ...payload,
        youAreHost: match.hostToken === player.token,
        yourColor: player.color,
      });
    }
  }

  // -------------------------------------------------------------------------

  private find(socket: Socket) {
    const matchId = this.socketMatch.get(socket.id);
    const match = matchId ? this.matches.get(matchId) : undefined;
    return { match, player: match?.playerBySocket(socket.id) };
  }

  /**
   * Al desconectarse se le guarda el sitio, porque puede volver; al salir a
   * propósito, se le quita de la sala.
   */
  private detach(socket: Socket, { keepSeat = false } = {}): void {
    const { match, player } = this.find(socket);
    this.socketMatch.delete(socket.id);
    if (!match || !player) return;

    if (keepSeat && match.status === 'playing') {
      player.socketId = null;
    } else {
      match.players = match.players.filter((p) => p.token !== player.token);
      if (match.hostToken === player.token) {
        match.hostToken = match.players[0]?.token ?? null;
      }
    }
    if (match.status === 'lobby') this.sendLobby(match);
  }

  private sweep(): void {
    const now = Date.now();
    for (const [code, match] of this.matches) {
      const stale = now - match.createdAt > STALE_MS;
      if (match.players.length === 0 || (match.status === 'finished' && stale)) {
        this.matches.delete(code);
      }
    }
  }

  private fail(socket: Socket, message: string): void {
    socket.emit('error_msg', { code: 'bad_request', message });
  }

  private freshCode(): string {
    for (let attempt = 0; attempt < 100; attempt++) {
      let code = '';
      for (let i = 0; i < 4; i++) {
        code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
      }
      if (!this.matches.has(code)) return code;
    }
    return Date.now().toString(36).toUpperCase().slice(-4);
  }
}

function cleanName(raw: unknown): string {
  const name = typeof raw === 'string' ? raw.trim().slice(0, 20) : '';
  return name.length > 0 ? name : 'Invitado';
}

function cleanDirection(raw: unknown): Direction | null {
  return raw === 'up' || raw === 'down' || raw === 'left' || raw === 'right' ? raw : null;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
