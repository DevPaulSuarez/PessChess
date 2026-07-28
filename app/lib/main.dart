import 'package:flutter/material.dart';

import 'models/game_state.dart';
import 'screens/game_screen.dart';
import 'screens/home_screen.dart';
import 'screens/launcher_screen.dart';
import 'screens/tank_screen.dart';
import 'services/game_client.dart';

void main() {
  runApp(const PessChessApp());
}

class PessChessApp extends StatefulWidget {
  const PessChessApp({super.key});

  @override
  State<PessChessApp> createState() => _PessChessAppState();
}

class _PessChessAppState extends State<PessChessApp> {
  final _client = GameClient();

  /// El juego elegido en la pantalla de inicio. Null significa que aún no se
  /// ha elegido y toca enseñar la lista.
  GameKind? _chosen;

  @override
  void initState() {
    super.initState();
    _client.init();
  }

  @override
  void dispose() {
    _client.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final scheme = ColorScheme.fromSeed(
      seedColor: const Color(0xFF8B5E3C),
      brightness: Brightness.dark,
    );

    return MaterialApp(
      title: 'PessChess',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: scheme,
        scaffoldBackgroundColor: const Color(0xFF14110F),
        useMaterial3: true,
        filledButtonTheme: FilledButtonThemeData(
          style: FilledButton.styleFrom(
            // Solo altura mínima: usar `Size.fromHeight` pondría una anchura
            // mínima infinita, y eso rompe los botones que van dentro de una
            // fila. Los que deben ocupar todo el ancho ya lo consiguen con el
            // `stretch` de su columna.
            minimumSize: const Size(88, 52),
            textStyle:
                const TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
          ),
        ),
        inputDecorationTheme: const InputDecorationTheme(
          border: OutlineInputBorder(),
          filled: true,
        ),
      ),
      // Tres pantallas encadenadas: elegir juego, preparar la partida y jugar.
      // Con tan pocas no merece la pena montar navegación con rutas.
      home: ListenableBuilder(
        listenable: _client,
        builder: (context, _) {
          // Una partida en curso manda sobre todo lo demás: si se recupera una
          // al arrancar, hay que ir directo al tablero.
          if (_client.hasGame) return GameScreen(client: _client);

          final chosen = _chosen;
          if (chosen == null) {
            return LauncherScreen(
              client: _client,
              onPick: (game) => setState(() => _chosen = game),
            );
          }

          // Los tanques tienen su propio camino: no son por turnos ni de dos
          // jugadores, así que no pasan por la pantalla de las salas normales.
          if (chosen == GameKind.tanks) {
            return TankScreen(
              client: _client,
              onBack: () => setState(() => _chosen = null),
            );
          }

          return HomeScreen(
            client: _client,
            game: chosen,
            onBack: () => setState(() => _chosen = null),
          );
        },
      ),
    );
  }
}
