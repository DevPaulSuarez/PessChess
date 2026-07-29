import 'dart:math' as math;
import 'dart:ui';

import '../datos/paises.dart';
import '../datos/stages.dart';
import 'armas.dart';
import 'balas.dart';
import 'constantes.dart';
import 'dificultad.dart';
import 'efectos.dart';
import 'enemigos.dart';
import 'fondos.dart';
import 'jefe.dart';
import 'jugador.dart';
import 'mandos.dart';
import 'powerups.dart';
import 'puntuacion.dart';

enum EstadoPartida { jugando, terminado, gameOver }

/// Con qué vuela cada jugador.
class Alineacion {
  const Alineacion(this.pais, this.nave);

  final Pais pais;
  final Nave nave;
}

class ResultadoStage {
  const ResultadoStage({
    required this.stage,
    required this.puntos,
    required this.detalle,
    required this.evaluacion,
    required this.jefeVerdadero,
    required this.vidas,
  });

  final Stage stage;
  final int puntos;
  final List<Bonificacion> detalle;
  final Evaluacion evaluacion;
  final bool jefeVerdadero;
  final int vidas;
}

/// Una partida a un escenario: el árbitro de todo lo que pasa en pantalla.
///
/// Sabe de reglas, no de widgets. Lleva el guion del escenario, las colisiones,
/// el bote de vidas compartido y —lo que de verdad importa— las tres
/// condiciones que deciden si el equipo se gana al jefe de verdad o le sale el
/// mono.
class Partida {
  /// La semilla solo la usan las pruebas. Jugando de verdad se deja sin poner y
  /// cada partida sortea lo suyo; fijándola, la misma partida sale igual dos
  /// veces, que es la única forma de que una simulación pueda afirmar algo.
  Partida({required this.stage, required List<Alineacion> alineaciones, int? semilla})
      : numJugadores = alineaciones.length,
        vidasIniciales = vidasDelEquipo(alineaciones.length),
        azar = math.Random(semilla),
        fondo = Fondo(stage.fondo) {
    jugadores = [
      for (var i = 0; i < alineaciones.length; i++)
        Jugador(indice: i, pais: alineaciones[i].pais, nave: alineaciones[i].nave),
    ];
    vidas = vidasIniciales;
  }

  final Stage stage;
  final int numJugadores;
  final int vidasIniciales;
  final Fondo fondo;
  final math.Random azar;

  late final List<Jugador> jugadores;

  final List<Bala> balasJugador = [];
  final List<Bala> balasEnemigo = [];
  final List<Enemigo> enemigos = [];
  final List<PowerUp> powerups = [];
  final List<BombaActiva> bombas = [];
  final List<Escudo> escudos = [];
  final Efectos efectos = Efectos();

  Jefe? jefe;

  late int vidas;
  int puntos = 0;
  double tiempo = 0;

  EstadoPartida estado = EstadoPartida.jugando;
  ResultadoStage? resultado;

  // Guion
  int _paso = 0;
  double _espera = 0;
  bool _esperandoLimpio = false;

  // Contadores de las condiciones del escenario.
  int generados = 0;
  int destruidos = 0;
  int vidasPerdidas = 0;
  bool insignia = false;
  bool? jefeVerdadero;
  Evaluacion? evaluacion;

  // Estado propio de cada insignia.
  final List<int> _campanasEnOrden = [];
  bool _edificioDestruido = false;
  int icebergsRotos = 0;
  double silencio = 0;
  bool _delfinFuera = false;

  String? zona;
  double _zonaRestante = 0;

  Anuncio? anuncio;
  double combinadoActivo = 0;
  final Map<int, double> _ultimaBomba = {};

  double viento = 0;
  double _vientoObjetivo = 0;
  double _proximoCambioViento = 0;

  // -------------------------------------------------------------------------
  // Consultas que usan las entidades
  // -------------------------------------------------------------------------

  List<Jugador> get jugadoresVivos => jugadores.where((j) => j.viva).toList();

