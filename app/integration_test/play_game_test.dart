/// Prueba de extremo a extremo con la interfaz real.
///
/// La app hace de jugador 1 y un socket normal hace de jugador 2, ambos contra
/// el servidor de verdad. Requiere el servidor levantado:
///
///   cd server && npm run dev
///   cd app && flutter test integration_test -d macos
library;

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;

import 'package:pesschess/main.dart' as app;

const _serverUrl = 'http://localhost:3000';

/// El rival: un cliente pelado, sin interfaz.
class Opponent {
  Opponent._(this.socket);

  final io.Socket socket;
  final _states = StreamController<Map<String, dynamic>>.broadcast();
  Map<String, dynamic>? last;

  static Future<Opponent> connect() async {
    final socket = io.io(
      _serverUrl,
      // `enableForceNew` es imprescindible: sin él, socket.io reutiliza la
      // conexión que ya tiene abierta la app hacia esta misma URL y los dos
      // jugadores acabarían compartiendo un único socket.
      io.OptionBuilder()
          .setTransports(['websocket'])
          .enableForceNew()
          .build(),
    );
    final opponent = Opponent._(socket);

    socket.on('state', (data) {
      final state = (data as Map).cast<String, dynamic>();
      opponent.last = state;
      opponent._states.add(state);
    });

    final ready = Completer<void>();
    socket.onConnect((_) => ready.complete());
    await ready.future.timeout(const Duration(seconds: 5));
    return opponent;
  }

  void joinRoom(String code, String name) =>
      socket.emit('join_room', {'name': name, 'code': code});

  void move(String from, String to) =>
      socket.emit('move', {'from': from, 'to': to});

  void resign() => socket.emit('resign');

  /// Espera un estado que cumpla la condición (o lo da por bueno si ya vale).
  Future<Map<String, dynamic>> waitFor(
    String what,
    bool Function(Map<String, dynamic>) predicate, {
    Duration timeout = const Duration(seconds: 8),
  }) {
    if (last != null && predicate(last!)) return Future.value(last!);
    return _states.stream.firstWhere(predicate).timeout(
          timeout,
          onTimeout: () => throw TestFailure(
            'El rival nunca vio: $what\nSu último estado fue: $last',
          ),
        );
  }

  void dispose() {
    socket.dispose();
    _states.close();
  }
}

/// Repinta hasta que se cumpla la condición, en vez de esperar a ciegas.
///
/// `pumpAndSettle` no sirve aquí: la app tiene un reloj que se refresca cada
/// 200 ms, así que nunca llega a quedarse quieta.
Future<void> pumpUntil(
  WidgetTester tester,
  String what,
  bool Function() condition, {
  Duration timeout = const Duration(seconds: 10),
}) async {
  final deadline = DateTime.now().add(timeout);
  while (DateTime.now().isBefore(deadline)) {
    await tester.pump(const Duration(milliseconds: 100));
    if (condition()) return;
  }
  // Al fallar, enseñar lo que sí había en pantalla ahorra mucho tiempo.
  final visible = tester
      .widgetList<Text>(find.byType(Text))
      .map((t) => t.data)
      .whereType<String>()
      .where((t) => t.trim().isNotEmpty)
      .toList();
  fail('Se agotó el tiempo esperando: $what\nEn pantalla había: $visible');
}

/// Atajo para esperar a que aparezca un texto concreto.
Future<void> pumpUntilText(WidgetTester tester, String text) =>
    pumpUntil(tester, 'el texto "$text"',
        () => find.text(text).evaluate().isNotEmpty);

/// Saca el código de sala de la pantalla de espera: 4 letras o números.
String readRoomCode(WidgetTester tester) {
  final code = tester
      .widgetList<Text>(find.byType(Text))
      .map((t) => t.data)
      .whereType<String>()
      .firstWhere(
        (text) => RegExp(r'^[A-Z0-9]{4}$').hasMatch(text),
        orElse: () => '',
      );
  expect(code, isNotEmpty, reason: 'No apareció el código de sala');
  return code;
}

