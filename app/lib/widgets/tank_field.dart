import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../services/tank_client.dart';

/// Dibuja el campo de batalla: muros, tanques y balas.
///
/// Todo llega ya calculado por el servidor; aquí solo se pinta. El cliente no
/// decide nada del juego, igual que en el ajedrez.
class TankFieldPainter extends CustomPainter {
  const TankFieldPainter({required this.world});

  final TankWorld world;

  static const _ground = Color(0xFF14110F);
  static const _brick = Color(0xFF9C5A3C);
  static const _steel = Color(0xFF9AA0A6);
  static const _bush = Color(0xFF2E7D32);
  static const _water = Color(0xFF1565C0);
  static const _ice = Color(0xFF9AD5E8);

  @override
  void paint(Canvas canvas, Size size) {
    final cell = size.shortestSide / world.size;
    canvas.drawRect(Offset.zero & size, Paint()..color = _ground);

    _paintWalls(canvas, cell);
    _paintPickups(canvas, cell);
    _paintTanks(canvas, cell);
    _paintBullets(canvas, cell);
    // Los arbustos se pintan los últimos, encima de todo: de eso se trata,
    // de que tapen a quien se meta debajo.
    _paintBushes(canvas, cell);
    _paintEffects(canvas, cell);
    _paintBorder(canvas, cell);
  }

  /// Explosiones y destellos. Van encima de los arbustos: si un tanque revienta
  /// dentro de uno, la explosión debe verse igual.
  void _paintEffects(Canvas canvas, double cell) {
    for (final effect in world.effects) {
      final centre = Offset(effect.x * cell, effect.y * cell);
      final t = effect.progress;
      if (t >= 1) continue;

      switch (effect.kind) {
        case 'shot':
          // Fogonazo breve al salir la bala.
          canvas.drawCircle(
            centre,
            cell * (0.5 + t * 0.4),
            Paint()..color = Colors.amberAccent.withValues(alpha: (1 - t) * 0.7),
          );

        case 'brick':
          // Cascotes saliendo del ladrillo roto.
          final debris = Paint()
            ..color = _brick.withValues(alpha: (1 - t).clamp(0, 1).toDouble());
          for (var i = 0; i < 6; i++) {
            final angle = i * 1.05;
            final distance = cell * (0.2 + t * 1.1);
            canvas.drawRect(
              Rect.fromCenter(
                center: centre.translate(
                  distance * math.cos(angle),
                  distance * math.sin(angle),
                ),
                width: cell * 0.3 * (1 - t),
                height: cell * 0.3 * (1 - t),
              ),
              debris,
            );
          }

        case 'tank':
          // Bola de fuego que se abre y se apaga.
          canvas.drawCircle(
            centre,
            cell * (0.6 + t * 2.2),
            Paint()..color = Colors.deepOrange.withValues(alpha: (1 - t) * 0.55),
          );
          canvas.drawCircle(
            centre,
            cell * (0.3 + t * 1.4),
            Paint()..color = Colors.amber.withValues(alpha: (1 - t) * 0.9),
          );
      }
    }
  }

  /// Marco del campo. Sin él no se ve dónde acaba el terreno y parece que se
  /// pudiera seguir avanzando.
  void _paintBorder(Canvas canvas, double cell) {
    final side = cell * world.size;
    final thickness = cell * 0.5;
    final frame = Rect.fromLTWH(
      thickness / 2,
      thickness / 2,
      side - thickness,
      side - thickness,
    );
    canvas.drawRect(
      frame,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = thickness
        ..color = Colors.white.withValues(alpha: 0.85),
    );
  }