  Jugador? jugadorMasCercano(double x, double y) {
    Jugador? mejor;
    var mejorDistancia = double.infinity;
    for (final jugador in jugadores) {
      if (!jugador.viva) continue;
      final d = (jugador.x - x) * (jugador.x - x) + (jugador.y - y) * (jugador.y - y);
      if (d < mejorDistancia) {
        mejorDistancia = d;
        mejor = jugador;
      }
    }
    return mejor;
  }

  Blanco? enemigoMasCercano(double x, double y) {
    Blanco? mejor;
    var mejorDistancia = double.infinity;
    for (final enemigo in enemigos) {
      if (!enemigo.viva || enemigo.y < 0) continue;
      final d = (enemigo.x - x) * (enemigo.x - x) + (enemigo.y - y) * (enemigo.y - y);
      if (d < mejorDistancia) {
        mejorDistancia = d;
        mejor = enemigo;
      }
    }
    final j = jefe;
    if (mejor == null && j != null && j.viva && !j.entrando) return j;
    return mejor;
  }

  void sumarPuntos(num n) => puntos += n.round();

  void anunciar(String texto, [double duracion = 2.4]) {
    anuncio = Anuncio(texto, duracion);
  }

  // -------------------------------------------------------------------------
  // Bucle
  // -------------------------------------------------------------------------

  void actualizar(double dt, Mandos mandos) {
    if (estado != EstadoPartida.jugando) return;

    tiempo += dt;
    combinadoActivo = math.max(0, combinadoActivo - dt);

    _avanzarGuion(dt);
    _actualizarViento(dt);

    fondo.actualizar(dt, factor: jefe?.fase.movimiento == 'ascenso' ? 3 : 1);

    for (final jugador in jugadores) {
      jugador.actualizar(dt, this, mandos);
      if (jugador.viva && viento != 0) {
        jugador.x = (jugador.x + viento * dt).clamp(14, anchoCampo - 14);
      }
    }

    for (final bala in balasJugador) {
      bala.actualizar(dt, enemigoMasCercano);
    }
    for (final bala in balasEnemigo) {
      bala.actualizar(dt);
    }
    for (final enemigo in enemigos) {
      enemigo.actualizar(dt, this);
    }
    for (final powerup in powerups) {
      powerup.actualizar(dt);
    }
    jefe?.actualizar(dt, this);

    _actualizarBombas(dt);
    _calcularEscudos();
    _colisiones();
    _insigniaDelSilencio(dt);

    efectos.actualizar(dt);

    final a = anuncio;
    if (a != null) {
      a.restante -= dt;
      if (a.restante <= 0) anuncio = null;
    }

    _limpiar();
    _comprobarFinal();
  }

  void _limpiar() {
    for (final enemigo in enemigos) {
      if (enemigo.viva || enemigo.contabilizado) continue;
      enemigo.contabilizado = true;
      // Escaparse no cuenta como derribo: por eso dejar pasar enemigos baja el
      // porcentaje y puede costar el jefe de verdad.
      if (enemigo.categoria == 'enemigo' && !enemigo.escapo) destruidos++;
    }

    balasJugador.removeWhere((b) => !b.viva);
    balasEnemigo.removeWhere((b) => !b.viva);
    enemigos.removeWhere((e) => !e.viva);
    powerups.removeWhere((p) => !p.viva);
  }

  void _comprobarFinal() {
    final j = jefe;
    if (j != null && !j.viva) {
      _terminarStage();
      return;
    }
    if (vidas <= 0 && jugadores.every((j) => !j.viva)) {
      estado = EstadoPartida.gameOver;
    }
  }

  // -------------------------------------------------------------------------
  // Guion del escenario
  // -------------------------------------------------------------------------

