import 'package:flutter/material.dart';

import '../models/game_state.dart';

/// Siluetas de las piezas, dibujadas a mano con vectores.
///
/// No se usan los símbolos de ajedrez de Unicode a propósito. El peón (U+265F)
/// tiene versión emoji, y iOS y macOS la prefieren; un emoji lleva el color
/// dentro de la fuente, así que ignora el color pedido y los peones blancos
/// salían negros. Dibujándolas nosotros, las piezas se ven exactamente igual en
/// todos los sistemas y podemos darles sombreado.
///
/// Todas las formas se diseñan dentro de un cuadrado de lado 1, apoyadas sobre
/// la línea y = 0.95, y luego se escalan al tamaño que haga falta.
Path piecePath(String type) {
  return switch (type) {
    'p' => _pawn(),
    'r' => _rook(),
    'n' => _knight(),
    'b' => _bishop(),
    'q' => _queen(),
    _ => _king(),
  };
}

/// Peana común: el pie sobre el que se apoyan todas las piezas.
void _addBase(Path p, {double top = 0.78}) {
  p.moveTo(0.28, top);
  p.lineTo(0.72, top);
  p.lineTo(0.78, 0.87);
  p.lineTo(0.22, 0.87);
  p.close();
  p.addRRect(RRect.fromLTRBR(
      0.17, 0.86, 0.83, 0.95, const Radius.circular(0.025)));
}

/// Anillo que separa la cabeza del cuerpo.
void _addCollar(Path p, double top, double bottom, double halfWidth) {
  p.addRRect(RRect.fromLTRBR(0.5 - halfWidth, top, 0.5 + halfWidth, bottom,
      const Radius.circular(0.02)));
}

Path _pawn() {
  final p = Path();
  p.addOval(Rect.fromCircle(center: const Offset(0.5, 0.30), radius: 0.125));
  _addCollar(p, 0.41, 0.47, 0.13);
  // Cuerpo: se ensancha desde el cuello hasta la peana.
  p.moveTo(0.38, 0.46);
  p.cubicTo(0.38, 0.60, 0.32, 0.66, 0.30, 0.79);
  p.lineTo(0.70, 0.79);
  p.cubicTo(0.68, 0.66, 0.62, 0.60, 0.62, 0.46);
  p.close();
  _addBase(p);
  return p;
}

Path _rook() {
  final p = Path();
  // Almenas de la torre.
  p.moveTo(0.24, 0.35);
  p.lineTo(0.24, 0.17);
  p.lineTo(0.35, 0.17);
  p.lineTo(0.35, 0.24);
  p.lineTo(0.44, 0.24);
  p.lineTo(0.44, 0.17);
  p.lineTo(0.56, 0.17);
  p.lineTo(0.56, 0.24);
  p.lineTo(0.65, 0.24);
  p.lineTo(0.65, 0.17);
  p.lineTo(0.76, 0.17);
  p.lineTo(0.76, 0.35);
  p.close();
  _addCollar(p, 0.34, 0.40, 0.24);
  // Fuste, ligeramente estrechado en el centro.
  p.moveTo(0.33, 0.39);
  p.cubicTo(0.31, 0.55, 0.31, 0.66, 0.29, 0.79);
  p.lineTo(0.71, 0.79);
  p.cubicTo(0.69, 0.66, 0.69, 0.55, 0.67, 0.39);
  p.close();
  _addBase(p);
  return p;
}

Path _bishop() {
  final p = Path();
  // Bolita del remate.
  p.addOval(Rect.fromCircle(center: const Offset(0.5, 0.13), radius: 0.055));
  // Mitra.
  p.moveTo(0.5, 0.17);
  p.cubicTo(0.68, 0.28, 0.70, 0.44, 0.63, 0.53);
  p.lineTo(0.37, 0.53);
  p.cubicTo(0.30, 0.44, 0.32, 0.28, 0.5, 0.17);
  p.close();
  _addCollar(p, 0.52, 0.58, 0.17);
  p.moveTo(0.36, 0.57);
  p.cubicTo(0.35, 0.66, 0.32, 0.70, 0.30, 0.79);
  p.lineTo(0.70, 0.79);
  p.cubicTo(0.68, 0.70, 0.65, 0.66, 0.64, 0.57);
  p.close();
  _addBase(p);
  return p;
}

