import 'dart:math' as math;
import 'dart:ui';

import 'constantes.dart';

/// Algo a lo que un misil puede perseguir.
///
/// Es lo único que una bala necesita saber del mundo, así que los enemigos y
/// los jefes lo implementan y la bala no tiene que conocer la partida entera.
abstract class Blanco {
  double get x;
  double get y;
  bool get viva;
}

/// Un proyectil, sea de quien sea.
///
/// Hay una sola clase para todos porque en un matamarcianos lo que distingue a
/// un disparo no es su código sino sus números: a dónde va, cuánto duele y qué
/// hace al chocar. Una subclase por arma multiplicaría los ficheros sin añadir
/// ni una idea.
class Bala {
  Bala({
    required this.x,
    required this.y,
    required this.vx,
    required this.vy,
    required this.color,
    this.radio = 4,
    this.dano = 10,
    this.forma = 'esfera',
    this.deJugador = true,
    this.duenno = 0,
    this.guia = 0,
    this.penetra = false,
    this.rebotes = 0,
    this.amplitud = 0,
    this.frecuencia = 8,
    this.alcance = 0,
    this.esquirlas = 0,
    this.efecto,
  }) : xBase = x {
    if (penetra) tocados = <Object>{};
  }

  double x;
  double y;
  double vx;
  double vy;
  double radio;
  double dano;
  Color color;

  /// 'esfera', 'misil', 'lanza', 'rayo', 'plasma', 'disco' o 'pluma'.
  String forma;
  bool deJugador;
  int duenno;
  bool viva = true;
  double t = 0;

  /// Radianes por segundo que puede corregir el rumbo. Cero es no perseguir.
  double guia;
  Blanco? objetivo;
  bool penetra;
  int rebotes;

  /// Vaivén lateral sobre la trayectoria recta.
  double amplitud;
  double frecuencia;

  /// Si es mayor que cero, la bala se apaga tras recorrer esa distancia.
  double alcance;
  double recorrido = 0;
  int esquirlas;

  /// 'lento', 'arrastre' o 'empuje'.
  String? efecto;

  /// A quién ya golpeó, para las que atraviesan.
  Set<Object>? tocados;

  double xBase;

  void actualizar(double dt, [Blanco? Function(double x, double y)? buscarBlanco]) {
    t += dt;

    if (guia > 0 && buscarBlanco != null) {
      if (objetivo == null || !objetivo!.viva) objetivo = buscarBlanco(x, y);
      if (objetivo != null) _perseguir(dt, objetivo!.x, objetivo!.y);
    }

    if (amplitud != 0) {
      // El vaivén se aplica sobre la trayectoria recta y no sobre la posición
      // anterior: así la bala serpentea sin desviarse de su rumbo.
      xBase += vx * dt;
      y += vy * dt;
      x = xBase + math.sin(t * frecuencia) * amplitud;
    } else {
      x += vx * dt;
      y += vy * dt;
    }

    recorrido += math.sqrt(vx * vx + vy * vy) * dt;
    if (alcance > 0 && recorrido > alcance) viva = false;

    if (rebotes > 0) {
      if (x < radio || x > anchoCampo - radio) {
        vx = -vx;
        x = x.clamp(radio, anchoCampo - radio);
        rebotes--;
      }
      if (y < radio) {
        vy = -vy;
        y = radio;
        rebotes--;
      }
    }

    const margen = 40.0;
    if (y < -margen || y > altoCampo + margen || x < -margen || x > anchoCampo + margen) {
      viva = false;
    }
  }

  void _perseguir(double dt, double objetivoX, double objetivoY) {
    final deseado = math.atan2(objetivoY - y, objetivoX - x);
    final actual = math.atan2(vy, vx);

    // Diferencia de ángulos normalizada a [-π, π]: sin esto un misil daría la
    // vuelta por el lado largo al cruzar el eje.
    var giro = ((deseado - actual + math.pi * 3) % (math.pi * 2)) - math.pi;
    giro = giro.clamp(-guia * dt, guia * dt);

    final velocidad = math.sqrt(vx * vx + vy * vy);
    vx = math.cos(actual + giro) * velocidad;
    vy = math.sin(actual + giro) * velocidad;
  }

  void dibujar(Canvas canvas) {
    canvas.save();
    canvas.translate(x, y);

    final pincel = Paint()..color = color;

    switch (forma) {
      case 'misil':
        canvas.rotate(math.atan2(vy, vx) + math.pi / 2);
        canvas.drawRect(const Rect.fromLTWH(-2, -7, 4, 12), pincel);
        canvas.drawRect(
          Rect.fromLTWH(-1.5, 5, 3, 6),
          Paint()..color = const Color(0xD9FFDC78),
        );

      case 'lanza':
        canvas.drawRect(
          Rect.fromLTWH(-radio / 2, -16, radio, 32),
          pincel..maskFilter = const MaskFilter.blur(BlurStyle.solid, 3),
        );

      case 'rayo':
        canvas.drawRect(Rect.fromLTWH(-radio / 2, -24, radio, 48), pincel);
        canvas.drawRect(
          Rect.fromLTWH(-radio / 6, -24, radio / 3, 48),
          Paint()..color = const Color(0xFFFFFFFF),
        );

      case 'plasma':
        canvas.drawCircle(
          Offset.zero,
          radio * 1.5,
          Paint()
            ..shader = Gradient.radial(Offset.zero, radio * 1.5, [
              const Color(0xFFFFFFFF),
              color,
              color.withValues(alpha: 0),
            ], [0.0, 0.45, 1.0]),
        );

      case 'disco':
        canvas.rotate(t * 14);
        canvas.drawArc(
          Rect.fromCircle(center: Offset.zero, radius: radio),
          0,
          math.pi * 1.6,
          false,
          Paint()
            ..color = color
            ..style = PaintingStyle.stroke
            ..strokeWidth = 3,
        );

      case 'pluma':
        canvas.rotate(math.atan2(vy, vx) + math.pi / 2);
        final pluma = Path()
          ..moveTo(0, -radio * 1.8)
          ..lineTo(radio, radio)
          ..lineTo(0, radio * 0.4)
          ..lineTo(-radio, radio)
          ..close();
        canvas.drawPath(pluma, pincel);

      default:
        canvas.drawCircle(Offset.zero, radio, pincel);
        if (!deJugador) {
          // Núcleo claro: las balas enemigas tienen que leerse sobre cualquier
          // fondo, y aquí los hay muy oscuros y muy claros.
          canvas.drawCircle(
            Offset.zero,
            radio * 0.45,
            Paint()..color = const Color(0xE6FFFFFF),
          );
        }
    }

    canvas.restore();
  }
}

/// Bala enemiga genérica, apuntada hacia donde se le diga.
Bala balaEnemiga(
  double x,
  double y,
  double angulo,
  double velocidad, {
  Color color = const Color(0xFFFF7043),
  double radio = 5,
  String forma = 'esfera',
  double alcance = 0,
}) {
  return Bala(
    x: x,
    y: y,
    vx: math.cos(angulo) * velocidad,
    vy: math.sin(angulo) * velocidad,
    color: color,
    radio: radio,
    forma: forma,
    dano: 1,
    deJugador: false,
    alcance: alcance,
  );
}
