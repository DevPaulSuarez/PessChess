import 'dart:async';
import 'dart:io' show Platform;

import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;

import '../models/game_state.dart';

enum ConnectionStatus { offline, connecting, online }

/// Todo el estado de red de la app en un solo sitio.
///
/// Se encarga de hablar con el servidor, de guardar en el dispositivo lo justo
/// para poder volver a una partida interrumpida, y de que el reloj avance de
/// forma suave entre mensaje y mensaje del servidor.
class GameClient extends ChangeNotifier {
  static const _prefServerUrl = 'server_url';
  static const _prefPlayerName = 'player_name';
  static const _prefGameId = 'game_id';
  static const _prefGameToken = 'game_token';
  static const _prefBoard3d = 'board_3d';

  /// Servidor al que se conecta la app si el jugador no ha puesto otro.
  ///
  /// Por defecto, el servidor publicado: así la app funciona nada más
  /// instalarla, sin que nadie tenga que configurar nada.
  ///
  /// Para desarrollar contra un servidor en la propia máquina:
  ///
  ///   flutter run --dart-define=SERVER_URL=http://localhost:3000
  static const defaultServerUrl = String.fromEnvironment(
    'SERVER_URL',
    defaultValue: 'https://ajedrez.devpess.com',
  );

  /// Separa el almacenamiento de dos instancias en el mismo ordenador.
  ///
  /// Solo sirve para probar una partida contra uno mismo en dos ventanas: sin
  /// esto compartirían la sesión guardada y, al reconectar, una se haría pasar
  /// por la otra. Se activa lanzando la app con PESSCHESS_PROFILE=b.
  static final String _profile = () {
    if (kIsWeb) return '';
    return Platform.environment['PESSCHESS_PROFILE'] ?? '';
  }();

  static String _key(String name) => _profile.isEmpty ? name : '$_profile.$name';

  io.Socket? _socket;
  SharedPreferences? _prefs;
  Timer? _ticker;

  ConnectionStatus _connection = ConnectionStatus.offline;
  String _serverUrl = defaultServerUrl;
  String _playerName = '';
  GameState? _state;
  JoinInfo? _joinInfo;
  bool _inQueue = false;
  bool _board3d = false;
  String? _lastError;

  /// Momento en que llegó el último estado, para interpolar el reloj.
  DateTime _stateReceivedAt = DateTime.now();

  ConnectionStatus get connection => _connection;
  String get serverUrl => _serverUrl;
  String get playerName => _playerName;
  GameState? get state => _state;
  JoinInfo? get joinInfo => _joinInfo;
  bool get inQueue => _inQueue;

  /// Si el tablero se dibuja en perspectiva en vez de visto desde arriba.
  bool get board3d => _board3d;

  String? get lastError => _lastError;
  bool get hasGame => _state != null;

  /// Código para compartir con el rival mientras se espera.
  String? get roomCode => _joinInfo?.code;

  // -------------------------------------------------------------------------
  // Arranque
  // -------------------------------------------------------------------------

  Future<void> init() async {
    _prefs = await SharedPreferences.getInstance();
    _serverUrl = _prefs!.getString(_key(_prefServerUrl)) ?? defaultServerUrl;
    _playerName = _prefs!.getString(_key(_prefPlayerName)) ?? '';
    _board3d = _prefs!.getBool(_key(_prefBoard3d)) ?? false;
    notifyListeners();
    connect();
  }

  void connect() {
    _socket?.dispose();
    _connection = ConnectionStatus.connecting;
    _lastError = null;
    notifyListeners();

    final socket = io.io(
      _serverUrl,
      io.OptionBuilder()
          .setTransports(['websocket'])
          .enableReconnection()
          .setReconnectionDelay(1000)
          .setReconnectionDelayMax(5000)
          .build(),
    );
    _socket = socket;

    socket.onConnect((_) {
      _connection = ConnectionStatus.online;
      _lastError = null;
      // Si veníamos de una partida, volver a ella automáticamente.
      _resumeSavedGame();
      notifyListeners();
    });

    socket.onDisconnect((_) {
      _connection = ConnectionStatus.offline;
      _inQueue = false;
      notifyListeners();
    });

    socket.onConnectError((err) {
      _connection = ConnectionStatus.offline;
      _lastError = 'No se pudo conectar con $_serverUrl';
      notifyListeners();
    });

    socket.on('joined', (data) {
      _joinInfo = JoinInfo.fromJson((data as Map).cast<String, dynamic>());
      _inQueue = false;
      _saveGame(_joinInfo!.gameId, _joinInfo!.token);
      notifyListeners();
    });

    socket.on('state', (data) {
      _state = GameState.fromJson((data as Map).cast<String, dynamic>());
      _stateReceivedAt = DateTime.now();
      _lastError = null;
      _syncTicker();
      notifyListeners();
    });

    socket.on('queued', (_) {
      _inQueue = true;
      notifyListeners();
    });

    socket.on('queue_cancelled', (_) {
      _inQueue = false;
      notifyListeners();
    });

    socket.on('error_msg', (data) {
      final payload = (data as Map).cast<String, dynamic>();
      _lastError = payload['message'] as String?;
      // Una partida que ya no existe no debe quedarse guardada: si no, la app
      // intentaría volver a ella en cada arranque.
      if (payload['code'] == 'no_game') _clearSavedGame();
      notifyListeners();
    });
  }

