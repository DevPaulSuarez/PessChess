import 'dart:math' as math;
import 'dart:ui';

import '../datos/stages.dart';
import 'balas.dart';
import 'constantes.dart';
import 'dificultad.dart';
import 'partida.dart';
import 'puntuacion.dart';

/// Los jefes: varias fases, partes que se destruyen aparte y un láser.
///
/// Un jefe se describe con datos (`datos/stages.dart`) y esta clase los
/// ejecuta. Lo que hace que un jefe se sienta distinto de otro no es su código
/// sino el orden de sus fases y lo que obliga a hacer al equipo: repartirse las
/// partes, turnarse el láser o dejar de disparar y sobrevivir.
class Jefe implements Blanco {
  Jefe(this.def, Partida partida) {
    radio = def.radio;
    alturaBase = def.altura;
    x = anchoCampo / 2;
    y = -80;
    vx = def.velocidad;

    // La vida sale de la tabla de dificultad, no del escenario: así todos los
    // jefes escalan igual con el número de jugadores.
    vidaTotal = vidaDeJefe(partida.numJugadores) * def.escalaVida;
    vida = vidaTotal * fase.vida;
    vidaFase = vida;
    _montarPartes();
  }

  final DefJefe def;

  @override
  double x = 0;
  @override
  double y = 0;
  @override
  bool viva = true;

  late double radio;
  late double alturaBase;
  late double vx;
  late double vidaTotal;
  late double vida;
  late double vidaFase;

  int faseIndice = 0;
  double t = 0;
  double tFase = 0;
  bool entrando = true;
  double invulnerable = 0;
  double destelloDano = 0;
  double anguloGiro = 0;
  bool recibioDano = false;

  /// Si el equipo ha perdido alguna vida mientras este jefe estaba en pantalla.
  bool hirioAlEquipo = false;

  Laser? laser;

  final List<ParteViva> partes = [];
  final List<Offset> _rastro = [];
  final Map<Object, double> _temporizadores = {};

  String get nombre => def.nombre;
  List<Color> get colores => def.colores;

  /// La fase en curso.
  ///
  /// Se recorta al último índice porque al morir el jefe `faseIndice` se pasa
  /// del final, y todavía queda un fotograma en el que alguien lo dibuja.
  FaseJefe get fase => def.fases[math.min(faseIndice, def.fases.length - 1)];

  double get fraccionVida => vidaFase > 0 ? vida / vidaFase : 0;

  void _montarPartes() {
    partes
      ..clear()
      ..addAll(fase.partes.map((p) => ParteViva(p, vidaTotal / 10000)));
  }

  /// El núcleo solo es vulnerable cuando toca.
  ///
  /// Es lo que convierte a un jefe en un puzle además de en un saco de vida: la
  /// torre pide tirar las torretas primero, y a la serpiente hay que comérsela
  /// de la cola a la cabeza.
  bool vulnerable() {
    if (invulnerable > 0 || entrando) return false;
    if (!fase.requierePartes) return true;
    return partes.every((p) => !p.viva);
  }

  /// Partes a las que se puede disparar ahora mismo.
  List<ParteViva> partesVulnerables() {
    final vivas = partes.where((p) => p.viva).toList();
    if (!fase.deLaColaALaCabeza || vivas.isEmpty) return vivas;
    return [vivas.last]; // la serpiente se destruye por el rabo
  }

  void actualizar(double dt, Partida partida) {
    t += dt;
    tFase += dt;
    destelloDano = math.max(0, destelloDano - dt * 6);
    invulnerable = math.max(0, invulnerable - dt);

    if (entrando) {
      y += 90 * dt;
      if (y >= alturaBase) {
        y = alturaBase;
        entrando = false;
      }
      _moverPartes(dt);
      return;
    }

    _mover(dt, partida);
    _moverPartes(dt);

    if (invulnerable <= 0) {
      _ejecutarAtaques(dt, partida);
      _actualizarLaser(dt, partida);
    }
  }