  void _avanzarGuion(double dt) {
    if (zona != null) {
      _zonaRestante -= dt;
      if (_zonaRestante <= 0) zona = null;
    }

    if (_paso >= stage.guion.length) return;

    if (_esperandoLimpio) {
      if (enemigos.any((e) => e.categoria == 'enemigo')) return;
      _esperandoLimpio = false;
    }

    _espera -= dt;
    if (_espera > 0) return;

    final suceso = stage.guion[_paso];
    _paso++;
    _espera = _paso < stage.guion.length ? stage.guion[_paso].espera : 0;

    switch (suceso.tipo) {
      case 'anuncio':
        anunciar(suceso.texto ?? '');
      case 'oleada':
        _soltarOleada(suceso);
      case 'esperarLimpio':
        _esperandoLimpio = true;
      case 'zonaEspecial':
        zona = suceso.zona;
        _zonaRestante = suceso.duracion;
      case 'jefe':
        _invocarJefe();
    }
  }

  void _soltarOleada(Suceso suceso) {
    final base = stage.plantillas[suceso.plantilla];
    if (base == null) return;

    // Solo se multiplican los enemigos normales: multiplicar las campanas de la
    // catedral o los mid-boss rompería el escenario.
    final total = base.categoria == 'escenario' || base.esMidBoss
        ? suceso.cuantos
        : enemigosDeOleada(suceso.cuantos, numJugadores);

    for (var i = 0; i < total; i++) {
      final punto = _posicionEn(suceso.formacion, i, total);
      enemigos.add(Enemigo(base, punto.dx, punto.dy, this));
      if (base.categoria != 'escenario') generados++;
    }

    // Las campanas se numeran de izquierda a derecha nada más aparecer: ese es
    // el orden en el que hay que tocarlas.
    if (suceso.plantilla == 'campana') {
      final campanas = enemigos.where((e) => e.forma == 'campana').toList()
        ..sort((a, b) => a.x.compareTo(b.x));
      for (var i = 0; i < campanas.length; i++) {
        campanas[i].orden = i;
      }
    }
  }

  Offset _posicionEn(String formacion, int i, int total) {
    const margen = 46.0;
    const util = anchoCampo - margen * 2;

    switch (formacion) {
      case 'fila':
        return Offset(margen + (util * (i + 0.5)) / total, -40 - i * 12);

      case 'uve':
        final centro = (i - (total - 1) / 2) / math.max(1, total / 2);
        return Offset(anchoCampo / 2 + centro * (util / 2), -40 - centro.abs() * 90);

      case 'lados':
        final izquierda = i.isEven;
        return Offset(
          izquierda ? margen + (i * 9) % 60 : anchoCampo - margen - ((i * 9) % 60),
          -40 - (i ~/ 2) * 55,
        );

      case 'suelo':
        return Offset(margen + (util * (i + 0.5)) / total, -50 - i * 90);

      case 'centro':
        return const Offset(anchoCampo / 2, -60);

      default:
        return Offset(margen + azar.nextDouble() * util, -40 - i * 34);
    }
  }

  void invocarEsbirros(String plantilla, int cuantos, double x, double y) {
    final base = stage.plantillas[plantilla];
    if (base == null) return;
    for (var i = 0; i < cuantos; i++) {
      generados++;
      enemigos.add(Enemigo(base, x + (i - cuantos / 2) * 40, y + 20, this));
    }
  }

  /// Aquí se decide todo.
  ///
  /// Se miran las tres condiciones del escenario: si se cumplen dos, baja el
  /// jefe de verdad; si no, aparece el sustituto y el equipo se lleva la nota
  /// mala aunque lo derrote.
  void _invocarJefe() {
    // Hay insignias que solo se pueden juzgar cuando ya no queda escenario por
    // delante, como la de los siete icebergs.
    cerrarInsignias();

    final ev = evaluarCondiciones(
      destruidos: destruidos,
      generados: generados,
      vidasPerdidas: vidasPerdidas,
      insignia: insignia,
    );

    evaluacion = ev;
    jefeVerdadero = ev.jefeVerdadero;

    final definicion = ev.jefeVerdadero ? stage.jefe : jefeSustituto;
    jefe = Jefe(definicion, this);

    anunciar(ev.jefeVerdadero ? definicion.nombre.toUpperCase() : 'APARECE… ¿UN MONO?', 3.2);
    balasEnemigo.clear();
  }

