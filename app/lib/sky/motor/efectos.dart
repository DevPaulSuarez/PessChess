import 'dart:math' as math;
import 'dart:ui';

/// Explosiones, chispas, rótulos y sacudidas de pantalla.
///
/// Nada de esto afecta a la partida: si se borrase entero, el juego seguiría
/// funcionando igual. Pero es lo que separa "el enemigo desapareció" de "he
/// reventado al enemigo", así que tiene su sitio propio.
class Efectos {
  final _azar = math.Random();
  final List<_Particula> _particulas = [];
  final List<_Onda> _ondas = [];
  final List<Rotulo> rotulos = [];

  double sacudida = 0;
  double destello = 0;

  void explosion(double x, double y, {double tamano = 1, Color color = const Color(0xFFFFB74D)}) {
    final cuantas = (10 * tamano).round();

    for (var i = 0; i < cuantas; i++) {
      final angulo = _azar.nextDouble() * math.pi * 2;
      final velocidad = (40 + _azar.nextDouble() * 150) * tamano;
      _particulas.add(_Particula(
        x: x,
        y: y,
        vx: math.cos(angulo) * velocidad,
        vy: math.sin(angulo) * velocidad,
        radio: (2 + _azar.nextDouble() * 3) * tamano,
        vida: 0.3 + _azar.nextDouble() * 0.4 * tamano,
        color: _azar.nextDouble() < 0.4 ? const Color(0xFFFFFFFF) : color,
      ));
    }

    _ondas.add(_Onda(x: x, y: y, radio: 4 * tamano, radioMax: 40 * tamano, color: color));
    sacudir(2.5 * tamano);
  }

  void chispa(double x, double y, Color color) {
    for (var i = 0; i < 3; i++) {
      final angulo = _azar.nextDouble() * math.pi * 2;
      _particulas.add(_Particula(
        x: x,
        y: y,
        vx: math.cos(angulo) * 90,
        vy: math.sin(angulo) * 90,
        radio: 1.6,
        vida: 0.16,
        color: color,
      ));
    }
  }

  void rotulo(double x, double y, String texto, {Color color = const Color(0xFFFFE082), double vida = 1.1}) {
    rotulos.add(Rotulo(x: x, y: y, texto: texto, color: color, vida: vida));
  }

  /// Fogonazo blanco a pantalla completa, para las bombas.
  void fogonazo(double intensidad) {
    destello = math.max(destello, intensidad);
  }

  void sacudir(double intensidad) {
    sacudida = math.min(14, sacudida + intensidad);
  }

  void actualizar(double dt) {
    for (final p in _particulas) {
      p.edad += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.94;
      p.vy *= 0.94;
    }
    _particulas.removeWhere((p) => p.edad >= p.vida);

    for (final o in _ondas) {
      o.edad += dt;
    }
    _ondas.removeWhere((o) => o.edad >= o.vida);

    for (final r in rotulos) {
      r.edad += dt;
      r.y -= 26 * dt;
    }
    rotulos.removeWhere((r) => r.edad >= r.vida);

    sacudida = math.max(0, sacudida - dt * 34);
    destello = math.max(0, destello - dt * 3.2);
  }

  /// Desplazamiento que hay que aplicar al mundo por la sacudida.
  Offset desplazamiento() {
    if (sacudida <= 0) return Offset.zero;
    return Offset(
      (_azar.nextDouble() - 0.5) * sacudida,
      (_azar.nextDouble() - 0.5) * sacudida,
    );
  }

  void dibujar(Canvas canvas) {
    for (final o in _ondas) {
      final avance = o.edad / o.vida;
      canvas.drawCircle(
        Offset(o.x, o.y),
        o.radio + (o.radioMax - o.radio) * avance,
        Paint()
          ..color = o.color.withValues(alpha: 1 - avance)
          ..style = PaintingStyle.stroke
          ..strokeWidth = 3 * (1 - avance) + 1
          ..blendMode = BlendMode.plus,
      );
    }

    for (final p in _particulas) {
      final restante = 1 - p.edad / p.vida;
      canvas.drawCircle(
        Offset(p.x, p.y),
        p.radio * restante,
        Paint()
          ..color = p.color.withValues(alpha: restante)
          ..blendMode = BlendMode.plus,
      );
    }
  }
}

class Rotulo {
  Rotulo({required this.x, required this.y, required this.texto, required this.color, required this.vida});

  final double x;
  double y;
  final String texto;
  final Color color;
  final double vida;
  double edad = 0;

  double get opacidad {
    final avance = edad / vida;
    return (1 - avance * avance).clamp(0, 1);
  }
}

class _Particula {
  _Particula({
    required this.x,
    required this.y,
    required this.vx,
    required this.vy,
    required this.radio,
    required this.vida,
    required this.color,
  });

  double x;
  double y;
  double vx;
  double vy;
  final double radio;
  final double vida;
  final Color color;
  double edad = 0;
}

class _Onda {
  _Onda({required this.x, required this.y, required this.radio, required this.radioMax, required this.color});

  final double x;
  final double y;
  final double radio;
  final double radioMax;
  final Color color;
  final double vida = 0.35;
  double edad = 0;
}
