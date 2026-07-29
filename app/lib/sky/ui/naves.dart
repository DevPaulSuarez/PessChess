/// Las naves y las banderas, dibujadas a mano con vectores.
///
/// No hay ni un PNG en el juego. Las naves son polígonos y las banderas son
/// rectángulos: se ven nítidas a cualquier escala, no pesan nada y no hay que
/// mantener un atlas de sprites por cada país que se añada.
library;

import 'dart:math' as math;
import 'dart:ui';

import '../datos/paises.dart';

class _Silueta {
  const _Silueta({
    required this.fuselaje,
    required this.alas,
    required this.cola,
    required this.cabina,
    this.canard,
    this.barquilla,
    this.travesano,
    this.helice = false,
  });

  /// Puntos en una caja de lado 1 centrada en el origen, con el morro arriba.
  final List<List<double>> fuselaje;
  final List<List<double>> alas;
  final List<List<double>> cola;

  /// Centro y radios de la burbuja de la cabina.
  final List<double> cabina;
  final List<List<double>>? canard;
  final List<List<double>>? barquilla;
  final List<List<double>>? travesano;
  final bool helice;
}

const Map<String, _Silueta> _siluetas = {
  'caza': _Silueta(
    fuselaje: [[0, -0.5], [0.08, -0.24], [0.09, 0.3], [-0.09, 0.3], [-0.08, -0.24]],
    alas: [[0.08, -0.02], [0.46, 0.2], [0.46, 0.28], [0.08, 0.2]],
    cola: [[0.06, 0.26], [0.24, 0.44], [0.24, 0.5], [0.06, 0.4]],
    cabina: [0, -0.16, 0.06, 0.11],
  ),
  'raptor': _Silueta(
    fuselaje: [[0, -0.5], [0.13, -0.1], [0.12, 0.32], [-0.12, 0.32], [-0.13, -0.1]],
    alas: [[0.11, -0.06], [0.5, 0.24], [0.42, 0.34], [0.11, 0.26]],
    cola: [[0.13, 0.24], [0.3, 0.48], [0.2, 0.5], [0.08, 0.36]],
    cabina: [0, -0.2, 0.07, 0.1],
  ),
  'canard': _Silueta(
    // Delta con canards: el morro lleva dos aletitas por delante del ala.
    fuselaje: [[0, -0.5], [0.07, -0.18], [0.1, 0.34], [-0.1, 0.34], [-0.07, -0.18]],
    alas: [[0.08, -0.08], [0.44, 0.3], [0.44, 0.36], [0.08, 0.28]],
    canard: [[0.06, -0.28], [0.26, -0.12], [0.26, -0.07], [0.06, -0.16]],
    cola: [[0.05, 0.3], [0.16, 0.48], [0.16, 0.5], [0.05, 0.42]],
    cabina: [0, -0.24, 0.055, 0.1],
  ),
  'interceptor': _Silueta(
    fuselaje: [[0, -0.5], [0.09, -0.3], [0.1, 0.36], [-0.1, 0.36], [-0.09, -0.3]],
    alas: [[0.09, 0.02], [0.48, 0.26], [0.48, 0.32], [0.09, 0.24]],
    cola: [[0.09, 0.28], [0.3, 0.46], [0.3, 0.5], [0.09, 0.42]],
    cabina: [0, -0.24, 0.06, 0.12],
  ),
  'ataque': _Silueta(
    // Corto, ancho y con pinta de aguantar lo que le echen.
    fuselaje: [[0, -0.44], [0.13, -0.2], [0.14, 0.32], [-0.14, 0.32], [-0.13, -0.2]],
    alas: [[0.12, -0.04], [0.5, 0.02], [0.5, 0.16], [0.12, 0.18]],
    cola: [[0.1, 0.28], [0.3, 0.4], [0.3, 0.48], [0.1, 0.42]],
    cabina: [0, -0.2, 0.07, 0.1],
  ),
  'ligero': _Silueta(
    fuselaje: [[0, -0.46], [0.08, -0.26], [0.08, 0.32], [-0.08, 0.32], [-0.08, -0.26]],
    alas: [[0.07, 0.0], [0.44, 0.06], [0.44, 0.16], [0.07, 0.18]],
    cola: [[0.06, 0.3], [0.22, 0.38], [0.22, 0.46], [0.06, 0.42]],
    cabina: [0, -0.2, 0.055, 0.1],
  ),
  'helice': _Silueta(
    fuselaje: [[0, -0.42], [0.1, -0.22], [0.1, 0.34], [-0.1, 0.34], [-0.1, -0.22]],
    alas: [[0.09, 0.04], [0.46, 0.1], [0.46, 0.2], [0.09, 0.22]],
    cola: [[0.08, 0.3], [0.26, 0.4], [0.26, 0.48], [0.08, 0.44]],
    cabina: [0, -0.12, 0.06, 0.12],
    helice: true,
  ),
  'bimotor': _Silueta(
    // Dos colas unidas por un plano, como un Bronco.
    fuselaje: [[0, -0.42], [0.09, -0.2], [0.09, 0.16], [-0.09, 0.16], [-0.09, -0.2]],
    alas: [[0.08, -0.06], [0.5, 0.0], [0.5, 0.12], [0.08, 0.14]],
    barquilla: [[0.24, -0.1], [0.34, -0.1], [0.34, 0.46], [0.24, 0.46]],
    travesano: [[-0.34, 0.4], [0.34, 0.4], [0.34, 0.5], [-0.34, 0.5]],
    cola: [[0.08, 0.16], [0.12, 0.2], [0.12, 0.24], [0.08, 0.22]],
    cabina: [0, -0.14, 0.06, 0.1],
  ),
};