  void _terminarStage() {
    if (estado != EstadoPartida.jugando) return;
    estado = EstadoPartida.terminado;

    final ev = evaluacion ??
        evaluarCondiciones(
          destruidos: destruidos,
          generados: generados,
          vidasPerdidas: vidasPerdidas,
          insignia: insignia,
        );

    final cierre = puntuarStage(
      base: puntos,
      sinDanoEnJefe: !(jefe?.hirioAlEquipo ?? false),
      sinMuertes: vidasPerdidas == 0,
    );

    puntos = cierre.total;
    resultado = ResultadoStage(
      stage: stage,
      puntos: cierre.total,
      detalle: cierre.detalle,
      evaluacion: ev,
      jefeVerdadero: jefeVerdadero ?? false,
      vidas: vidas,
    );
  }

  // -------------------------------------------------------------------------
  // Viento
  // -------------------------------------------------------------------------

  void _actualizarViento(double dt) {
    if (!stage.viento) return;

    // Cuanta más gente, más fuerte y más caprichoso: es la mecánica ambiental
    // del escenario de hielo.
    if (tiempo > _proximoCambioViento) {
      _proximoCambioViento = tiempo + 3 + azar.nextDouble() * 4;
      final fuerza = 26 * (1 + 0.35 * (numJugadores - 1));
      _vientoObjetivo = (azar.nextDouble() * 2 - 1) * fuerza;
    }
    viento += (_vientoObjetivo - viento) * math.min(1, dt * 1.6);
  }

  // -------------------------------------------------------------------------
  // Bombas
  // -------------------------------------------------------------------------

  void lanzarBomba(Jugador jugador) {
    if (!jugador.viva || jugador.bombas <= 0) return;

    jugador.bombas--;
    _ultimaBomba[jugador.indice] = tiempo;

    // Bomba conjunta: si todos sueltan la suya en el mismo segundo, se funden
    // en una sola mucho mayor. Es la recompensa de coordinarse de verdad.
    final recientes = _ultimaBomba.values.where((t) => tiempo - t < 1).length;
    final conjunta = numJugadores > 1 && recientes == numJugadores;

    final bomba = jugador.pais.bomba;
    bombas.add(BombaActiva(
      tipo: conjunta ? 'pantalla' : bomba.tipo,
      color: conjunta ? const Color(0xFFFFFFFF) : bomba.color,
      x: jugador.x,
      y: jugador.y,
      duenno: jugador.indice,
      duracion: conjunta
          ? 1.6
          : bomba.tipo == 'escudo'
              ? 4.5
              : 1,
      dano: (conjunta ? 5200 : 1500) * (1 + jugador.nave.poder * 0.05),
      conjunta: conjunta,
    ));

    if (bomba.tipo != 'escudo') balasEnemigo.clear();
    jugador.invulnerable = math.max(jugador.invulnerable, 1.2);

    efectos.fogonazo(conjunta ? 1.4 : 0.8);
    anunciar(conjunta ? '¡ARMAGEDÓN!' : bomba.nombre.toUpperCase(), conjunta ? 2.6 : 1.4);
  }

