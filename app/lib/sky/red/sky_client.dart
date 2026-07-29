import 'dart:ui';

import 'package:flutter/foundation.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;

import '../datos/paises.dart' show Bandera;

/// El lado del móvil de Sky Warriors en red.
///
/// No lleva reglas dentro, igual que el tablero no lleva ajedrez: manda el
/// mando y pinta lo que llega. Si el móvil decidiese por su cuenta dónde está
/// una bala, dos jugadores verían muertes distintas y no habría forma de
/// ponerlos de acuerdo.

/// Un piloto en la sala, antes de despegar.
class PilotoView {
  const PilotoView({
    required this.indice,
    required this.nombre,
    required this.paisId,
    required this.naveIndice,
    required this.listo,
    required this.conectado,
  });

  factory PilotoView.fromJson(Map<String, dynamic> json) => PilotoView(
        indice: json['indice'] as int,
        nombre: json['nombre'] as String,
        paisId: json['paisId'] as String?,
        naveIndice: json['naveIndice'] as int? ?? 0,
        listo: json['listo'] as bool? ?? false,
        conectado: json['conectado'] as bool? ?? true,
      );

  final int indice;
  final String nombre;
  final String? paisId;
  final int naveIndice;
  final bool listo;
  final bool conectado;
}

/// La sala: quién está y si se puede despegar.
class SkyLobby {
  const SkyLobby({
    required this.code,
    required this.estado,
    required this.stage,
    required this.pilotos,
    required this.eresHost,
    required this.puedeEmpezar,
    required this.tuIndice,
    required this.ocupadas,
    required this.desbloqueados,
    required this.tuyos,
  });

  factory SkyLobby.fromJson(Map<String, dynamic> json) => SkyLobby(
        code: json['code'] as String,
        estado: json['estado'] as String,
        stage: json['stage'] as int? ?? 0,
        pilotos: ((json['pilotos'] as List?) ?? [])
            .map((p) => PilotoView.fromJson((p as Map).cast<String, dynamic>()))
            .toList(),
        eresHost: json['eresHost'] as bool? ?? false,
        puedeEmpezar: json['puedeEmpezar'] as bool? ?? false,
        tuIndice: json['tuIndice'] as int? ?? 0,
        ocupadas: ((json['ocupadas'] as List?) ?? [])
            .map((o) => '${(o as Map)['paisId']}:${o['naveIndice']}')
            .toSet(),
        desbloqueados:
            ((json['desbloqueados'] as List?) ?? []).map((e) => e as String).toSet(),
        tuyos: ((json['tuyos'] as List?) ?? []).map((e) => e as String).toSet(),
      );

  final String code;
  final String estado;
  final int stage;
  final List<PilotoView> pilotos;
  final bool eresHost;
  final bool puedeEmpezar;
  final int tuIndice;

  /// Naves que ya lleva alguien, como `'peru:1'`. Cada una es de uno solo.
  final Set<String> ocupadas;

  /// Lo que puede volar la escuadrilla: todo lo que tenga cualquiera de sus
  /// pilotos. Volando juntos, el veterano presta sus países a los demás.
  final Set<String> desbloqueados;

  /// Y lo que te has ganado tú, que es lo que te llevas al salir.
  final Set<String> tuyos;

  bool get volando => estado == 'playing';

  bool puedeVolar(String paisId) => desbloqueados.contains(paisId);

  /// Prestado: lo pone la escuadrilla, no tú. Al salir deja de estar.
  bool esPrestado(String paisId) => desbloqueados.contains(paisId) && !tuyos.contains(paisId);

  /// Quién lleva una nave, si la lleva alguien.
  PilotoView? duenno(String paisId, int naveIndice) => pilotos
      .where((p) => p.paisId == paisId && p.naveIndice == naveIndice)
      .firstOrNull;
}

/// Una nave del catálogo, tal y como la manda el servidor.
class NaveRemota {
  const NaveRemota(
    this.nombre,
    this.piloto,
    this.silueta,
    this.velocidad,
    this.poder,
    this.bombas,
    this.imagen,
  );

  factory NaveRemota.fromJson(Map<String, dynamic> json) => NaveRemota(
        json['nombre'] as String,
        json['piloto'] as String,
        json['silueta'] as String,
        (json['velocidad'] as num).toDouble(),
        (json['poder'] as num).toDouble(),
        json['bombas'] as int,
        json['imagen'] as String?,
      );

  final String nombre;
  final String piloto;
  final String silueta;
  final double velocidad;
  final double poder;
  final int bombas;