Path _knight() {
  final p = Path();
  // Cabeza de caballo mirando a la izquierda.
  p.moveTo(0.34, 0.72);
  p.cubicTo(0.32, 0.58, 0.34, 0.48, 0.42, 0.42);
  p.cubicTo(0.38, 0.40, 0.33, 0.38, 0.28, 0.39);
  p.cubicTo(0.24, 0.36, 0.24, 0.31, 0.27, 0.28);
  p.lineTo(0.37, 0.30);
  p.cubicTo(0.40, 0.23, 0.46, 0.16, 0.54, 0.14);
  p.lineTo(0.52, 0.21);
  p.lineTo(0.61, 0.15);
  p.cubicTo(0.70, 0.24, 0.74, 0.40, 0.72, 0.56);
  p.lineTo(0.70, 0.72);
  p.close();
  _addBase(p, top: 0.71);
  return p;
}

Path _queen() {
  final p = Path();
  // Corona de cinco puntas con sus bolitas.
  p.moveTo(0.24, 0.47);
  p.lineTo(0.18, 0.24);
  p.lineTo(0.32, 0.40);
  p.lineTo(0.41, 0.19);
  p.lineTo(0.50, 0.38);
  p.lineTo(0.59, 0.19);
  p.lineTo(0.68, 0.40);
  p.lineTo(0.82, 0.24);
  p.lineTo(0.76, 0.47);
  p.close();
  for (final tip in const [
    Offset(0.18, 0.24),
    Offset(0.41, 0.19),
    Offset(0.59, 0.19),
    Offset(0.82, 0.24),
  ]) {
    p.addOval(Rect.fromCircle(center: tip, radius: 0.055));
  }
  _addCollar(p, 0.46, 0.53, 0.27);
  p.moveTo(0.31, 0.52);
  p.cubicTo(0.30, 0.63, 0.28, 0.68, 0.26, 0.79);
  p.lineTo(0.74, 0.79);
  p.cubicTo(0.72, 0.68, 0.70, 0.63, 0.69, 0.52);
  p.close();
  _addBase(p);
  return p;
}

Path _king() {
  final p = Path();
  // Cruz del remate.
  p.addRRect(RRect.fromLTRBR(
      0.465, 0.06, 0.535, 0.26, const Radius.circular(0.015)));
  p.addRRect(RRect.fromLTRBR(
      0.40, 0.115, 0.60, 0.175, const Radius.circular(0.015)));
  // Corona.
  p.moveTo(0.26, 0.50);
  p.cubicTo(0.23, 0.36, 0.33, 0.27, 0.42, 0.30);
  p.lineTo(0.50, 0.24);
  p.lineTo(0.58, 0.30);
  p.cubicTo(0.67, 0.27, 0.77, 0.36, 0.74, 0.50);
  p.close();
  _addCollar(p, 0.49, 0.56, 0.26);
  p.moveTo(0.31, 0.55);
  p.cubicTo(0.30, 0.65, 0.28, 0.69, 0.26, 0.79);
  p.lineTo(0.74, 0.79);
  p.cubicTo(0.72, 0.69, 0.70, 0.65, 0.69, 0.55);
  p.close();
  _addBase(p);
  return p;
}

/// Ficha de damas: un disco. La dama lleva una corona encima.
///
/// Es un dibujo aparte porque una ficha no tiene la misma silueta que una pieza
/// de ajedrez, pero se pinta con las mismas reglas de color y contorno.
void _paintDraughtsPiece(Canvas canvas, String type, Paint fill, Paint stroke) {
  const centre = Offset(0.5, 0.5);

  canvas.drawCircle(centre, 0.36, fill);
  canvas.drawCircle(centre, 0.36, stroke);
  // Anillo interior: le da el aspecto de ficha torneada en vez de un círculo
  // plano, y ayuda a verla sobre casillas del mismo color.
  canvas.drawCircle(centre, 0.26, stroke);

  if (type != 'k') return;

  // Corona para la dama coronada.
  final crown = Path()
    ..moveTo(0.36, 0.58)
    ..lineTo(0.33, 0.43)
    ..lineTo(0.41, 0.50)
    ..lineTo(0.50, 0.39)
    ..lineTo(0.59, 0.50)
    ..lineTo(0.67, 0.43)
    ..lineTo(0.64, 0.58)
    ..close();
  canvas.drawPath(crown, stroke..style = PaintingStyle.fill);
  stroke.style = PaintingStyle.stroke;
}