  void _actualizarBombas(double dt) {
    for (final bomba in bombas) {
      bomba.t += dt;
      final avance = bomba.t / bomba.duracion;
      final porPaso = bomba.dano * dt / bomba.duracion;

      switch (bomba.tipo) {
        case 'escudo':
          final jugador = jugadores[bomba.duenno];
          if (jugador.viva) {
            bomba.x = jugador.x;
            bomba.y = jugador.y;
          }
          // El escudo no daña: se come las balas que le entran.
          balasEnemigo.removeWhere(
            (b) => math.sqrt(math.pow(b.x - bomba.x, 2) + math.pow(b.y - bomba.y, 2)) <= 62,
          );

        case 'barrido':
          final y = avance * altoCampo;
          _danarEnFranja(y - 40, y + 40, porPaso, bomba.duenno);

        case 'columna':
          for (final cx in [bomba.x - 90, bomba.x, bomba.x + 90]) {
            _danarEnColumna(cx, 34, porPaso, bomba.duenno);
          }

        case 'lluvia':
          if (azar.nextDouble() < 0.6) {
            efectos.explosion(
              azar.nextDouble() * anchoCampo,
              azar.nextDouble() * altoCampo * 0.8,
              tamano: 0.7,
              color: bomba.color,
            );
          }
          _danarEnFranja(0, altoCampo, porPaso * 0.7, bomba.duenno);

        default:
          _danarEnFranja(0, altoCampo, porPaso, bomba.duenno);
      }
    }

    bombas.removeWhere((b) => b.t >= b.duracion);
  }

  void _danarEnFranja(double y1, double y2, double dano, int duenno) {
    for (final enemigo in [...enemigos]) {
      if (enemigo.y >= y1 && enemigo.y <= y2) _matar(enemigo, dano, duenno);
    }
    final j = jefe;
    if (j != null && j.viva && j.y >= y1 && j.y <= y2) j.golpear(dano, duenno, this);
    balasEnemigo.removeWhere((b) => b.y >= y1 && b.y <= y2);
  }

  void _danarEnColumna(double x, double radio, double dano, int duenno) {
    for (final enemigo in [...enemigos]) {
      if ((enemigo.x - x).abs() <= radio) _matar(enemigo, dano, duenno);
    }
    final j = jefe;
    if (j != null && j.viva && (j.x - x).abs() <= radio + j.radio) j.golpear(dano, duenno, this);
    balasEnemigo.removeWhere((b) => (b.x - x).abs() <= radio);
  }

  // -------------------------------------------------------------------------
  // Cooperación
  // -------------------------------------------------------------------------

  /// Escudo cruzado: dos jugadores cerca y disparando levantan una barrera
  /// entre ellos que se come las balas. Premia volar juntos, que es justo lo
  /// contrario de lo que apetece cuando la pantalla se llena.
  void _calcularEscudos() {
    escudos.clear();
    final vivos = jugadoresVivos;

    for (var i = 0; i < vivos.length; i++) {
      for (var j = i + 1; j < vivos.length; j++) {
        final a = vivos[i];
        final b = vivos[j];
        if (!a.disparando || !b.disparando) continue;
        final distancia = math.sqrt(math.pow(a.x - b.x, 2) + math.pow(a.y - b.y, 2));
        if (distancia > 96) continue;
        escudos.add(Escudo(a.x, a.y, b.x, b.y));
      }
    }
  }

  /// Donar: cambiar potencia propia por una vida para el bote común.
  void donarVida(Jugador jugador) {
    if (jugador.nivel <= 1 || vidas >= vidasIniciales) return;

    jugador.nivel--;
    vidas++;
    efectos.rotulo(jugador.x, jugador.y - 24, '¡VIDA DONADA!', color: const Color(0xFFEF5350));
  }

  void matarJugador(Jugador jugador) {
    if (!jugador.golpear(this)) return;

    vidas = math.max(0, vidas - 1);
    vidasPerdidas++;
    jefe?.hirioAlEquipo = true;
  }

  // -------------------------------------------------------------------------
  // Colisiones
  // -------------------------------------------------------------------------

