import { Game } from './game.js';
import type { TimeControl } from './types.js';
import type { GameKind } from './rules/registry.js';

/** Sin I, O, 0 ni 1: en pantalla se confunden y el código se dicta en voz alta. */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 4;

/** Una partida terminada se guarda un rato por si alguien recarga la app. */
const FINISHED_TTL_MS = 10 * 60 * 1000;
/** Una sala que nadie llegó a ocupar se descarta pasado este tiempo. */
const ABANDONED_TTL_MS = 30 * 60 * 1000;

interface QueueEntry {
  socketId: string;
  name: string;
  game: GameKind;
  timeControl: TimeControl | null;
}

export class GameManager {
  private games = new Map<string, Game>();
  /** Cola de emparejamiento rápido, agrupada por ritmo de juego. */
  private queue: QueueEntry[] = [];

  create(kind: GameKind, timeControl: TimeControl | null): Game {
    const game = new Game(this.freshCode(), kind, timeControl);
    this.games.set(game.id, game);
    return game;
  }

  get(code: string): Game | undefined {
    return this.games.get(code.toUpperCase().trim());
  }

  /**
   * Busca rival en la cola para este ritmo de juego. Si hay alguien esperando,
   * devuelve su partida; si no, crea una y deja al jugador en espera.
   */
  enqueue(entry: QueueEntry): Game | null {
    // Solo se emparejan quienes piden el mismo juego y el mismo ritmo.
    const key = queueKey(entry);
    const index = this.queue.findIndex(
      (q) => queueKey(q) === key && q.socketId !== entry.socketId,
    );

    if (index === -1) {
      // Nadie compatible esperando: entra en la cola.
      this.leaveQueue(entry.socketId);
      this.queue.push(entry);
      return null;
    }

    const [opponent] = this.queue.splice(index, 1);
    const game = this.create(entry.game, entry.timeControl);
    game.addPlayer(opponent.name, opponent.socketId);
    return game;
  }

  leaveQueue(socketId: string): void {
    this.queue = this.queue.filter((q) => q.socketId !== socketId);
  }

  /** Todas las partidas en las que participa este socket. */
  gamesForSocket(socketId: string): Game[] {
    return [...this.games.values()].filter((g) => g.playerBySocket(socketId) !== null);
  }

  /** Partidas activas con reloj, para comprobar si a alguien se le acabó el tiempo. */
  activeTimedGames(): Game[] {
    return [...this.games.values()].filter(
      (g) => g.status === 'active' && g.timeControl !== null,
    );
  }

  /** Libera partidas terminadas hace rato y salas que nadie llegó a usar. */
  sweep(): void {
    const now = Date.now();
    for (const [code, game] of this.games) {
      const finishedLongAgo =
        game.status === 'finished' && now - game.createdAt > FINISHED_TTL_MS;
      const neverStarted =
        game.status === 'waiting' && now - game.createdAt > ABANDONED_TTL_MS;
      if (finishedLongAgo || neverStarted) this.games.delete(code);
    }
  }

  get stats() {
    return { games: this.games.size, queued: this.queue.length };
  }

  private freshCode(): string {
    for (let attempt = 0; attempt < 100; attempt++) {
      let code = '';
      for (let i = 0; i < CODE_LENGTH; i++) {
        code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
      }
      if (!this.games.has(code)) return code;
    }
    // Con 32^4 ≈ un millón de combinaciones esto no debería pasar nunca, pero
    // más vale un código largo que un bucle infinito.
    return `${Date.now().toString(36).toUpperCase()}`;
  }
}

/** Dos jugadores solo se emparejan si piden el mismo juego y el mismo ritmo. */
function queueKey(entry: QueueEntry): string {
  const tc = entry.timeControl;
  return `${entry.game}:${tc ? `${tc.initialMs}+${tc.incrementMs}` : 'unlimited'}`;
}
