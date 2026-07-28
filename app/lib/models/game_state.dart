/// Reflejo en Dart del protocolo definido en `server/src/types.ts`.
///
/// Si cambias algo aquí, cámbialo también allí: son las dos caras del mismo
/// contrato.
library;

/// Los juegos que ofrece el servidor.
///
/// Para añadir uno: una entrada aquí, otra en el registro del servidor, y las
/// formas de sus piezas. El resto —salas, relojes, emparejamiento, reconexión—
/// no hay que tocarlo.
enum GameKind {
  chess(
    code: 'chess',
    name: 'Ajedrez',
    description: 'El de siempre, con jaque mate, enroque y coronación.',
    emoji: '♞',
  ),
  draughts(
    code: 'draughts',
    name: 'Damas',
    description: 'Damas inglesas: comer es obligatorio y al final coronas.',
    emoji: '⛃',
  );

  const GameKind({
    required this.code,
    required this.name,
    required this.description,
    required this.emoji,
  });

  /// Lo que entiende el servidor.
  final String code;
  final String name;
  final String description;
  final String emoji;

  static GameKind fromCode(String code) =>
      GameKind.values.firstWhere((g) => g.code == code, orElse: () => GameKind.chess);
}

enum PieceColor { white, black }

extension PieceColorX on PieceColor {
  String get code => this == PieceColor.white ? 'w' : 'b';
  PieceColor get opposite =>
      this == PieceColor.white ? PieceColor.black : PieceColor.white;
  String get label => this == PieceColor.white ? 'Blancas' : 'Negras';

  static PieceColor fromCode(String code) =>
      code == 'w' ? PieceColor.white : PieceColor.black;
}

enum GameStatus { waiting, active, finished }

GameStatus _statusFrom(String raw) => switch (raw) {
      'active' => GameStatus.active,
      'finished' => GameStatus.finished,
      _ => GameStatus.waiting,
    };

class TimeControl {
  const TimeControl({required this.initialMs, required this.incrementMs});

  final int initialMs;
  final int incrementMs;

  /// Etiqueta corta al estilo del ajedrez: "10+5" son 10 minutos más 5 segundos.
  String get label {
    final minutes = initialMs ~/ 60000;
    final increment = incrementMs ~/ 1000;
    final base = minutes > 0 ? '$minutes' : '${initialMs ~/ 1000}s';
    return increment > 0 ? '$base+$increment' : base;
  }

  Map<String, dynamic> toJson() =>
      {'initialMs': initialMs, 'incrementMs': incrementMs};

  static TimeControl? fromJson(Map<String, dynamic>? json) => json == null
      ? null
      : TimeControl(
          initialMs: json['initialMs'] as int,
          incrementMs: json['incrementMs'] as int,
        );
}

/// Una jugada legal que el servidor autoriza al jugador de turno.
class LegalMove {
  const LegalMove({
    required this.from,
    required this.to,
    required this.san,
    this.promotion,
  });

  final String from;
  final String to;
  final String san;

  /// 'q', 'r', 'b' o 'n' si la jugada corona un peón.
  final String? promotion;

  factory LegalMove.fromJson(Map<String, dynamic> json) => LegalMove(
        from: json['from'] as String,
        to: json['to'] as String,
        san: json['san'] as String,
        promotion: json['promotion'] as String?,
      );
}

class PlayerView {
  const PlayerView({required this.name, required this.connected});

  final String name;
  final bool connected;

  factory PlayerView.fromJson(Map<String, dynamic> json) => PlayerView(
        name: json['name'] as String? ?? '',
        connected: json['connected'] as bool? ?? false,
      );
}

class Move {
  const Move({required this.from, required this.to, required this.san});

  final String from;
  final String to;
  final String san;

  static Move? fromJson(Map<String, dynamic>? json) => json == null
      ? null
      : Move(
          from: json['from'] as String,
          to: json['to'] as String,
          san: json['san'] as String,
        );
}

/// Instantánea completa de la partida, tal y como la manda el servidor.
class GameState {
  GameState({
    required this.gameId,
    required this.game,
    required this.status,
    required this.fen,
    required this.turn,
    required this.yourColor,
    required this.white,
    required this.black,
    required this.timeControl,
    required this.clocks,
    required this.lastMove,
    required this.history,
    required this.inCheck,
    required this.legalMoves,
    required this.drawOfferFrom,
    required this.result,
    required this.endReason,
  });

