import { Chess } from 'chess.js';
import { randomUUID } from 'node:crypto';
import type {
  Color,
  EndReason,
  GameState,
  GameStatus,
  LegalMove,
  Result,
  TimeControl,
} from './types.js';

export interface Player {
  /** Credencial secreta que identifica a este jugador al reconectar. */
  token: string;
  name: string;
  socketId: string | null;
}

/**
 * Una partida. Contiene el tablero, los dos jugadores y los relojes.
 *
 * El reloj se lleva "en diferido": no se descuenta continuamente, sino que se
 * calcula el tiempo consumido cada vez que hace falta (al mover o al comprobar
 * si alguien se ha quedado sin tiempo). Así no hay temporizadores por partida.
 */
export class Game {
  readonly id: string;
  readonly chess = new Chess();
  readonly timeControl: TimeControl | null;
  readonly createdAt = Date.now();

  white: Player | null = null;
  black: Player | null = null;

  status: GameStatus = 'waiting';
  result: Result | null = null;
  endReason: EndReason | null = null;
  drawOfferFrom: Color | null = null;

  private clocks: { w: number; b: number };
  /** Momento en que empezó a correr el reloj del jugador de turno. */
  private turnStartedAt: number | null = null;

  constructor(id: string, timeControl: TimeControl | null) {
    this.id = id;
    this.timeControl = timeControl;
    this.clocks = {
      w: timeControl?.initialMs ?? 0,
      b: timeControl?.initialMs ?? 0,
    };
  }

  // -------------------------------------------------------------------------
  // Jugadores
  // -------------------------------------------------------------------------

  /** Añade un jugador y devuelve el color que le ha tocado. */
  addPlayer(name: string, socketId: string): { color: Color; token: string } | null {
    // Nadie puede sentarse en los dos lados del tablero: sin esto, una misma
    // conexión podría crear una sala y entrar en ella para jugar contra sí
    // misma, y quedaría con las dos identidades a la vez.
    if (this.playerBySocket(socketId)) return null;

    const player: Player = { token: randomUUID(), name, socketId };

    // El primero en llegar es blancas; podríamos sortearlo, pero para partidas
    // entre amigos es más predecible que quien crea la sala lleve blancas.
    if (!this.white) {
      this.white = player;
      return { color: 'w', token: player.token };
    }
    if (!this.black) {
      this.black = player;
      this.start();
      return { color: 'b', token: player.token };
    }
    return null; // sala llena
  }

  playerByToken(token: string): { color: Color; player: Player } | null {
    if (this.white?.token === token) return { color: 'w', player: this.white };
    if (this.black?.token === token) return { color: 'b', player: this.black };
    return null;
  }

  playerBySocket(socketId: string): { color: Color; player: Player } | null {
    if (this.white?.socketId === socketId) return { color: 'w', player: this.white };
    if (this.black?.socketId === socketId) return { color: 'b', player: this.black };
    return null;
  }

  get isFull(): boolean {
    return this.white !== null && this.black !== null;
  }

  private start(): void {
    this.status = 'active';
    this.turnStartedAt = Date.now();
  }

  // -------------------------------------------------------------------------
  // Reloj
  // -------------------------------------------------------------------------

  /** Milisegundos que le quedan a cada jugador ahora mismo. */
  currentClocks(): { w: number; b: number } | null {
    if (!this.timeControl) return null;
    if (this.status !== 'active' || this.turnStartedAt === null) {
      return { ...this.clocks };
    }
    const turn = this.chess.turn();
    const elapsed = Date.now() - this.turnStartedAt;
    return {
      ...this.clocks,
      [turn]: Math.max(0, this.clocks[turn] - elapsed),
    } as { w: number; b: number };
  }

  /**
   * Comprueba si al jugador de turno se le ha acabado el tiempo y, en tal caso,
   * termina la partida. Devuelve true si la partida ha terminado por esto.
   */
  checkFlag(): boolean {
    if (this.status !== 'active' || !this.timeControl) return false;
    const clocks = this.currentClocks()!;
    const turn = this.chess.turn();
    if (clocks[turn] > 0) return false;

    this.clocks = clocks;
    // Si al rival no le queda material para dar mate, es tablas y no derrota.
    const winnerHasMaterial = this.sideHasMatingMaterial(turn === 'w' ? 'b' : 'w');
    this.finish(
      !winnerHasMaterial ? '1/2-1/2' : turn === 'w' ? '0-1' : '1-0',
      'timeout',
    );
    return true;
  }

