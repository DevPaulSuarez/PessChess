import 'dart:math' as math;
import 'dart:ui';

import '../datos/stages.dart';
import 'balas.dart';
import 'constantes.dart';
import 'dificultad.dart';
import 'partida.dart';

/// Todo lo que hay que abatir.
///
/// Un enemigo es una plantilla de datos (`datos/stages.dart`) más un patrón de
/// movimiento y otro de disparo. Con estos ocho y estos tres salen todos los
/// bichos de los tres escenarios, sin una clase por criatura.
class Enemigo implements Blanco {
  Enemigo(this.plantilla, this.x, this.y, Partida partida)
      : xBase = x,
        centroY = y,
        radio = plantilla.radio,
        vx = plantilla.vx,
        vy = plantilla.vy,
        // Los enemigos aguantan más cuanta más gente haya: si no, cuatro
        // jugadores barrerían la pantalla antes de que llegase a verse.
        vida = plantilla.vida * (1 + 0.22 * (partida.numJugadores - 1)),
        vidaMax = plantilla.vida * (1 + 0.22 * (partida.numJugadores - 1)) {
    final d = plantilla.disparo;
    cadencia = d == null ? double.infinity : d.cada * (0.4 + partida.azar.nextDouble() * 0.6);
  }

  final Plantilla plantilla;

  @override
  double x;
  @override
  double y;
  @override
  bool viva = true;

  double vx;
  double vy;
  final double radio;
  double vida;
  final double vidaMax;

  double xBase;
  double centroY;
  double t = 0;
  double destelloDano = 0;
  double lento = 0;
  late double cadencia;
  double anguloEspiral = 0;
  bool presa = false;
  bool escapo = false;
  bool contabilizado = false;

  /// Solo lo usan las campanas de la catedral: en qué orden están colocadas.
  int orden = 0;

  /// Quién le ha pegado hace poco. Es lo que detecta el ataque combinado.
  final Map<int, double> golpesRecientes = {};

  String get forma => plantilla.forma;
  String get categoria => plantilla.categoria;
  bool get esMidBoss => plantilla.esMidBoss;
  List<Color> get colores => plantilla.colores;
  int get puntos => plantilla.puntos;

  void actualizar(double dt, Partida partida) {
    t += dt;
    destelloDano = math.max(0, destelloDano - dt * 6);

    // Los cristales de sal y demás efectos de frenado.
    final escala = lento > 0 ? 0.45 : 1.0;
    lento = math.max(0, lento - dt);

    _mover(dt * escala, partida);

    final disparo = plantilla.disparo;
    if (disparo != null && partida.jugadoresVivos.isNotEmpty) {
      cadencia -= dt * escala;
      if (cadencia <= 0) {
        cadencia = disparo.cada;
        partida.balasEnemigo.addAll(_disparar(disparo, partida));
      }
    }

    golpesRecientes.removeWhere((_, cuando) => partida.tiempo - cuando > 0.6);

    // Fuera de pantalla por abajo o por los lados: se va sin dejar rastro. No
    // cuenta como abatido, y por eso dejar escapar enemigos baja el porcentaje.
    const margen = 60.0;
    if (y > altoCampo + margen || x < -margen || x > anchoCampo + margen) {
      viva = false;
      escapo = true;
    }
  }