  void _mover(double dt, Partida partida) {
    switch (fase.movimiento) {
      case 'zigzag':
        x += vx * dt;
        if (x < radio + 8 || x > anchoCampo - radio - 8) {
          vx = -vx;
          x = x.clamp(radio + 8, anchoCampo - radio - 8);
        }
        y = alturaBase + math.sin(t * 2.4).abs() * 40;

      case 'persigue':
        final objetivo = partida.jugadorMasCercano(x, y);
        if (objetivo != null) {
          x += (objetivo.x - x).sign * (fase.velocidadCaza ?? 70) * dt;
        }
        x = x.clamp(radio, anchoCampo - radio);
        y = alturaBase + math.sin(t * 2) * 18;

      case 'ascenso':
        // Sube despacio mientras el escenario cae: parece que lo persigue.
        y = alturaBase - math.min(60, tFase * 12);
        x = anchoCampo / 2 + math.sin(t * 1.3) * 90;

      case 'quieto':
        x = anchoCampo / 2;
        y = alturaBase;

      default: // vaivén
        x = anchoCampo / 2 + math.sin(t * (fase.ritmo ?? 0.9)) * (anchoCampo / 2 - radio - 10);
        y = alturaBase + math.sin(t * 1.7) * 12;
    }
  }

  void _moverPartes(double dt) {
    // El rastro guarda por dónde ha pasado la cabeza; los segmentos se colocan
    // en posiciones antiguas y así la serpiente ondula sola.
    _rastro.insert(0, Offset(x, y));
    if (_rastro.length > 240) _rastro.removeLast();

    for (final parte in partes) {
      final indice = parte.def.rastro;
      if (indice != null) {
        final punto = _rastro[math.min(_rastro.length - 1, indice)];
        parte.x = punto.dx;
        parte.y = punto.dy;
      } else {
        parte.x = x + parte.def.dx;
        parte.y = y + parte.def.dy;
      }
      parte.destelloDano = math.max(0, parte.destelloDano - dt * 6);
    }
  }

  void _ejecutarAtaques(double dt, Partida partida) {
    for (final ataque in fase.ataques) {
      final restante = (_temporizadores[ataque] ?? ataque.espera ?? 0.8) - dt;
      if (restante > 0) {
        _temporizadores[ataque] = restante;
        continue;
      }

      // Con más jugadores el jefe dispara más seguido, no solo más balas.
      final prisa = 1 - 0.08 * (partida.numJugadores - 1);
      _temporizadores[ataque] = ataque.cada * prisa;
      _atacar(ataque, partida);
    }

    final invoca = fase.invoca;
    if (invoca == null) return;

    final restante = (_temporizadores[invoca] ?? invoca.cada) - dt;
    if (restante > 0) {
      _temporizadores[invoca] = restante;
    } else {
      _temporizadores[invoca] = invoca.cada;
      partida.invocarEsbirros(invoca.plantilla, invoca.cuantos, x, y);
    }
  }

  void _atacar(AtaqueJefe a, Partida partida) {
    final extra = proyectilesExtra(partida.numJugadores);
    final velocidad = velocidadProyectil(a.velocidad, partida.numJugadores);

    switch (a.tipo) {
      case 'circulo':
        final cuantas = a.balas + 3 * extra;
        anguloGiro += a.giro ?? 0.35;
        for (var i = 0; i < cuantas; i++) {
          partida.balasEnemigo.add(balaEnemiga(
            x, y, anguloGiro + (i * math.pi * 2) / cuantas, velocidad,
            color: a.color, forma: a.forma,
          ));
        }

      case 'dirigido':
        final objetivo = partida.jugadorMasCercano(x, y);
        if (objetivo == null) return;
        final base = math.atan2(objetivo.y - y, objetivo.x - x);
        final cuantas = a.balas + extra;
        for (var i = 0; i < cuantas; i++) {
          partida.balasEnemigo.add(balaEnemiga(
            x, y, base + (i - (cuantas - 1) / 2) * 0.13, velocidad,
            color: a.color, forma: a.forma,
          ));
        }

      case 'lluvia':
        // Cae del cielo en columnas: obliga a moverse en horizontal.
        final cuantas = a.balas + 2 * extra;
        for (var i = 0; i < cuantas; i++) {
          partida.balasEnemigo.add(balaEnemiga(
            partida.azar.nextDouble() * anchoCampo, -10, math.pi / 2, velocidad,
            color: a.color, forma: a.forma,
          ));
        }

      case 'veneno':
        // Nubes que se quedan flotando y estorban.
        for (var i = 0; i < a.balas; i++) {
          partida.balasEnemigo.add(balaEnemiga(
            x + (partida.azar.nextDouble() - 0.5) * 80, y + 20, math.pi / 2, 30,
            color: a.color, radio: 16, alcance: 90,
          ));
        }

      case 'laser':
        // El ataque que obliga a coordinarse: uno atrae el haz y los demás
        // aprovechan.
        laser = Laser(
          angulo: 0,
          giro: (a.giro ?? 0.6) * (partida.azar.nextBool() ? 1 : -1),
          restante: a.duracion,
          color: a.color,
        );

      default: // abanico
        final cuantas = a.balas + 2 * extra;
        final apertura = a.apertura ?? 1.3;
        for (var i = 0; i < cuantas; i++) {
          final angulo = math.pi / 2 + (i - (cuantas - 1) / 2) * (apertura / cuantas);
          partida.balasEnemigo.add(balaEnemiga(
            x, y + radio * 0.4, angulo, velocidad,
            color: a.color, forma: a.forma,
          ));
        }
    }
  }