  bool _matar(Enemigo enemigo, double dano, int duenno) {
    final ganados = enemigo.golpear(dano, duenno, this);
    if (ganados == 0) return false;

    sumarPuntos(ganados);
    efectos.explosion(
      enemigo.x,
      enemigo.y,
      tamano: enemigo.esMidBoss ? 3 : enemigo.radio / 14,
      color: enemigo.colores[2],
    );

    final premio = sorteoDePowerUp(azar, equipoTocado: vidas < vidasIniciales / 2);
    if (premio != null) powerups.add(PowerUp(enemigo.x, enemigo.y, premio));
    if (enemigo.esMidBoss) {
      for (final tipo in ['P', 'B']) {
        powerups.add(PowerUp(enemigo.x, enemigo.y, tipo));
      }
    }

    anotarDerribo(enemigo.forma, enemigo.orden, enemigo.x, enemigo.y);
    return true;
  }

  void _colisiones() {
    // --- Balas del jugador contra todo lo que se pueda romper ---------------
    for (final bala in [...balasJugador]) {
      if (!bala.viva) continue;

      for (final enemigo in [...enemigos]) {
        if (!enemigo.viva) continue;
        if (bala.tocados?.contains(enemigo) ?? false) continue;
        final distancia = math.sqrt(math.pow(bala.x - enemigo.x, 2) + math.pow(bala.y - enemigo.y, 2));
        if (distancia > enemigo.radio + bala.radio) continue;

        switch (bala.efecto) {
          case 'lento':
            enemigo.lento = 1.4;
          case 'arrastre':
            enemigo.y += 6;
          case 'empuje':
            enemigo.x += (enemigo.x - bala.x).sign * 5;
        }

        _matar(enemigo, bala.dano, bala.duenno);
        efectos.chispa(bala.x, bala.y, bala.color);

        if (bala.penetra) {
          bala.tocados!.add(enemigo);
        } else {
          bala.viva = false;
          if (bala.esquirlas > 0) balasJugador.addAll(esquirlasDe(bala));
          break;
        }
      }

      final j = jefe;
      if (!bala.viva || j == null || !j.viva) continue;

      // Partes del jefe primero: son las que tapan el núcleo.
      var tocoParte = false;
      for (final parte in j.partesVulnerables()) {
        final distancia = math.sqrt(math.pow(bala.x - parte.x, 2) + math.pow(bala.y - parte.y, 2));
        if (distancia > parte.def.radio + bala.radio) continue;
        j.golpear(bala.dano, bala.duenno, this, parte);
        efectos.chispa(bala.x, bala.y, bala.color);
        tocoParte = true;
        if (!bala.penetra) bala.viva = false;
        break;
      }
      if (tocoParte) continue;

      final alNucleo = math.sqrt(math.pow(bala.x - j.x, 2) + math.pow(bala.y - j.y, 2));
      if (alNucleo < j.radio + bala.radio) {
        if (j.vulnerable()) {
          j.golpear(bala.dano, bala.duenno, this);
          efectos.chispa(bala.x, bala.y, bala.color);
        } else {
          efectos.chispa(bala.x, bala.y, const Color(0xFF9E9E9E));
        }
        if (!bala.penetra) bala.viva = false;
      }
    }

    // --- Balas enemigas contra escudos y jugadores --------------------------
    for (final bala in balasEnemigo) {
      if (!bala.viva) continue;

      if (chocaConEscudo(bala.x, bala.y, bala.radio)) {
        bala.viva = false;
        efectos.chispa(bala.x, bala.y, const Color(0xFF4FC3F7));
        continue;
      }

      for (final jugador in jugadoresVivos) {
        final distancia = math.sqrt(math.pow(bala.x - jugador.x, 2) + math.pow(bala.y - jugador.y, 2));
        if (distancia > jugador.radio + bala.radio) continue;
        bala.viva = false;
        matarJugador(jugador);
        break;
      }
    }

    // --- Choques directos y recogida ----------------------------------------
    for (final jugador in jugadoresVivos) {
      for (final enemigo in enemigos) {
        if (!enemigo.viva) continue;
        final distancia = math.sqrt(math.pow(jugador.x - enemigo.x, 2) + math.pow(jugador.y - enemigo.y, 2));
        if (distancia > enemigo.radio + jugador.radio) continue;
        matarJugador(jugador);
        break;
      }

      final j = jefe;
      if (j != null && j.viva && !j.entrando) {
        final distancia = math.sqrt(math.pow(jugador.x - j.x, 2) + math.pow(jugador.y - j.y, 2));
        if (distancia < j.radio + jugador.radio) matarJugador(jugador);
      }

      for (final powerup in powerups) {
        if (!powerup.viva) continue;
        final distancia = math.sqrt(math.pow(jugador.x - powerup.x, 2) + math.pow(jugador.y - powerup.y, 2));
        if (distancia > powerup.radio + 16) continue;

        powerup.viva = false;
        switch (powerup.tipo) {
          case 'M':
            sumarPuntos(Puntos.moneda);
            efectos.rotulo(powerup.x, powerup.y, '+${Puntos.moneda}', color: const Color(0xFFCE93D8));
          case 'H':
            vidas = math.min(vidasIniciales, vidas + 1);
            efectos.rotulo(powerup.x, powerup.y, '¡VIDA!', color: const Color(0xFFEF5350));
          case 'I':
            ganarInsignia();
          default:
            jugador.recoger(powerup.tipo, this);
        }
      }
    }
  }