  /// Dibujo propio subido desde el editor, si lo tiene. Manda sobre la silueta.
  final String? imagen;
}

/// Un país del catálogo. Los colores llegan en hexadecimal desde el motor.
class PaisRemoto {
  const PaisRemoto(
    this.id,
    this.nombre,
    this.colores,
    this.arma,
    this.bomba,
    this.naves,
    this.bandera,
  );

  factory PaisRemoto.fromJson(Map<String, dynamic> json) => PaisRemoto(
        json['id'] as String,
        json['nombre'] as String,
        ((json['colores'] as List?) ?? []).map((c) => _color(c as String)).toList(),
        (json['arma'] as Map)['nombre'] as String,
        (json['bomba'] as Map)['nombre'] as String,
        ((json['naves'] as List?) ?? [])
            .map((n) => NaveRemota.fromJson((n as Map).cast<String, dynamic>()))
            .toList(),
        _bandera(json['bandera']),
      );

  final String id;
  final String nombre;
  final List<Color> colores;
  final String arma;
  final String bomba;
  final List<NaveRemota> naves;

  /// Su bandera, para reconocerlo de un vistazo en la parrilla.
  final Bandera bandera;
}

/// La bandera tal y como la manda el servidor.
///
/// Se reconstruye en el mismo tipo que ya usa el dibujante de banderas, así que
/// se pinta con el código de siempre y no hay dos formas de hacer lo mismo.
Bandera _bandera(Object? crudo) {
  if (crudo is! Map) return const Bandera('h', franjas: [Color(0xFF9E9E9E)]);
  final json = crudo.cast<String, dynamic>();

  final emblema = json['emblema'];
  return Bandera(
    json['tipo'] as String? ?? 'h',
    franjas: ((json['franjas'] as List?) ?? []).map((c) => _color(c as String)).toList(),
    pesos: (json['pesos'] as List?)?.map((p) => (p as num).toInt()).toList(),
    emblema: emblema is String ? _color(emblema) : null,
  );
}

/// Lo que un piloto lleva ganado.
class ProgresoView {
  const ProgresoView(this.insignias, this.escenarios, this.desbloqueados, this.total);

  factory ProgresoView.fromJson(Map<String, dynamic> json) => ProgresoView(
        json['insignias'] as int? ?? 0,
        json['escenarios'] as int? ?? 0,
        ((json['desbloqueados'] as List?) ?? []).map((e) => e as String).toList(),
        json['total'] as int? ?? 21,
      );

  final int insignias;
  final int escenarios;
  final List<String> desbloqueados;
  final int total;
}

/// `#rrggbb` a color. Si viniera algo raro, gris: es preferible a reventar.
Color _color(String hex) {
  final limpio = hex.replaceAll('#', '');
  final valor = int.tryParse(limpio.length == 3
          ? limpio.split('').map((c) => '$c$c').join()
          : limpio,
      radix: 16);
  return valor == null ? const Color(0xFF9E9E9E) : Color(0xFF000000 | valor);
}

/// Una cosa que se pinta: posición, tamaño y estilo.
///
/// Los colores son tres —casco, sombra y acento— porque es lo que piden los
/// dibujos: con uno solo, todos los enemigos saldrían planos.
class CosaView {
  const CosaView(this.x, this.y, this.radio, this.colores, this.forma);

  final double x;
  final double y;
  final double radio;
  final List<Color> colores;
  final String forma;

  Color get color => colores.first;
}

class EnemigoView extends CosaView {
  const EnemigoView(super.x, super.y, super.radio, super.colores, super.forma, this.vida, this.rango);

  /// Vida que le queda, de 0 a 100.
  final int vida;

  /// 0 enemigo normal, 1 mid-boss, 2 jefe.
  final int rango;
}

class JugadorView {
  const JugadorView({
    required this.indice,
    required this.x,
    required this.y,
    required this.vivo,
    required this.invulnerable,
    required this.nivel,
    required this.bombas,
    required this.inclinacion,
    required this.disparando,
    required this.bajas,
  });

  final int indice;
  final double x;
  final double y;
  final bool vivo;
  final bool invulnerable;
  final int nivel;
  final int bombas;
  final double inclinacion;
  final bool disparando;
  final int bajas;
}

class JefeView {
  const JefeView({
    required this.x,
    required this.y,
    required this.radio,
    required this.colores,
    required this.forma,
    required this.nombre,
    required this.fase,
    required this.entrando,
    required this.vida,
    required this.partes,
  });