  void _actualizarLaser(double dt, Partida partida) {
    final haz = laser;
    if (haz == null) return;

    haz.angulo += haz.giro * dt;
    haz.restante -= dt;
    if (haz.restante <= 0) {
      laser = null;
      return;
    }

    for (final jugador in partida.jugadoresVivos) {
      final dx = jugador.x - x;
      final dy = jugador.y - y;
      final proyeccion = dx * math.cos(haz.angulo) + dy * math.sin(haz.angulo);
      if (proyeccion < 0) continue;

      final distancia = (-dx * math.sin(haz.angulo) + dy * math.cos(haz.angulo)).abs();
      if (distancia < 10) partida.matarJugador(jugador);
    }
  }

  void golpear(double dano, int duenno, Partida partida, [ParteViva? parte]) {
    recibioDano = true;

    if (parte != null) {
      parte.vida -= dano;
      parte.destelloDano = 1;
      if (parte.vida <= 0) {
        parte.viva = false;
        partida.efectos.explosion(parte.x, parte.y, tamano: 1.4, color: colores[2]);
        partida.sumarPuntos(Puntos.pesado);
      }
      return;
    }

    if (!vulnerable()) return;

    vida -= dano;
    destelloDano = 1;
    if (vida > 0) return;

    _siguienteFase(partida);
  }

  void _siguienteFase(Partida partida) {
    partida.sumarPuntos(Puntos.faseJefe);
    partida.efectos.explosion(x, y, tamano: 3, color: colores[2]);
    partida.efectos.fogonazo(0.7);
    partida.balasEnemigo.clear(); // respiro entre fases: es justo y se agradece

    faseIndice++;
    if (faseIndice >= def.fases.length) {
      viva = false;
      return;
    }

    vida = vidaTotal * fase.vida;
    vidaFase = vida;
    tFase = 0;
    invulnerable = 1.2;
    laser = null;
    _temporizadores.clear();
    _montarPartes();
    partida.anunciar('FASE ${faseIndice + 1}: ${fase.nombre.toUpperCase()}');
  }

  // -------------------------------------------------------------------------

  void dibujar(Canvas canvas) {
    final haz = laser;
    if (haz != null) _dibujarLaser(canvas, haz);

    for (final parte in partes) {
      if (!parte.viva) continue;
      canvas.drawCircle(Offset(parte.x, parte.y), parte.def.radio,
          Paint()..color = Color.lerp(colores[1], const Color(0xFFFFFFFF), parte.destelloDano * 0.7)!);
      canvas.drawCircle(Offset(parte.x, parte.y), parte.def.radio * 0.45, Paint()..color = colores[2]);
    }

    canvas.save();
    canvas.translate(x, y);
    // Cada fase puede cambiar de forma: el colibrí se vuelve esfera solar.
    dibujarFormaJefe(canvas, fase.forma ?? def.forma, colores, radio, t, fraccionVida, destelloDano);
    canvas.restore();
  }

  void _dibujarLaser(Canvas canvas, Laser haz) {
    const largo = 900.0;
    final destino = Offset(x + math.cos(haz.angulo) * largo, y + math.sin(haz.angulo) * largo);

    canvas.drawLine(
      Offset(x, y),
      destino,
      Paint()
        ..color = haz.color.withValues(alpha: 0.35)
        ..strokeWidth = 18
        ..blendMode = BlendMode.plus,
    );
    canvas.drawLine(
      Offset(x, y),
      destino,
      Paint()
        ..color = const Color(0xFFFFFFFF)
        ..strokeWidth = 5,
    );
  }
}

class Laser {
  Laser({required this.angulo, required this.giro, required this.restante, required this.color});

  double angulo;
  final double giro;
  double restante;
  final Color color;
}

/// Una parte del jefe con vida propia: torreta, segmento o cabeza.
class ParteViva {
  ParteViva(this.def, double escala)
      : vida = def.vida * escala,
        vidaMax = def.vida * escala;