  final String gameId;

  /// A qué se está jugando en esta sala.
  final GameKind game;

  final GameStatus status;
  final String fen;
  final PieceColor turn;
  final PieceColor yourColor;
  final PlayerView white;
  final PlayerView black;
  final TimeControl? timeControl;

  /// Milisegundos restantes por color. Null si la partida no tiene reloj.
  final Map<PieceColor, int>? clocks;

  final Move? lastMove;
  final List<String> history;
  final bool inCheck;
  final List<LegalMove> legalMoves;
  final PieceColor? drawOfferFrom;
  final String? result;
  final String? endReason;

  bool get isYourTurn => status == GameStatus.active && turn == yourColor;
  PlayerView get you => yourColor == PieceColor.white ? white : black;
  PlayerView get opponent => yourColor == PieceColor.white ? black : white;

  /// Jugadas legales que salen de una casilla concreta.
  List<LegalMove> movesFrom(String square) =>
      legalMoves.where((m) => m.from == square).toList();

  factory GameState.fromJson(Map<String, dynamic> json) {
    final rawClocks = json['clocks'] as Map<String, dynamic>?;
    final rawDrawOffer = json['drawOfferFrom'] as String?;

    return GameState(
      gameId: json['gameId'] as String,
      game: GameKind.fromCode(json['game'] as String? ?? 'chess'),
      status: _statusFrom(json['status'] as String),
      fen: json['fen'] as String,
      turn: PieceColorX.fromCode(json['turn'] as String),
      yourColor: PieceColorX.fromCode(json['yourColor'] as String),
      white: PlayerView.fromJson(
          (json['white'] as Map).cast<String, dynamic>()),
      black: PlayerView.fromJson(
          (json['black'] as Map).cast<String, dynamic>()),
      timeControl: TimeControl.fromJson(
          (json['timeControl'] as Map?)?.cast<String, dynamic>()),
      clocks: rawClocks == null
          ? null
          : {
              PieceColor.white: rawClocks['w'] as int,
              PieceColor.black: rawClocks['b'] as int,
            },
      lastMove: Move.fromJson((json['lastMove'] as Map?)?.cast<String, dynamic>()),
      history: (json['history'] as List).cast<String>(),
      inCheck: json['inCheck'] as bool? ?? false,
      legalMoves: (json['legalMoves'] as List)
          .map((m) => LegalMove.fromJson((m as Map).cast<String, dynamic>()))
          .toList(),
      drawOfferFrom:
          rawDrawOffer == null ? null : PieceColorX.fromCode(rawDrawOffer),
      result: json['result'] as String?,
      endReason: json['endReason'] as String?,
    );
  }

  /// Texto que resume cómo acabó la partida, desde tu punto de vista.
  String get outcomeMessage {
    if (status != GameStatus.finished) return '';

    final reason = switch (endReason) {
      'checkmate' => 'jaque mate',
      'stalemate' => 'rey ahogado',
      'insufficient_material' => 'material insuficiente',
      'threefold_repetition' => 'repetición de jugadas',
      'fifty_move_rule' => 'regla de las 50 jugadas',
      'timeout' => 'se acabó el tiempo',
      'blocked' => 'sin fichas ni jugadas posibles',
      'no_progress' => 'nadie avanzaba',
      'resignation' => 'abandono',
      'draw_agreed' => 'acuerdo entre jugadores',
      'abandoned' => 'partida abandonada',
      _ => '',
    };

    if (result == '1/2-1/2') return 'Tablas por $reason';

    final winner =
        result == '1-0' ? PieceColor.white : PieceColor.black;
    final headline = winner == yourColor ? '¡Has ganado!' : 'Has perdido';
    return '$headline · $reason';
  }
}

/// Credenciales que devuelve el servidor al entrar en una partida.
class JoinInfo {
  const JoinInfo({
    required this.gameId,
    required this.token,
    required this.color,
    required this.code,
  });

  final String gameId;

  /// Se guarda en el dispositivo: es lo que permite volver a la partida.
  final String token;
  final PieceColor color;
  final String code;

  factory JoinInfo.fromJson(Map<String, dynamic> json) => JoinInfo(
        gameId: json['gameId'] as String,
        token: json['token'] as String,
        color: PieceColorX.fromCode(json['color'] as String),
        code: json['code'] as String,
      );
}
