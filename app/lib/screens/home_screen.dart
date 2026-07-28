import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../models/game_state.dart';
import '../services/game_client.dart';

/// Ritmos de juego ofrecidos. El último, sin reloj, es para partidas tranquilas.
const _timeControls = <(String, TimeControl?)>[
  ('Relámpago 5', TimeControl(initialMs: 300000, incrementMs: 0)),
  ('Rápida 10', TimeControl(initialMs: 600000, incrementMs: 0)),
  ('Rápida 10+5', TimeControl(initialMs: 600000, incrementMs: 5000)),
  ('Larga 30', TimeControl(initialMs: 1800000, incrementMs: 0)),
  ('Sin reloj', null),
];

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key, required this.client});

  final GameClient client;

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final _nameController = TextEditingController();
  final _codeController = TextEditingController();
  int _timeControlIndex = 1;
  String? _shownError;

  GameClient get _client => widget.client;

  @override
  void initState() {
    super.initState();
    _nameController.text = _client.playerName;
    _client.addListener(_onClientChanged);
  }

  @override
  void dispose() {
    _client.removeListener(_onClientChanged);
    _nameController.dispose();
    _codeController.dispose();
    super.dispose();
  }

  void _onClientChanged() {
    // El nombre puede llegar de disco después de construir la pantalla.
    if (_nameController.text.isEmpty && _client.playerName.isNotEmpty) {
      _nameController.text = _client.playerName;
    }

    final error = _client.lastError;
    if (error != null && error != _shownError) {
      _shownError = error;
      ScaffoldMessenger.of(context)
        ..clearSnackBars()
        ..showSnackBar(SnackBar(
          content: Text(error),
          backgroundColor: Theme.of(context).colorScheme.error,
        ));
    } else if (error == null) {
      _shownError = null;
    }
  }

  TimeControl? get _selectedTimeControl => _timeControls[_timeControlIndex].$2;

  /// Guarda el nombre antes de cualquier acción, para no perderlo.
  Future<void> _saveName() => _client.setPlayerName(_nameController.text);

  Future<void> _createRoom() async {
    await _saveName();
    _client.createRoom(_selectedTimeControl);
  }

  Future<void> _quickMatch() async {
    await _saveName();
    _client.quickMatch(_selectedTimeControl);
  }

  Future<void> _joinRoom() async {
    final code = _codeController.text.trim();
    if (code.isEmpty) return;
    await _saveName();
    _client.joinRoom(code);
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      body: SafeArea(
        child: Stack(
          children: [
            Center(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(24),
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 420),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Row(
                        children: [
                          Text('♞', style: TextStyle(fontSize: 40, color: theme.colorScheme.primary)),
                          const SizedBox(width: 12),
                          Text(
                            'PessChess',
                            style: theme.textTheme.headlineMedium
                                ?.copyWith(fontWeight: FontWeight.bold),
                          ),
                          const Spacer(),
                          _ConnectionDot(client: _client),
                          IconButton(
                            tooltip: 'Servidor',
                            icon: const Icon(Icons.settings_outlined),
                            onPressed: _showServerSettings,
                          ),
                        ],
                      ),
                      const SizedBox(height: 28),

                      TextField(
                        controller: _nameController,
                        textCapitalization: TextCapitalization.words,
                        maxLength: 20,
                        decoration: const InputDecoration(
                          labelText: 'Tu nombre',
                          counterText: '',
                          prefixIcon: Icon(Icons.person_outline),
                        ),
                      ),
                      const SizedBox(height: 20),

                      Text('Ritmo de juego', style: theme.textTheme.labelLarge),
                      const SizedBox(height: 8),
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: [
                          for (var i = 0; i < _timeControls.length; i++)
                            ChoiceChip(
                              label: Text(_timeControls[i].$1),
                              selected: _timeControlIndex == i,
                              onSelected: (_) =>
                                  setState(() => _timeControlIndex = i),
                            ),
                        ],
                      ),
                      const SizedBox(height: 28),

                      FilledButton.icon(
                        onPressed: _createRoom,
                        icon: const Icon(Icons.add),
                        label: const Text('Crear partida'),
                      ),
                      const SizedBox(height: 12),
                      FilledButton.tonalIcon(
                        onPressed: _quickMatch,
                        icon: const Icon(Icons.bolt),
                        label: const Text('Partida rápida'),
                      ),

                      const SizedBox(height: 28),
                      Row(
                        children: [
                          const Expanded(child: Divider()),
                          Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 12),
                            child: Text('o entra con un código',
                                style: theme.textTheme.bodySmall),
                          ),
                          const Expanded(child: Divider()),
                        ],
                      ),
                      const SizedBox(height: 16),

                      Row(
                        children: [
                          Expanded(
                            child: TextField(
                              controller: _codeController,
                              textCapitalization: TextCapitalization.characters,
                              maxLength: 4,
                              textAlign: TextAlign.center,
                              style: const TextStyle(
                                fontSize: 22,
                                letterSpacing: 8,
                                fontWeight: FontWeight.bold,
                              ),
                              inputFormatters: [
                                UpperCaseFormatter(),
                                FilteringTextInputFormatter.allow(
                                    RegExp('[A-Za-z0-9]')),
                              ],
                              decoration: const InputDecoration(
                                labelText: 'Código',
                                counterText: '',
                              ),
                              onSubmitted: (_) => _joinRoom(),
                            ),
                          ),
                          const SizedBox(width: 12),
                          SizedBox(
                            height: 56,
                            child: FilledButton(
                              onPressed: _joinRoom,
                              child: const Text('Entrar'),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ),

            if (_client.inQueue) _SearchingOverlay(client: _client),
          ],
        ),
      ),
    );
  }

  Future<void> _showServerSettings() async {
    final controller = TextEditingController(text: _client.serverUrl);

    final url = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Servidor'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Dirección del servidor de partidas. En un móvil real no vale '
              '"localhost": hay que poner la IP del ordenador (por ejemplo '
              'http://192.168.1.50:3000) o la dirección donde esté desplegado.',
              style: TextStyle(fontSize: 13),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: controller,
              autocorrect: false,
              keyboardType: TextInputType.url,
              decoration: const InputDecoration(labelText: 'URL'),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(controller.text),
            child: const Text('Guardar'),
          ),
        ],
      ),
    );

    controller.dispose();
    if (url != null) await _client.setServerUrl(url);
  }
}

/// Los códigos de sala siempre van en mayúsculas.
class UpperCaseFormatter extends TextInputFormatter {
  @override
  TextEditingValue formatEditUpdate(
    TextEditingValue oldValue,
    TextEditingValue newValue,
  ) {
    return newValue.copyWith(text: newValue.text.toUpperCase());
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

class _SearchingOverlay extends StatelessWidget {
  const _SearchingOverlay({required this.client});

  final GameClient client;

  @override
  Widget build(BuildContext context) {
    return ColoredBox(
      color: Colors.black.withValues(alpha: 0.75),
      child: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const CircularProgressIndicator(),
            const SizedBox(height: 24),
            Text('Buscando rival…',
                style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            const Text(
              'Se emparejará contigo la primera persona\nque pida el mismo ritmo.',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 13, color: Colors.white70),
            ),
            const SizedBox(height: 24),
            TextButton(
              onPressed: client.cancelQueue,
              child: const Text('Cancelar'),
            ),
          ],
        ),
      ),
    );
  }
}