  void _paintWalls(Canvas canvas, double cell) {
    if (world.walls.length < world.size * world.size) return;

    final brick = Paint()..color = _brick;
    final steel = Paint()..color = _steel;
    // Ranuras del ladrillo, para que no parezca un cuadrado liso.
    final mortar = Paint()
      ..color = Colors.black.withValues(alpha: 0.25)
      ..strokeWidth = 1;

    for (var y = 0; y < world.size; y++) {
      for (var x = 0; x < world.size; x++) {
        final value = world.walls[y * world.size + x];
        if (value == 0 || value == 3) continue; // los arbustos van aparte

        final rect = Rect.fromLTWH(x * cell, y * cell, cell, cell);
        if (value == 5) {
          // Hielo: se pisa, pero el tanque patina al soltar.
          canvas.drawRect(rect, Paint()..color = _ice);
          canvas.drawLine(
            Offset(rect.left + cell * 0.2, rect.bottom - cell * 0.2),
            Offset(rect.right - cell * 0.2, rect.top + cell * 0.2),
            Paint()
              ..color = Colors.white.withValues(alpha: 0.7)
              ..strokeWidth = cell * 0.08,
          );
          continue;
        }
        if (value == 4) {
          // Agua: corta el paso a los tanques pero las balas la cruzan.
          canvas.drawRect(rect, Paint()..color = _water);
          canvas.drawLine(
            Offset(rect.left, rect.center.dy),
            Offset(rect.right, rect.center.dy),
            Paint()
              ..color = Colors.white.withValues(alpha: 0.35)
              ..strokeWidth = cell * 0.1,
          );
          continue;
        }
        canvas.drawRect(rect, value == 1 ? brick : steel);
        if (value == 1) {
          canvas.drawLine(
            Offset(rect.left, rect.center.dy),
            Offset(rect.right, rect.center.dy),
            mortar,
          );
          canvas.drawLine(
            Offset(rect.center.dx, rect.top),
            Offset(rect.center.dx, rect.center.dy),
            mortar,
          );
        }
      }
    }
  }

  /// Arbustos: manchas de hojas por las que se puede pasar y esconderse.
  void _paintBushes(Canvas canvas, double cell) {
    if (world.walls.length < world.size * world.size) return;
    final leaves = Paint()..color = _bush.withValues(alpha: 0.92);

    for (var y = 0; y < world.size; y++) {
      for (var x = 0; x < world.size; x++) {
        if (world.walls[y * world.size + x] != 3) continue;
        final rect = Rect.fromLTWH(x * cell, y * cell, cell, cell);
        canvas.drawCircle(rect.center, cell * 0.55, leaves);
        canvas.drawCircle(
          rect.center.translate(-cell * 0.22, -cell * 0.18),
          cell * 0.34,
          Paint()..color = const Color(0xFF43A047).withValues(alpha: 0.9),
        );
      }
    }
  }

  /// Cofres: lo que sueltan se distingue por color e icono.
  void _paintPickups(Canvas canvas, double cell) {
    for (final pickup in world.pickups) {
      final centre = Offset(pickup.x * cell, pickup.y * cell);
      final (color, symbol) = switch (pickup.kind) {
        'life' => (const Color(0xFF2FBF71), '+'),
        'defense' => (const Color(0xFF3A86FF), '◇'),
        _ => (const Color(0xFFFFBE0B), '★'),
      };

      final box = Rect.fromCenter(
          center: centre, width: cell * 1.5, height: cell * 1.5);
      canvas.drawRRect(
        RRect.fromRectAndRadius(box, Radius.circular(cell * 0.25)),
        Paint()..color = color,
      );
      canvas.drawRRect(
        RRect.fromRectAndRadius(box, Radius.circular(cell * 0.25)),
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = cell * 0.12
          ..color = Colors.white,
      );

      // Marcas de lo que le queda: hay que romperlo a tiros.
      for (var i = 0; i < 3; i++) {
        final pip = Rect.fromLTWH(
          box.left + cell * 0.15 + i * cell * 0.45,
          box.bottom + cell * 0.12,
          cell * 0.3,
          cell * 0.16,
        );
        canvas.drawRect(
          pip,
          Paint()..color = i < pickup.hp ? color : Colors.white24,
        );
      }

      final label = TextPainter(
        text: TextSpan(
          text: symbol,
          style: TextStyle(
            color: Colors.white,
            fontSize: cell * 0.95,
            fontWeight: FontWeight.bold,
            height: 1,
          ),
        ),
        textDirection: TextDirection.ltr,
      )..layout();
      label.paint(canvas, centre - Offset(label.width / 2, label.height / 2));
    }
  }