  bool chocaConEscudo(double x, double y, double radio) {
    for (final escudo in escudos) {
      final dx = escudo.x2 - escudo.x1;
      final dy = escudo.y2 - escudo.y1;
      final largo2 = dx * dx + dy * dy;
      if (largo2 == 0) continue;

      // Proyección sobre el segmento, recortada a sus extremos.
      final t = (((x - escudo.x1) * dx + (y - escudo.y1) * dy) / largo2).clamp(0.0, 1.0);
      final px = escudo.x1 + dx * t;
      final py = escudo.y1 + dy * t;
      if (math.sqrt(math.pow(x - px, 2) + math.pow(y - py, 2)) < 8 + radio) return true;
    }
    return false;
  }

  // -------------------------------------------------------------------------
  // Insignias
  // -------------------------------------------------------------------------

  void anotarDerribo(String forma, int orden, double x, double y) {
    final tipo = stage.insignia.tipo;

    if (tipo == 'campanas') {
      if (forma == 'campana') {
        _campanasEnOrden.add(orden);
        var enOrden = true;
        for (var i = 0; i < _campanasEnOrden.length; i++) {
          if (_campanasEnOrden[i] != i) enOrden = false;
        }
        if (enOrden && _campanasEnOrden.length == 4 && !_edificioDestruido) ganarInsignia();
      }
      if (forma == 'edificio') {
        _edificioDestruido = true;
        efectos.rotulo(x, y, 'ERA UN EDIFICIO CIVIL', color: const Color(0xFFEF5350));
      }
    }

    if (tipo == 'icebergs' && forma == 'iceberg') icebergsRotos++;
  }

  /// La insignia del silencio: mientras el equipo sobrevuela el río sin
  /// disparar un solo tiro, aparece el delfín rosa que la lleva.
  void _insigniaDelSilencio(double dt) {
    if (stage.insignia.tipo != 'silencio' || insignia) return;
    if (zona != 'rio') return;

    if (jugadoresVivos.any((j) => j.disparando)) {
      if (silencio > 3) {
        efectos.rotulo(anchoCampo / 2, 200, 'EL SILENCIO SE ROMPIÓ', color: const Color(0xFFEF5350));
      }
      silencio = 0;
      return;
    }

    silencio += dt;
    if (silencio < stage.insignia.segundos || _delfinFuera) return;

    _delfinFuera = true;
    final delfin = stage.plantillas['delfin'];
    if (delfin != null) enemigos.add(Enemigo(delfin, -20, 300, this));
    powerups.add(PowerUp(anchoCampo / 2, 260, 'I'));
    anunciar('¡UN DELFÍN ROSA!', 2.6);
  }