  final double x;
  final double y;
  final double radio;
  final List<Color> colores;
  final String forma;
  final String nombre;
  final int fase;
  final bool entrando;

  /// Lo que le queda de la fase en curso, de 0 a 100.
  final int vida;
  final List<CosaView> partes;
}

/// Un fotograma entero del mundo, ya descomprimido.
class SkyMundo {
  SkyMundo({
    required this.fotograma,
    required this.generacion,
    required this.vidas,
    required this.puntos,
    required this.stage,
    required this.tuIndice,
    required this.jugadores,
    required this.balasJugador,
    required this.balasEnemigo,
    required this.enemigos,
    required this.jefe,
    required this.powerups,
    required this.escudos,
    required this.generados,
    required this.destruidos,
    required this.insignia,
    required this.vidasPerdidas,
    required this.anuncio,
    required this.zona,
    required this.combinado,
  });

  /// Descomprime lo que manda el servidor.
  ///
  /// Todo viene en listas de números y una tabla de estilos aparte, porque con
  /// nombres cada bala costaría cinco veces más y en pantalla hay cien.
  factory SkyMundo.fromJson(Map<String, dynamic> json) {
    final estilos = ((json['est'] as List?) ?? []).map((e) => e as String).toList();

    const blanco = [Color(0xFFFFFFFF), Color(0xFFFFFFFF), Color(0xFFFFFFFF)];
    List<Color> coloresDe(int i) => i >= 0 && i < estilos.length
        ? estilos[i].split('|').first.split(',').map(_color).toList()
        : blanco;
    String formaDe(int i) => i >= 0 && i < estilos.length ? estilos[i].split('|').last : 'bala';

    List<CosaView> cosas(String clave) => ((json[clave] as List?) ?? []).map((b) {
          final l = (b as List).cast<num>();
          final e = l[3].toInt();
          return CosaView(l[0].toDouble(), l[1].toDouble(), l[2].toDouble(), coloresDe(e), formaDe(e));
        }).toList();

    final jefeJson = json['jf'];

    return SkyMundo(
      fotograma: json['f'] as int? ?? 0,
      generacion: json['vuelo'] as int? ?? 0,
      vidas: json['vidas'] as int? ?? 0,
      puntos: json['puntos'] as int? ?? 0,
      stage: json['stage'] as int? ?? 0,
      tuIndice: json['tuIndice'] as int? ?? 0,
      jugadores: ((json['j'] as List?) ?? []).map((j) {
        final l = (j as List).cast<num>();
        return JugadorView(
          indice: l[0].toInt(),
          x: l[1].toDouble(),
          y: l[2].toDouble(),
          vivo: l[3] == 1,
          invulnerable: l[4] == 1,
          nivel: l[5].toInt(),
          bombas: l[6].toInt(),
          inclinacion: l[7].toDouble(),
          disparando: l[8] == 1,
          bajas: l[9].toInt(),
        );
      }).toList(),
      balasJugador: cosas('bj'),
      balasEnemigo: cosas('be'),
      enemigos: ((json['en'] as List?) ?? []).map((e) {
        final l = (e as List).cast<num>();
        final estilo = l[3].toInt();
        return EnemigoView(
          l[0].toDouble(),
          l[1].toDouble(),
          l[2].toDouble(),
          coloresDe(estilo),
          formaDe(estilo),
          l[4].toInt(),
          l[5].toInt(),
        );
      }).toList(),
      jefe: jefeJson == null
          ? null
          : () {
              final j = (jefeJson as Map).cast<String, dynamic>();
              final estilo = j['e'] as int;
              return JefeView(
                x: (j['x'] as num).toDouble(),
                y: (j['y'] as num).toDouble(),
                radio: (j['r'] as num).toDouble(),
                colores: coloresDe(estilo),
                forma: formaDe(estilo),
                nombre: j['nombre'] as String? ?? '',
                fase: j['fase'] as int? ?? 0,
                entrando: j['entrando'] as bool? ?? false,
                vida: j['vida'] as int? ?? 0,
                partes: ((j['partes'] as List?) ?? []).map((p) {
                  final l = (p as List).cast<num>();
                  return CosaView(
                    l[0].toDouble(),
                    l[1].toDouble(),
                    l[2].toDouble(),
                    coloresDe(estilo),
                    'parte',
                  );
                }).toList(),
              );
            }(),
      powerups: ((json['pu'] as List?) ?? []).map((p) {
        final l = p as List;
        return CosaView(
          (l[0] as num).toDouble(),
          (l[1] as num).toDouble(),
          11,
          blanco,
          l[2] as String,
        );
      }).toList(),
      escudos: ((json['es'] as List?) ?? []).map((e) {
        final l = (e as List).cast<num>();
        return Rect.fromPoints(
          Offset(l[0].toDouble(), l[1].toDouble()),
          Offset(l[2].toDouble(), l[3].toDouble()),
        );
      }).toList(),
      generados: json['gen'] as int? ?? 0,
      destruidos: json['des'] as int? ?? 0,
      insignia: json['ins'] == 1,
      vidasPerdidas: json['perd'] as int? ?? 0,
      anuncio: json['anuncio'] as String?,
      zona: json['zona'] as String?,
      combinado: json['combinado'] == 1,
    );
  }

