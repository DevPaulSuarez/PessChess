import 'dart:math' as math;
import 'dart:ui';

import 'constantes.dart';

/// Los fondos, generados sobre la marcha.
///
/// Tres capas que bajan a distintas velocidades bastan para dar profundidad: lo
/// lejano casi no se mueve y lo cercano vuela. Cuando un elemento sale por
/// abajo vuelve a entrar por arriba en otro sitio, así que el escenario no se
/// repite de forma reconocible y no ocupa memoria.
class Fondo {
  Fondo(this.tipo) : _paleta = _paletas[tipo] ?? _paletas['ciudad']! {
    _capas = [
      _Capa(velocidad: 22, elementos: _generar(9, 'lejano')),
      _Capa(velocidad: 60, elementos: _generar(7, 'medio')),
      _Capa(velocidad: 150, elementos: _generar(14, 'cercano')),
    ];

    // Motas: nieve en el glaciar, brasas en la ciudad, polen en la selva.
    _motas = List.generate(60, (_) => _Mota(
          x: _azar.nextDouble() * anchoCampo,
          y: _azar.nextDouble() * altoCampo,
          v: 40 + _azar.nextDouble() * 160,
          r: _azar.nextDouble() * 1.8 + 0.6,
        ));
  }

  final String tipo;
  final _Paleta _paleta;
  final _azar = math.Random();

  late final List<_Capa> _capas;
  late final List<_Mota> _motas;

  double t = 0;
  double desplazamiento = 0;

  List<_Elemento> _generar(int cuantos, String capa) =>
      List.generate(cuantos, (_) => _nuevo(capa, _azar.nextDouble() * altoCampo));

  _Elemento _nuevo(String capa, double y) {
    final grande = capa == 'lejano';
    return _Elemento(
      capa: capa,
      x: _azar.nextDouble() * anchoCampo,
      y: y,
      w: (grande ? 50 : 26) + _azar.nextDouble() * (grande ? 70 : 60),
      h: (grande ? 80 : 34) + _azar.nextDouble() * (grande ? 130 : 90),
      variante: _azar.nextDouble(),
    );
  }

  void actualizar(double dt, {double factor = 1}) {
    t += dt;
    desplazamiento += dt * 60 * factor;

    for (final capa in _capas) {
      for (var i = 0; i < capa.elementos.length; i++) {
        final el = capa.elementos[i];
        el.y += capa.velocidad * factor * dt;
        if (el.y - el.h > altoCampo) capa.elementos[i] = _nuevo(el.capa, -el.h - 20);
      }
    }

    for (final mota in _motas) {
      mota.y += mota.v * factor * dt;
      mota.x += math.sin(t + mota.y * 0.01) * 12 * dt;
      if (mota.y > altoCampo) {
        mota.y = -4;
        mota.x = _azar.nextDouble() * anchoCampo;
      }
    }
  }

  void dibujar(Canvas canvas) {
    const campo = Rect.fromLTWH(0, 0, anchoCampo, altoCampo);

    canvas.drawRect(
      campo,
      Paint()
        ..shader = Gradient.linear(
          const Offset(0, 0),
          const Offset(0, altoCampo),
          _paleta.cielo,
          [0.0, 0.55, 1.0],
        ),
    );

    if (tipo == 'selva') _dibujarRio(canvas);

    for (final capa in _capas) {
      for (final el in capa.elementos) {
        _dibujarElemento(canvas, el);
      }
    }

    for (final mota in _motas) {
      canvas.drawRect(
        Rect.fromLTWH(mota.x, mota.y, mota.r, mota.r * 2),
        Paint()..color = Color.fromRGBO(255, 255, 255, 0.15 + mota.r * 0.2),
      );
    }

    // Viñeta: oscurece los bordes para que las balas se lean en el centro.
    canvas.drawRect(
      campo,
      Paint()
        ..shader = Gradient.radial(
          const Offset(anchoCampo / 2, altoCampo / 2),
          altoCampo * 0.8,
          const [Color(0x00000000), Color(0x8C000000)],
          const [0.35, 1.0],
        ),
    );
  }

