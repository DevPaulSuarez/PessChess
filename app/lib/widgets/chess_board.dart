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
}

/// Cuánto se inclina el tablero hacia atrás en el modo 3D, en radianes.
///
/// Unos 30°: suficiente para dar sensación de volumen sin que las filas del
/// fondo se aplasten tanto que cueste distinguirlas.
const _tiltAngle = 0.52;

/// Fuerza del punto de fuga. Cuanto mayor, más exagerada la profundidad y más
/// pequeño acaba viéndose el tablero, porque hay que encogerlo para que quepa.
const _perspective = 0.0012;

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
    this.perspective = false,
  });

  final GameState state;

  /// Dibuja el tablero inclinado y las piezas de pie, en lugar de visto
  /// completamente desde arriba.
  final bool perspective;

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
    final destinations = _selected == null
        ? <String>{}
        : {
            ..._state.movesFrom(_selected!).map((m) => m.to),
            // La torre con la que se puede enrocar también se marca, para que
            // se vea que tocarla vale.
            ..._castlingByRook(_selected!).keys,
          };
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
          final tilt = widget.perspective ? _tiltAngle : 0.0;

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
                    tilt: tilt,
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

          if (!widget.perspective) {
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
          }

          // En perspectiva no se recorta el tablero: las piezas se levantan por
          // encima de su casilla y un recorte les cortaría la cabeza.
          //
          // `Transform` convierte también las coordenadas de los toques, así
          // que se puede seguir tocando cada casilla justo donde se la ve.
          //
          // La fila más cercana se agranda al proyectarla y sus esquinas se
          // saldrían del hueco reservado al tablero; fuera de ese hueco los
          // toques ya no llegan. Por eso se encoge todo lo justo para que la
          // esquina más cercana caiga exactamente en el borde.
          final halfBoard = side / 2;
          final fit = 1 - _perspective * halfBoard * math.sin(tilt);

          return Center(
            child: Transform.scale(
              scale: fit,
              child: Transform(
                alignment: Alignment.center,
                transform: Matrix4.identity()
                  ..setEntry(3, 2, _perspective)
                  // Giro negativo: así la fila del fondo se aleja de la cámara.
                  // Con el signo contrario el tablero se inclina hacia el
                  // jugador y se ve del revés.
                  ..rotateX(-tilt),
                child: grid,
              ),
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
    required this.tilt,
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

  /// Inclinación del tablero. Cero en el modo plano.
  final double tilt;

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
    final base = isLight ? BoardColors.light : BoardColors.dark;
    final labelColor = isLight ? BoardColors.dark : BoardColors.light;

    final is3d = tilt > 0;

    return GestureDetector(
      onTap: onTap,
      child: SizedBox(
        width: size,
        height: size,
        child: Stack(
          fit: StackFit.expand,
          // Las piezas de pie sobresalen por arriba de su casilla. Como las
          // filas se pintan de fondo a frente, se tapan entre ellas igual que
          // en un tablero real.
          clipBehavior: is3d ? Clip.none : Clip.hardEdge,
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

            // En 3D las pistas van debajo de la pieza, como marcas pintadas en
            // el suelo alrededor de ella. En plano van encima, que se ve mejor.
            if (is3d && isDestination) _hint(),

            if (piece != null)
              if (is3d) ...[
                // Sombra en el plano del tablero: es lo que ancla la pieza a su
                // casilla y evita que parezca flotando.
                Positioned(
                  left: size * 0.14,
                  right: size * 0.14,
                  bottom: size * 0.06,
                  height: size * 0.24,
                  child: const IgnorePointer(
                    child: DecoratedBox(
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        gradient: RadialGradient(
                          colors: [Colors.black54, Colors.transparent],
                          stops: [0.2, 1],
                        ),
                      ),
                    ),
                  ),
                ),
                // La pieza se contrarresta la inclinación del tablero para
                // quedarse mirando al jugador, apoyada sobre su casilla.
                Positioned(
                  left: -size * 0.15,
                  right: -size * 0.15,
                  bottom: size * 0.04,
                  height: size * 1.45,
                  child: IgnorePointer(
                    child: Transform(
                      alignment: Alignment.bottomCenter,
                      // Deshace la inclinación del tablero para que la pieza
                      // quede mirando al jugador en vez de tumbada.
                      transform: Matrix4.identity()..rotateX(tilt),
                      child: _PieceGlyph(
                        piece: piece!,
                        size: size,
                        game: game,
                        standing: true,
                      ),
                    ),
                  ),
                ),
              ] else
                _PieceGlyph(piece: piece!, size: size, game: game),

            if (!is3d && isDestination) _hint(),
          ],
        ),
      ),
    );
  }

  /// Marca de destino posible: un aro alrededor de lo que se puede capturar y
  /// un punto en las casillas vacías.
  Widget _hint() {
    final color = isLight ? BoardColors.hintOnLight : BoardColors.hintOnDark;

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
    this.standing = false,
  });

  final Piece piece;
  final double size;
  final GameKind game;

  /// En el modo 3D la pieza se apoya sobre la casilla en vez de centrarse en
  /// ella, y se dibuja algo más grande para compensar el escorzo.
  final bool standing;

  @override
  Widget build(BuildContext context) {
    // De pie se dibuja más grande, porque en perspectiva la pieza se ve
    // escorzada y con el tamaño plano quedaría enana.
    final box = size * (standing ? 1.15 : 0.88);

    return IgnorePointer(
      child: Align(
        alignment: standing ? Alignment.bottomCenter : Alignment.center,
        child: SizedBox(
          width: box,
          height: box,
          child: CustomPaint(
            painter: PiecePainter(
              type: piece.type,
              color: piece.color,
              game: game,
              shaded: standing,
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
