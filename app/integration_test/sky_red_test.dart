/// Sky Warriors en red, con la interfaz real.
///
/// La app hace de piloto 1 y un socket pelado hace de piloto 2, los dos contra
/// el servidor de verdad. Comprueba lo que ninguna prueba sin pantalla puede:
/// que desde la app se crea una escuadrilla, se elige país —y solo entre los
/// desbloqueados—, se despega y llega a pintarse el mundo que manda el
/// servidor. Requiere el servidor levantado:
///
///   cd server && npm run dev
///   cd app && flutter test integration_test/sky_red_test.dart -d macos
library;

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;

import 'package:pesschess/main.dart' as app;

const _serverUrl = 'http://localhost:3000';

/// El compañero de escuadrilla: un cliente sin interfaz.
class Companero {
  Companero._(this.socket);

  final io.Socket socket;
  Map<String, dynamic>? lobby;
  Map<String, dynamic>? mundo;
  String ultimoError = '';

  static Future<Companero> connect() async {
    final socket = io.io(
      _serverUrl,
      // Sin `enableForceNew`, socket.io reutilizaría la conexión que ya tiene
      // abierta la app y los dos pilotos compartirían un único socket.
      io.OptionBuilder().setTransports(['websocket']).enableForceNew().build(),
    );
    final companero = Companero._(socket);

    socket.on('sky_lobby', (d) => companero.lobby = (d as Map).cast<String, dynamic>());
    socket.on('sky_state', (d) => companero.mundo = (d as Map).cast<String, dynamic>());
    socket.on('error_msg', (d) => companero.ultimoError = ((d as Map)['message'] as String?) ?? '');

    final listo = Completer<void>();
    socket.onConnect((_) => listo.complete());
    await listo.future.timeout(const Duration(seconds: 5));
    return companero;
  }

  void unirse(String code, String nombre) =>
      socket.emit('sky_join', {'code': code, 'name': nombre, 'pilotId': 'companero-de-prueba'});

  void elegirNave(String paisId, int naveIndice) =>
      socket.emit('sky_pick', {'paisId': paisId, 'naveIndice': naveIndice});

  void pilotar({double x = 0, double y = 0, bool disparo = true}) =>
      socket.emit('sky_input', {'x': x, 'y': y, 'disparo': disparo});

  void dispose() => socket.dispose();
}

Future<void> pumpUntil(
  WidgetTester tester,
  String what,
  bool Function() condition, {
  Duration timeout = const Duration(seconds: 15),
}) async {
  final deadline = DateTime.now().add(timeout);
  while (DateTime.now().isBefore(deadline)) {
    await tester.pump(const Duration(milliseconds: 100));
    if (condition()) return;
  }
  final visible = tester
      .widgetList<Text>(find.byType(Text))
      .map((t) => t.data)
      .whereType<String>()
      .where((t) => t.trim().isNotEmpty)
      .toList();
  fail('Se agotó el tiempo esperando: $what\nEn pantalla había: $visible');
}

Future<void> pumpUntilText(WidgetTester tester, String text) =>
    pumpUntil(tester, 'el texto "$text"', () => find.text(text).evaluate().isNotEmpty);

