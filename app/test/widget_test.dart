import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:pesschess/models/game_state.dart';
import 'package:pesschess/screens/game_screen.dart';
import 'package:pesschess/widgets/chess_board.dart';
import 'package:pesschess/widgets/piece_shapes.dart';

const _startFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

/// Estado mínimo de partida para las pruebas.
GameState _state({
  String fen = _startFen,
  String game = 'chess',
  PieceColor yourColor = PieceColor.white,
  String turn = 'w',
  String status = 'active',
  List<Map<String, dynamic>> legalMoves = const [],
  String? result,
  String? endReason,
}) {
  return GameState.fromJson({
    'gameId': 'ABCD',
    'game': game,
    'status': status,
    'fen': fen,
    'turn': turn,
    'yourColor': yourColor.code,
    'white': {'name': 'Ana', 'connected': true},
    'black': {'name': 'Beto', 'connected': true},
    'timeControl': {'initialMs': 600000, 'incrementMs': 0},
    'clocks': {'w': 600000, 'b': 600000},
    'lastMove': null,
    'history': <String>[],
    'inCheck': false,
    'legalMoves': legalMoves,
    'drawOfferFrom': null,
    'result': result,
    'endReason': endReason,
  });
}

Widget _wrap(Widget child) => MaterialApp(home: Scaffold(body: child));

/// Cuántas casillas están marcadas como destino posible.
int _destinationHints(WidgetTester tester) =>
    find.byKey(const ValueKey('destino')).evaluate().length;

/// Las piezas que hay pintadas ahora mismo en el tablero.
List<PiecePainter> _paintedPieces(WidgetTester tester) => tester
    .widgetList<CustomPaint>(find.byType(CustomPaint))
    .map((c) => c.painter)
    .whereType<PiecePainter>()
    .toList();