  /** ¿Le queda a este color material suficiente para dar mate? */
  private sideHasMatingMaterial(color: Color): boolean {
    const board = this.chess.board().flat();
    let minors = 0;
    for (const square of board) {
      if (!square || square.color !== color) continue;
      if (square.type === 'p' || square.type === 'q' || square.type === 'r') return true;
      if (square.type === 'b' || square.type === 'n') minors++;
    }
    return minors >= 2;
  }

  // -------------------------------------------------------------------------
  // Jugadas
  // -------------------------------------------------------------------------

  /**
   * Intenta hacer una jugada. Devuelve un mensaje de error si no se pudo, o
   * null si todo fue bien.
   */
  move(color: Color, from: string, to: string, promotion?: string): string | null {
    if (this.status !== 'active') return 'La partida no está en juego.';
    if (this.chess.turn() !== color) return 'No es tu turno.';
    if (this.checkFlag()) return 'Se acabó el tiempo.';

    let made;
    try {
      made = this.chess.move({ from, to, promotion: promotion ?? 'q' });
    } catch {
      return 'Jugada ilegal.';
    }
    if (!made) return 'Jugada ilegal.';

    // Descontar lo consumido y sumar el incremento.
    if (this.timeControl && this.turnStartedAt !== null) {
      const elapsed = Date.now() - this.turnStartedAt;
      this.clocks[color] = Math.max(0, this.clocks[color] - elapsed) + this.timeControl.incrementMs;
      this.turnStartedAt = Date.now();
    }

    // Una jugada cancela cualquier oferta de tablas pendiente.
    this.drawOfferFrom = null;
    this.checkGameOver();
    return null;
  }

  private checkGameOver(): void {
    if (!this.chess.isGameOver()) return;

    if (this.chess.isCheckmate()) {
      // El que acaba de recibir el mate es el que tiene el turno.
      this.finish(this.chess.turn() === 'w' ? '0-1' : '1-0', 'checkmate');
    } else if (this.chess.isStalemate()) {
      this.finish('1/2-1/2', 'stalemate');
    } else if (this.chess.isInsufficientMaterial()) {
      this.finish('1/2-1/2', 'insufficient_material');
    } else if (this.chess.isThreefoldRepetition()) {
      this.finish('1/2-1/2', 'threefold_repetition');
    } else {
      this.finish('1/2-1/2', 'fifty_move_rule');
    }
  }

  resign(color: Color): void {
    if (this.status !== 'active') return;
    this.finish(color === 'w' ? '0-1' : '1-0', 'resignation');
  }

  offerDraw(color: Color): void {
    if (this.status !== 'active') return;
    this.drawOfferFrom = color;
  }

  /** Acepta las tablas ofrecidas por el rival. Devuelve true si se aplicaron. */
  acceptDraw(color: Color): boolean {
    if (this.status !== 'active') return false;
    if (this.drawOfferFrom === null || this.drawOfferFrom === color) return false;
    this.finish('1/2-1/2', 'draw_agreed');
    return true;
  }

  declineDraw(color: Color): void {
    if (this.drawOfferFrom !== null && this.drawOfferFrom !== color) {
      this.drawOfferFrom = null;
    }
  }

  private finish(result: Result, reason: EndReason): void {
    this.clocks = this.currentClocks() ?? this.clocks;
    this.status = 'finished';
    this.result = result;
    this.endReason = reason;
    this.turnStartedAt = null;
    this.drawOfferFrom = null;
  }

  // -------------------------------------------------------------------------
  // Instantánea para el cliente
  // -------------------------------------------------------------------------

  /** Construye el estado tal y como lo debe ver el jugador de este color. */
  stateFor(color: Color): GameState {
    const turn = this.chess.turn();
    const isYourTurn = this.status === 'active' && turn === color;

    const legalMoves: LegalMove[] = isYourTurn
      ? this.chess.moves({ verbose: true }).map((m) => ({
          from: m.from,
          to: m.to,
          ...(m.promotion ? { promotion: m.promotion } : {}),
          san: m.san,
        }))
      : [];

    const history = this.chess.history({ verbose: true });
    const last = history[history.length - 1];

    return {
      gameId: this.id,
      status: this.status,
      fen: this.chess.fen(),
      turn,
      yourColor: color,
      white: { name: this.white?.name ?? '', connected: this.white?.socketId != null },
      black: { name: this.black?.name ?? '', connected: this.black?.socketId != null },
      timeControl: this.timeControl,
      clocks: this.currentClocks(),
      lastMove: last ? { from: last.from, to: last.to, san: last.san } : null,
      history: history.map((m) => m.san),
      inCheck: this.chess.inCheck(),
      legalMoves,
      drawOfferFrom: this.drawOfferFrom,
      result: this.result,
      endReason: this.endReason,
    };
  }
}