  final int fotograma;

  /// Qué vuelo de la sala es. Cambia en cada despegue.
  final int generacion;

  final int vidas;
  final int puntos;
  final int stage;
  final int tuIndice;
  final List<JugadorView> jugadores;
  final List<CosaView> balasJugador;
  final List<CosaView> balasEnemigo;
  final List<EnemigoView> enemigos;
  final JefeView? jefe;
  final List<CosaView> powerups;

  /// Cada escudo es el segmento entre dos naves; viaja como rectángulo porque
  /// dos puntos es lo único que hace falta para pintarlo.
  final List<Rect> escudos;

  final int generados;
  final int destruidos;
  final bool insignia;
  final int vidasPerdidas;
  final String? anuncio;
  final String? zona;
  final bool combinado;

  JugadorView? get tuNave =>
      jugadores.where((j) => j.indice == tuIndice).firstOrNull;
}

/// Si un fotograma que acaba de llegar se ha quedado atrás y hay que tirarlo.
///
/// Por la red los mensajes pueden adelantarse entre sí, y pintar uno viejo se
/// vería como un salto atrás. Pero el número de fotograma vuelve a cero en cada
/// despegue: comparar entre vuelos distintos daba por atrasado todo el vuelo
/// nuevo y dejaba la pantalla congelada en la última imagen del anterior. Por
/// eso solo se comparan fotogramas del mismo vuelo.
bool esAtrasado(SkyMundo? actual, SkyMundo nuevo) {
  if (actual == null) return false;
  if (nuevo.generacion != actual.generacion) return false;
  return nuevo.fotograma < actual.fotograma;
}

/// Lo que se cuenta al terminar un escenario.
class SkyResultado {
  const SkyResultado({
    required this.estado,
    required this.stage,
    required this.puntos,
    required this.jefeVerdadero,
    required this.ultimo,
    required this.condiciones,
    required this.porcentaje,
    required this.desbloqueados,
  });

  factory SkyResultado.fromJson(Map<String, dynamic> json) {
    final ev = json['evaluacion'] as Map?;
    return SkyResultado(
      estado: json['estado'] as String,
      stage: json['stage'] as int? ?? 0,
      puntos: json['puntos'] as int? ?? 0,
      jefeVerdadero: json['jefeVerdadero'] as bool? ?? false,
      ultimo: json['ultimo'] as bool? ?? false,
      porcentaje: ((ev?['porcentaje'] as num?) ?? 0).toDouble(),
      condiciones: ((ev?['condiciones'] as List?) ?? [])
          .map((c) => (
                texto: (c as Map)['texto'] as String,
                cumplida: c['cumplida'] as bool,
              ))
          .toList(),
      desbloqueados:
          ((json['desbloqueados'] as List?) ?? []).map((e) => e as String).toList(),
    );
  }

  final String estado;
  final int stage;
  final int puntos;
  final bool jefeVerdadero;
  final bool ultimo;
  final double porcentaje;
  final List<({String texto, bool cumplida})> condiciones;

  /// Países que se acaban de abrir con este escenario.
  final List<String> desbloqueados;

  bool get derrota => estado == 'gameover';
}

class SkyClient extends ChangeNotifier {
  io.Socket? _socket;

  SkyLobby? _lobby;
  SkyMundo? _mundo;
  SkyResultado? _resultado;
  List<PaisRemoto> _paises = const [];
  ProgresoView? _progreso;
  String? _code;
  String? _token;
  String? _error;

  /// Para no repetir mensajes de mando idénticos, que son la mayoría.
  String? _ultimoMando;

  /// Quién es este móvil, para que el servidor sepa qué lleva desbloqueado.
  /// Lo pone `GameClient` al arrancar.
  String? pilotId;