  void _paintTanks(Canvas canvas, double cell) {
    for (final tank in world.tanks) {
      if (!tank.alive) continue;

      final centre = Offset(tank.x * cell, tank.y * cell);
      final half = world.tankSize * cell / 2;
      final color = Color(tank.color);
      final horizontal = tank.dir == 'left' || tank.dir == 'right';

      // Orugas: dos barras oscuras a los costados, paralelas a la marcha. Van
      // debajo del casco para que asomen por los lados.
      final trackWidth = half * 0.42;
      final tracks = Paint()..color = const Color(0xFF2B2B2B);
      if (horizontal) {
        canvas.drawRect(
          Rect.fromLTRB(centre.dx - half, centre.dy - half,
              centre.dx + half, centre.dy - half + trackWidth),
          tracks,
        );
        canvas.drawRect(
          Rect.fromLTRB(centre.dx - half, centre.dy + half - trackWidth,
              centre.dx + half, centre.dy + half),
          tracks,
        );
      } else {
        canvas.drawRect(
          Rect.fromLTRB(centre.dx - half, centre.dy - half,
              centre.dx - half + trackWidth, centre.dy + half),
          tracks,
        );
        canvas.drawRect(
          Rect.fromLTRB(centre.dx + half - trackWidth, centre.dy - half,
              centre.dx + half, centre.dy + half),
          tracks,
        );
      }

      // Casco, entre las dos orugas.
      final hull = horizontal
          ? Rect.fromLTRB(centre.dx - half * 0.9, centre.dy - half + trackWidth,
              centre.dx + half * 0.9, centre.dy + half - trackWidth)
          : Rect.fromLTRB(centre.dx - half + trackWidth, centre.dy - half * 0.9,
              centre.dx + half - trackWidth, centre.dy + half * 0.9);
      canvas.drawRRect(
        RRect.fromRectAndRadius(hull, Radius.circular(cell * 0.12)),
        Paint()..color = color,
      );

      // Cañón. Se pinta oscuro y no del color del tanque: sobre el casco de su
      // propio color no se vería, y es lo único que dice hacia dónde apunta.
      final barrelPaint = Paint()..color = const Color(0xFF1C1C1C);
      final barrelHalf = cell * 0.16;
      final reach = half * 1.35;
      final barrel = switch (tank.dir) {
        'up' => Rect.fromLTRB(centre.dx - barrelHalf, centre.dy - reach,
            centre.dx + barrelHalf, centre.dy),
        'down' => Rect.fromLTRB(centre.dx - barrelHalf, centre.dy,
            centre.dx + barrelHalf, centre.dy + reach),
        'left' => Rect.fromLTRB(centre.dx - reach, centre.dy - barrelHalf,
            centre.dx, centre.dy + barrelHalf),
        _ => Rect.fromLTRB(centre.dx, centre.dy - barrelHalf,
            centre.dx + reach, centre.dy + barrelHalf),
      };
      canvas.drawRect(barrel, barrelPaint);

      // Torreta, que tapa el arranque del cañón y remata la silueta.
      canvas.drawCircle(centre, half * 0.42, Paint()..color = color);
      canvas.drawCircle(
        centre,
        half * 0.42,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = cell * 0.07
          ..color = const Color(0xFF1C1C1C),
      );

      // El tanque propio lleva un aro para no perderlo de vista en el jaleo.
      if (tank.id == world.yourTankId) {
        canvas.drawCircle(
          centre,
          half * 1.3,
          Paint()
            ..style = PaintingStyle.stroke
            ..strokeWidth = cell * 0.12
            ..color = Colors.white.withValues(alpha: 0.9),
        );
      }

      _paintHealthBar(canvas, tank, centre, half, cell);

      // La barra de carga solo en el tanque propio: en los demás sería ruido.
      if (tank.id == world.yourTankId && tank.charging > 0) {
        final bar = Rect.fromLTWH(centre.dx - half,
            centre.dy + half + cell * 0.2, half * 2, cell * 0.24);
        canvas.drawRect(bar, Paint()..color = Colors.black54);
        canvas.drawRect(
          Rect.fromLTWH(bar.left, bar.top, bar.width * tank.chargeRatio, bar.height),
          Paint()
            ..color = tank.isCharged ? Colors.amberAccent : Colors.white70,
        );
      }
    }
  }