Future<void> tapSquare(WidgetTester tester, String square) async {
  final finder = find.byKey(ValueKey('square-$square'));
  expect(finder, findsOneWidget, reason: 'No se encontró la casilla $square');

  // Si la casilla está tapada o fuera de pantalla, el toque se pierde en
  // silencio y la prueba acaba fallando mucho después y por otro motivo.
  if (finder.hitTestable().evaluate().isEmpty) {
    final visible = tester
        .widgetList<Text>(find.byType(Text))
        .map((t) => t.data)
        .whereType<String>()
        .where((t) => t.trim().isNotEmpty && t.length > 1)
        .toList();
    fail('Algo tapa la casilla $square. En pantalla: $visible');
  }

  await tester.tap(finder);
  await tester.pump();
}

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    // Cada prueba arranca sin partida guardada ni nombre previo.
    SharedPreferences.setMockInitialValues({'server_url': _serverUrl});
  });

  testWidgets('dos jugadores juegan una partida completa', (tester) async {
    final opponent = await Opponent.connect();
    addTearDown(opponent.dispose);

    app.main();
    await tester.pump(const Duration(seconds: 2));

    // --- El jugador 1 crea la sala desde la interfaz -----------------------
    expect(find.text('PessChess'), findsOneWidget);

    await tester.enterText(find.byType(TextField).first, 'Ana');
    await tester.pump();

    await tester.tap(find.text('Crear partida'));
    await pumpUntilText(tester, 'Comparte este código');

    final code = readRoomCode(tester);
    expect(code.length, 4);

    // --- El jugador 2 entra con ese código ---------------------------------
    opponent.joinRoom(code, 'Beto');
    await opponent.waitFor('que la partida arrancase', (s) => s['status'] == 'active');
    await pumpUntilText(tester, 'Te toca mover');

    // La pantalla de espera desaparece y se ven los dos nombres.
    expect(find.text('Comparte este código'), findsNothing);
    expect(find.text('Ana'), findsOneWidget);
    expect(find.text('Beto'), findsOneWidget);

    // Se ven los dos relojes. El de las blancas ya corre, así que solo el de
    // las negras sigue clavado en el tiempo inicial.
    final clocks = tester
        .widgetList<Text>(find.byType(Text))
        .map((t) => t.data)
        .whereType<String>()
        .where((t) => RegExp(r'^\d+:\d{2}$').hasMatch(t))
        .toList();
    expect(clocks.length, 2, reason: 'Deben verse los dos relojes');
    expect(clocks, contains('10:00'));

    // --- El jugador 1 mueve tocando el tablero -----------------------------
    await tapSquare(tester, 'e2');
    await tapSquare(tester, 'e4');

    final afterE4 = await opponent.waitFor('la primera jugada de las blancas', (s) => s['history'].isNotEmpty);
    expect(afterE4['history'], ['e4'], reason: 'La jugada no llegó al rival');

    await pumpUntilText(tester, 'Mueve tu rival');

    // --- Y el rival responde -----------------------------------------------
    opponent.move('e7', 'e5');
    await pumpUntilText(tester, '1. e4 e5');
    expect(find.text('Te toca mover'), findsOneWidget);

    // --- Una jugada ilegal no debe hacer nada -------------------------------
    await tapSquare(tester, 'd1');
    await tapSquare(tester, 'd8'); // la dama no puede llegar ahí
    await tester.pump(const Duration(milliseconds: 500));
    expect(find.text('1. e4 e5'), findsOneWidget, reason: 'El tablero no debía cambiar');

    // --- Jaque: la interfaz debe avisar ------------------------------------
    await tapSquare(tester, 'f1');
    await tapSquare(tester, 'c4');
    await opponent.waitFor('la tercera jugada', (s) => s['history'].length == 3);
    opponent.move('b8', 'c6');
    await pumpUntilText(tester, 'Te toca mover');

    await tapSquare(tester, 'd1');
    await tapSquare(tester, 'h5');
    await opponent.waitFor('la quinta jugada', (s) => s['history'].length == 5);
    opponent.move('g8', 'f6');
    await pumpUntilText(tester, 'Te toca mover');

    // --- Mate del pastor ---------------------------------------------------
    await tapSquare(tester, 'h5');
    await tapSquare(tester, 'f7');

    final mated = await opponent.waitFor('el final de la partida', (s) => s['status'] == 'finished');
    expect(mated['result'], '1-0');
    expect(mated['endReason'], 'checkmate');

    await pumpUntilText(tester, '¡Has ganado!');
    expect(find.textContaining('jaque mate'), findsWidgets);
  });

  testWidgets('el rival abandona y la app lo anuncia', (tester) async {
    final opponent = await Opponent.connect();
    addTearDown(opponent.dispose);

    app.main();
    await tester.pump(const Duration(seconds: 2));

    await tester.enterText(find.byType(TextField).first, 'Ana');
    await tester.pump();
    await tester.tap(find.text('Crear partida'));
    await pumpUntilText(tester, 'Comparte este código');

    opponent.joinRoom(readRoomCode(tester), 'Beto');
    await opponent.waitFor('que la partida arrancase', (s) => s['status'] == 'active');
    await pumpUntilText(tester, 'Te toca mover');

    opponent.resign();
    await pumpUntilText(tester, '¡Has ganado!');
    expect(find.textContaining('abandono'), findsWidgets);
  });

  testWidgets('un código inexistente avisa sin romper nada', (tester) async {
    app.main();
    await tester.pump(const Duration(seconds: 2));

    await tester.enterText(find.byType(TextField).first, 'Ana');
    await tester.pump();

    // El segundo campo de texto es el del código de sala.
    await tester.enterText(find.byType(TextField).at(1), 'ZZZZ');
    await tester.pump();
    await tester.tap(find.text('Entrar'));

    await pumpUntil(tester, 'el aviso de sala inexistente',
        () => find.textContaining('No existe ninguna sala').evaluate().isNotEmpty);

    // Y seguimos en el menú, no en una partida rota.
    expect(find.text('Crear partida'), findsOneWidget);
  });
}
