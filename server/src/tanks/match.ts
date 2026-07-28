import { randomUUID } from 'node:crypto';

import type { Cell } from './arena.js';
import {
  Arena,
  ARENA,
  CPU_COLOR,
  type TankInput,
  type TankSpec,
  type Upgrade,
} from './arena.js';

/**
 * Los colores que se pueden elegir. Uno por jugador: en cuanto alguien coge
 * uno, deja de estar disponible para los demás.
 *
 * El plomo no está en la lista a propósito: es el de los tanques de la máquina
 * y no debe poder elegirlo nadie.
 */
export const TANK_COLORS = [
  { id: 'rojo', hex: '#E5383B' },
  { id: 'azul', hex: '#3A86FF' },
  { id: 'verde', hex: '#2FBF71' },
  { id: 'amarillo', hex: '#FFBE0B' },
  { id: 'morado', hex: '#9B5DE5' },
  { id: 'naranja', hex: '#FF7B00' },
  { id: 'celeste', hex: '#00BBF9' },
  { id: 'rosa', hex: '#F15BB5' },
] as const;

export const MAX_PLAYERS = TANK_COLORS.length;
export const MIN_TANKS = 2;
export const MAX_TANKS = 12;
export const MAX_CHESTS = 10;

export type MatchStatus = 'lobby' | 'playing' | 'finished';

export interface TankPlayer {
  /** Credencial secreta, igual que en el ajedrez: permite volver si te caes. */
  token: string;
  socketId: string | null;
  name: string;
  /** Id del color elegido, o null si aún no ha elegido. */
  color: string | null;
}

/**
 * Una partida de tanques: la sala donde la gente entra y elige color, y luego
 * el mundo en marcha.
 *
 * A diferencia del ajedrez, aquí pueden entrar más de dos y el mundo avanza
 * solo, sin esperar a nadie.
 */
export class TankMatch {
  readonly id: string;
  readonly createdAt = Date.now();

  /** Cuántos tanques habrá en total; los que sobren los lleva la máquina. */
  tankCount: number;

  /** Cuántos cofres de cada clase saldrán durante la partida. */
  chests: Record<'life' | 'defense' | 'attack' | 'speed', number>;

  players: TankPlayer[] = [];
  status: MatchStatus = 'lobby';
  arena: Arena | null = null;
  winner: { name: string; color: string } | null = null;

  /** Quién creó la sala: es el único que puede empezar y cambiar los ajustes. */
  hostToken: string | null = null;

  /** Mapa dibujado con el que se juega, o null para uno generado. */
  mapId: string | null = null;
  mapName: string | null = null;
  /** El mapa ya resuelto, que se lo pasa quien crea la partida. */
  private layout: Cell[][] | null = null;

  /** Qué tanque lleva cada jugador, una vez empezada la partida. */
  private tankByToken = new Map<string, string>();

  /**
   * Los muros cambian cuando una bala rompe un ladrillo. Se mandan enteros solo
   * cuando cambian, en vez de veinte veces por segundo sin necesidad.
   */
  wallsDirty = true;

  constructor(
    id: string,
    tankCount: number,
    chests: Partial<Record<'life' | 'defense' | 'attack' | 'speed', number>> = {},
  ) {
    this.id = id;
    this.tankCount = clampTanks(tankCount);
    this.chests = {
      life: clampChests(chests.life ?? ARENA.defaultChests.life),
      defense: clampChests(chests.defense ?? ARENA.defaultChests.defense),
      attack: clampChests(chests.attack ?? ARENA.defaultChests.attack),
      speed: clampChests(chests.speed ?? ARENA.defaultChests.speed),
    };
  }

  // -------------------------------------------------------------------------
  // La sala
  // -------------------------------------------------------------------------

  /** Añade un jugador. Devuelve null si la sala está llena o ya empezó. */
  addPlayer(name: string, socketId: string): TankPlayer | null {
    if (this.status !== 'lobby') return null;
    if (this.players.length >= MAX_PLAYERS) return null;
    if (this.players.length >= this.tankCount) return null;

    const player: TankPlayer = {
      token: randomUUID(),
      socketId,
      name,
      color: null,
    };
    this.players.push(player);
    this.hostToken ??= player.token;
    return player;
  }

  playerByToken(token: string): TankPlayer | undefined {
    return this.players.find((p) => p.token === token);
  }

  playerBySocket(socketId: string): TankPlayer | undefined {
    return this.players.find((p) => p.socketId === socketId);
  }

  get isHost() {
    return (token: string) => this.hostToken === token;
  }

  /** Los colores que ya ha cogido alguien. */
  takenColors(): string[] {
    return this.players.map((p) => p.color).filter((c): c is string => c !== null);
  }

