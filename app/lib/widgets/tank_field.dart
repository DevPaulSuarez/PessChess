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

  @override
  void paint(Canvas canvas, Size size) {
    final cell = size.shortestSide / world.size;
    canvas.drawRect(Offset.zero & size, Paint()..color = _ground);

    _paintWalls(canvas, cell);
    _paintTanks(canvas, cell);
    _paintBullets(canvas, cell);
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
        if (value == 0) continue;

        final rect = Rect.fromLTWH(x * cell, y * cell, cell, cell);
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
    final paint = Paint()..color = Colors.amberAccent;
    for (final bullet in world.bullets) {
      canvas.drawCircle(
          Offset(bullet.x * cell, bullet.y * cell), cell * 0.18, paint);
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