  void _mover(double dt, Partida partida) {
    switch (plantilla.movimiento) {
      case 'seno':
        y += vy * dt;
        x = xBase + math.sin(t * plantilla.frecuencia) * plantilla.amplitud;

      case 'zigzag':
        y += vy * dt;
        // Cambia de lado por tramos: más brusco que el seno y más difícil de
        // leer, que es de lo que se trata.
        final tramo = (t * 1.6).floor().isEven ? 1 : -1;
        x += tramo * plantilla.amplitud * dt;

      case 'picada':
        if (!presa) {
          final objetivo = partida.jugadorMasCercano(x, y);
          if (objetivo != null) {
            final angulo = math.atan2(objetivo.y - y, objetivo.x - x);
            vx = math.cos(angulo) * plantilla.velocidadPicada;
            vy = math.sin(angulo) * plantilla.velocidadPicada;
            presa = true;
          }
        }
        x += vx * dt;
        y += vy * dt;

      case 'entrar':
        // Entra, se planta a una altura y se queda disparando.
        if (y < plantilla.alturaParada) {
          y += vy * dt;
        } else {
          y = plantilla.alturaParada;
          x += math.cos(t * 0.9) * 40 * dt;
        }

      case 'suelo':
        // Unidades de tierra: bajan con el suelo del escenario.
        y += vy * dt;
        x = xBase;

      case 'lateral':
        x += vx * dt;
        y += math.sin(t * 2) * 30 * dt;

      case 'orbita':
        centroY += vy * dt;
        x = xBase + math.cos(t * 1.8) * plantilla.amplitud;
        y = centroY + math.sin(t * 1.8) * 26;

      case 'quieto':
        break;

      default:
        x += vx * dt;
        y += vy * dt;
    }
  }

  List<Bala> _disparar(DisparoEnemigo disparo, Partida partida) {
    final extra = proyectilesExtra(partida.numJugadores);
    final velocidad = velocidadProyectil(disparo.velocidad, partida.numJugadores);

    switch (disparo.tipo) {
      case 'espiral':
        final cuantas = disparo.balas + extra;
        anguloEspiral += 0.7;
        return List.generate(
          cuantas,
          (i) => balaEnemiga(x, y, anguloEspiral + (i * math.pi * 2) / cuantas, velocidad, color: disparo.color),
        );

      case 'abanico':
        final cuantas = disparo.balas + 2 * extra;
        final apertura = disparo.apertura ?? 1.1;
        return List.generate(cuantas, (i) {
          final angulo = math.pi / 2 + (i - (cuantas - 1) / 2) * (apertura / cuantas);
          return balaEnemiga(x, y, angulo, velocidad, color: disparo.color);
        });

      case 'ninguno':
        return const [];

      default:
        final objetivo = partida.jugadorMasCercano(x, y);
        if (objetivo == null) return const [];

        final base = math.atan2(objetivo.y - y, objetivo.x - x);
        final cuantas = disparo.balas + extra;
        return List.generate(
          cuantas,
          (i) => balaEnemiga(x, y, base + (i - (cuantas - 1) / 2) * 0.16, velocidad, color: disparo.color),
        );
    }
  }

  /// Recibe daño. Devuelve los puntos ganados si ha muerto con este golpe.
  ///
  /// Aquí vive el ataque combinado: si tres jugadores o más le están pegando a
  /// la vez, el daño se multiplica por dos y medio. Es la mecánica que
  /// convierte cuatro jugadores dispersos en un equipo concentrando fuego.
  int golpear(double dano, int duenno, Partida partida) {
    golpesRecientes[duenno] = partida.tiempo;

    var multiplicador = 1.0;
    if (golpesRecientes.length >= 3) {
      multiplicador = 2.5;
      partida.combinadoActivo = 0.4;
    }

    vida -= dano * multiplicador;
    destelloDano = 1;

    if (vida > 0) return 0;
    viva = false;
    return puntos;
  }

  void dibujar(Canvas canvas) {
    canvas.save();
    canvas.translate(x, y);
    dibujarFormaEnemigo(canvas, forma, colores, radio, t, destelloDano);
    canvas.restore();

    // Barra de vida solo para los gordos: en los débiles sería ruido.
    if (vidaMax > 300 && vida < vidaMax) {
      final w = radio * 2;
      canvas.drawRect(
        Rect.fromLTWH(x - w / 2, y - radio - 8, w, 3),
        Paint()..color = const Color(0x99000000),
      );
      canvas.drawRect(
        Rect.fromLTWH(x - w / 2, y - radio - 8, w * (vida / vidaMax), 3),
        Paint()..color = const Color(0xFFEF5350),
      );
    }
  }
}

