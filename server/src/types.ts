/**
 * Protocolo entre el servidor y la app Flutter.
 *
 * Regla de oro: el servidor es la única autoridad. El cliente nunca decide si
 * una jugada es legal ni cuánto tiempo le queda a nadie; solo dibuja lo que el
 * servidor le manda y pide mover.
 */

import type { GameKind } from './rules/registry.js';

export type { GameKind };

export type Color = 'w' | 'b';

export type GameStatus = 'waiting' | 'active' | 'finished';

/** Motivo por el que terminó la partida. */
export type EndReason =
  // Comunes a varios juegos.
  | 'timeout'
  | 'resignation'
  | 'draw_agreed'
  | 'abandoned'
  // Ajedrez.
  | 'checkmate'
  | 'stalemate'
  | 'insufficient_material'
  | 'threefold_repetition'
  | 'fifty_move_rule'
  // Damas.
  | 'blocked'
  | 'no_progress'
  // Reversi.
  | 'final_count';

/** '1-0' blancas ganan, '0-1' negras ganan, '1/2-1/2' tablas. */
export type Result = '1-0' | '0-1' | '1/2-1/2';

export interface TimeControl {
  /** Tiempo inicial por jugador, en milisegundos. */
  initialMs: number;
  /** Segundos que se suman tras cada jugada, en milisegundos. */
  incrementMs: number;
}

/** Una jugada legal, tal y como la manda el servidor al jugador de turno. */
export interface LegalMove {
  from: string;
  to: string;
  /** Presente solo si la jugada corona un peón: 'q' | 'r' | 'b' | 'n'. */
  promotion?: string;
  san: string;
}

export interface PlayerView {
  name: string;
  connected: boolean;
}

/** Instantánea completa de la partida. Se manda entera en cada cambio. */
export interface GameState {
  gameId: string;
  /** A qué se está jugando: 'chess', 'draughts'… */
  game: GameKind;
  status: GameStatus;
  fen: string;
  turn: Color;
  /** Color del jugador que recibe este mensaje. */
  yourColor: Color;
  white: PlayerView;
  black: PlayerView;
  timeControl: TimeControl | null;
  /** Milisegundos restantes. Null si la partida es sin reloj. */
  clocks: { w: number; b: number } | null;
  lastMove: { from: string; to: string; san: string } | null;
  /** Historial en notación algebraica: ['e4', 'e5', 'Cf3', ...]. */
  history: string[];
  inCheck: boolean;
  /** Jugadas legales del jugador que recibe el mensaje. Vacío si no es su turno. */
  legalMoves: LegalMove[];
  /** Color que ha ofrecido tablas y espera respuesta, si lo hay. */
  drawOfferFrom: Color | null;
  result: Result | null;
  endReason: EndReason | null;
}

// ---------------------------------------------------------------------------
// Cliente -> Servidor
// ---------------------------------------------------------------------------

export interface CreateRoomPayload {
  name: string;
  game: GameKind;
  timeControl: TimeControl | null;
}

export interface JoinRoomPayload {
  name: string;
  code: string;
}

export interface QuickMatchPayload {
  name: string;
  game: GameKind;
  timeControl: TimeControl | null;
}

export interface MovePayload {
  from: string;
  to: string;
  promotion?: string;
}

/** Para volver a una partida tras cerrar la app o perder la conexión. */
export interface ResumePayload {
  gameId: string;
  token: string;
}

// ---------------------------------------------------------------------------
// Servidor -> Cliente
// ---------------------------------------------------------------------------

/** Confirma que estás en una partida y te da la credencial para reconectar. */
export interface JoinedPayload {
  gameId: string;
  /** Guardar en el dispositivo: es lo que te devuelve a esta partida. */
  token: string;
  color: Color;
  /** Código para compartir con el rival mientras esperas. */
  code: string;
}

export interface ErrorPayload {
  code: 'room_not_found' | 'room_full' | 'bad_move' | 'not_your_turn' | 'no_game' | 'bad_request';
  message: string;
}