List<String> siluetasDisponibles() => _siluetas.keys.toList();

Path _camino(List<List<double>> puntos, double escala, {bool espejo = false}) {
  final camino = Path();
  for (var i = 0; i < puntos.length; i++) {
    final px = (espejo ? -puntos[i][0] : puntos[i][0]) * escala;
    final py = puntos[i][1] * escala;
    if (i == 0) {
      camino.moveTo(px, py);
    } else {
      camino.lineTo(px, py);
    }
  }
  return camino..close();
}

/// Dibuja una nave centrada en el origen del lienzo.
///
/// `inclinacion` va de -1 a 1 y estrecha la silueta al virar, que es como se
/// simulaba el alabeo en las recreativas de 16 bits: sin sprites nuevos.
void dibujarNave(
  Canvas canvas,
  String silueta,
  List<Color> colores, {
  double escala = 34,
  double inclinacion = 0,
  double t = 0,
  bool propulsor = true,
}) {
  final forma = _siluetas[silueta] ?? _siluetas['caza']!;
  final primario = Paint()..color = colores[0];
  final secundario = Paint()..color = colores[1];
  final acento = Paint()..color = colores[2];

  canvas.save();
  canvas.scale(1 - inclinacion.abs() * 0.35, 1);
  canvas.rotate(inclinacion * 0.12);

  if (propulsor) {
    // Llama detrás, con un parpadeo rápido para que se note el motor vivo.
    final largo = (0.16 + math.sin(t * 26).abs() * 0.1) * escala;
    canvas.drawRect(
      Rect.fromLTWH(-0.05 * escala, 0.3 * escala, 0.1 * escala, largo),
      Paint()
        ..shader = Gradient.linear(
          Offset(0, 0.3 * escala),
          Offset(0, 0.3 * escala + largo),
          [colores[2], colores[2].withValues(alpha: 0)],
        ),
    );
  }

  if (forma.travesano != null) canvas.drawPath(_camino(forma.travesano!, escala), secundario);
  for (final parte in [forma.alas, forma.canard, forma.cola, forma.barquilla]) {
    if (parte == null) continue;
    canvas.drawPath(_camino(parte, escala), secundario);
    canvas.drawPath(_camino(parte, escala, espejo: true), secundario);
  }

  canvas.drawPath(_camino(forma.fuselaje, escala), primario);

  if (forma.helice) {
    // El disco de la hélice: gira demasiado deprisa para verse, como en la
    // realidad.
    canvas.drawOval(
      Rect.fromCenter(center: Offset(0, -0.36 * escala), width: 0.6 * escala, height: 0.1 * escala),
      Paint()..color = const Color(0x40FFFFFF),
    );
  }

  canvas.drawOval(
    Rect.fromCenter(
      center: Offset(forma.cabina[0] * escala, forma.cabina[1] * escala),
      width: forma.cabina[2] * 2 * escala,
      height: forma.cabina[3] * 2 * escala,
    ),
    acento,
  );

  canvas.restore();
}

