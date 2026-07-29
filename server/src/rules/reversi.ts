import type { Color, EndReason, Result } from '../types.js';
import type { EngineMove, RuleEngine } from './engine.js';

/**
 * Reversi (Othello).
 *
 * Reglas:
 *  - Tablero de 8x8. Se empieza con cuatro fichas cruzadas en el centro.
 *  - No se mueve nada: en cada turno se **coloca** una ficha en una casilla
 *    vacía, y por eso las jugadas salen y llegan a la misma casilla.
 *  - La casilla vale si encierra fichas del rival entre la que colocas y otra
 *    tuya, en línea recta: horizontal, vertical o diagonal. Todas las fichas
 *    encerradas cambian de color, en todas las direcciones a la vez.
 *  - Colocar donde no se le da la vuelta a nada no es una jugada.
 *  - Quien no tiene ninguna casilla válida **pasa**, y vuelve a jugar el rival.
 *  - La partida acaba cuando ninguno de los dos puede colocar (casi siempre,
 *    con el tablero lleno). Gana quien tenga más fichas; empate si hay tantas.
 *
 * Empiezan las blancas, en vez de las negras como en el Othello de torneo. La
 * posición inicial es simétrica, así que es el mismo juego con los colores
 * cambiados, y en toda la app mueve primero quien lleva blancas.
 */
export class ReversiRules implements RuleEngine {
  /** Solo el color: aquí todas las fichas son iguales. */
  private board = new Map<string, Color>();
  private toMove: Color = 'w';
  private moves: string[] = [];
  private ended: { result: Result; reason: EndReason } | null = null;

  constructor() {
    this.board.set('d4', 'w');
    this.board.set('e5', 'w');
    this.board.set('d5', 'b');
    this.board.set('e4', 'b');
  }

  /**
   * Monta una posición dibujándola, fila 8 arriba y fila 1 abajo: 'W' ficha
   * blanca, 'B' negra y '.' casilla vacía. Se usa en las pruebas, donde ver el
   * tablero importa más que la lista de casillas.
   */
  static fromDiagram(rows: string[], turn: Color = 'w'): ReversiRules {
    const rules = new ReversiRules();
    rules.board = new Map();

    rows.forEach((row, index) => {
      const rank = 8 - index;
      [...row].forEach((cell, file) => {
        if (cell === 'W') rules.board.set(squareAt(file, rank), 'w');
        if (cell === 'B') rules.board.set(squareAt(file, rank), 'b');
      });
    });

    rules.toMove = turn;
    return rules;
  }

  // -------------------------------------------------------------------------

  fen(): string {
    const rows: string[] = [];
    for (let rank = 8; rank >= 1; rank--) {
      let row = '';
      let empty = 0;
      for (let file = 0; file < 8; file++) {
        const disc = this.board.get(squareAt(file, rank));
        if (!disc) {
          empty++;
          continue;
        }
        if (empty > 0) {
          row += empty;
          empty = 0;
        }
        // Se reutiliza la letra del peón para no inventar otro formato: la app
        // ya sabe leer un FEN, y en reversi solo hay un tipo de ficha.
        row += disc === 'w' ? 'P' : 'p';
      }
      if (empty > 0) row += empty;
      rows.push(row);
    }
    return `${rows.join('/')} ${this.toMove} - - 0 ${Math.floor(this.moves.length / 2) + 1}`;
  }

  turn(): Color {
    return this.toMove;
  }

  inCheck(): boolean {
    return false; // en reversi no hay nada equivalente al jaque
  }

  /**
   * Sin ninguna ficha sobre el tablero no hay forma de volver a colocar, porque
   * toda jugada necesita cerrar la línea contra una ficha propia.
   */
  canStillWin(color: Color): boolean {
    return this.count(color) > 0;
  }

  outcome(): { result: Result; reason: EndReason } | null {
    return this.ended;
  }

  history(): string[] {
    return [...this.moves];
  }

