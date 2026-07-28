
import 'package:flutter/foundation.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;

/// Un tanque tal y como lo manda el servidor.
class TankView {
  const TankView({
    required this.id,
    required this.color,
    required this.name,
    required this.x,
    required this.y,
    required this.dir,
    required this.hp,
    required this.maxHp,
    required this.attack,
    required this.defense,
    this.speed = 6,
    required this.alive,
    required this.kills,
    required this.upgrades,
    this.charging = 0,
    this.chargeMs = 1,
  });

  final String id;
  final int color;

  /// Null en los tanques de la máquina.
  final String? name;

  final double x;
  final double y;
  final String dir;
  final int hp;
  final int maxHp;
  final int attack;
  final int defense;

  /// Celdas por segundo; sube con los cofres rosas.
  final double speed;
  final bool alive;
  final int kills;

  /// Mejoras ganadas y sin gastar.
  final int upgrades;

  /// Milisegundos que lleva pulsado el gatillo, y los que hacen falta.
  final int charging;
  final int chargeMs;

  /// De 0 a 1: lo cargado que está el disparo.
  double get chargeRatio =>
      chargeMs <= 0 ? 0 : (charging / chargeMs).clamp(0, 1).toDouble();

  bool get isCharged => charging >= chargeMs;

  bool get isCpu => name == null;

  factory TankView.fromJson(Map<String, dynamic> json) => TankView(
        id: json['id'] as String,
        color: _parseColor(json['color'] as String),
        name: json['name'] as String?,
        x: (json['x'] as num).toDouble(),
        y: (json['y'] as num).toDouble(),
        dir: json['dir'] as String,
        hp: json['hp'] as int,
        maxHp: json['maxHp'] as int,
        attack: json['attack'] as int,
        defense: json['defense'] as int,
        speed: (json['speed'] as num?)?.toDouble() ?? 6,
        alive: json['alive'] as bool,
        kills: json['kills'] as int,
        upgrades: json['upgrades'] as int,
        charging: json['charging'] as int? ?? 0,
        chargeMs: json['chargeMs'] as int? ?? 1,
      );
}

class BulletView {
  const BulletView(this.x, this.y, {this.charged = false});
  final double x;
  final double y;

  /// Los cargados se pintan distintos y revientan el acero.
  final bool charged;
}

/// Un cofre esperando a que alguien lo pise.
class PickupView {
  const PickupView(this.kind, this.x, this.y, {this.hp = 3});

  /// 'life', 'defense' o 'attack'.
  final String kind;
  final double x;
  final double y;

  /// Hay que reventarlo a tiros; el premio es de quien dé el último.
  final int hp;
}

/// Un jugador sentado en la sala, antes de empezar.
class LobbyPlayer {
  const LobbyPlayer({
    required this.name,
    required this.color,
    required this.connected,
    required this.isHost,
  });

  final String name;
  final String? color;
  final bool connected;
  final bool isHost;

  factory LobbyPlayer.fromJson(Map<String, dynamic> json) => LobbyPlayer(
        name: json['name'] as String,
        color: json['color'] as String?,
        connected: json['connected'] as bool,
        isHost: json['isHost'] as bool,
      );
}

class TankColorOption {
  const TankColorOption(this.id, this.value);
  final String id;
  final int value;
}

/// La sala de tanques mientras se espera a que empiece.
class TankLobby {
  const TankLobby({
    required this.code,
    required this.tankCount,
    required this.chests,
    required this.minTanks,
    required this.maxTanks,
    required this.maxChests,
    required this.colors,
    required this.taken,
    required this.canStart,
    required this.players,
    required this.youAreHost,
    required this.yourColor,
    required this.mapId,
    required this.mapName,
    required this.maps,
  });

  final String code;
  final int tankCount;

  /// Cuántos cofres de cada clase saldrán: 'life', 'defense' y 'attack'.
  final Map<String, int> chests;
  final int minTanks;
  final int maxTanks;
  final int maxChests;
  final List<TankColorOption> colors;

  /// Colores que ya ha cogido alguien: no se pueden volver a elegir.
  final List<String> taken;

  final bool canStart;
  final List<LobbyPlayer> players;
  final bool youAreHost;
  final String? yourColor;

  /// Mapa dibujado con el que se jugará, o null para uno generado.
  final String? mapId;
  final String? mapName;