  /**
   * Elige color. Falla si ese color ya lo tiene otro: es justo lo que pidió el
   * usuario, que un color cogido no se pueda volver a elegir.
   */
  pickColor(token: string, colorId: string): boolean {
    if (this.status !== 'lobby') return false;
    const player = this.playerByToken(token);
    if (!player) return false;
    if (!TANK_COLORS.some((c) => c.id === colorId)) return false;
    if (this.players.some((p) => p.token !== token && p.color === colorId)) return false;

    player.color = colorId;
    return true;
  }

  setChestCount(token: string, kind: string, count: number): boolean {
    if (this.status !== 'lobby' || this.hostToken !== token) return false;
    if (kind !== 'life' && kind !== 'defense' && kind !== 'attack' && kind !== 'speed') {
      return false;
    }
    this.chests[kind] = clampChests(count);
    return true;
  }

  /** Elige el mapa dibujado con el que se jugará. */
  setMap(
    token: string,
    map: { id: string; name: string; layout: Cell[][] } | null,
  ): boolean {
    if (this.status !== 'lobby' || this.hostToken !== token) return false;
    this.mapId = map?.id ?? null;
    this.mapName = map?.name ?? null;
    this.layout = map?.layout ?? null;
    return true;
  }

  setTankCount(token: string, count: number): boolean {
    if (this.status !== 'lobby' || this.hostToken !== token) return false;
    const wanted = clampTanks(count);
    // No se puede pedir menos tanques que jugadores ya sentados.
    if (wanted < this.players.length) return false;
    this.tankCount = wanted;
    return true;
  }

  /** Hace falta que todos hayan elegido color y que sean al menos dos. */
  get canStart(): boolean {
    return (
      this.status === 'lobby' &&
      this.players.length >= 2 &&
      this.players.every((p) => p.color !== null)
    );
  }

  /** Arranca la partida. Solo puede el que creó la sala. */
  start(token: string): boolean {
    if (!this.canStart || this.hostToken !== token) return false;

    const specs: TankSpec[] = this.players.map((player, i) => {
      const tankId = `t${i}`;
      this.tankByToken.set(player.token, tankId);
      return {
        id: tankId,
        playerId: player.token,
        color: hexOf(player.color!),
      };
    });

    // Los tanques que sobran los lleva la máquina, en plomo.
    for (let i = this.players.length; i < this.tankCount; i++) {
      specs.push({ id: `cpu${i}`, playerId: null, color: CPU_COLOR });
    }

    this.arena = new Arena(specs, Date.now(), this.chests, this.layout ?? undefined);
    this.status = 'playing';
    this.wallsDirty = true;
    return true;
  }

  // -------------------------------------------------------------------------
  // La partida en marcha
  // -------------------------------------------------------------------------

  tankIdOf(token: string): string | undefined {
    return this.tankByToken.get(token);
  }

  setInput(token: string, input: TankInput): void {
    const tankId = this.tankByToken.get(token);
    if (tankId && this.arena) this.arena.setInput(tankId, input);
  }

  upgrade(token: string, upgrade: Upgrade): boolean {
    const tankId = this.tankByToken.get(token);
    if (!tankId || !this.arena) return false;
    return this.arena.applyUpgrade(tankId, upgrade);
  }

  /** Adelanta el mundo un paso. Devuelve true si la partida acaba de terminar. */
  tick(): boolean {
    if (this.status !== 'playing' || !this.arena) return false;

    const bricksBefore = this.countBricks();
    this.arena.tick(ARENA.tickMs);
    if (this.countBricks() !== bricksBefore) this.wallsDirty = true;

    const winner = this.arena.winner();
    if (winner) {
      const player = this.players.find((p) => p.token === winner.playerId);
      this.winner = { name: player?.name ?? 'Alguien', color: winner.color };
      this.status = 'finished';
      return true;
    }

    if (this.arena.everyoneIsDown) {
      // Todos destruidos: no gana nadie, ganan las máquinas.
      this.winner = null;
      this.status = 'finished';
      return true;
    }
    return false;
  }

  private countBricks(): number {
    return this.arena!.walls.reduce(
      (total, row) => total + row.filter((c) => c === 1).length,
      0,
    );
  }

  /** El campo como una cadena de dígitos, para mandarlo compacto. */
  wallsAsText(): string {
    return this.arena!.walls.map((row) => row.join('')).join('');
  }
}

export function hexOf(colorId: string): string {
  return TANK_COLORS.find((c) => c.id === colorId)?.hex ?? CPU_COLOR;
}

function clampChests(count: number): number {
  if (!Number.isFinite(count)) return 2;
  return Math.min(MAX_CHESTS, Math.max(0, Math.round(count)));
}

function clampTanks(count: number): number {
  if (!Number.isFinite(count)) return 4;
  return Math.min(MAX_TANKS, Math.max(MIN_TANKS, Math.round(count)));
}