  void ganarInsignia() {
    if (insignia) return;
    insignia = true;
    sumarPuntos(Puntos.insignia);
    anunciar('¡INSIGNIA DEL PAÍS!', 3);
    efectos.fogonazo(0.6);
  }

  /// Al acabar el escenario hay insignias que solo se pueden juzgar al final.
  void cerrarInsignias() {
    if (stage.insignia.tipo == 'icebergs' && icebergsRotos == stage.insignia.objetivo) {
      ganarInsignia();
    }
  }

  // -------------------------------------------------------------------------
  // Dibujo
  // -------------------------------------------------------------------------

  void dibujar(Canvas canvas) {
    fondo.dibujar(canvas);

    final sacudida = efectos.desplazamiento();
    canvas.save();
    canvas.translate(sacudida.dx, sacudida.dy);

    for (final powerup in powerups) {
      powerup.dibujar(canvas);
    }
    for (final enemigo in enemigos) {
      enemigo.dibujar(canvas);
    }
    if (jefe?.viva ?? false) jefe!.dibujar(canvas);

    _dibujarBombas(canvas);
    _dibujarEscudos(canvas);

    for (final bala in balasJugador) {
      bala.dibujar(canvas);
    }
    for (final jugador in jugadores) {
      jugador.dibujar(canvas);
    }
    for (final bala in balasEnemigo) {
      bala.dibujar(canvas);
    }

    efectos.dibujar(canvas);
    canvas.restore();
  }

  void _dibujarBombas(Canvas canvas) {
    for (final bomba in bombas) {
      final avance = bomba.t / bomba.duracion;
      final pincel = Paint()
        ..color = bomba.color.withValues(alpha: (1 - avance).clamp(0, 1))
        ..blendMode = BlendMode.plus;

      switch (bomba.tipo) {
        case 'escudo':
          canvas.drawCircle(
            Offset(bomba.x, bomba.y),
            62,
            Paint()
              ..color = bomba.color.withValues(alpha: 0.45 + math.sin(bomba.t * 12) * 0.12)
              ..blendMode = BlendMode.plus,
          );
        case 'barrido':
          canvas.drawRect(Rect.fromLTWH(0, avance * altoCampo - 40, anchoCampo, 80), pincel);
        case 'columna':
          for (final cx in [bomba.x - 90, bomba.x, bomba.x + 90]) {
            canvas.drawRect(Rect.fromLTWH(cx - 34, 0, 68, altoCampo), pincel);
          }
        default:
          canvas.drawCircle(Offset(bomba.x, bomba.y), avance * altoCampo, pincel);
      }
    }
  }

  void _dibujarEscudos(Canvas canvas) {
    if (escudos.isEmpty) return;

    final pincel = Paint()
      ..color = const Color(0xFF4FC3F7).withValues(alpha: 0.55 + math.sin(tiempo * 14) * 0.15)
      ..strokeWidth = 6
      ..blendMode = BlendMode.plus;

    for (final escudo in escudos) {
      canvas.drawLine(Offset(escudo.x1, escudo.y1), Offset(escudo.x2, escudo.y2), pincel);
    }
  }
}

class Anuncio {
  Anuncio(this.texto, this.total) : restante = total;

  final String texto;
  final double total;
  double restante;
}

/// Una bomba en curso. Vive unos segundos y va haciendo daño mientras dura.
class BombaActiva {
  BombaActiva({
    required this.tipo,
    required this.color,
    required this.x,
    required this.y,
    required this.duenno,
    required this.duracion,
    required this.dano,
    required this.conjunta,
  });

  final String tipo;
  final Color color;
  double x;
  double y;
  final int duenno;
  final double duracion;
  final double dano;
  final bool conjunta;
  double t = 0;
}

/// La barrera que levantan dos jugadores volando juntos.
class Escudo {
  const Escudo(this.x1, this.y1, this.x2, this.y2);

  final double x1;
  final double y1;
  final double x2;
  final double y2;
}
