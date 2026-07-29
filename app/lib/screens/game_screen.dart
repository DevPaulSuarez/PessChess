import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../models/game_state.dart';
import '../services/game_client.dart';
import '../widgets/chess_board.dart';
import '../widgets/piece_shapes.dart';

/// Formatea un reloj: mm:ss normalmente y, por debajo de 10 segundos, con la
/// décima, que es cuando de verdad importa verla.
String formatClock(int ms) {
  final totalSeconds = ms ~/ 1000;
  final minutes = totalSeconds ~/ 60;
  final seconds = totalSeconds % 60;
  final base = '$minutes:${seconds.toString().padLeft(2, '0')}';
  if (ms >= 10000) return base;
  return '$base.${(ms % 1000) ~/ 100}';
}

class GameScreen extends StatefulWidget {
  const GameScreen({super.key, required this.client});

  final GameClient client;

  @override
  State<GameScreen> createState() => _GameScreenState();
}

class _GameScreenState extends State<GameScreen> {
  String? _shownError;
  bool _outcomeShown = false;

  GameClient get _client => widget.client;

  @override
  void initState() {
    super.initState();
    _client.addListener(_onClientChanged);
  }

  @override
  void dispose() {
    _client.removeListener(_onClientChanged);
    super.dispose();
  }

  void _onClientChanged() {
    if (!mounted) return;

    final error = _client.lastError;
    if (error != null && error != _shownError) {
      _shownError = error;
      ScaffoldMessenger.of(context)
        ..clearSnackBars()
        ..showSnackBar(SnackBar(
          content: Text(error),
          duration: const Duration(seconds: 2),
        ));
    } else if (error == null) {
      _shownError = null;
    }

    // El aviso de fin de partida se enseña una sola vez.
    final state = _client.state;
    if (state != null && state.status == GameStatus.finished && !_outcomeShown) {
      _outcomeShown = true;
      WidgetsBinding.instance.addPostFrameCallback((_) => _showOutcome(state));
    }
  }

