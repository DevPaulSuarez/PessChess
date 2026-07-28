import type { Color, EndReason, Result } from '../types.js';

/**
 * Todo lo que el servidor necesita saber de un juego de tablero para poder
 * arbitrarlo. Las salas, los códigos, los relojes, el emparejamiento y la
 * reconexión no saben de qué juego se trata: solo hablan con esta interfaz.
 *
 * Para añadir un juego nuevo basta con implementarla y anotarlo en el registro.
 */
export interface RuleEngine {
  /**
   * Posición actual en notación FEN.
   *
   * Se usa el mismo formato para todos los juegos aunque no sea ajedrez: la
   * app ya sabe leerlo y le ahorra tener un formato por juego. Cada juego
   * decide qué letra usa para cada pieza.
   */
  fen(): string;

  /** A quién le toca mover. */
  turn(): Color;

  /** Jugadas permitidas ahora mismo al jugador de turno. */
  legalMoves(): EngineMove[];

  /** Intenta mover. Devuelve la jugada hecha, o null si no era legal. */
  move(from: string, to: string, promotion?: string): EngineMove | null;

  /** Las jugadas hechas hasta ahora, en la notación propia del juego. */
  history(): string[];

  /** Cómo terminó la partida, o null si sigue en juego. */
  outcome(): { result: Result; reason: EndReason } | null;

  /**
   * Si el jugador de turno está en una situación que conviene destacar en el
   * tablero. En ajedrez es el jaque; en damas no existe y siempre es false.
   */
  inCheck(): boolean;

  /**
   * Si a este bando le queda material suficiente para poder ganar. Se usa
   * cuando al rival se le acaba el tiempo: si no puedes ganar de ninguna
   * forma, la partida son tablas en vez de victoria tuya.
   */
  canStillWin(color: Color): boolean;
}

export interface EngineMove {
  from: string;
  to: string;
  /** Presente solo si la jugada corona. */
  promotion?: string;
  /** La jugada escrita como la escribiría un jugador de ese juego. */
  san: string;
}