  SkyLobby? get lobby => _lobby;
  SkyMundo? get mundo => _mundo;
  SkyResultado? get resultado => _resultado;
  List<PaisRemoto> get paises => _paises;
  ProgresoView? get progreso => _progreso;
  String? get code => _code;
  String? get error => _error;
  bool get enEscuadrilla => _lobby != null;

  /// El país que lleva un piloto, para pintar su nave con sus colores.
  PaisRemoto? pais(String? id) =>
      id == null ? null : _paises.where((p) => p.id == id).firstOrNull;

  void rebind(io.Socket socket) {
    _socket = socket;

    socket.on('sky_joined', (data) {
      final json = (data as Map).cast<String, dynamic>();
      _code = json['code'] as String;
      _token = json['token'] as String?;
      _paises = ((json['paises'] as List?) ?? [])
          .map((p) => PaisRemoto.fromJson((p as Map).cast<String, dynamic>()))
          .toList();
      final prog = json['progreso'];
      if (prog != null) _progreso = ProgresoView.fromJson((prog as Map).cast<String, dynamic>());
      _error = null;
      notifyListeners();
    });

    socket.on('sky_lobby', (data) {
      _lobby = SkyLobby.fromJson((data as Map).cast<String, dynamic>());
      // Al despegar de nuevo se limpia lo del escenario anterior.
      if (_lobby!.volando) _resultado = null;
      notifyListeners();
    });

    socket.on('sky_state', (data) {
      final nuevo = SkyMundo.fromJson((data as Map).cast<String, dynamic>());
      if (esAtrasado(_mundo, nuevo)) return;
      _mundo = nuevo;
      notifyListeners();
    });

    socket.on('sky_result', (data) {
      final json = (data as Map).cast<String, dynamic>();
      _resultado = SkyResultado.fromJson(json);

      // Al terminar puede haberse abierto algún país: el catálogo llega otra vez
      // con lo que ahora sí se puede volar.
      final paises = json['paises'] as List?;
      if (paises != null) {
        _paises = paises.map((p) => PaisRemoto.fromJson((p as Map).cast<String, dynamic>())).toList();
      }
      final prog = json['progreso'];
      if (prog != null) _progreso = ProgresoView.fromJson((prog as Map).cast<String, dynamic>());
      notifyListeners();
    });

    socket.on('error_msg', (data) {
      _error = ((data as Map)['message'] as String?) ?? 'Algo salió mal.';
      notifyListeners();
    });
  }

  // -------------------------------------------------------------------------

  void crear(String nombre) =>
      _socket?.emit('sky_create', {'name': nombre, 'pilotId': pilotId});

  void unirse(String code, String nombre) => _socket?.emit(
        'sky_join',
        {'code': code.toUpperCase(), 'name': nombre, 'pilotId': pilotId},
      );

  void elegir(String paisId, int naveIndice) =>
      _socket?.emit('sky_pick', {'paisId': paisId, 'naveIndice': naveIndice});

  void despegar() => _socket?.emit('sky_start');

  void siguienteEscenario() => _socket?.emit('sky_next');

  /// El mando, tal cual lo tiene el dedo ahora mismo.
  ///
  /// Se manda aunque no cambie mientras se pilota: soltar el dedo y que el
  /// servidor no se entere dejaría la nave volando sola.
  void mando({required double x, required double y, required bool disparo}) {
    final firma = '${x.toStringAsFixed(2)},${y.toStringAsFixed(2)},$disparo';
    if (firma == _ultimoMando) return;
    _ultimoMando = firma;
    _socket?.emit('sky_input', {'x': x, 'y': y, 'disparo': disparo});
  }

  /// Bomba y donación son pulsaciones: van solas y no se repiten.
  void bomba() {
    _ultimoMando = null;
    _socket?.emit('sky_input', {'bomba': true});
  }

  void donar() {
    _ultimoMando = null;
    _socket?.emit('sky_input', {'donar': true});
  }

  void volver(String code, String token) =>
      _socket?.emit('sky_resume', {'code': code, 'token': token});

  void salir() {
    _socket?.emit('sky_leave');
    _lobby = null;
    _mundo = null;
    _resultado = null;
    _code = null;
    _token = null;
    _ultimoMando = null;
    notifyListeners();
  }

  /// Lo que hace falta para volver si la app se cierra a mitad de vuelo.
  ({String code, String token})? get credenciales {
    final c = _code;
    final t = _token;
    return c != null && t != null ? (code: c, token: t) : null;
  }
}
