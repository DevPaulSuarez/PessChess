import type { Color, EndReason, Result } from '../types.js';
import type { EngineMove, RuleEngine } from './engine.js';

/**
 * Damas inglesas (o americanas), que son las que se juegan en Perú.
 *
 * Reglas:
 *  - Tablero de 8x8, doce fichas por bando, solo sobre las casillas negras.
 *  - El peón avanza y come **solo hacia adelante**, en diagonal.
 *  - Al llegar a la última fila se corona y pasa a ser dama, que se mueve y
 *    come una casilla en las cuatro diagonales.
 *  - Comer es **obligatorio**. Si hay varias formas de comer se puede elegir
 *    cualquiera; no hay que comer la mayor cantidad posible (eso es de las
 *    damas españolas).
 *  - Si tras comer se puede volver a comer con la misma ficha, hay que seguir.
 *  - Coronar termina el turno, aunque se pudiera seguir comiendo.
 *  - Pierde quien se queda sin fichas o sin ninguna jugada posible.
 */
export class DraughtsRules implements RuleEngine {
  /** Qué hay en cada casilla, por ejemplo 'c3' -> peón blanco. */
  private board = new Map<string, Ficha>();
  private toMove: Color = 'w';
  private moves: string[] = [];

  /**
   * Casilla desde la que hay que seguir comiendo con la misma ficha. Mientras
   * tenga valor, es el único sitio desde el que se puede jugar.
   */
  private chain: string | null = null;

  /**
   * Jugadas seguidas sin comer ni coronar. Sin esto, dos damas podrían
   * perseguirse eternamente y la partida no acabaría nunca.
   */
  private idleMoves = 0;
  private static readonly IDLE_LIMIT = 80; // 40 jugadas de cada bando

  private ended: { result: Result; reason: EndReason } | null = null;

  constructor() {
    // Las blancas ocupan las tres primeras filas y suben; las negras bajan.
    for (const square of darkSquares()) {
      const rank = rankOf(square);
      if (rank <= 3) this.board.set(square, { color: 'w', king: false });
      if (rank >= 6) this.board.set(square, { color: 'b', king: false });
    }
  }

  /**
   * Monta una posición concreta en vez de la inicial.
   *
   * Cada casilla lleva una letra: 'P' peón blanco, 'p' peón negro, 'K' dama
   * blanca, 'k' dama negra. Se usa en las pruebas, para poder plantear finales
   * sin tener que llegar a ellos jugando veinte movimientos.
   */
  static fromPosition(
    pieces: Record<string, 'P' | 'p' | 'K' | 'k'>,
    turn: Color = 'w',
  ): DraughtsRules {
    const rules = new DraughtsRules();
    rules.board = new Map(
      Object.entries(pieces).map(([square, letter]) => [
        square,
        {
          color: letter === letter.toUpperCase() ? 'w' : 'b',
          king: letter.toLowerCase() === 'k',
        },
      ]),
    );
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
        const piece = this.board.get(squareAt(file, rank));
        if (!piece) {
          empty++;
          continue;
        }
        if (empty > 0) {
          row += empty;
          empty = 0;
        }
        // Se reutilizan las letras del ajedrez para no inventar otro formato:
        // 'p' es peón y 'k' es dama; mayúscula para las blancas.
        const letter = piece.king ? 'k' : 'p';
        row += piece.color === 'w' ? letter.toUpperCase() : letter;
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
    return false; // en damas no hay nada equivalente al jaque
  }

  /** Mientras queden fichas se puede ganar. */
  canStillWin(color: Color): boolean {
    for (const piece of this.board.values()) {
      if (piece.color === color) return true;
    }
    return false;
  }

  outcome(): { result: Result; reason: EndReason } | null {
    return this.ended;
  }

  history(): string[] {
    return [...this.moves];
  }

  // -------------------------------------------------------------------------
  // Generación de jugadas
  // -------------------------------------------------------------------------

  legalMoves(): EngineMove[] {
    if (this.ended) return [];

    // A media cadena de capturas, solo se puede seguir con esa misma ficha.
    if (this.chain) return this.capturesFrom(this.chain);

    const captures: EngineMove[] = [];
    const quiet: EngineMove[] = [];

    for (const [square, piece] of this.board) {
      if (piece.color !== this.toMove) continue;
      captures.push(...this.capturesFrom(square));
      quiet.push(...this.quietMovesFrom(square));
    }

    // Comer es obligatorio: si se puede, no hay más opciones.
    return captures.length > 0 ? captures : quiet;
  }

