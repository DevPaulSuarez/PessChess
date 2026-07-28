/// Herramienta de inspección: dibuja el tablero y guarda la imagen en disco.
///
/// No comprueba nada; sirve para ver de verdad cómo queda cada modo sin
/// depender de capturas de pantalla del sistema. Se ejecuta con:
///
///   flutter test integration_test/render_board_test.dart -d macos
///
/// Las imágenes salen en la carpeta que indique SALIDA (por defecto /tmp).
library;

import 'dart:io';
import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';

import 'package:pesschess/models/game_state.dart';
import 'package:pesschess/widgets/chess_board.dart';
import 'package:pesschess/widgets/piece_shapes.dart';

/// En macOS la app corre en un cajón aislado y no puede escribir en cualquier
/// sitio, así que por defecto se usa su propia carpeta temporal.
final _outputDir = const String.fromEnvironment('SALIDA').isEmpty
    ? Directory.systemTemp.path
    : const String.fromEnvironment('SALIDA');

GameState _state(String fen, {List<Map<String, dynamic>> legalMoves = const []}) {
  return GameState.fromJson({
    'gameId': 'ABCD',
    'status': 'active',
    'fen': fen,
    'turn': 'w',
    'yourColor': 'w',
    'white': {'name': 'Ana', 'connected': true},
    'black': {'name': 'Beto', 'connected': true},
    'timeControl': null,
    'clocks': null,
    'lastMove': null,
    'history': <String>[],
    'inCheck': false,
    'legalMoves': legalMoves,
    'drawOfferFrom': null,
    'result': null,
    'endReason': null,
  });
}

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('guarda una imagen de cada modo', (tester) async {
    const start = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

    for (final perspective in [false, true]) {
      final key = GlobalKey();

      await tester.pumpWidget(MaterialApp(
        debugShowCheckedModeBanner: false,
        home: Scaffold(
          backgroundColor: const Color(0xFF14110F),
          body: Center(
            child: RepaintBoundary(
              key: key,
              child: SizedBox(
                width: 560,
                height: 560,
                child: ChessBoard(
                  state: _state(start, legalMoves: [
                    {'from': 'e2', 'to': 'e4', 'san': 'e4'},
                  ]),
                  perspective: perspective,
                  onMove: (_, _, _) {},
                  askPromotion: () async => null,
                ),
              ),
            ),
          ),
        ),
      ));
      await tester.pump(const Duration(milliseconds: 300));

      final boundary =
          key.currentContext!.findRenderObject()! as RenderRepaintBoundary;

      ByteData? png;
      await tester.runAsync(() async {
        final image = await boundary.toImage(pixelRatio: 2);
        png = await image.toByteData(format: ui.ImageByteFormat.png);
        image.dispose();
      });

      final name = perspective ? 'tablero_3d.png' : 'tablero_2d.png';
      File('$_outputDir/$name').writeAsBytesSync(png!.buffer.asUint8List());
      debugPrint('Guardado $_outputDir/$name');
    }
  });

  testWidgets('tira de contraste', (tester) async {
    // Cada tipo de pieza, de los dos colores, sobre los dos colores de casilla.
    // Es la comprobación de que un bando no desaparece sobre su propio color.
    const types = ['k', 'q', 'r', 'b', 'n', 'p'];
    final key = GlobalKey();

    Widget cell(String type, PieceColor color, bool lightSquare) => Container(
          width: 86,
          height: 86,
          color: lightSquare ? BoardColors.light : BoardColors.dark,
          child: CustomPaint(painter: PiecePainter(type: type, color: color)),
        );

    await tester.pumpWidget(MaterialApp(
      debugShowCheckedModeBanner: false,
      home: Scaffold(
        body: Center(
          child: RepaintBoundary(
            key: key,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                for (final color in PieceColor.values)
                  for (final lightSquare in [true, false])
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        for (final type in types) cell(type, color, lightSquare),
                      ],
                    ),
              ],
            ),
          ),
        ),
      ),
    ));
    await tester.pump(const Duration(milliseconds: 300));

    final boundary =
        key.currentContext!.findRenderObject()! as RenderRepaintBoundary;
    ByteData? png;
    await tester.runAsync(() async {
      final image = await boundary.toImage(pixelRatio: 2);
      png = await image.toByteData(format: ui.ImageByteFormat.png);
      image.dispose();
    });

    File('$_outputDir/contraste.png').writeAsBytesSync(png!.buffer.asUint8List());
    debugPrint('Guardado $_outputDir/contraste.png');
  });
}
