import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:flutter/material.dart';

import '../motor/constantes.dart';
import '../motor/enemigos.dart' show dibujarFormaEnemigo;
import '../motor/jefe.dart' show dibujarFormaJefe;
import '../ui/naves.dart' show dibujarNave;
import 'sky_client.dart';

/// Pinta el mundo que manda el servidor.
///
/// No calcula nada: cada cosa viene con su sitio, su tamaño y sus colores, y
/// aquí solo se dibuja. Las siluetas —las naves, los diecinueve tipos de enemigo
/// y los jefes— son las mismas funciones que usa el juego de un solo móvil, que
/// ya las tenía hechas y solo piden datos sueltos.
class PintorDeRed extends CustomPainter {
  PintorDeRed({
    required this.mundo,
    required this.colorPorPiloto,
    required this.siluetaPorPiloto,
    required this.imagenPorPiloto,
    required this.t,
  });

  final SkyMundo mundo;

  /// Los colores y la silueta de cada nave salen de la sala, no del fotograma:
  /// no cambian en toda la partida y mandarlos sesenta veces por segundo sería
  /// repetir lo mismo.
  final Map<int, List<Color>> colorPorPiloto;
  final Map<int, String> siluetaPorPiloto;

  /// El dibujo propio de cada nave, si se ha subido uno y ya ha llegado.
  final Map<int, ui.Image> imagenPorPiloto;

  /// Reloj propio del móvil, solo para lo que se menea al pintar (el fuego del
  /// propulsor, el parpadeo de un invulnerable). No decide nada.
  final double t;

  @override
  void paint(Canvas canvas, Size size) {
    // El juego piensa siempre en 480x640; el lienzo se escala al hueco que haya.
    final escala = math.min(size.width / anchoCampo, size.height / altoCampo);
    canvas.save();
    canvas.translate(
      (size.width - anchoCampo * escala) / 2,
      (size.height - altoCampo * escala) / 2,
    );
    canvas.scale(escala);
    canvas.clipRect(const Rect.fromLTWH(0, 0, anchoCampo, altoCampo));

    _fondo(canvas);
    _powerups(canvas);
    _enemigos(canvas);
    _jefe(canvas);
    _escudos(canvas);
    _jugadores(canvas);
    _balas(canvas, mundo.balasJugador);
    _balas(canvas, mundo.balasEnemigo);

    canvas.restore();
  }

  // ---------------------------------------------------------------------------

  void _fondo(Canvas canvas) {
    canvas.drawRect(
      const Rect.fromLTWH(0, 0, anchoCampo, altoCampo),
      Paint()..color = const Color(0xFF0B1026),
    );

    // Estrellas: se sacan del número de fotograma para que las mismas salgan en
    // el mismo sitio en todos los móviles, sin mandarlas por la red.
    final pincel = Paint()..color = const Color(0x66FFFFFF);
    for (var i = 0; i < 60; i++) {
      final x = (i * 79) % anchoCampo;
      final y = ((i * 137) + mundo.fotograma * (1 + i % 3)) % altoCampo;
      canvas.drawCircle(Offset(x.toDouble(), y.toDouble()), i % 5 == 0 ? 1.6 : 1, pincel);
    }
  }

  void _jugadores(Canvas canvas) {
    for (final jugador in mundo.jugadores) {
      if (!jugador.vivo) continue;

      // Al revivir se parpadea: es la señal de que todavía no te pueden matar.
      if (jugador.invulnerable && (t * 12).floor().isEven) continue;

      canvas.save();
      canvas.translate(jugador.x, jugador.y);

      final propia = imagenPorPiloto[jugador.indice];
      if (propia != null) {
        // El dibujo subido manda sobre la silueta. Se encaja en el mismo hueco
        // que ocuparía la nave dibujada, sin deformarlo: una imagen estirada se
        // nota más que una pequeña.
        _dibujarImagen(canvas, propia, jugador.inclinacion);
      } else {
        dibujarNave(
          canvas,
          siluetaPorPiloto[jugador.indice] ?? 'caza',
          colorPorPiloto[jugador.indice] ?? const [Colors.white, Colors.blueGrey, Colors.amber],
          inclinacion: jugador.inclinacion,
          t: t,
        );
      }
      canvas.restore();

      // La tuya lleva una marca debajo: con cuatro naves iguales en pantalla, no
      // saber cuál eres es lo primero que mata.
      if (jugador.indice == mundo.tuIndice) {
        canvas.drawCircle(
          Offset(jugador.x, jugador.y + 22),
          3,
          Paint()..color = const Color(0xCCFFFFFF),
        );
      }
    }
  }

