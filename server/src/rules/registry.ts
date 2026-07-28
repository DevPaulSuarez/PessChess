import type { RuleEngine } from './engine.js';
import { ChessRules } from './chess.js';
import { DraughtsRules } from './draughts.js';

/**
 * Los juegos que ofrece el servidor.
 *
 * Para añadir uno nuevo: implementar `RuleEngine` y añadir una entrada aquí.
 * No hay que tocar nada más — ni las salas, ni los relojes, ni el
 * emparejamiento, ni la reconexión.
 */
export const GAMES = {
  chess: { name: 'Ajedrez', create: () => new ChessRules() },
  draughts: { name: 'Damas', create: () => new DraughtsRules() },
} as const satisfies Record<string, { name: string; create: () => RuleEngine }>;

export type GameKind = keyof typeof GAMES;

export const GAME_KINDS = Object.keys(GAMES) as GameKind[];

export function isGameKind(value: unknown): value is GameKind {
  return typeof value === 'string' && value in GAMES;
}

export function createEngine(kind: GameKind): RuleEngine {
  return GAMES[kind].create();
}