// ---------------------------------------------------------------------------
// Banderas
// ---------------------------------------------------------------------------

void _estrella(Canvas canvas, double x, double y, double radio, Paint pincel, [int puntas = 5]) {
  final camino = Path();
  for (var i = 0; i < puntas * 2; i++) {
    final r = i.isEven ? radio : radio * 0.45;
    final a = (i * math.pi) / puntas - math.pi / 2;
    final px = x + math.cos(a) * r;
    final py = y + math.sin(a) * r;
    if (i == 0) {
      camino.moveTo(px, py);
    } else {
      camino.lineTo(px, py);
    }
  }
  canvas.drawPath(camino..close(), pincel);
}

/// Banderas simplificadas: franjas y poco más.
///
/// No se busca exactitud heráldica —a cuarenta píxeles no cabe un escudo— sino
/// que cada país se reconozca de un vistazo en la parrilla del selector.
void dibujarBandera(Canvas canvas, Pais pais, Rect caja) =>
    dibujarBanderaDe(canvas, pais.bandera, caja);

/// La misma bandera, a partir de su definición suelta.
///
/// En red los países llegan del servidor y no hay objeto `Pais` que pasar: solo
/// la definición, que es lo único que hace falta para dibujarla.
void dibujarBanderaDe(Canvas canvas, Bandera b, Rect caja) {
  canvas.save();
  canvas.clipRect(caja);
  canvas.drawRect(caja, Paint()..color = const Color(0xFFFFFFFF));

  void franjas(bool horizontal) {
    final pesos = b.pesos ?? List.filled(b.franjas.length, 1);
    final total = pesos.reduce((a, n) => a + n);
    var avance = 0.0;
    for (var i = 0; i < b.franjas.length; i++) {
      final parte = (pesos[i] / total) * (horizontal ? caja.height : caja.width);
      final rect = horizontal
          ? Rect.fromLTWH(caja.left, caja.top + avance, caja.width, parte + 0.5)
          : Rect.fromLTWH(caja.left + avance, caja.top, parte + 0.5, caja.height);
      canvas.drawRect(rect, Paint()..color = b.franjas[i]);
      avance += parte;
    }
  }

  final blanco = Paint()..color = const Color(0xFFFFFFFF);

  switch (b.tipo) {
    case 'h':
    case 'v':
      franjas(b.tipo == 'h');
      if (b.emblema != null) {
        canvas.drawCircle(caja.center, math.min(caja.width, caja.height) * 0.16, Paint()..color = b.emblema!);
      }

    case 'usa':
      for (var i = 0; i < 7; i++) {
        canvas.drawRect(
          Rect.fromLTWH(caja.left, caja.top + i * caja.height / 7, caja.width, caja.height / 7 + 0.5),
          Paint()..color = i.isEven ? const Color(0xFFB22234) : const Color(0xFFFFFFFF),
        );
      }
      canvas.drawRect(
        Rect.fromLTWH(caja.left, caja.top, caja.width * 0.42, caja.height * 0.54),
        Paint()..color = const Color(0xFF3C3B6E),
      );
      for (var f = 0; f < 3; f++) {
        for (var c = 0; c < 4; c++) {
          _estrella(canvas, caja.left + caja.width * (0.08 + c * 0.09),
              caja.top + caja.height * (0.14 + f * 0.16), caja.height * 0.05, blanco);
        }
      }

    case 'china':
      canvas.drawRect(caja, Paint()..color = const Color(0xFFDE2910));
      final amarillo = Paint()..color = const Color(0xFFFFDE00);
      _estrella(canvas, caja.left + caja.width * 0.22, caja.top + caja.height * 0.32, caja.height * 0.16, amarillo);
      for (var i = 0; i < 4; i++) {
        _estrella(canvas, caja.left + caja.width * 0.42,
            caja.top + caja.height * (0.12 + i * 0.15), caja.height * 0.06, amarillo);
      }

    case 'cuba':
      for (var i = 0; i < 5; i++) {
        canvas.drawRect(
          Rect.fromLTWH(caja.left, caja.top + i * caja.height / 5, caja.width, caja.height / 5 + 0.5),
          Paint()..color = i.isEven ? const Color(0xFF002A8F) : const Color(0xFFFFFFFF),
        );
      }
      final triangulo = Path()
        ..moveTo(caja.left, caja.top)
        ..lineTo(caja.left + caja.width * 0.42, caja.center.dy)
        ..lineTo(caja.left, caja.bottom)
        ..close();
      canvas.drawPath(triangulo, Paint()..color = const Color(0xFFCF142B));
      _estrella(canvas, caja.left + caja.width * 0.13, caja.center.dy, caja.height * 0.13, blanco);

    case 'cruz':
      final azul = Paint()..color = const Color(0xFF002D62);
      final rojo = Paint()..color = const Color(0xFFCE1126);
      canvas.drawRect(Rect.fromLTWH(caja.left, caja.top, caja.width / 2, caja.height / 2), azul);
      canvas.drawRect(Rect.fromLTWH(caja.center.dx, caja.center.dy, caja.width / 2, caja.height / 2), azul);
      canvas.drawRect(Rect.fromLTWH(caja.center.dx, caja.top, caja.width / 2, caja.height / 2), rojo);
      canvas.drawRect(Rect.fromLTWH(caja.left, caja.center.dy, caja.width / 2, caja.height / 2), rojo);
      canvas.drawRect(Rect.fromLTWH(caja.left + caja.width * 0.44, caja.top, caja.width * 0.12, caja.height), blanco);
      canvas.drawRect(Rect.fromLTWH(caja.left, caja.top + caja.height * 0.44, caja.width, caja.height * 0.12), blanco);

    case 'chile':
      canvas.drawRect(Rect.fromLTWH(caja.left, caja.top, caja.width, caja.height / 2), blanco);
      canvas.drawRect(Rect.fromLTWH(caja.left, caja.center.dy, caja.width, caja.height / 2),
          Paint()..color = const Color(0xFFD52B1E));
      canvas.drawRect(Rect.fromLTWH(caja.left, caja.top, caja.width / 3, caja.height / 2),
          Paint()..color = const Color(0xFF0039A6));
      _estrella(canvas, caja.left + caja.width / 6, caja.top + caja.height / 4, caja.height * 0.14, blanco);

    case 'panama':
      canvas.drawRect(caja, blanco);
      final azul = Paint()..color = const Color(0xFF005293);
      final rojo = Paint()..color = const Color(0xFFDA121A);
      canvas.drawRect(Rect.fromLTWH(caja.center.dx, caja.top, caja.width / 2, caja.height / 2), azul);
      canvas.drawRect(Rect.fromLTWH(caja.left, caja.center.dy, caja.width / 2, caja.height / 2), rojo);
      _estrella(canvas, caja.left + caja.width * 0.25, caja.top + caja.height * 0.25, caja.height * 0.12, azul);
      _estrella(canvas, caja.left + caja.width * 0.75, caja.top + caja.height * 0.75, caja.height * 0.12, rojo);

    default:
      franjas(true);
  }

  canvas.restore();
  canvas.drawRect(
    caja.deflate(0.5),
    Paint()
      ..color = const Color(0x80000000)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1,
  );
}