  /// Los mapas guardados en el editor, para poder elegir.
  final List<({String id, String name})> maps;

  /// Cuántos tanques llevará la máquina con los jugadores que hay ahora.
  int get cpuTanks => (tankCount - players.length).clamp(0, tankCount);

  factory TankLobby.fromJson(Map<String, dynamic> json) => TankLobby(
        code: json['code'] as String,
        tankCount: json['tankCount'] as int,
        chests: ((json['chests'] as Map?) ?? {})
            .map((k, v) => MapEntry(k as String, (v as num).toInt())),
        minTanks: json['minTanks'] as int,
        maxTanks: json['maxTanks'] as int,
        maxChests: json['maxChests'] as int? ?? 10,
        colors: (json['colors'] as List)
            .map((c) => TankColorOption(
                  (c as Map)['id'] as String,
                  _parseColor(c['hex'] as String),
                ))
            .toList(),
        taken: (json['taken'] as List).cast<String>(),
        canStart: json['canStart'] as bool,
        players: (json['players'] as List)
            .map((p) => LobbyPlayer.fromJson((p as Map).cast<String, dynamic>()))
            .toList(),
        youAreHost: json['youAreHost'] as bool,
        yourColor: json['yourColor'] as String?,
        mapId: json['mapId'] as String?,
        mapName: json['mapName'] as String?,
        maps: ((json['maps'] as List?) ?? [])
            .map((m) => (
                  id: (m as Map)['id'] as String,
                  name: m['name'] as String,
                ))
            .toList(),
      );
}

/// Algo que acaba de pasar y hay que animar: un disparo, un ladrillo roto o un
/// tanque destruido. Se apaga solo con el tiempo.
class EffectView {
  EffectView(this.kind, this.x, this.y) : bornAt = DateTime.now();

  /// 'shot', 'brick' o 'tank'.
  final String kind;
  final double x;
  final double y;
  final DateTime bornAt;

  /// Cuánto dura cada clase de animación.
  Duration get duration => switch (kind) {
        'shot' => const Duration(milliseconds: 160),
        'crack' => const Duration(milliseconds: 200),
        'brick' => const Duration(milliseconds: 380),
        _ => const Duration(milliseconds: 600),
      };

  /// De 0 (recién ocurrido) a 1 (ya terminado).
  double get progress {
    final elapsed = DateTime.now().difference(bornAt).inMilliseconds;
    return (elapsed / duration.inMilliseconds).clamp(0, 1).toDouble();
  }

  bool get done => progress >= 1;
}

/// El mundo en un instante.
class TankWorld {
  const TankWorld({
    required this.status,
    required this.size,
    required this.tankSize,
    required this.yourTankId,
    required this.tanks,
    required this.bullets,
    required this.pickups,
    required this.walls,
    required this.effects,
    required this.winner,
  });

  final String status;
  final int size;
  final double tankSize;
  final String? yourTankId;
  final List<TankView> tanks;
  final List<BulletView> bullets;
  final List<PickupView> pickups;
  final List<EffectView> effects;

  /// El campo, celda a celda: 0 vacío, 1 ladrillo, 2 acero.
  final List<int> walls;

  final ({String name, int color})? winner;

  bool get finished => status == 'finished';

  TankView? get yourTank {
    for (final tank in tanks) {
      if (tank.id == yourTankId) return tank;
    }
    return null;
  }
}

/// Habla con el servidor durante una partida de tanques.
///
/// Va aparte del cliente de ajedrez porque el trato es distinto: aquí no se
/// mandan jugadas y se espera, sino que se avisa de lo que se tiene pulsado y
/// el servidor manda el mundo veinte veces por segundo.
class TankClient extends ChangeNotifier {
  /// El socket cambia cada vez que la app se reconecta, así que no se guarda
  /// para siempre: se vuelve a enganchar en cada conexión.
  io.Socket? _socket;

  TankLobby? _lobby;
  TankWorld? _world;
  String? _code;
  String? _error;

  /// Lo último que se mandó, para no repetir mensajes idénticos.
  String? _lastSentInput;

  /// El campo llega solo cuando cambia, así que hay que recordarlo.
  List<int> _walls = const [];

  /// Animaciones en curso. Duran más que el mensaje que las provocó, así que
  /// se guardan aquí y se van apagando solas.
  final List<EffectView> _effects = [];

