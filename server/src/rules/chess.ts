import { Chess } from 'chess.js';

import type { Color, EndReason, Result } from '../types.js';
import type { EngineMove, RuleEngine } from './engine.js';

/** Ajedrez, apoyado en chess.js para las reglas. */
export class ChessRules implements RuleEngine {
  private readonly chess = new Chess();

  fen(): string {
    return this.chess.fen();
  }

  turn(): Color {
    return this.chess.turn();
  }

  legalMoves(): EngineMove[] {
    return this.chess.moves({ verbose: true }).map((m) => ({
      from: m.from,
      to: m.to,
      ...(m.promotion ? { promotion: m.promotion } : {}),
      san: m.san,
    }));
  }

  move(from: string, to: string, promotion?: string): EngineMove | null {
    try {
      // Sin indicar pieza, coronar da dama: es lo que quiere casi todo el mundo
      // y la app pregunta antes cuando hay elección.
      const made = this.chess.move({ from, to, promotion: promotion ?? 'q' });
      if (!made) return null;
      return {
        from: made.from,
        to: made.to,
        ...(made.promotion ? { promotion: made.promotion } : {}),
        san: made.san,
      };
    } catch {
      return null;
    }
  }

  history(): string[] {
    return this.chess.history();
  }

  inCheck(): boolean {
    return this.chess.inCheck();
  }

  outcome(): { result: Result; reason: EndReason } | null {
    if (!this.chess.isGameOver()) return null;

    if (this.chess.isCheckmate()) {
      // Quien tiene el turno es el que acaba de recibir el mate.
      return {
        result: this.chess.turn() === 'w' ? '0-1' : '1-0',
        reason: 'checkmate',
      };
    }
    if (this.chess.isStalemate()) return { result: '1/2-1/2', reason: 'stalemate' };
    if (this.chess.isInsufficientMaterial()) {
      return { result: '1/2-1/2', reason: 'insufficient_material' };
    }
    if (this.chess.isThreefoldRepetition()) {
      return { result: '1/2-1/2', reason: 'threefold_repetition' };
    }
    return { result: '1/2-1/2', reason: 'fifty_move_rule' };
  }

  /** Con rey solo, o rey y una pieza menor, no se puede dar mate. */
  canStillWin(color: Color): boolean {
    let minors = 0;
    for (const square of this.chess.board().flat()) {
      if (!square || square.color !== color) continue;
      if (square.type === 'p' || square.type === 'q' || square.type === 'r') return true;
      if (square.type === 'b' || square.type === 'n') minors++;
    }
    return minors >= 2;
  }
}