/// Las siluetas de los enemigos.
///
/// Todas miran hacia abajo (hacia el jugador) y caben en un círculo de `radio`,
/// que es justo el que se usa para las colisiones: lo que se ve es lo que
/// choca.
void dibujarFormaEnemigo(
  Canvas canvas,
  String forma,
  List<Color> colores,
  double radio,
  double t, [
  double destello = 0,
]) {
  final primario = Paint()..color = colores[0];
  final secundario = Paint()..color = colores[1];
  final acento = Paint()..color = colores[2];

  if (destello > 0) {
    // Un fogonazo blanco al recibir: sin esto no se sabe si estás acertando.
    primario.color = Color.lerp(colores[0], const Color(0xFFFFFFFF), destello * 0.7)!;
  }

  switch (forma) {
    case 'dron':
      final cuerpo = Path()
        ..moveTo(0, radio)
        ..lineTo(radio, -radio * 0.5)
        ..lineTo(0, -radio * 0.2)
        ..lineTo(-radio, -radio * 0.5)
        ..close();
      canvas.drawPath(cuerpo, primario);
      canvas.drawCircle(Offset(0, radio * 0.2), radio * 0.28, acento);

    case 'mosquito':
      canvas.drawOval(Rect.fromCenter(center: Offset.zero, width: radio * 0.8, height: radio * 2), primario);
      final alas = Paint()..color = const Color(0x66FFFFFF);
      for (final lado in [-1, 1]) {
        canvas.save();
        canvas.translate(lado * radio * 0.7, -radio * 0.2);
        canvas.rotate(lado * math.sin(t * 30) * 0.5);
        canvas.drawOval(Rect.fromCenter(center: Offset.zero, width: radio * 1.1, height: radio * 0.44), alas);
        canvas.restore();
      }

    case 'heli':
      canvas.drawOval(Rect.fromCenter(center: Offset.zero, width: radio * 1.1, height: radio * 1.8), primario);
      canvas.drawRect(Rect.fromLTWH(-radio * 0.15, radio * 0.6, radio * 0.3, radio * 0.7), secundario);
      // Palas: una barra que se estrecha y se ensancha, como al girar.
      final palas = Paint()..color = const Color(0xBFDCE6F0);
      canvas.drawRect(Rect.fromLTWH(-radio * 1.3, -radio * 0.9, radio * 2.6, 2.5), palas);
      canvas.save();
      canvas.scale(math.cos(t * 18).abs().clamp(0.05, 1), 1);
      canvas.drawRect(Rect.fromLTWH(-radio * 1.3, -radio * 0.9, radio * 2.6, 2.5), palas);
      canvas.restore();

    case 'tanque':
      canvas.drawRect(Rect.fromLTWH(-radio, -radio * 0.6, radio * 2, radio * 1.2), secundario);
      canvas.drawRect(Rect.fromLTWH(-radio * 0.6, -radio * 0.4, radio * 1.2, radio * 0.8), primario);
      canvas.drawRect(Rect.fromLTWH(-radio * 0.12, radio * 0.3, radio * 0.24, radio * 0.8), acento);

    case 'barco':
      final casco = Path()
        ..moveTo(-radio, -radio * 0.4)
        ..lineTo(radio, -radio * 0.4)
        ..lineTo(radio * 0.6, radio * 0.7)
        ..lineTo(-radio * 0.6, radio * 0.7)
        ..close();
      canvas.drawPath(casco, primario);
      canvas.drawRect(Rect.fromLTWH(-radio * 0.3, -radio * 0.9, radio * 0.6, radio * 0.6), acento);

    case 'submarino':
      canvas.drawOval(Rect.fromCenter(center: Offset.zero, width: radio * 2, height: radio), primario);
      canvas.drawRect(Rect.fromLTWH(-radio * 0.2, -radio * 0.9, radio * 0.4, radio * 0.5), acento);

    case 'arbol':
      canvas.drawRect(Rect.fromLTWH(-radio * 0.2, -radio, radio * 0.4, radio * 2), secundario);
      for (var i = 0; i < 3; i++) {
        canvas.drawCircle(
          Offset(math.cos(i * 2.1) * radio * 0.5, math.sin(i * 2.1) * radio * 0.5),
          radio * 0.6,
          primario,
        );
      }

    case 'pinguino':
      canvas.drawOval(Rect.fromCenter(center: Offset.zero, width: radio * 1.4, height: radio * 2), primario);
      canvas.drawOval(
        Rect.fromCenter(center: Offset(0, radio * 0.15), width: radio * 0.84, height: radio * 1.2),
        Paint()..color = const Color(0xFFFFFFFF),
      );
      final pico = Path()
        ..moveTo(0, radio * 0.9)
        ..lineTo(radio * 0.25, radio * 1.2)
        ..lineTo(-radio * 0.25, radio * 1.2)
        ..close();
      canvas.drawPath(pico, acento);

    case 'ave':
      final aleteo = math.sin(t * 8) * radio * 0.4;
      final alas = Path()
        ..moveTo(0, radio * 0.6)
        ..quadraticBezierTo(radio * 1.4, -radio * 0.2 + aleteo, radio * 0.3, -radio * 0.7)
        ..lineTo(-radio * 0.3, -radio * 0.7)
        ..quadraticBezierTo(-radio * 1.4, -radio * 0.2 + aleteo, 0, radio * 0.6)
        ..close();
      canvas.drawPath(alas, primario);

    case 'torreta':
      canvas.drawCircle(Offset.zero, radio, secundario);
      canvas.drawCircle(Offset.zero, radio * 0.6, primario);
      canvas.drawRect(Rect.fromLTWH(-radio * 0.15, 0, radio * 0.3, radio * 1.2), acento);

    case 'campana':
      final campana = Path()
        ..moveTo(-radio * 0.8, radio * 0.7)
        ..quadraticBezierTo(-radio * 0.8, -radio * 0.8, 0, -radio * 0.8)
        ..quadraticBezierTo(radio * 0.8, -radio * 0.8, radio * 0.8, radio * 0.7)
        ..close();
      canvas.drawPath(campana, primario);
      canvas.drawCircle(Offset(0, radio * 0.8), radio * 0.2, acento);

    case 'iceberg':
      final hielo = Path()
        ..moveTo(0, -radio)
        ..lineTo(radio, radio * 0.5)
        ..lineTo(radio * 0.3, radio)
        ..lineTo(-radio * 0.8, radio * 0.6)
        ..close();
      canvas.drawPath(hielo, primario);
      final cara = Path()
        ..moveTo(0, -radio)
        ..lineTo(radio * 0.4, radio * 0.1)
        ..lineTo(-radio * 0.2, radio * 0.2)
        ..close();
      canvas.drawPath(cara, Paint()..color = const Color(0x8CFFFFFF));

    case 'edificio':
      canvas.drawRect(Rect.fromLTWH(-radio, -radio, radio * 2, radio * 2), primario);
      for (var f = 0; f < 3; f++) {
        for (var c = 0; c < 3; c++) {
          canvas.drawRect(
            Rect.fromLTWH(-radio * 0.7 + c * radio * 0.55, -radio * 0.7 + f * radio * 0.55, radio * 0.3, radio * 0.3),
            acento,
          );
        }
      }

    default:
      canvas.drawCircle(Offset.zero, radio, primario);
  }
}

/// Los patrones que existen, para que las pruebas comprueben que ningún
/// escenario pide uno que nadie sabe hacer.
const List<String> movimientosValidos = [
  'recto', 'seno', 'zigzag', 'picada', 'entrar', 'suelo', 'lateral', 'orbita', 'quieto',
];

const List<String> disparosValidos = ['directo', 'espiral', 'abanico', 'ninguno'];
