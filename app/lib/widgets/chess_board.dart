import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../models/game_state.dart';
import 'piece_shapes.dart';

/// Una pieza sobre el tablero.
class Piece {
  const Piece(this.type, this.color);

  /// 'k', 'q', 'r', 'b', 'n' o 'p'.
  final String type;
  final PieceColor color;
}

/// Lee la posición a partir de un FEN y devuelve qué hay en cada casilla.
///
/// Del FEN solo interesa el primer campo: el resto (turno, enroques, etc.) ya
/// nos lo dice el servidor por separado.
Map<String, Piece> parseFen(String fen) {
  final pieces = <String, Piece>{};
  final rows = fen.split(' ').first.split('/');

  for (var rankIndex = 0; rankIndex < rows.length; rankIndex++) {
    final rank = 8 - rankIndex; // el FEN empieza por la fila 8
    var file = 0;

    for (final char in rows[rankIndex].split('')) {
      final emptySquares = int.tryParse(char);
      if (emptySquares != null) {
        file += emptySquares;
        continue;
      }
      final square = '${String.fromCharCode(97 + file)}$rank';
      final color = char == char.toUpperCase() ? PieceColor.white : PieceColor.black;
      pieces[square] = Piece(char.toLowerCase(), color);
      file++;
    }
  }
  return pieces;
}

class BoardColors {
  const BoardColors._();

  static const light = Color(0xFFFFFFFF);
  static const dark = Color(0xFF111111);
  static const lastMove = Color(0x99F2D06B);
  static const selected = Color(0x9962C46B);
  static const check = Color(0xCCE24A4A);

  /// Las marcas de destino tienen que verse sobre los dos colores de casilla,
  /// así que cada una lleva el contrario del suelo que pisa.
  static const hintOnLight = Color(0x59000000);
  static const hintOnDark = Color(0x73FFFFFF);

  /// El reversi se juega sobre paño verde, no sobre casillas blancas y negras:
  /// con las fichas blancas y negras, un tablero a cuadros las escondería.
  static const feltLight = Color(0xFF2E7D55);
  static const feltDark = Color(0xFF27694A);

  static Color square(GameKind game, bool isLight) {
    if (game == GameKind.reversi) return isLight ? feltLight : feltDark;
    return isLight ? light : dark;
  }

  /// Color de las coordenadas del borde, legible sobre la casilla que sea.
  static Color label(GameKind game, bool isLight) {
    if (game == GameKind.reversi) return const Color(0x99FFFFFF);
    return isLight ? dark : light;
  }

  static Color hint(GameKind game, bool isLight) {
    if (game == GameKind.reversi) return hintOnDark;
    return isLight ? hintOnLight : hintOnDark;
  }
}

/// El tablero interactivo.
///
/// No sabe nada de reglas de ajedrez: se limita a pintar la posición que le
/// llega y a ofrecer como destinos las jugadas que el servidor ha autorizado.
class ChessBoard extends StatefulWidget {
  const ChessBoard({
    super.key,
    required this.state,
    required this.onMove,
    required this.askPromotion,
  });

  final GameState state;

  /// Se llama cuando el jugador elige una jugada completa y legal.
  final void Function(String from, String to, String? promotion) onMove;

  /// Pregunta al jugador a qué pieza corona. Devuelve null si se arrepiente.
  final Future<String?> Function() askPromotion;

  @override
  State<ChessBoard> createState() => _ChessBoardState();
}

class _ChessBoardState extends State<ChessBoard> {
  String? _selected;

  @override
  void didUpdateWidget(ChessBoard oldWidget) {
    super.didUpdateWidget(oldWidget);
    // Al cambiar la posición, la selección anterior ya no tiene sentido.
    if (oldWidget.state.fen != widget.state.fen) _selected = null;
  }

  GameState get _state => widget.state;

  /// El tablero se ve siempre desde el lado del jugador.
  bool get _flipped => _state.yourColor == PieceColor.black;

  /// Permite enrocar tocando la torre, además de la casilla del rey.
  ///
  /// Para el servidor el enroque es siempre un movimiento del rey dos casillas
  /// (e1 a g1), y tocar la torre lo rechazaría. Pero tocar la torre es el gesto
  /// que espera casi todo el mundo, así que aquí se traduce: la casilla de la
  /// torre lleva a la jugada de enroque que le corresponde.
  Map<String, LegalMove> _castlingByRook(String from) {
    final byRook = <String, LegalMove>{};
    for (final move in _state.movesFrom(from)) {
      final rank = move.to.substring(1);
      if (move.san == 'O-O') byRook['h$rank'] = move;
      if (move.san == 'O-O-O') byRook['a$rank'] = move;
    }
    return byRook;
  }