  void _paintHealthBar(
    Canvas canvas,
    TankView tank,
    Offset centre,
    double half,
    double cell,
  ) {
    if (tank.hp >= tank.maxHp) return;

    final width = half * 2;
    final bar = Rect.fromLTWH(
        centre.dx - half, centre.dy - half - cell * 0.45, width, cell * 0.22);
    canvas.drawRect(bar, Paint()..color = Colors.black54);
    canvas.drawRect(
      Rect.fromLTWH(bar.left, bar.top, width * (tank.hp / tank.maxHp), bar.height),
      Paint()..color = tank.hp > tank.maxHp / 3 ? Colors.greenAccent : Colors.redAccent,
    );
  }

  void _paintBullets(Canvas canvas, double cell) {
    for (final bullet in world.bullets) {
      final centre = Offset(bullet.x * cell, bullet.y * cell);

      if (!bullet.charged) {
        canvas.drawCircle(centre, cell * 0.18, Paint()..color = Colors.amberAccent);
        continue;
      }

      // El cargado lleva halo y núcleo blanco: hay que distinguirlo de un
      // vistazo, porque es el que revienta el acero.
      canvas.drawCircle(
        centre,
        cell * 0.55,
        Paint()
          ..color = const Color(0xFF7CE7FF).withValues(alpha: 0.35)
          ..maskFilter = MaskFilter.blur(BlurStyle.normal, cell * 0.25),
      );
      canvas.drawCircle(centre, cell * 0.34, Paint()..color = const Color(0xFF7CE7FF));
      canvas.drawCircle(centre, cell * 0.16, Paint()..color = Colors.white);
    }
  }

  @override
  bool shouldRepaint(TankFieldPainter old) => true; // cambia veinte veces por segundo
}

/// Cruceta de movimiento.
///
/// Se eligió cruceta en vez de palanca porque los tanques solo van en cuatro
/// direcciones: una palanca daría diagonales que el juego no puede usar.
class TankPad extends StatelessWidget {
  const TankPad({super.key, required this.onDirection, required this.direction});

  /// Se llama con la dirección pulsada, o null al soltar.
  final void Function(String?) onDirection;
  final String? direction;

  @override
  Widget build(BuildContext context) {
    Widget arrow(String dir, IconData icon) {
      final active = direction == dir;
      return Listener(
        onPointerDown: (_) => onDirection(dir),
        onPointerUp: (_) => onDirection(null),
        onPointerCancel: (_) => onDirection(null),
        child: Container(
          width: 56,
          height: 56,
          decoration: BoxDecoration(
            color: active
                ? Colors.white.withValues(alpha: 0.35)
                : Colors.white.withValues(alpha: 0.12),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Icon(icon, size: 30),
        ),
      );
    }

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        arrow('up', Icons.keyboard_arrow_up),
        Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            arrow('left', Icons.keyboard_arrow_left),
            const SizedBox(width: 56),
            arrow('right', Icons.keyboard_arrow_right),
          ],
        ),
        arrow('down', Icons.keyboard_arrow_down),
      ],
    );
  }
}

/// Botón de disparo. Se dispara mientras se mantiene pulsado.
class FireButton extends StatelessWidget {
  const FireButton({super.key, required this.onFiring, required this.firing});

  final void Function(bool) onFiring;
  final bool firing;

  @override
  Widget build(BuildContext context) {
    return Listener(
      onPointerDown: (_) => onFiring(true),
      onPointerUp: (_) => onFiring(false),
      onPointerCancel: (_) => onFiring(false),
      child: Container(
        width: 92,
        height: 92,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: firing
              ? Colors.redAccent.withValues(alpha: 0.75)
              : Colors.redAccent.withValues(alpha: 0.35),
          border: Border.all(color: Colors.redAccent, width: 2),
        ),
        child: const Icon(Icons.local_fire_department, size: 42),
      ),
    );
  }
}