void main() {
  group('Lectura del FEN', () {
    test('coloca las 32 piezas de la posición inicial', () {
      final pieces = parseFen(_startFen);
      expect(pieces.length, 32);
      expect(pieces['e1']!.type, 'k');
      expect(pieces['e1']!.color, PieceColor.white);
      expect(pieces['d8']!.type, 'q');
      expect(pieces['d8']!.color, PieceColor.black);
      expect(pieces['a2']!.type, 'p');
      expect(pieces['e4'], isNull);
    });

    test('cuenta bien las casillas vacías', () {
      final pieces = parseFen('4k3/8/8/8/8/8/8/4K3 w - - 0 1');
      expect(pieces.length, 2);
      expect(pieces['e1']!.type, 'k');
      expect(pieces['e8']!.type, 'k');
    });

    test('lee una posición a medio jugar', () {
      final pieces = parseFen(
          'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2');
      expect(pieces['e4']!.color, PieceColor.white);
      expect(pieces['e5']!.color, PieceColor.black);
      expect(pieces['e2'], isNull);
      expect(pieces['e7'], isNull);
    });
  });

  group('Reloj', () {
    test('muestra minutos y segundos', () {
      expect(formatClock(600000), '10:00');
      expect(formatClock(65000), '1:05');
      expect(formatClock(60000), '1:00');
    });

    test('añade la décima por debajo de 10 segundos', () {
      expect(formatClock(9500), '0:09.5');
      expect(formatClock(500), '0:00.5');
      expect(formatClock(0), '0:00.0');
    });
  });

  group('Fin de partida', () {
    test('anuncia la victoria a quien gana', () {
      final state = _state(
        yourColor: PieceColor.white,
        status: 'finished',
        result: '1-0',
        endReason: 'checkmate',
      );
      expect(state.outcomeMessage, contains('¡Has ganado!'));
      expect(state.outcomeMessage, contains('jaque mate'));
    });

    test('anuncia la derrota a quien pierde', () {
      final state = _state(
        yourColor: PieceColor.black,
        status: 'finished',
        result: '1-0',
        endReason: 'timeout',
      );
      expect(state.outcomeMessage, contains('Has perdido'));
      expect(state.outcomeMessage, contains('se acabó el tiempo'));
    });

    test('las tablas no tienen ganador', () {
      final state = _state(
        status: 'finished',
        result: '1/2-1/2',
        endReason: 'draw_agreed',
      );
      expect(state.outcomeMessage, startsWith('Tablas'));
    });
  });

  group('Tablero', () {
    testWidgets('dibuja las 64 casillas', (tester) async {
      await tester.pumpWidget(_wrap(ChessBoard(
        state: _state(),
        onMove: (_, __, ___) {},
        askPromotion: () async => null,
      )));

      expect(find.byType(GestureDetector), findsNWidgets(64));
    });

    testWidgets('tocar pieza y destino confirma la jugada', (tester) async {
      String? movedFrom;
      String? movedTo;

      await tester.pumpWidget(_wrap(ChessBoard(
        state: _state(legalMoves: [
          {'from': 'e2', 'to': 'e4', 'san': 'e4'},
        ]),
        onMove: (from, to, promotion) {
          movedFrom = from;
          movedTo = to;
        },
        askPromotion: () async => null,
      )));

      // Blancas abajo: e2 está en la fila 6 (contando desde arriba) y columna 4.
      final squares = find.byType(GestureDetector);
      await tester.tap(squares.at(6 * 8 + 4));
      await tester.pump();
      await tester.tap(squares.at(4 * 8 + 4));
      await tester.pump();

      expect(movedFrom, 'e2');
      expect(movedTo, 'e4');
    });

    testWidgets('el caballo puede capturar', (tester) async {
      String? from;
      String? to;

      // Caballo blanco en e4 con peones negros a tiro en d6 y f6.
      await tester.pumpWidget(_wrap(ChessBoard(
        state: _state(
          fen: '4k3/8/3p1p2/8/4N3/8/8/4K3 w - - 0 1',
          legalMoves: [
            {'from': 'e4', 'to': 'd6', 'san': 'Cxd6+'},
            {'from': 'e4', 'to': 'f6', 'san': 'Cxf6+'},
            {'from': 'e4', 'to': 'c5', 'san': 'Cc5'},
          ],
        ),
        onMove: (f, t, _) {
          from = f;
          to = t;
        },
        askPromotion: () async => null,
      )));

      await tester.tap(find.byKey(const ValueKey('square-e4')));
      await tester.pump();
      await tester.tap(find.byKey(const ValueKey('square-d6')));
      await tester.pump();

      expect(from, 'e4');
      expect(to, 'd6', reason: 'El caballo debe poder comerse el peón de d6');
    });

    group('Enroque', () {
      // Rey en e1 con las dos torres, y el enroque disponible por ambos lados.
      // El servidor manda el enroque como movimiento del rey: e1 a g1 o a c1.
      ChessBoard board(void Function(String, String) onMove) => ChessBoard(
            state: _state(
              fen: '4k3/8/8/8/8/8/8/R3K2R w KQ - 0 1',
              legalMoves: [
                {'from': 'e1', 'to': 'g1', 'san': 'O-O'},
                {'from': 'e1', 'to': 'c1', 'san': 'O-O-O'},
                {'from': 'e1', 'to': 'f1', 'san': 'Rf1'},
              ],
            ),
            onMove: (from, to, _) => onMove(from, to),
            askPromotion: () async => null,
          );

      testWidgets('tocando el rey y su casilla de destino', (tester) async {
        String? from, to;
        await tester.pumpWidget(_wrap(board((f, t) {
          from = f;
          to = t;
        })));

        await tester.tap(find.byKey(const ValueKey('square-e1')));
        await tester.pump();
        await tester.tap(find.byKey(const ValueKey('square-g1')));
        await tester.pump();

        expect(from, 'e1');
        expect(to, 'g1');
      });

      testWidgets('tocando el rey y luego la torre', (tester) async {
        String? from, to;
        await tester.pumpWidget(_wrap(board((f, t) {
          from = f;
          to = t;
        })));

        await tester.tap(find.byKey(const ValueKey('square-e1')));
        await tester.pump();
        // Tocar la torre es lo que espera la gente; debe acabar en el mismo
        // enroque que tocar g1.
        await tester.tap(find.byKey(const ValueKey('square-h1')));
        await tester.pump();

        expect(from, 'e1');
        expect(to, 'g1', reason: 'Tocar la torre debe enrocar');
      });

      testWidgets('el enroque largo, por la torre de a1', (tester) async {
        String? to;
        await tester.pumpWidget(_wrap(board((_, t) => to = t)));

        await tester.tap(find.byKey(const ValueKey('square-e1')));
        await tester.pump();
        await tester.tap(find.byKey(const ValueKey('square-a1')));
        await tester.pump();

        expect(to, 'c1', reason: 'La torre de a1 debe hacer el enroque largo');
      });

      testWidgets('las dos torres se marcan como destino', (tester) async {
        await tester.pumpWidget(_wrap(board((_, _) {})));

        await tester.tap(find.byKey(const ValueKey('square-e1')));
        await tester.pump();

        // Cinco marcas: g1, c1 y f1 del propio rey, más las dos torres.
        expect(_destinationHints(tester), 5);
      });
    });

    testWidgets('no deja mover cuando no es tu turno', (tester) async {
      var moved = false;

      await tester.pumpWidget(_wrap(ChessBoard(
        // Turno de las negras: el servidor no ha dado jugadas legales.
        state: _state(turn: 'b'),
        onMove: (_, __, ___) => moved = true,
        askPromotion: () async => null,
      )));

      final squares = find.byType(GestureDetector);
      await tester.tap(squares.at(6 * 8 + 4));
      await tester.pump();
      await tester.tap(squares.at(4 * 8 + 4));
      await tester.pump();

      expect(moved, isFalse);
    });

    testWidgets('pregunta a qué pieza coronar', (tester) async {
      String? chosenPromotion;
      var asked = false;

      // Peón blanco en b7 a punto de coronar.
      await tester.pumpWidget(_wrap(ChessBoard(
        state: _state(
          fen: '4k3/1P6/8/8/8/8/8/4K3 w - - 0 1',
          legalMoves: [
            {'from': 'b7', 'to': 'b8', 'promotion': 'q', 'san': 'b8=D'},
            {'from': 'b7', 'to': 'b8', 'promotion': 'n', 'san': 'b8=C'},
          ],
        ),
        onMove: (_, __, promotion) => chosenPromotion = promotion,
        askPromotion: () async {
          asked = true;
          return 'n';
        },
      )));

      final squares = find.byType(GestureDetector);
      await tester.tap(squares.at(1 * 8 + 1)); // b7
      await tester.pump();
      await tester.tap(squares.at(0 * 8 + 1)); // b8
      await tester.pumpAndSettle();

      expect(asked, isTrue);
      expect(chosenPromotion, 'n');
    });

    testWidgets('dibuja las 32 piezas con su color', (tester) async {
      await tester.pumpWidget(_wrap(ChessBoard(
        state: _state(),
        onMove: (_, _, _) {},
        askPromotion: () async => null,
      )));

      final pieces = _paintedPieces(tester);
      expect(pieces.length, 32);

      // Las piezas se dibujaron durante un tiempo con símbolos de fuente, y el
      // peón blanco salía negro porque el sistema lo sustituía por un emoji,
      // que lleva su propio color. Esto lo vigila.
      expect(
        pieces.where((p) => p.type == 'p' && p.color == PieceColor.white).length,
        8,
        reason: 'Los ocho peones blancos deben ser blancos',
      );
      expect(pieces.where((p) => p.color == PieceColor.white).length, 16);
      expect(pieces.where((p) => p.color == PieceColor.black).length, 16);
    });

    group('Damas', () {
      const inicio =
          '1p1p1p1p/p1p1p1p1/1p1p1p1p/8/8/P1P1P1P1/1P1P1P1P/P1P1P1P1 w - - 0 1';

      testWidgets('dibuja veinticuatro fichas', (tester) async {
        await tester.pumpWidget(_wrap(ChessBoard(
          state: _state(fen: inicio, game: 'draughts'),
          onMove: (_, _, _) {},
          askPromotion: () async => null,
        )));

        final pieces = _paintedPieces(tester);
        expect(pieces.length, 24);
        expect(pieces.every((p) => p.game == GameKind.draughts), isTrue,
            reason: 'Deben dibujarse como fichas, no como piezas de ajedrez');
        expect(pieces.where((p) => p.color == PieceColor.white).length, 12);
        expect(pieces.where((p) => p.color == PieceColor.black).length, 12);
      });

      testWidgets('mover una ficha manda la jugada', (tester) async {
        String? from, to;

        await tester.pumpWidget(_wrap(ChessBoard(
          state: _state(fen: inicio, game: 'draughts', legalMoves: [
            {'from': 'c3', 'to': 'd4', 'san': 'c3-d4'},
          ]),
          onMove: (f, t, _) {
            from = f;
            to = t;
          },
          askPromotion: () async => null,
        )));

        await tester.tap(find.byKey(const ValueKey('square-c3')));
        await tester.pump();
        await tester.tap(find.byKey(const ValueKey('square-d4')));
        await tester.pump();

        expect(from, 'c3');
        expect(to, 'd4');
      });

      testWidgets('nunca pregunta por coronar', (tester) async {
        var asked = false;

        // En damas la coronación es automática: el servidor no manda jugadas
        // con opción de pieza, así que el diálogo no debe salir jamás.
        await tester.pumpWidget(_wrap(ChessBoard(
          state: _state(
            fen: '8/1P6/8/8/8/8/8/8 w - - 0 1',
            game: 'draughts',
            legalMoves: [
              {'from': 'b7', 'to': 'a8', 'san': 'b7-a8=D'},
              {'from': 'b7', 'to': 'c8', 'san': 'b7-c8=D'},
            ],
          ),
          onMove: (_, _, _) {},
          askPromotion: () async {
            asked = true;
            return null;
          },
        )));

        await tester.tap(find.byKey(const ValueKey('square-b7')));
        await tester.pump();
        await tester.tap(find.byKey(const ValueKey('square-a8')));
        await tester.pumpAndSettle();

        expect(asked, isFalse);
      });

      test('los finales propios de damas se explican', () {
        final bloqueado = _state(
          game: 'draughts',
          status: 'finished',
          result: '1-0',
          endReason: 'blocked',
        );
        expect(bloqueado.outcomeMessage, contains('¡Has ganado!'));
        expect(bloqueado.outcomeMessage, contains('sin fichas'));

        final tablas = _state(
          game: 'draughts',
          status: 'finished',
          result: '1/2-1/2',
          endReason: 'no_progress',
        );
        expect(tablas.outcomeMessage, contains('Tablas'));
        expect(tablas.outcomeMessage, contains('nadie avanzaba'));
      });
    });

    group('Reversi', () {
      // Las cuatro fichas cruzadas del centro.
      const inicio = '8/8/8/3pP3/3Pp3/8/8/8 w - - 0 1';

      /// Las cuatro aperturas de las blancas, tal y como las manda el servidor:
      /// una jugada que empieza y acaba en la misma casilla.
      List<Map<String, dynamic>> aperturas() => [
            for (final square in ['c5', 'd6', 'e3', 'f4'])
              {'from': square, 'to': square, 'san': square},
          ];

      testWidgets('dibuja las cuatro fichas del centro', (tester) async {
        await tester.pumpWidget(_wrap(ChessBoard(
          state: _state(fen: inicio, game: 'reversi'),
          onMove: (_, _, _) {},
          askPromotion: () async => null,
        )));

        final pieces = _paintedPieces(tester);
        expect(pieces.length, 4);
        expect(pieces.every((p) => p.game == GameKind.reversi), isTrue,
            reason: 'Deben dibujarse como discos, no como piezas de ajedrez');
        expect(pieces.where((p) => p.color == PieceColor.white).length, 2);
        expect(pieces.where((p) => p.color == PieceColor.black).length, 2);
      });

      testWidgets('marca dónde se puede colocar sin tocar nada antes',
          (tester) async {
        await tester.pumpWidget(_wrap(ChessBoard(
          state: _state(fen: inicio, game: 'reversi', legalMoves: aperturas()),
          onMove: (_, _, _) {},
          askPromotion: () async => null,
        )));

        // En ajedrez hay que seleccionar una pieza para ver sus destinos; una
        // colocación no sale de ninguna pieza, así que se enseñan de entrada.
        expect(_destinationHints(tester), 4);
      });

      testWidgets('colocar es un solo toque', (tester) async {
        String? from, to;

        await tester.pumpWidget(_wrap(ChessBoard(
          state: _state(fen: inicio, game: 'reversi', legalMoves: aperturas()),
          onMove: (f, t, _) {
            from = f;
            to = t;
          },
          askPromotion: () async => null,
        )));

        await tester.tap(find.byKey(const ValueKey('square-d6')));
        await tester.pump();

        expect(from, 'd6');
        expect(to, 'd6', reason: 'La jugada empieza y acaba en la casilla');
      });

      testWidgets('tocar una casilla que no vale no manda nada',
          (tester) async {
        var jugadas = 0;

        await tester.pumpWidget(_wrap(ChessBoard(
          state: _state(fen: inicio, game: 'reversi', legalMoves: aperturas()),
          onMove: (_, _, _) => jugadas++,
          askPromotion: () async => null,
        )));

        // Ni una casilla vacía cualquiera, ni una ficha propia: en reversi las
        // fichas no se seleccionan, porque no se mueven.
        await tester.tap(find.byKey(const ValueKey('square-a1')));
        await tester.pump();
        await tester.tap(find.byKey(const ValueKey('square-e5')));
        await tester.pump();

        expect(jugadas, 0);
        expect(_destinationHints(tester), 4,
            reason: 'Las marcas siguen siendo las mismas cuatro');
      });

      test('el marcador cuenta las fichas de cada bando', () {
        // Tras la primera jugada de las blancas: cuatro contra una.
        final state = _state(
            fen: '8/8/3P4/3PP3/3Pp3/8/8/8 b - - 0 2', game: 'reversi');
        expect(state.pieceCount(PieceColor.white), 4);
        expect(state.pieceCount(PieceColor.black), 1);
      });

      test('el final por recuento se explica', () {
        final ganada = _state(
          game: 'reversi',
          status: 'finished',
          result: '1-0',
          endReason: 'final_count',
        );
        expect(ganada.outcomeMessage, contains('¡Has ganado!'));
        expect(ganada.outcomeMessage, contains('recuento final'));

        final tablas = _state(
          game: 'reversi',
          status: 'finished',
          result: '1/2-1/2',
          endReason: 'final_count',
        );
        expect(tablas.outcomeMessage, contains('Tablas'));
      });
    });

    testWidgets('el tablero se gira para las negras', (tester) async {
      await tester.pumpWidget(_wrap(ChessBoard(
        state: _state(
          fen: '4k3/8/8/8/8/8/8/4K2R w - - 0 1',
          yourColor: PieceColor.black,
          turn: 'b',
        ),
        onMove: (_, __, ___) {},
        askPromotion: () async => null,
      )));

      // Con las negras abajo, la esquina superior izquierda es la fila 1.
      final firstLabel = tester.widgetList<Text>(find.byType(Text)).first;
      expect(firstLabel.data, '1');
    });
  });
}