  /** Direcciones en las que puede actuar una ficha. */
  private directions(piece: Ficha): Array<[number, number]> {
    const forward = piece.color === 'w' ? 1 : -1;
    if (piece.king) {
      return [
        [1, 1],
        [-1, 1],
        [1, -1],
        [-1, -1],
      ];
    }
    return [
      [1, forward],
      [-1, forward],
    ];
  }

  private quietMovesFrom(from: string): EngineMove[] {
    const piece = this.board.get(from);
    if (!piece) return [];

    const moves: EngineMove[] = [];
    for (const [df, dr] of this.directions(piece)) {
      const to = shift(from, df, dr);
      if (to && !this.board.has(to)) {
        moves.push({ from, to, san: `${from}-${to}` });
      }
    }
    return moves;
  }

  private capturesFrom(from: string): EngineMove[] {
    const piece = this.board.get(from);
    if (!piece) return [];

    const moves: EngineMove[] = [];
    for (const [df, dr] of this.directions(piece)) {
      const jumped = shift(from, df, dr);
      const landing = shift(from, df * 2, dr * 2);
      if (!jumped || !landing) continue;

      const victim = this.board.get(jumped);
      if (!victim || victim.color === piece.color) continue;
      if (this.board.has(landing)) continue;

      moves.push({ from, to: landing, san: `${from}x${landing}` });
    }
    return moves;
  }

  // -------------------------------------------------------------------------
  // Aplicar una jugada
  // -------------------------------------------------------------------------

  move(from: string, to: string): EngineMove | null {
    if (this.ended) return null;

    const chosen = this.legalMoves().find((m) => m.from === from && m.to === to);
    if (!chosen) return null;

    const piece = this.board.get(from)!;
    const isCapture = chosen.san.includes('x');

    this.board.delete(from);
    if (isCapture) {
      // La ficha comida está justo entre la casilla de salida y la de llegada.
      this.board.delete(midpoint(from, to));
    }
    this.board.set(to, piece);

    // Coronar. En damas inglesas coronar termina el turno aunque se pudiera
    // seguir comiendo, así que se corta la cadena.
    const lastRank = piece.color === 'w' ? 8 : 1;
    const promoted = !piece.king && rankOf(to) === lastRank;
    if (promoted) piece.king = true;

    this.moves.push(chosen.san + (promoted ? '=D' : ''));

    // ¿Hay que seguir comiendo con la misma ficha?
    const continues = isCapture && !promoted && this.capturesFrom(to).length > 0;
    this.chain = continues ? to : null;

    this.idleMoves = isCapture || promoted ? 0 : this.idleMoves + 1;

    if (!continues) {
      this.toMove = this.toMove === 'w' ? 'b' : 'w';
      this.checkEnd();
    }

    return chosen;
  }

  private checkEnd(): void {
    // Quien no puede mover, pierde: da igual si es por quedarse sin fichas o
    // por tenerlas todas bloqueadas.
    if (this.legalMoves().length === 0) {
      this.ended = {
        result: this.toMove === 'w' ? '0-1' : '1-0',
        reason: 'blocked',
      };
      return;
    }

    if (this.idleMoves >= DraughtsRules.IDLE_LIMIT) {
      this.ended = { result: '1/2-1/2', reason: 'no_progress' };
    }
  }
}

interface Ficha {
  color: Color;
  king: boolean;
}

// ---------------------------------------------------------------------------
// Utilidades de casillas
// ---------------------------------------------------------------------------

function squareAt(file: number, rank: number): string {
  return `${String.fromCharCode(97 + file)}${rank}`;
}

function fileOf(square: string): number {
  return square.charCodeAt(0) - 97;
}

function rankOf(square: string): number {
  return Number(square.slice(1));
}

/** La casilla que está a tantas columnas y filas de distancia, si existe. */
function shift(square: string, df: number, dr: number): string | null {
  const file = fileOf(square) + df;
  const rank = rankOf(square) + dr;
  if (file < 0 || file > 7 || rank < 1 || rank > 8) return null;
  return squareAt(file, rank);
}

/** La casilla que queda entre otras dos separadas por un salto. */
function midpoint(from: string, to: string): string {
  return squareAt((fileOf(from) + fileOf(to)) / 2, (rankOf(from) + rankOf(to)) / 2);
}

/** Las casillas negras, que son las únicas que se usan. La a1 es negra. */
function darkSquares(): string[] {
  const squares: string[] = [];
  for (let rank = 1; rank <= 8; rank++) {
    for (let file = 0; file < 8; file++) {
      if ((file + rank) % 2 === 1) squares.push(squareAt(file, rank));
    }
  }
  return squares;
}