  /** Fichas de un color sobre el tablero. Es el marcador de la partida. */
  count(color: Color): number {
    let total = 0;
    for (const disc of this.board.values()) {
      if (disc === color) total++;
    }
    return total;
  }

  // -------------------------------------------------------------------------
  // Generación de jugadas
  // -------------------------------------------------------------------------

  legalMoves(): EngineMove[] {
    if (this.ended) return [];
    return this.movesFor(this.toMove);
  }

  private movesFor(color: Color): EngineMove[] {
    const moves: EngineMove[] = [];
    for (let rank = 1; rank <= 8; rank++) {
      for (let file = 0; file < 8; file++) {
        const square = squareAt(file, rank);
        if (this.board.has(square)) continue;
        if (this.flips(square, color).length === 0) continue;
        // La jugada es la casilla misma, así que sale y llega al mismo sitio.
        moves.push({ from: square, to: square, san: square });
      }
    }
    return moves;
  }

  /** Las fichas que cambiarían de color al colocar en esa casilla. */
  private flips(square: string, color: Color): string[] {
    const flipped: string[] = [];

    for (const [df, dr] of DIRECTIONS) {
      const enclosed: string[] = [];

      for (let step = 1; ; step++) {
        const next = shift(square, df * step, dr * step);
        if (!next) break; // el borde: la línea no cierra

        const occupant = this.board.get(next);
        if (!occupant) break; // un hueco: tampoco cierra

        if (occupant !== color) {
          enclosed.push(next);
          continue;
        }
        // Ficha propia: se le da la vuelta a todo lo que haya quedado en medio.
        flipped.push(...enclosed);
        break;
      }
    }

    return flipped;
  }

  // -------------------------------------------------------------------------
  // Aplicar una jugada
  // -------------------------------------------------------------------------

  move(from: string, to: string): EngineMove | null {
    if (this.ended) return null;
    // Colocar no es recorrer: si vienen dos casillas distintas, el cliente no
    // está jugando a esto.
    if (from !== to) return null;

    const flipped = this.flips(to, this.toMove);
    if (flipped.length === 0) return null;

    this.board.set(to, this.toMove);
    for (const square of flipped) this.board.set(square, this.toMove);

    this.moves.push(to);
    this.advance();

    return { from: to, to, san: to };
  }

  /**
   * Pasa el turno al rival, saltándoselo si no tiene dónde colocar, y termina
   * la partida si no puede jugar ninguno de los dos.
   */
  private advance(): void {
    const rival = other(this.toMove);

    if (this.movesFor(rival).length > 0) {
      this.toMove = rival;
      return;
    }

    if (this.movesFor(this.toMove).length > 0) {
      // El rival pasa y repite quien acaba de jugar. Queda anotado para que se
      // entienda por qué el historial tiene dos jugadas seguidas del mismo.
      this.moves.push('paso');
      return;
    }

    this.finish();
  }

  private finish(): void {
    const white = this.count('w');
    const black = this.count('b');

    this.ended = {
      result: white > black ? '1-0' : black > white ? '0-1' : '1/2-1/2',
      reason: 'final_count',
    };
  }
}

const DIRECTIONS: Array<[number, number]> = [
  [0, 1],
  [0, -1],
  [1, 0],
  [-1, 0],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

// ---------------------------------------------------------------------------
// Utilidades de casillas
// ---------------------------------------------------------------------------

function other(color: Color): Color {
  return color === 'w' ? 'b' : 'w';
}

function squareAt(file: number, rank: number): string {
  return `${String.fromCharCode(97 + file)}${rank}`;
}

/** La casilla que está a tantas columnas y filas de distancia, si existe. */
function shift(square: string, df: number, dr: number): string | null {
  const file = square.charCodeAt(0) - 97 + df;
  const rank = Number(square.slice(1)) + dr;
  if (file < 0 || file > 7 || rank < 1 || rank > 8) return null;
  return squareAt(file, rank);
}