  Future<void> _handleTap(String square, Map<String, Piece> pieces) async {
    if (!_state.isYourTurn) return;

    // Si lo que toca es colocar, la jugada es la casilla misma: se juega al
    // primer toque y no hay nada que seleccionar antes.
    final placements = _state.placements;
    if (placements.isNotEmpty) {
      if (placements.contains(square)) widget.onMove(square, square, null);
      return;
    }

    // ¿Es un destino válido de la pieza ya seleccionada?
    if (_selected != null) {
      final candidates = _state
          .movesFrom(_selected!)
          .where((m) => m.to == square)
          .toList();

      if (candidates.isNotEmpty) {
        final from = _selected!;
        setState(() => _selected = null);

        // Varias jugadas al mismo destino solo pasa al coronar un peón.
        String? promotion;
        if (candidates.length > 1 || candidates.first.promotion != null) {
          promotion = await widget.askPromotion();
          if (promotion == null) return; // se arrepintió
        }
        widget.onMove(from, square, promotion);
        return;
      }

      // ¿Han tocado la torre para enrocar?
      final castling = _castlingByRook(_selected!)[square];
      if (castling != null) {
        final from = _selected!;
        setState(() => _selected = null);
        widget.onMove(from, castling.to, null);
        return;
      }
    }

    // Si no, seleccionar la pieza propia que haya en la casilla.
    final piece = pieces[square];
    final isOwnPiece = piece != null && piece.color == _state.yourColor;
    setState(() => _selected = isOwnPiece && square != _selected ? square : null);
  }

  /// Casilla del rey propio, para marcarla cuando está en jaque.
  String? _checkedKingSquare(Map<String, Piece> pieces) {
    if (!_state.inCheck) return null;
    for (final entry in pieces.entries) {
      if (entry.value.type == 'k' && entry.value.color == _state.turn) {
        return entry.key;
      }
    }
    return null;
  }

  @override
  Widget build(BuildContext context) {
    final pieces = parseFen(_state.fen);
    final placements = _state.placements;

    // Las colocaciones se marcan siempre, sin tocar nada antes: no salen de
    // ninguna pieza, así que no habría forma de descubrirlas.
    final Set<String> destinations;
    if (placements.isNotEmpty) {
      destinations = placements;
    } else if (_selected == null) {
      destinations = const {};
    } else {
      destinations = {
        ..._state.movesFrom(_selected!).map((m) => m.to),
        // La torre con la que se puede enrocar también se marca, para que se
        // vea que tocarla vale.
        ..._castlingByRook(_selected!).keys,
      };
    }
    final checkedKing = _checkedKingSquare(pieces);
    final lastMove = _state.lastMove;

    return AspectRatio(
      aspectRatio: 1,
      child: LayoutBuilder(
        builder: (context, constraints) {
          // El lado más corto manda: con solo el ancho, un hueco más bajo que
          // ancho haría que el tablero se saliese por abajo.
          final side = math.min(constraints.maxWidth, constraints.maxHeight);
          final squareSize = side / 8;

          final grid = Column(
            mainAxisSize: MainAxisSize.min,
            children: List.generate(8, (row) {
              return Row(
                mainAxisSize: MainAxisSize.min,
                children: List.generate(8, (col) {
                  // Con el tablero girado, la fila 0 es la 1 y no la 8.
                  final rank = _flipped ? row + 1 : 8 - row;
                  final fileIndex = _flipped ? 7 - col : col;
                  final square = '${String.fromCharCode(97 + fileIndex)}$rank';

                  return _Square(
                    // Permite señalar una casilla por su nombre desde las
                    // pruebas, sin depender de su posición en pantalla.
                    key: ValueKey('square-$square'),
                    size: squareSize,
                    game: _state.game,
                    // a1 es casilla negra y h1 blanca: "la clara, a la derecha".
                    isLight: (fileIndex + rank) % 2 == 0,
                    piece: pieces[square],
                    isSelected: square == _selected,
                    isDestination: destinations.contains(square),
                    isCapture:
                        destinations.contains(square) && pieces[square] != null,
                    isLastMove: lastMove != null &&
                        (square == lastMove.from || square == lastMove.to),
                    isCheckedKing: square == checkedKing,
                    // Las coordenadas solo en el borde, como en un tablero real.
                    fileLabel:
                        row == 7 ? String.fromCharCode(97 + fileIndex) : null,
                    rankLabel: col == 0 ? '$rank' : null,
                    onTap: () => _handleTap(square, pieces),
                  );
                }),
              );
            }),
          );

          return DecoratedBox(
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(6),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.25),
                  blurRadius: 16,
                  offset: const Offset(0, 6),
                ),
              ],
            ),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(6),
              child: grid,
            ),
          );
        },
      ),
    );
  }
}