/// El código de la escuadrilla: cuatro letras o números en pantalla.
String leerCodigo(WidgetTester tester) {
  final code = tester
      .widgetList<Text>(find.byType(Text))
      .map((t) => t.data)
      .whereType<String>()
      .firstWhere((t) => RegExp(r'^[A-Z0-9]{4}$').hasMatch(t), orElse: () => '');
  expect(code, isNotEmpty, reason: 'No apareció el código de la escuadrilla');
  return code;
}

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    // Cada prueba arranca como un móvil recién instalado: así el progreso de
    // una no decide qué países ve la siguiente.
    SharedPreferences.setMockInitialValues({});
  });

  testWidgets('salir del matamarcianos deja entrar a los demás juegos', (tester) async {
    app.main();
    await tester.pump(const Duration(seconds: 2));

    // Entrar al matamarcianos, crear una escuadrilla y volverse atrás.
    await pumpUntilText(tester, 'Sky Warriors United');
    await tester.tap(find.text('Sky Warriors United'));
    await pumpUntilText(tester, 'Crear escuadrilla');

    await tester.enterText(find.byType(TextField).first, 'Ana');
    await tester.pump();
    await tester.tap(find.text('Crear escuadrilla'));
    await pumpUntilText(tester, 'Comparte este código');

    await tester.tap(find.byIcon(Icons.arrow_back));
    await pumpUntilText(tester, 'Ajedrez');

    // Y desde ahí, entrar a un juego normal como si nada hubiera pasado.
    await tester.tap(find.text('Ajedrez'));
    await pumpUntilText(tester, 'Crear partida');

    await tester.enterText(find.byType(TextField).first, 'Ana');
    await tester.pump();
    await tester.tap(find.text('Crear partida'));
    await pumpUntilText(tester, 'Comparte este código');
  });

  testWidgets('dos pilotos vuelan el mismo escenario desde la app', (tester) async {
    final companero = await Companero.connect();
    addTearDown(companero.dispose);

    app.main();
    await tester.pump(const Duration(seconds: 2));

    await pumpUntilText(tester, 'Sky Warriors United');
    await tester.tap(find.text('Sky Warriors United'));
    await pumpUntilText(tester, 'Crear escuadrilla');

    await tester.enterText(find.byType(TextField).first, 'Ana');
    await tester.pump();
    await tester.tap(find.text('Crear escuadrilla'));
    await pumpUntilText(tester, 'Comparte este código');

    final code = leerCodigo(tester);
    expect(code.length, 4);

    // --- Los países que no se han ganado no se pueden elegir ---------------
    await pumpUntilText(tester, 'Estados Unidos');
    expect(find.text('Por ganar'), findsWidgets,
        reason: 'Los países bloqueados deben verse, marcados');
    expect(find.byIcon(Icons.lock), findsWidgets);

    // México está bloqueado de salida: tocarlo no abre su lista de pilotos.
    expect(find.text('eligiendo…'), findsOneWidget);
    await tester.tap(find.text('México'));
    await tester.pump(const Duration(milliseconds: 400));
    expect(find.text('Estados Unidos'), findsOneWidget,
        reason: 'Un país bloqueado no debe abrirse');

    // --- Primero el país, después el piloto -------------------------------
    await tester.tap(find.text('Estados Unidos'));
    await tester.pump(const Duration(milliseconds: 400));

    // Ya dentro del país: sus dos pilotos, cada uno con su nave.
    expect(find.text('F-35 Lightning II'), findsOneWidget);
    expect(find.text('F-22 Raptor'), findsOneWidget);

    await tester.tap(find.text('F-35 Lightning II'));
    await pumpUntil(tester, 'que la app registre la elección',
        () => find.text('Falta gente por elegir').evaluate().isNotEmpty
            || find.text('Despegar').evaluate().isNotEmpty);

    companero.unirse(code, 'Beto');
    await pumpUntilText(tester, 'Beto');

    // El compañero intenta la misma nave que ya lleva la app: no debe poder.
    companero.elegirNave('usa', 0);
    await tester.pump(const Duration(milliseconds: 500));
    expect(companero.ultimoError, contains('ya la lleva'),
        reason: 'Dos pilotos no pueden llevar la misma nave');

    // La otra nave del mismo país sí está libre.
    companero.elegirNave('usa', 1);
    await pumpUntilText(tester, 'Despegar');

    // Y en la lista de pilotos se ve quién lleva la que ya no está libre.
    expect(find.textContaining('La lleva Beto'), findsOneWidget);

    // --- Despegar ---------------------------------------------------------
    await tester.tap(find.text('Despegar'));

    // El mundo llega del servidor: si no llegara, no habría nada que pintar.
    await pumpUntil(tester, 'que el compañero reciba el mundo',
        () => companero.mundo != null);

    final mundo = companero.mundo!;
    expect((mundo['j'] as List).length, 2, reason: 'Deben volar las dos naves');

    // La app está pintando ese mismo mundo: el marcador de puntos del HUD solo
    // existe cuando hay partida.
    await pumpUntil(tester, 'el marcador del vuelo',
        () => find.text('00000000').evaluate().isNotEmpty);

    // --- El mando de la app mueve su nave, no la del compañero ------------
    final naves = mundo['j'] as List;
    final xAntes = ((naves[0] as List)[1] as num).toDouble();
    final xCompaneroAntes = ((naves[1] as List)[1] as num).toDouble();

    // Un dedo arrastrando hacia la izquierda de la pantalla.
    final centro = tester.getCenter(find.byType(CustomPaint).first);
    final gesto = await tester.startGesture(centro);
    for (var i = 0; i < 12; i++) {
      await gesto.moveBy(const Offset(-14, 0));
      await tester.pump(const Duration(milliseconds: 40));
    }

    await pumpUntil(
      tester,
      'que la nave de la app se mueva a la izquierda',
      () {
        final j = companero.mundo?['j'] as List?;
        if (j == null) return false;
        return ((j[0] as List)[1] as num).toDouble() < xAntes - 15;
      },
    );
    await gesto.up();

    final despues = companero.mundo!['j'] as List;
    expect(((despues[1] as List)[1] as num).toDouble(),
        closeTo(xCompaneroAntes, 6),
        reason: 'El dedo de un piloto no puede mover la nave del otro');
  });
}