  Future<void> _showOutcome(GameState state) async {
    if (!mounted) return;
    await showDialog<void>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(state.outcomeMessage.split(' · ').first),
        content: Text(
          state.outcomeMessage.contains(' · ')
              ? 'Motivo: ${state.outcomeMessage.split(' · ').last}'
              : state.outcomeMessage,
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Ver el tablero'),
          ),
          FilledButton(
            onPressed: () {
              Navigator.of(context).pop();
              _client.leaveGame();
            },
            child: const Text('Volver al menú'),
          ),
        ],
      ),
    );
  }

  Future<void> _confirmResign() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('¿Abandonar la partida?'),
        content: const Text('Tu rival ganará la partida.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Seguir jugando'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Abandonar'),
          ),
        ],
      ),
    );
    if (confirmed == true) _client.resign();
  }

  Future<void> _confirmLeave() async {
    final state = _client.state;
    // Si la partida ya acabó o ni siquiera empezó, salir no cuesta nada.
    if (state == null || state.status != GameStatus.active) {
      await _client.leaveGame();
      return;
    }

    final choice = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Salir de la partida'),
        content: const Text(
          'La partida sigue en marcha y tu reloj seguirá corriendo. Puedes '
          'volver más tarde, o abandonar y darla por perdida.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop('cancel'),
            child: const Text('Cancelar'),
          ),
          TextButton(
            onPressed: () => Navigator.of(context).pop('leave'),
            child: const Text('Salir y volver luego'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(context).pop('resign'),
            child: const Text('Abandonar'),
          ),
        ],
      ),
    );

    if (choice == 'resign') {
      _client.resign();
    } else if (choice == 'leave') {
      await _client.leaveGame();
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = _client.state;
    if (state == null) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    final clocks = _client.displayClocks;
    final opponentColor = state.yourColor.opposite;
    final drawOfferFromOpponent = state.drawOfferFrom == opponentColor;
    // Contar las fichas solo tiene sentido donde ganan las que más tenga.
    final showsScore = state.game == GameKind.reversi;

    return Scaffold(
      body: SafeArea(
        child: Stack(
          children: [
            Column(
              children: [
                _TopBar(
                  state: state,
                  connection: _client.connection,
                  onLeave: _confirmLeave,
                ),

                Expanded(
                  child: Center(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 12),
                      child: ConstrainedBox(
                        constraints: const BoxConstraints(maxWidth: 520),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            _PlayerBar(
                              player: state.opponent,
                              game: state.game,
                              color: opponentColor,
                              // En reversi el marcador cambia en cada jugada y
                              // es lo único que dice quién va ganando.
                              discs: showsScore
                                  ? state.pieceCount(opponentColor)
                                  : null,
                              clockMs: clocks?[opponentColor],
                              isTurn: state.turn == opponentColor &&
                                  state.status == GameStatus.active,
                              isYou: false,
                            ),
                            const SizedBox(height: 8),
                            // El tablero se encoge hasta caber entero. Nada de
                            // scroll: tener que desplazar la pantalla para
                            // alcanzar tu propia primera fila sería inaceptable.
                            Flexible(
                              child: ChessBoard(
                                state: state,
                                onMove: (from, to, promotion) => _client.move(
                                    from, to,
                                    promotion: promotion),
                                askPromotion: () => showPromotionPicker(
                                    context, state.yourColor),
                              ),
                            ),
                            const SizedBox(height: 8),
                            _PlayerBar(
                              player: state.you,
                              game: state.game,
                              color: state.yourColor,
                              discs: showsScore
                                  ? state.pieceCount(state.yourColor)
                                  : null,
                              clockMs: clocks?[state.yourColor],
                              isTurn: state.isYourTurn,
                              isYou: true,
                            ),
                            const SizedBox(height: 12),
                            _MoveHistory(history: state.history),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),

                if (drawOfferFromOpponent)
                  _DrawOfferBanner(
                    opponentName: state.opponent.name,
                    onAccept: _client.acceptDraw,
                    onDecline: _client.declineDraw,
                  ),

                _ActionBar(
                  state: state,
                  onResign: _confirmResign,
                  onOfferDraw: _client.offerDraw,
                  onBackToMenu: _client.leaveGame,
                ),
              ],
            ),

            if (state.status == GameStatus.waiting)
              _WaitingOverlay(code: _client.roomCode ?? state.gameId, onCancel: _confirmLeave),
          ],
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------

class _TopBar extends StatelessWidget {
  const _TopBar({
    required this.state,
    required this.connection,
    required this.onLeave,
  });

  final GameState state;
  final ConnectionStatus connection;
  final VoidCallback onLeave;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    final status = switch (state.status) {
      GameStatus.waiting => 'Esperando rival',
      GameStatus.finished => 'Partida terminada',
      GameStatus.active =>
        state.isYourTurn ? 'Te toca mover' : 'Mueve tu rival',
    };

    return Padding(
      padding: const EdgeInsets.fromLTRB(4, 4, 12, 4),
      child: Row(
        children: [
          IconButton(
            icon: const Icon(Icons.arrow_back),
            onPressed: onLeave,
            tooltip: 'Salir',
          ),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(status, style: theme.textTheme.titleSmall),
                Text(
                  [
                    'Sala ${state.gameId}',
                    if (state.timeControl != null) state.timeControl!.label,
                    if (state.inCheck && state.status == GameStatus.active)
                      '¡Jaque!',
                  ].join(' · '),
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: state.inCheck && state.status == GameStatus.active
                        ? theme.colorScheme.error
                        : null,
                  ),
                ),
              ],
            ),
          ),
          if (connection != ConnectionStatus.online)
            const Padding(
              padding: EdgeInsets.only(left: 8),
              child: Row(
                children: [
                  Icon(Icons.cloud_off, size: 16, color: Colors.amberAccent),
                  SizedBox(width: 4),
                  Text('Reconectando…', style: TextStyle(fontSize: 12)),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

class _PlayerBar extends StatelessWidget {
  const _PlayerBar({
    required this.player,
    required this.game,
    required this.color,
    required this.clockMs,
    required this.isTurn,
    required this.isYou,
    this.discs,
  });

  final PlayerView player;
  final GameKind game;
  final PieceColor color;
  final int? clockMs;
  final bool isTurn;
  final bool isYou;

  /// Fichas sobre el tablero, si en este juego cuentan. Null si no.
  final int? discs;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final lowTime = clockMs != null && clockMs! < 30000;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: isTurn
            ? theme.colorScheme.primaryContainer.withValues(alpha: 0.35)
            : Colors.white.withValues(alpha: 0.04),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(
          color: isTurn
              ? theme.colorScheme.primary.withValues(alpha: 0.6)
              : Colors.transparent,
        ),
      ),
      child: Row(
        children: [
          // Una pieza del color que lleva el jugador, con la forma del juego
          // que se esté jugando, para no dudar nunca de qué bando eres.
          SizedBox(
            width: 24,
            height: 24,
            child: CustomPaint(
              painter: PiecePainter(type: 'p', color: color, game: game),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Row(
              children: [
                Flexible(
                  child: Text(
                    player.name.isEmpty ? 'Esperando…' : player.name,
                    overflow: TextOverflow.ellipsis,
                    style: theme.textTheme.titleSmall,
                  ),
                ),
                if (isYou)
                  Padding(
                    padding: const EdgeInsets.only(left: 6),
                    child: Text('(tú)', style: theme.textTheme.bodySmall),
                  ),
                if (!player.connected && player.name.isNotEmpty)
                  const Padding(
                    padding: EdgeInsets.only(left: 6),
                    child: Icon(Icons.cloud_off,
                        size: 14, color: Colors.amberAccent),
                  ),
              ],
            ),
          ),
          if (discs != null)
            Padding(
              padding: const EdgeInsets.only(right: 10),
              child: Text(
                '$discs',
                // Las pruebas lo buscan por aquí: un número suelto en pantalla
                // se confunde con las coordenadas del tablero.
                key: ValueKey('marcador-${color.code}'),
                style: theme.textTheme.titleMedium?.copyWith(
                  fontFeatures: const [FontFeature.tabularFigures()],
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          if (clockMs != null)
            Container(
              padding:
                  const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: lowTime
                    ? theme.colorScheme.error.withValues(alpha: 0.25)
                    : Colors.black.withValues(alpha: 0.3),
                borderRadius: BorderRadius.circular(6),
              ),
              child: Text(
                formatClock(clockMs!),
                style: TextStyle(
                  fontFeatures: const [FontFeature.tabularFigures()],
                  fontSize: 20,
                  fontWeight: FontWeight.w600,
                  color: lowTime ? theme.colorScheme.error : Colors.white,
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _MoveHistory extends StatelessWidget {
  const _MoveHistory({required this.history});

  final List<String> history;

  @override
  Widget build(BuildContext context) {
    if (history.isEmpty) return const SizedBox(height: 24);

    // Agrupadas de dos en dos: "1. e4 e5".
    final pairs = <String>[];
    for (var i = 0; i < history.length; i += 2) {
      final number = i ~/ 2 + 1;
      final black = i + 1 < history.length ? ' ${history[i + 1]}' : '';
      pairs.add('$number. ${history[i]}$black');
    }

    return SizedBox(
      height: 24,
      child: ListView(
        scrollDirection: Axis.horizontal,
        reverse: true, // la jugada más reciente siempre visible
        children: [
          for (final pair in pairs.reversed)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 6),
              child: Text(
                pair,
                style: const TextStyle(
                  fontFeatures: [FontFeature.tabularFigures()],
                  color: Colors.white60,
                  fontSize: 13,
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _DrawOfferBanner extends StatelessWidget {
  const _DrawOfferBanner({
    required this.opponentName,
    required this.onAccept,
    required this.onDecline,
  });

  final String opponentName;
  final VoidCallback onAccept;
  final VoidCallback onDecline;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      color: Theme.of(context).colorScheme.secondaryContainer,
      padding: const EdgeInsets.fromLTRB(16, 8, 8, 8),
      child: Row(
        children: [
          Expanded(child: Text('$opponentName ofrece tablas')),
          TextButton(onPressed: onDecline, child: const Text('Rechazar')),
          FilledButton(onPressed: onAccept, child: const Text('Aceptar')),
        ],
      ),
    );
  }
}

class _ActionBar extends StatelessWidget {
  const _ActionBar({
    required this.state,
    required this.onResign,
    required this.onOfferDraw,
    required this.onBackToMenu,
  });

  final GameState state;
  final VoidCallback onResign;
  final VoidCallback onOfferDraw;
  final VoidCallback onBackToMenu;

  @override
  Widget build(BuildContext context) {
    if (state.status == GameStatus.finished) {
      return Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          children: [
            Text(
              state.outcomeMessage,
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 12),
            FilledButton(
              onPressed: onBackToMenu,
              child: const Text('Volver al menú'),
            ),
          ],
        ),
      );
    }

    final canAct = state.status == GameStatus.active;
    final alreadyOffered = state.drawOfferFrom == state.yourColor;

    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 4, 12, 12),
      child: Row(
        children: [
          Expanded(
            child: OutlinedButton.icon(
              onPressed: canAct && !alreadyOffered ? onOfferDraw : null,
              icon: const Icon(Icons.handshake_outlined, size: 18),
              label: Text(alreadyOffered ? 'Tablas ofrecidas' : 'Ofrecer tablas'),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: OutlinedButton.icon(
              onPressed: canAct ? onResign : null,
              icon: const Icon(Icons.flag_outlined, size: 18),
              label: const Text('Abandonar'),
            ),
          ),
        ],
      ),
    );
  }
}

/// Pantalla de espera con el código para compartir con el rival.
class _WaitingOverlay extends StatelessWidget {
  const _WaitingOverlay({required this.code, required this.onCancel});

  final String code;
  final VoidCallback onCancel;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return ColoredBox(
      color: Colors.black.withValues(alpha: 0.88),
      child: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text('Comparte este código', style: theme.textTheme.titleMedium),
              const SizedBox(height: 4),
              Text(
                'Tu rival lo escribe en la pantalla de inicio',
                style: theme.textTheme.bodySmall,
              ),
              const SizedBox(height: 24),
              InkWell(
                onTap: () {
                  Clipboard.setData(ClipboardData(text: code));
                  ScaffoldMessenger.of(context)
                    ..clearSnackBars()
                    ..showSnackBar(
                      const SnackBar(content: Text('Código copiado')),
                    );
                },
                borderRadius: BorderRadius.circular(12),
                child: Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 32, vertical: 20),
                  decoration: BoxDecoration(
                    border: Border.all(color: theme.colorScheme.primary),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        code,
                        style: const TextStyle(
                          fontSize: 44,
                          fontWeight: FontWeight.bold,
                          letterSpacing: 10,
                        ),
                      ),
                      const SizedBox(width: 8),
                      const Icon(Icons.copy, size: 20),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 32),
              const SizedBox(
                width: 28,
                height: 28,
                child: CircularProgressIndicator(strokeWidth: 3),
              ),
              const SizedBox(height: 16),
              Text('Esperando a que entre…',
                  style: theme.textTheme.bodyMedium),
              const SizedBox(height: 24),
              TextButton(onPressed: onCancel, child: const Text('Cancelar')),
            ],
          ),
        ),
      ),
    );
  }
}