class _Square extends StatelessWidget {
  const _Square({
    super.key,
    required this.size,
    required this.game,
    required this.isLight,
    required this.piece,
    required this.isSelected,
    required this.isDestination,
    required this.isCapture,
    required this.isLastMove,
    required this.isCheckedKing,
    required this.fileLabel,
    required this.rankLabel,
    required this.onTap,
  });

  final double size;

  /// A qué se juega: decide la silueta de las piezas.
  final GameKind game;

  final bool isLight;
  final Piece? piece;
  final bool isSelected;
  final bool isDestination;
  final bool isCapture;
  final bool isLastMove;
  final bool isCheckedKing;
  final String? fileLabel;
  final String? rankLabel;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final base = BoardColors.square(game, isLight);
    final labelColor = BoardColors.label(game, isLight);

    return GestureDetector(
      onTap: onTap,
      child: SizedBox(
        width: size,
        height: size,
        child: Stack(
          fit: StackFit.expand,
          children: [
            ColoredBox(color: base),
            if (isLastMove) const ColoredBox(color: BoardColors.lastMove),
            if (isCheckedKing)
              DecoratedBox(
                decoration: const BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: RadialGradient(
                    colors: [BoardColors.check, Colors.transparent],
                    stops: [0.35, 1],
                  ),
                ),
              ),
            if (isSelected) const ColoredBox(color: BoardColors.selected),

            // Coordenadas en las esquinas, discretas.
            if (rankLabel != null)
              Padding(
                padding: const EdgeInsets.only(left: 2, top: 1),
                child: Align(
                  alignment: Alignment.topLeft,
                  child: Text(
                    rankLabel!,
                    style: TextStyle(
                      fontSize: size * 0.18,
                      fontWeight: FontWeight.w700,
                      color: labelColor,
                    ),
                  ),
                ),
              ),
            if (fileLabel != null)
              Padding(
                padding: const EdgeInsets.only(right: 2, bottom: 1),
                child: Align(
                  alignment: Alignment.bottomRight,
                  child: Text(
                    fileLabel!,
                    style: TextStyle(
                      fontSize: size * 0.18,
                      fontWeight: FontWeight.w700,
                      color: labelColor,
                    ),
                  ),
                ),
              ),

            if (piece != null) _PieceGlyph(piece: piece!, size: size, game: game),

            if (isDestination) _hint(),

          ],
        ),
      ),
    );
  }

  /// Marca de destino posible: un aro alrededor de lo que se puede capturar y
  /// un punto en las casillas vacías.
  Widget _hint() {
    final color = BoardColors.hint(game, isLight);

    return IgnorePointer(
      key: const ValueKey('destino'),
      child: Center(
        child: isCapture
            ? Container(
                width: size * 0.92,
                height: size * 0.92,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(color: color, width: size * 0.08),
                ),
              )
            : Container(
                width: size * 0.28,
                height: size * 0.28,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: color,
                ),
              ),
      ),
    );
  }
}

/// Dibuja una pieza con las siluetas vectoriales de `piece_shapes.dart`.
class _PieceGlyph extends StatelessWidget {
  const _PieceGlyph({
    required this.piece,
    required this.size,
    required this.game,
  });

  final Piece piece;
  final double size;
  final GameKind game;

  @override
  Widget build(BuildContext context) {
    final box = size * 0.88;

    return IgnorePointer(
      child: Center(
        child: SizedBox(
          width: box,
          height: box,
          child: CustomPaint(
            painter: PiecePainter(
              type: piece.type,
              color: piece.color,
              game: game,
            ),
          ),
        ),
      ),
    );
  }
}

/// Diálogo para elegir pieza al coronar un peón.
Future<String?> showPromotionPicker(BuildContext context, PieceColor color) {
  const options = [
    ('q', 'Dama'),
    ('r', 'Torre'),
    ('b', 'Alfil'),
    ('n', 'Caballo'),
  ];

  return showDialog<String>(
    context: context,
    builder: (context) => AlertDialog(
      title: const Text('Coronar el peón'),
      content: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          for (final (type, label) in options)
            Expanded(
              child: InkWell(
                onTap: () => Navigator.of(context).pop(type),
                borderRadius: BorderRadius.circular(8),
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      _PieceGlyph(
                        piece: Piece(type, color),
                        size: 52,
                        game: GameKind.chess,
                      ),
                      const SizedBox(height: 4),
                      Text(label, style: const TextStyle(fontSize: 11)),
                    ],
                  ),
                ),
              ),
            ),
        ],
      ),
    ),
  );
}
