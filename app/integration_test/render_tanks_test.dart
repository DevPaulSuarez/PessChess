/// Herramienta de inspección: dibuja el campo de tanques y guarda la imagen.
///
///   flutter test integration_test/render_tanks_test.dart -d macos
library;

import 'dart:io';
import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';

import 'package:pesschess/services/tank_client.dart';
import 'package:pesschess/widgets/tank_field.dart';

final _outputDir = Directory.systemTemp.path;

/// El mismo reparto de muros que hace el servidor, para ver algo realista.
List<int> _walls(int size) {
  final walls = List<int>.filled(size * size, 0);
  for (var y = 2; y + 2 <= size - 2; y += 5) {
    for (var x = 2; x + 2 <= size - 2; x += 5) {
      final block = (x - 2) ~/ 5 + (y - 2) ~/ 5;
      final cell = block % 11 == 6
          ? 5
          : block % 7 == 4
              ? 4
              : block % 5 == 2
                  ? 3
                  : (block % 3 == 0 ? 2 : 1);
      for (var dy = 0; dy < 2; dy++) {
        for (var dx = 0; dx < 2; dx++) {
          walls[(y + dy) * size + (x + dx)] = cell;
        }
      }
    }
  }
  return walls;
}

TankView _tank({
  required String id,
  required int color,
  String? name,
  required double x,
  required double y,
  required String dir,
  int hp = 5,
  int maxHp = 5,
}) =>
    TankView(
      id: id,
      color: color,
      name: name,
      x: x,
      y: y,
      dir: dir,
      hp: hp,
      maxHp: maxHp,
      charging: id == 't0' ? 380 : 0,
      chargeMs: 550,
      attack: 1,
      defense: 2,
      alive: true,
      kills: 0,
      upgrades: 0,
    );

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('guarda una imagen del campo de batalla', (tester) async {
    const size = 26;

    final world = TankWorld(
      status: 'playing',
      size: size,
      tankSize: 2.0,
      yourTankId: 't0',
      tanks: [
        _tank(id: 't0', color: 0xFFE5383B, name: 'Ana', x: 2, y: 2, dir: 'down'),
        _tank(id: 't1', color: 0xFF3A86FF, name: 'Beto', x: 24, y: 24, dir: 'up', hp: 2),
        _tank(id: 't2', color: 0xFF8E8E93, x: 15, y: 6, dir: 'right'),
        // Este está metido en un arbusto: debe quedar tapado.
        _tank(id: 't3', color: 0xFF8E8E93, x: 11.5, y: 11.5, dir: 'left', hp: 1),
      ],
      bullets: const [
        BulletView(13, 9),
        BulletView(5, 15, charged: true),
      ],
      pickups: const [
        PickupView('life', 6, 13),
        PickupView('defense', 18, 10, hp: 2),
        PickupView('attack', 11, 22, hp: 1),
      ],
      walls: _walls(size),
      effects: [
        EffectView('brick', 9, 5),
        EffectView('tank', 20, 17),
        EffectView('shot', 2, 4),
      ],
      winner: null,
    );

    final key = GlobalKey();
    await tester.pumpWidget(MaterialApp(
      debugShowCheckedModeBanner: false,
      home: Scaffold(
        backgroundColor: const Color(0xFF14110F),
        body: Center(
          child: RepaintBoundary(
            key: key,
            child: SizedBox(
              width: 540,
              height: 540,
              child: CustomPaint(painter: TankFieldPainter(world: world)),
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

    File('$_outputDir/tanques.png').writeAsBytesSync(png!.buffer.asUint8List());
    debugPrint('Guardado $_outputDir/tanques.png');
  });
}