/// Ficha de reversi: un disco liso, más grande que el de damas porque aquí las
/// fichas se tocan entre sí y el tablero se llena.
///
/// No lleva el contorno del color contrario: sobre el paño verde las dos caras
/// se distinguen solas, y un aro blanco alrededor de cada ficha negra ensuciaría
/// un tablero que acaba con sesenta y cuatro.
void _paintReversiDisc(Canvas canvas, bool isWhite, Paint fill) {
  const centre = Offset(0.5, 0.5);
  const radius = 0.40;

  // Sombra bajo la ficha, para que se vea apoyada sobre el paño.
  canvas.drawCircle(
    centre.translate(0.015, 0.025),
    radius,
    Paint()
      ..color = Colors.black.withValues(alpha: 0.35)
      ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 0.02),
  );

  canvas.drawCircle(centre, radius, fill);

  // Canto: un borde tenue del mismo tono que la cara, que le da grosor sin
  // convertirse en un aro de color contrario.
  canvas.drawCircle(
    centre,
    radius,
    Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 0.02
      ..color = isWhite ? const Color(0x33000000) : const Color(0x33FFFFFF),
  );
}

/// Pinta una pieza rellena, con contorno del color contrario para que se
/// distinga igual de bien sobre casillas claras y oscuras.
class PiecePainter extends CustomPainter {
  const PiecePainter({
    required this.type,
    required this.color,
    this.game = GameKind.chess,
    this.shaded = false,
  });

  final String type;
  final PieceColor color;

  /// De qué juego es la pieza: cambia la silueta, no los colores.
  final GameKind game;

  /// Añade un degradado suave que simula volumen. Se usa en la vista 3D.
  final bool shaded;

  bool get _isWhite => color == PieceColor.white;

  Color get _fill => _isWhite ? const Color(0xFFFFFFFF) : const Color(0xFF000000);

  /// El contorno lleva el color contrario al relleno. Es lo que permite
  /// distinguir una pieza negra sobre casilla negra, y una blanca sobre
  /// casilla blanca.
  Color get _stroke => _isWhite ? const Color(0xFF000000) : const Color(0xFFFFFFFF);

  @override
  void paint(Canvas canvas, Size size) {
    final scale = size.shortestSide;
    canvas.save();
    canvas.translate((size.width - scale) / 2, (size.height - scale) / 2);
    canvas.scale(scale);

    final fillPaint = Paint()..style = PaintingStyle.fill;
    if (shaded) {
      // Luz desde arriba a la izquierda.
      fillPaint.shader = LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: _isWhite
            ? [const Color(0xFFFFFFFF), const Color(0xFFBFBFBF)]
            : [const Color(0xFF3D3D3D), const Color(0xFF000000)],
      ).createShader(const Rect.fromLTWH(0, 0, 1, 1));
    } else {
      fillPaint.color = _fill;
    }

    final strokePaint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 0.022
      ..strokeJoin = StrokeJoin.round
      ..color = _stroke;

    if (game == GameKind.reversi) {
      _paintReversiDisc(canvas, _isWhite, fillPaint);
      canvas.restore();
      return;
    }

    if (game == GameKind.draughts) {
      _paintDraughtsPiece(canvas, type, fillPaint, strokePaint);
      canvas.restore();
      return;
    }

    final path = piecePath(type);

    // Sombra propia, para despegar la pieza del tablero.
    canvas.drawPath(
      path.shift(const Offset(0.015, 0.015)),
      Paint()
        ..color = Colors.black.withValues(alpha: 0.28)
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 0.012),
    );

    canvas.drawPath(path, fillPaint);
    canvas.drawPath(path, strokePaint);

    canvas.restore();
  }

  @override
  bool shouldRepaint(PiecePainter old) =>
      old.type != type ||
      old.color != color ||
      old.game != game ||
      old.shaded != shaded;
}
