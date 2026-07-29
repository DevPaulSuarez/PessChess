import 'dart:math' as math;
import 'dart:ui';

import 'constantes.dart';

/// Qué hace cada letra, y de qué color se pinta.
const Map<String, Color> coloresPowerUp = {
  'P': Color(0xFFFFD54F), // potencia
  'F': Color(0xFFFF8A65), // potencia máxima
  'B': Color(0xFF4FC3F7), // bomba
  'S': Color(0xFFAED581), // velocidad
  'M': Color(0xFFCE93D8), // moneda
  'H': Color(0xFFEF5350), // vida
  'I': Color(0xFFFFD700), // insignia del país
};

class PowerUp {
  PowerUp(this.x, this.y, this.tipo);

  double x;
  double y;
  final String tipo;
  final double radio = 11;
  double t = 0;
  bool viva = true;

  Color get color => coloresPowerUp[tipo] ?? coloresPowerUp['P']!;

  void actualizar(double dt) {
    t += dt;
    y += 55 * dt;
    x += math.sin(t * 3) * 26 * dt;
    if (y > altoCampo + 20) viva = false;
  }

  void dibujar(Canvas canvas) {
    final pulso = 1 + math.sin(t * 7) * 0.08;

    canvas.save();
    canvas.translate(x, y);
    canvas.scale(pulso, pulso);

    final caja = RRect.fromRectAndRadius(
      Rect.fromCenter(center: Offset.zero, width: radio * 2, height: radio * 2),
      const Radius.circular(4),
    );
    canvas.drawRRect(caja, Paint()..color = color);
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromCenter(center: Offset.zero, width: radio * 2 - 4, height: radio * 2 - 4),
        const Radius.circular(3),
      ),
      Paint()..color = const Color(0xBF000000),
    );

    canvas.restore();
  }
}

/// Qué suelta un enemigo al morir.
///
/// La vida solo cae cuando el equipo va mal: es una red de seguridad para que
/// una partida mal empezada no sea una condena, sin regalar nada a quien va
/// sobrado.
String? sorteoDePowerUp(math.Random azar, {required bool equipoTocado}) {
  final suerte = azar.nextDouble();
  if (suerte < 0.06) return 'P';
  if (suerte < 0.08) return 'B';
  if (suerte < 0.095) return 'S';
  if (suerte < 0.105 && equipoTocado) return 'H';
  if (suerte < 0.16) return 'M';
  return null;
}
