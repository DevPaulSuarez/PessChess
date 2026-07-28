import 'package:flutter/material.dart';

import '../models/game_state.dart';
import '../services/game_client.dart';

/// Lo primero que se ve al abrir la app: a qué quieres jugar.
///
/// La lista sale de `GameKind`, así que añadir un juego nuevo lo hace aparecer
/// aquí sin tocar esta pantalla.
class LauncherScreen extends StatelessWidget {
  const LauncherScreen({
    super.key,
    required this.client,
    required this.onPick,
  });

  final GameClient client;
  final void Function(GameKind) onPick;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    children: [
                      Text(
                        'PessChess',
                        style: theme.textTheme.headlineMedium
                            ?.copyWith(fontWeight: FontWeight.bold),
                      ),
                      const Spacer(),
                      ListenableBuilder(
                        listenable: client,
                        builder: (context, _) => _ConnectionDot(client: client),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Text(
                    'Juega con quien quieras, esté donde esté.',
                    style: theme.textTheme.bodyMedium
                        ?.copyWith(color: Colors.white60),
                  ),
                  const SizedBox(height: 32),

                  for (final game in GameKind.values) ...[
                    _GameCard(game: game, onTap: () => onPick(game)),
                    const SizedBox(height: 12),
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _GameCard extends StatelessWidget {
  const _GameCard({required this.game, required this.onTap});

  final GameKind game;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Material(
      color: Colors.white.withValues(alpha: 0.05),
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: Padding(
          padding: const EdgeInsets.all(18),
          child: Row(
            children: [
              Container(
                width: 54,
                height: 54,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: theme.colorScheme.primary.withValues(alpha: 0.18),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(game.emoji, style: const TextStyle(fontSize: 30)),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(game.name, style: theme.textTheme.titleMedium),
                    const SizedBox(height: 2),
                    Text(
                      game.description,
                      style: theme.textTheme.bodySmall
                          ?.copyWith(color: Colors.white60),
                    ),
                  ],
                ),
              ),
              const Icon(Icons.chevron_right),
            ],
          ),
        ),
      ),
    );
  }
}

class _ConnectionDot extends StatelessWidget {
  const _ConnectionDot({required this.client});

  final GameClient client;

  @override
  Widget build(BuildContext context) {
    final (color, label) = switch (client.connection) {
      ConnectionStatus.online => (Colors.greenAccent, 'Conectado'),
      ConnectionStatus.connecting => (Colors.amberAccent, 'Conectando…'),
      ConnectionStatus.offline => (Colors.redAccent, 'Sin conexión'),
    };

    return Tooltip(
      message: '$label · ${client.serverUrl}',
      child: Container(
        width: 10,
        height: 10,
        decoration: BoxDecoration(color: color, shape: BoxShape.circle),
      ),
    );
  }
}