  // -------------------------------------------------------------------------
  // Acciones del jugador
  // -------------------------------------------------------------------------

  Future<void> setServerUrl(String url) async {
    final trimmed = url.trim();
    if (trimmed.isEmpty || trimmed == _serverUrl) return;
    _serverUrl = trimmed;
    await _prefs?.setString(_key(_prefServerUrl), trimmed);
    // Cambiar de servidor invalida cualquier partida guardada del anterior.
    await _clearSavedGame();
    _state = null;
    _joinInfo = null;
    connect();
  }

  Future<void> setPlayerName(String name) async {
    _playerName = name.trim();
    await _prefs?.setString(_key(_prefPlayerName), _playerName);
    notifyListeners();
  }

  void createRoom(TimeControl? timeControl) {
    _resetGame();
    _socket?.emit('create_room', {
      'name': _playerName,
      'timeControl': timeControl?.toJson(),
    });
  }

  void joinRoom(String code) {
    _resetGame();
    _socket?.emit('join_room', {
      'name': _playerName,
      'code': code.trim().toUpperCase(),
    });
  }

  void quickMatch(TimeControl? timeControl) {
    _resetGame();
    _socket?.emit('quick_match', {
      'name': _playerName,
      'timeControl': timeControl?.toJson(),
    });
  }

  void cancelQueue() => _socket?.emit('cancel_queue');

  Future<void> toggleBoard3d() async {
    _board3d = !_board3d;
    await _prefs?.setBool(_key(_prefBoard3d), _board3d);
    notifyListeners();
  }

  void move(String from, String to, {String? promotion}) {
    _socket?.emit('move', {
      'from': from,
      'to': to,
      'promotion': ?promotion,
    });
  }

  void resign() => _socket?.emit('resign');
  void offerDraw() => _socket?.emit('offer_draw');
  void acceptDraw() => _socket?.emit('accept_draw');
  void declineDraw() => _socket?.emit('decline_draw');

  /// Salir de la partida actual y volver al menú.
  Future<void> leaveGame() async {
    _resetGame();
    await _clearSavedGame();
    notifyListeners();
  }

  void clearError() {
    if (_lastError == null) return;
    _lastError = null;
    notifyListeners();
  }

  void _resetGame() {
    _state = null;
    _joinInfo = null;
    _inQueue = false;
    _lastError = null;
    _stopTicker();
  }

  // -------------------------------------------------------------------------
  // Reloj
  // -------------------------------------------------------------------------

  /// Tiempo restante de cada color, descontando lo que lleva pensando el
  /// jugador de turno desde el último mensaje del servidor.
  ///
  /// Es solo para la pantalla: quien decide de verdad si alguien se quedó sin
  /// tiempo es siempre el servidor.
  Map<PieceColor, int>? get displayClocks {
    final state = _state;
    final clocks = state?.clocks;
    if (state == null || clocks == null) return null;
    if (state.status != GameStatus.active) return clocks;

    final elapsed = DateTime.now().difference(_stateReceivedAt).inMilliseconds;
    return {
      for (final color in PieceColor.values)
        color: color == state.turn
            ? (clocks[color]! - elapsed).clamp(0, clocks[color]!)
            : clocks[color]!,
    };
  }

  /// El reloj solo necesita repintarse durante una partida en curso con tiempo.
  void _syncTicker() {
    final state = _state;
    final needsTicker = state != null &&
        state.status == GameStatus.active &&
        state.clocks != null;

    if (needsTicker && _ticker == null) {
      _ticker = Timer.periodic(
          const Duration(milliseconds: 200), (_) => notifyListeners());
    } else if (!needsTicker) {
      _stopTicker();
    }
  }

  void _stopTicker() {
    _ticker?.cancel();
    _ticker = null;
  }

  // -------------------------------------------------------------------------
  // Partida guardada
  // -------------------------------------------------------------------------

  void _resumeSavedGame() {
    final gameId = _prefs?.getString(_key(_prefGameId));
    final token = _prefs?.getString(_key(_prefGameToken));
    if (gameId == null || token == null) return;
    _socket?.emit('resume', {'gameId': gameId, 'token': token});
  }

  Future<void> _saveGame(String gameId, String token) async {
    await _prefs?.setString(_key(_prefGameId), gameId);
    await _prefs?.setString(_key(_prefGameToken), token);
  }

  Future<void> _clearSavedGame() async {
    await _prefs?.remove(_key(_prefGameId));
    await _prefs?.remove(_key(_prefGameToken));
  }

  @override
  void dispose() {
    _stopTicker();
    _socket?.dispose();
    super.dispose();
  }
}