  /// Una cinta oscura que serpentea: es "la zona del río" de la insignia.
  void _dibujarRio(Canvas canvas) {
    final rio = Path()..moveTo(anchoCampo * 0.3, 0);
    for (var y = 0.0; y <= altoCampo; y += 40) {
      rio.lineTo(anchoCampo * 0.3 + math.sin((y + desplazamiento) * 0.008) * 60, y);
    }
    for (var y = altoCampo; y >= 0; y -= 40) {
      rio.lineTo(anchoCampo * 0.55 + math.sin((y + desplazamiento) * 0.008) * 60, y);
    }
    rio.close();
    canvas.drawPath(rio, Paint()..color = const Color(0xBF143C5A));
  }

  void _dibujarElemento(Canvas canvas, _Elemento el) {
    final pincel = Paint()..color = _paleta.deCapa(el.capa);

    switch (tipo) {
      case 'ciudad':
        canvas.drawRect(Rect.fromLTWH(el.x, el.y, el.w, el.h), pincel);
        // Ventanas encendidas: lo único con color en una ciudad apagada.
        if (el.capa != 'cercano') {
          final luz = Paint()..color = const Color(0x59FFB74D);
          for (var f = 0; f < el.h ~/ 18; f++) {
            for (var c = 0; c < el.w ~/ 16; c++) {
              if ((f * 7 + c * 3 + (el.variante * 10).floor()) % 4 != 0) continue;
              canvas.drawRect(Rect.fromLTWH(el.x + 5 + c * 16, el.y + 6 + f * 18, 6, 8), luz);
            }
          }
        }

      case 'selva':
        // Copas de árbol: tres círculos que se solapan.
        for (var i = 0; i < 3; i++) {
          canvas.drawCircle(
            Offset(el.x + el.w * (0.25 + i * 0.25), el.y + el.h * 0.5),
            el.w * 0.3,
            pincel,
          );
        }

      case 'glaciar':
        final pico = Path()
          ..moveTo(el.x, el.y + el.h)
          ..lineTo(el.x + el.w * 0.5, el.y)
          ..lineTo(el.x + el.w, el.y + el.h * 0.8)
          ..close();
        canvas.drawPath(pico, pincel);

        final brillo = Path()
          ..moveTo(el.x + el.w * 0.5, el.y)
          ..lineTo(el.x + el.w * 0.7, el.y + el.h * 0.6)
          ..lineTo(el.x + el.w * 0.35, el.y + el.h * 0.7)
          ..close();
        canvas.drawPath(brillo, Paint()..color = const Color(0x2EFFFFFF));

      default:
        canvas.drawRect(Rect.fromLTWH(el.x, el.y, el.w, el.h), pincel);
    }
  }
}

class _Paleta {
  const _Paleta({
    required this.cielo,
    required this.lejano,
    required this.medio,
    required this.cercano,
  });

  final List<Color> cielo;
  final Color lejano;
  final Color medio;
  final Color cercano;

  Color deCapa(String capa) => switch (capa) {
        'lejano' => lejano,
        'medio' => medio,
        _ => cercano,
      };
}

const Map<String, _Paleta> _paletas = {
  'ciudad': _Paleta(
    cielo: [Color(0xFF3E1F16), Color(0xFF7C3B1E), Color(0xFFC96A2B)], // amanecer con humo
    lejano: Color(0xFF2B1A17),
    medio: Color(0xFF3D2621),
    cercano: Color(0xFF1A0F0D),
  ),
  'selva': _Paleta(
    cielo: [Color(0xFF052E16), Color(0xFF0F4D2A), Color(0xFF1B7A44)],
    lejano: Color(0xFF08301C),
    medio: Color(0xFF0D4526),
    cercano: Color(0xFF041C11),
  ),
  'glaciar': _Paleta(
    cielo: [Color(0xFF0B2A3D), Color(0xFF14506E), Color(0xFF3F8FB0)],
    lejano: Color(0xFF1D5A76),
    medio: Color(0xFF2B7492),
    cercano: Color(0xFF0A1F2C),
  ),
};

class _Capa {
  _Capa({required this.velocidad, required this.elementos});

  final double velocidad;
  final List<_Elemento> elementos;
}

class _Elemento {
  _Elemento({
    required this.capa,
    required this.x,
    required this.y,
    required this.w,
    required this.h,
    required this.variante,
  });

  final String capa;
  final double x;
  double y;
  final double w;
  final double h;
  final double variante;
}

class _Mota {
  _Mota({required this.x, required this.y, required this.v, required this.r});

  double x;
  double y;
  final double v;
  final double r;
}