  TankLobby? get lobby => _lobby;
  TankWorld? get world => _world;
  String? get code => _code;
  String? get error => _error;
  bool get inMatch => _lobby != null || _world != null;

  void rebind(io.Socket socket) {
    _socket = socket;
    socket.on('tank_joined', (data) {
      _code = (data as Map)['code'] as String;
      notifyListeners();
    });

    socket.on('tank_lobby', (data) {
      _lobby = TankLobby.fromJson((data as Map).cast<String, dynamic>());
      _error = null;
      notifyListeners();
    });

    socket.on('tank_state', (data) {
      final json = (data as Map).cast<String, dynamic>();
      for (final event in (json['events'] as List?) ?? []) {
        final e = (event as Map).cast<String, dynamic>();
        _effects.add(EffectView(
          e['kind'] as String,
          (e['x'] as num).toDouble(),
          (e['y'] as num).toDouble(),
        ));
      }
      _effects.removeWhere((e) => e.done);

      final walls = json['walls'] as String?;
      if (walls != null) {
        _walls = walls.split('').map(int.parse).toList(growable: false);
      }

      _world = TankWorld(
        status: json['status'] as String,
        size: json['size'] as int,
        tankSize: (json['tankSize'] as num).toDouble(),
        yourTankId: json['yourTankId'] as String?,
        tanks: (json['tanks'] as List)
            .map((t) => TankView.fromJson((t as Map).cast<String, dynamic>()))
            .toList(),
        bullets: (json['bullets'] as List)
            .map((b) => BulletView(
                  ((b as Map)['x'] as num).toDouble(),
                  (b['y'] as num).toDouble(),
                  charged: b['charged'] as bool? ?? false,
                ))
            .toList(),
        pickups: ((json['pickups'] as List?) ?? [])
            .map((p) => PickupView(
                  (p as Map)['kind'] as String,
                  (p['x'] as num).toDouble(),
                  (p['y'] as num).toDouble(),
                  hp: (p['hp'] as num?)?.toInt() ?? 3,
                ))
            .toList(),
        walls: _walls,
        effects: List.unmodifiable(_effects),
        winner: json['winner'] == null
            ? null
            : (
                name: (json['winner'] as Map)['name'] as String,
                color: _parseColor((json['winner'] as Map)['color'] as String),
              ),
      );
      // La sala ya no pinta nada una vez empezada la partida.
      if (_world!.status != 'lobby') _lobby = null;
      notifyListeners();
    });
  }

  // -------------------------------------------------------------------------

  void create(String name, int tankCount, Map<String, int> chests) {
    _reset();
    _socket?.emit('tank_create', {
      'name': name,
      'tankCount': tankCount,
      'chests': chests,
    });
  }

  void join(String code, String name) {
    _reset();
    _socket?.emit('tank_join', {'code': code.trim().toUpperCase(), 'name': name});
  }

  void pickColor(String colorId) =>
      _socket?.emit('tank_pick_color', {'color': colorId});

  void setTankCount(int count) =>
      _socket?.emit('tank_set_count', {'tankCount': count});

  void start() => _socket?.emit('tank_start');

  /// Elige el mapa dibujado, o null para uno generado al azar.
  void pickMap(String? mapId) => _socket?.emit('tank_set_map', {'mapId': mapId});

  /// Avisa de lo que el jugador tiene pulsado.
  ///
  /// Solo se manda cuando cambia: repetir lo mismo veinte veces por segundo
  /// llenaría la red sin aportar nada.
  void sendInput({String? dir, required bool firing}) {
    final packed = '${dir ?? '-'}:$firing';
    if (packed == _lastSentInput) return;
    _lastSentInput = packed;
    _socket?.emit('tank_input', {'dir': dir, 'firing': firing});
  }

  void leave() {
    _socket?.emit('tank_leave');
    _reset();
    notifyListeners();
  }

  void showError(String message) {
    _error = message;
    notifyListeners();
  }

  void _reset() {
    _lobby = null;
    _world = null;
    _code = null;
    _error = null;
    _walls = const [];
    _effects.clear();
    _lastSentInput = null;
  }
}

int _parseColor(String hex) =>
    int.parse('FF${hex.replaceFirst('#', '')}', radix: 16);
