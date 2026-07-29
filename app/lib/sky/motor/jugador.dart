import 'dart:math' as math;
import 'dart:ui';

import '../datos/paises.dart';
import '../ui/naves.dart';
import 'armas.dart';
import 'balas.dart';
import 'constantes.dart';
import 'mandos.dart';
import 'partida.dart';

/// Colores del casco de cada jugador, para distinguirlos de un vistazo.
const List<Color> coloresJugador = [
  Color(0xFF4FC3F7),
  Color(0xFFFF8A65),
  Color(0xFFAED581),
  Color(0xFFCE93D8),
];

class Jugador implements Blanco {
  Jugador({required this.indice, required this.pais, required this.nave})
      : x = anchoCampo / 2 + (indice - 1.5) * 52,
        y = altoCampo - 90,
        bombas = nave.bombas;

  final int indice;
  final Pais pais;
  final Nave nave;

  @override
  double x;
  @override
  double y;
  @override
  bool viva = true;

  final double radio = radioJugador;

  int nivel = 1;
  int bombas;
  double velocidadExtra = 0;

  /// Al empezar, para no morir durante la cuenta atrás.
  double invulnerable = 2.5;
  double esperandoRevivir = 0;

  double cadencia = 0;
  double inclinacion = 0;
  double t = 0;
  bool disparando = false;

  /// Adónde arrastra el dedo, en coordenadas del campo.
  ///
  /// En el móvil no hay palanca: la nave sigue al dedo. Si esto tiene valor,
  /// manda sobre el mando, y soltar el dedo (ponerlo a null) es lo que deja de
  /// disparar. Eso último importa: la insignia del segundo escenario se gana
  /// justo por dejar de disparar.
  Offset? destinoTactil;

  Color get color => coloresJugador[indice % coloresJugador.length];

  double get velocidad => (150 + nave.velocidad * 22) * (1 + velocidadExtra);

  void actualizar(double dt, Partida partida, Mandos mandos) {
    t += dt;

    if (!viva) {
      esperandoRevivir -= dt;
      if (esperandoRevivir <= 0 && partida.vidas > 0) _revivir();
      return;
    }

    invulnerable = math.max(0, invulnerable - dt);

    final mando = mandos.estado(indice);
    final destino = destinoTactil;
    var direccion = 0.0;

    if (destino != null) {
      // La nave persigue al dedo sin teletransportarse: sigue limitada por su
      // velocidad, así que una nave lenta se sigue notando lenta.
      final dx = destino.dx - x;
      final dy = destino.dy - y;
      final distancia = math.sqrt(dx * dx + dy * dy);
      if (distancia > 1) {
        final avance = math.min(distancia, velocidad * dt);
        x += (dx / distancia) * avance;
        y += (dy / distancia) * avance;
        direccion = dx.sign;
      }
    } else {
      final largo = math.sqrt(mando.x * mando.x + mando.y * mando.y);
      if (largo > 0) {
        // Normalizar la diagonal: sin esto, moverse en diagonal sería un 41%
        // más rápido que moverse recto, y todo el mundo jugaría en diagonal.
        final factor = math.min(1, largo);
        x += (mando.x / largo) * factor * velocidad * dt;
        y += (mando.y / largo) * factor * velocidad * dt;
      }
      direccion = mando.x.sign;
    }

    x = x.clamp(14, anchoCampo - 14);
    y = y.clamp(24, altoCampo - 20);

    // El alabeo persigue a la dirección en vez de saltar: se nota mucho en el
    // tacto aunque el jugador no sepa decir por qué.
    inclinacion += (direccion - inclinacion) * math.min(1, dt * 9);

    disparando = mando.disparo || destino != null;
    cadencia -= dt;
    if (disparando && cadencia <= 0) {
      cadencia = pais.arma.cadencia;
      partida.balasJugador.addAll(dispararArma(
        Tirador(x: x, y: y, nivel: nivel, poder: nave.poder, indice: indice),
        pais.arma,
        azar: partida.azar,
      ));
    }

    if (mandos.pulsado(indice, 'bomba')) partida.lanzarBomba(this);
    if (mandos.pulsado(indice, 'donar')) partida.donarVida(this);
  }

  void _revivir() {
    viva = true;
    x = anchoCampo / 2 + (indice - 1.5) * 52;
    y = altoCampo - 60;
    invulnerable = 2.5;
  }

  /// Le han dado. Devuelve true si ha muerto de verdad.
  ///
  /// Perder una vida solo baja un nivel de potencia, no lo quita todo: el
  /// original castigaba tanto morir que la partida se volvía imposible de
  /// remontar, y en cooperativo eso arruina la tarde de quien va peor.
  bool golpear(Partida partida) {
    if (!viva || invulnerable > 0) return false;

    viva = false;
    esperandoRevivir = 1.4;
    nivel = math.max(1, nivel - 1);
    partida.efectos.explosion(x, y, tamano: 1.6, color: color);
    return true;
  }

  void recoger(String tipo, Partida partida) {
    switch (tipo) {
      case 'P':
        nivel = math.min(nivelMaximo, nivel + 1);
        partida.efectos.rotulo(x, y - 20, 'POTENCIA $nivel', color: const Color(0xFFFFD54F));
      case 'F':
        nivel = nivelMaximo;
        partida.efectos.rotulo(x, y - 20, '¡POTENCIA MÁXIMA!', color: const Color(0xFFFFD54F));
      case 'B':
        bombas = math.min(bombasMaximas, bombas + 1);
        partida.efectos.rotulo(x, y - 20, 'BOMBA', color: const Color(0xFF4FC3F7));
      case 'S':
        velocidadExtra = math.min(velocidadExtraMaxima, velocidadExtra + 0.1);
        partida.efectos.rotulo(x, y - 20, 'VELOCIDAD', color: const Color(0xFFAED581));
    }
  }

  void dibujar(Canvas canvas) {
    if (!viva) return;
    // Parpadeo mientras es invulnerable: se ve que está protegido, y se ve
    // también que eso se acaba.
    if (invulnerable > 0 && (t * 14).floor().isEven) return;

    canvas.save();
    canvas.translate(x, y);
    dibujarNave(canvas, nave.silueta, pais.colores, escala: 34, inclinacion: inclinacion, t: t);
    canvas.restore();

    // Marca del jugador y punto de choque: con cuatro naves en pantalla es la
    // única forma de saber cuál eres.
    canvas.drawCircle(Offset(x, y), 2.5, Paint()..color = color.withValues(alpha: 0.9));
  }
}