  final ParteJefe def;
  double vida;
  final double vidaMax;
  double x = 0;
  double y = 0;
  bool viva = true;
  double destelloDano = 0;
}

void dibujarFormaJefe(
  Canvas canvas,
  String forma,
  List<Color> colores,
  double radio,
  double t,
  double vida, [
  double destello = 0,
]) {
  final primario = Paint()
    ..color = Color.lerp(colores[0], const Color(0xFFFFFFFF), destello * 0.6)!;
  final secundario = Paint()..color = colores[1];
  final acento = Paint()..color = colores[2];

  switch (forma) {
    case 'colibri':
      // Alas que baten deprisa, cuerpo alargado y pico largo.
      final bateo = math.sin(t * 16) * 0.5;
      for (final lado in [-1, 1]) {
        canvas.save();
        canvas.rotate(lado * (0.5 + bateo));
        canvas.drawOval(
          Rect.fromCenter(center: Offset(lado * radio * 0.9, 0), width: radio * 1.9, height: radio * 0.6),
          secundario,
        );
        canvas.restore();
      }
      canvas.drawOval(Rect.fromCenter(center: Offset.zero, width: radio * 1.1, height: radio * 1.7), primario);
      final pico = Path()
        ..moveTo(-radio * 0.12, radio * 0.7)
        ..lineTo(radio * 0.12, radio * 0.7)
        ..lineTo(0, radio * 1.5)
        ..close();
      canvas.drawPath(pico, acento);
      canvas.drawCircle(Offset(0, -radio * 0.35), radio * 0.22, acento);

    case 'serpiente':
      canvas.drawOval(Rect.fromCenter(center: Offset.zero, width: radio * 1.6, height: radio * 2), primario);
      for (final lado in [-1, 1]) {
        canvas.drawCircle(Offset(lado * radio * 0.35, radio * 0.25), radio * 0.18, acento);
      }
      final lengua = Path()
        ..moveTo(-radio * 0.2, radio * 0.9)
        ..lineTo(radio * 0.2, radio * 0.9)
        ..lineTo(0, radio * 1.4)
        ..close();
      canvas.drawPath(lengua, secundario);

    case 'torre':
      // Tres cuerpos apilados que se estrechan hacia abajo.
      for (var i = 0; i < 3; i++) {
        final w = radio * (1.5 - i * 0.3);
        final h = radio * 0.55;
        canvas.drawRect(
          Rect.fromLTWH(-w / 2, -radio + i * h * 1.2, w, h),
          i.isEven ? primario : secundario,
        );
      }
      canvas.drawCircle(Offset(0, radio * 0.5), radio * 0.35 * (0.7 + vida * 0.3), acento);

    case 'esfera':
      canvas.drawCircle(
        Offset.zero,
        radio,
        Paint()
          ..shader = Gradient.radial(Offset.zero, radio, [
            const Color(0xFFFFFFFF),
            colores[2],
            colores[0],
          ], [0.0, 0.5, 1.0]),
      );
      final rayos = Paint()
        ..color = colores[2]
        ..strokeWidth = 3;
      for (var i = 0; i < 8; i++) {
        final a = t * 0.6 + (i * math.pi) / 4;
        canvas.drawLine(
          Offset(math.cos(a) * radio, math.sin(a) * radio),
          Offset(math.cos(a) * radio * 1.35, math.sin(a) * radio * 1.35),
          rayos,
        );
      }

    case 'mono':
      // El jefe sustituto: un mono en una nave. Es ridículo a propósito.
      canvas.drawOval(Rect.fromCenter(center: Offset(0, radio * 0.3), width: radio * 2, height: radio), secundario);
      canvas.drawCircle(Offset(0, -radio * 0.25), radio * 0.6, primario);
      canvas.drawCircle(Offset(0, -radio * 0.2), radio * 0.38, Paint()..color = const Color(0xFFFFE0B2));
      for (final lado in [-1, 1]) {
        canvas.drawCircle(Offset(lado * radio * 0.15, -radio * 0.28), radio * 0.06, Paint()..color = const Color(0xFF000000));
        canvas.drawCircle(Offset(lado * radio * 0.62, -radio * 0.3), radio * 0.2, primario);
      }

    default:
      canvas.drawCircle(Offset.zero, radio, primario);
  }
}

/// Lo que existe, para que las pruebas revisen los escenarios.
const List<String> movimientosJefe = ['vaiven', 'zigzag', 'persigue', 'ascenso', 'quieto'];
const List<String> ataquesJefe = ['abanico', 'circulo', 'dirigido', 'lluvia', 'veneno', 'laser'];
