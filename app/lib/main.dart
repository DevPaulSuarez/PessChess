import 'package:flutter/material.dart';

import 'screens/game_screen.dart';
import 'screens/home_screen.dart';
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
      // Una pantalla u otra según haya partida en curso: para dos pantallas no
      // merece la pena montar navegación con rutas.
      home: ListenableBuilder(
        listenable: _client,
        builder: (context, _) => _client.hasGame
            ? GameScreen(client: _client)
            : HomeScreen(client: _client),
      ),
    );
  }
}