  /// El PNG de una nave, centrado y a la escala del juego.
  ///
  /// Se respeta la proporción de la imagen: entra en un cuadrado de 40 y lo que
  /// sobre queda vacío. Estirarla para llenarlo dejaría todas las naves con la
  /// misma silueta gorda.
  void _dibujarImagen(Canvas canvas, ui.Image imagen, double inclinacion) {
    const lado = 40.0;
    final escala = lado / math.max(imagen.width, imagen.height);
    final ancho = imagen.width * escala;
    final alto = imagen.height * escala;

    canvas.save();
    canvas.rotate(inclinacion * 0.12);
    canvas.drawImageRect(
      imagen,
      Rect.fromLTWH(0, 0, imagen.width.toDouble(), imagen.height.toDouble()),
      Rect.fromCenter(center: Offset.zero, width: ancho, height: alto),
      Paint()..filterQuality = FilterQuality.medium,
    );
    canvas.restore();
  }

  void _enemigos(Canvas canvas) {
    for (final e in mundo.enemigos) {
      canvas.save();
      canvas.translate(e.x, e.y);
      dibujarFormaEnemigo(canvas, e.forma, e.colores, e.radio, t);
      canvas.restore();

      // Barra de vida solo a los gordos: sobre un dron sería ruido.
      if (e.rango > 0 && e.vida < 100) {
        _barraDeVida(canvas, e.x, e.y - e.radio - 8, e.radio * 2, e.vida / 100);
      }
    }
  }

  void _jefe(Canvas canvas) {
    final jefe = mundo.jefe;
    if (jefe == null) return;

    canvas.save();
    canvas.translate(jefe.x, jefe.y);
    dibujarFormaJefe(canvas, jefe.forma, jefe.colores, jefe.radio, t, jefe.vida / 100);
    canvas.restore();

    for (final parte in jefe.partes) {
      canvas.drawCircle(
        Offset(parte.x, parte.y),
        parte.radio,
        Paint()
          ..color = parte.colores.last.withValues(alpha: 0.85)
          ..style = PaintingStyle.stroke
          ..strokeWidth = 2,
      );
    }
  }

  void _balas(Canvas canvas, List<CosaView> balas) {
    for (final bala in balas) {
      final pincel = Paint()..color = bala.color;
      switch (bala.forma) {
        case 'misil':
          canvas.drawRect(
            Rect.fromCenter(center: Offset(bala.x, bala.y), width: 4, height: 12),
            pincel,
          );
        case 'rombo':
          final camino = Path()
            ..moveTo(bala.x, bala.y - bala.radio * 1.6)
            ..lineTo(bala.x + bala.radio, bala.y)
            ..lineTo(bala.x, bala.y + bala.radio * 1.6)
            ..lineTo(bala.x - bala.radio, bala.y)
            ..close();
          canvas.drawPath(camino, pincel);
        case 'rayo':
          canvas.drawRect(
            Rect.fromCenter(center: Offset(bala.x, bala.y), width: bala.radio, height: 26),
            pincel,
          );
        default:
          canvas.drawCircle(Offset(bala.x, bala.y), bala.radio, pincel);
      }
    }
  }

  void _powerups(Canvas canvas) {
    for (final premio in mundo.powerups) {
      final color = switch (premio.forma) {
        'potencia' => const Color(0xFFFFC107),
        'vida' => const Color(0xFFEF5350),
        'bomba' => const Color(0xFF4FC3F7),
        'velocidad' => const Color(0xFF66BB6A),
        _ => const Color(0xFFE0E0E0),
      };

      canvas.drawCircle(Offset(premio.x, premio.y), premio.radio, Paint()..color = color);
      canvas.drawCircle(
        Offset(premio.x, premio.y),
        premio.radio,
        Paint()
          ..color = const Color(0xFFFFFFFF)
          ..style = PaintingStyle.stroke
          ..strokeWidth = 2,
      );
    }
  }

  void _escudos(Canvas canvas) {
    if (mundo.escudos.isEmpty) return;

    final pincel = Paint()
      ..color = const Color(0xAA80DEEA)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 4
      ..strokeCap = StrokeCap.round;

    for (final escudo in mundo.escudos) {
      canvas.drawLine(escudo.topLeft, escudo.bottomRight, pincel);
    }
  }

  void _barraDeVida(Canvas canvas, double x, double y, double ancho, double fraccion) {
    final caja = Rect.fromCenter(center: Offset(x, y), width: ancho, height: 3);
    canvas.drawRect(caja, Paint()..color = const Color(0x66000000));
    canvas.drawRect(
      Rect.fromLTWH(caja.left, caja.top, caja.width * fraccion.clamp(0, 1), caja.height),
      Paint()..color = const Color(0xFFEF5350),
    );
  }

  @override
  bool shouldRepaint(PintorDeRed anterior) =>
      anterior.mundo != mundo ||
      anterior.t != t ||
      anterior.imagenPorPiloto.length != imagenPorPiloto.length;
}
