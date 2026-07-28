import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../services/game_client.dart';
import 'home_screen.dart' show UpperCaseFormatter;
import '../services/tank_client.dart';
import '../widgets/tank_field.dart';

/// Toda la partida de tanques: preparar, sala y batalla.
///
/// Las tres fases van en una sola pantalla porque se encadenan solas: en cuanto
/// el servidor manda la sala, o el mundo, se pasa a lo siguiente.
class TankScreen extends StatefulWidget {
  const TankScreen({super.key, required this.client, required this.onBack});

  final GameClient client;
  final VoidCallback onBack;

  @override
  State<TankScreen> createState() => _TankScreenState();
}

class _TankScreenState extends State<TankScreen> {
  final _nameController = TextEditingController();
  final _codeController = TextEditingController();
  int _tankCount = 4;

  /// Lo que el jugador tiene pulsado ahora mismo.
  String? _direction;
  bool _firing = false;

  TankClient get _tanks => widget.client.tanks;

  @override
  void initState() {
    super.initState();
    _nameController.text = widget.client.playerName;
    _tanks.addListener(_onChanged);
  }

  @override
  void dispose() {
    _tanks.removeListener(_onChanged);
    _nameController.dispose();
    _codeController.dispose();
    super.dispose();
  }

  void _onChanged() {
    if (!mounted) return;
    final error = _tanks.error;
    if (error != null) {
      ScaffoldMessenger.of(context)
        ..clearSnackBars()
        ..showSnackBar(SnackBar(content: Text(error)));
    }
    setState(() {});
  }

  void _press(String? dir) {
    setState(() => _direction = dir);
    _tanks.sendInput(dir: dir, firing: _firing);
  }

  void _setFiring(bool firing) {
    setState(() => _firing = firing);
    _tanks.sendInput(dir: _direction, firing: firing);
  }

  @override
  Widget build(BuildContext context) {
    final world = _tanks.world;
    if (world != null) return _battle(world);

    final lobby = _tanks.lobby;
    if (lobby != null) return _lobbyView(lobby);

    return _setup();
  }

  // -------------------------------------------------------------------------
  // 1. Preparar
  // -------------------------------------------------------------------------

  Widget _setup() {
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
                      IconButton(
                        icon: const Icon(Icons.arrow_back),
                        onPressed: widget.onBack,
                      ),
                      const Text('🛡️', style: TextStyle(fontSize: 30)),
                      const SizedBox(width: 10),
                      Text('Tanques',
                          style: theme.textTheme.headlineSmall
                              ?.copyWith(fontWeight: FontWeight.bold)),
                    ],
                  ),
                  const SizedBox(height: 24),

                  TextField(
                    controller: _nameController,
                    maxLength: 20,
                    decoration: const InputDecoration(
                      labelText: 'Tu nombre',
                      counterText: '',
                      prefixIcon: Icon(Icons.person_outline),
                    ),
                  ),
                  const SizedBox(height: 20),

                  Text('Tanques en la batalla', style: theme.textTheme.labelLarge),
                  const SizedBox(height: 4),
                  Text(
                    'Los que no coja nadie los lleva la máquina, en plomo.',
                    style: theme.textTheme.bodySmall
                        ?.copyWith(color: Colors.white60),
                  ),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      IconButton.filledTonal(
                        onPressed: _tankCount > 2
                            ? () => setState(() => _tankCount--)
                            : null,
                        icon: const Icon(Icons.remove),
                      ),
                      Expanded(
                        child: Text(
                          '$_tankCount',
                          textAlign: TextAlign.center,
                          style: theme.textTheme.headlineMedium,
                        ),
                      ),
                      IconButton.filledTonal(
                        onPressed: _tankCount < 12
                            ? () => setState(() => _tankCount++)
                            : null,
                        icon: const Icon(Icons.add),
                      ),
                    ],
                  ),
                  const SizedBox(height: 24),

                  FilledButton.icon(
                    onPressed: () {
                      widget.client.setPlayerName(_nameController.text);
                      _tanks.create(_nameController.text, _tankCount);
                    },
                    icon: const Icon(Icons.add),
                    label: const Text('Crear batalla'),
                  ),

                  const SizedBox(height: 24),
                  Row(children: [
                    const Expanded(child: Divider()),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 12),
                      child: Text('o entra con un código',
                          style: theme.textTheme.bodySmall),
                    ),
                    const Expanded(child: Divider()),
                  ]),
                  const SizedBox(height: 16),

                  Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: _codeController,
                          maxLength: 4,
                          textAlign: TextAlign.center,
                          textCapitalization: TextCapitalization.characters,
                          inputFormatters: [
                            UpperCaseFormatter(),
                            FilteringTextInputFormatter.allow(RegExp('[A-Za-z0-9]')),
                          ],
                          style: const TextStyle(
                            fontSize: 22,
                            letterSpacing: 8,
                            fontWeight: FontWeight.bold,
                          ),
                          decoration: const InputDecoration(
                            labelText: 'Código',
                            counterText: '',
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      SizedBox(
                        height: 56,
                        child: FilledButton(
                          onPressed: () {
                            widget.client.setPlayerName(_nameController.text);
                            _tanks.join(_codeController.text, _nameController.text);
                          },
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
      ),
    );
  }

  // -------------------------------------------------------------------------
  // 2. La sala
  // -------------------------------------------------------------------------

  Widget _lobbyView(TankLobby lobby) {
    final theme = Theme.of(context);

    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 460),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    children: [
                      IconButton(
                        icon: const Icon(Icons.arrow_back),
                        onPressed: () {
                          _tanks.leave();
                          widget.onBack();
                        },
                      ),
                      Expanded(
                        child: Text('Sala de batalla',
                            style: theme.textTheme.titleLarge),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),

                  // El código, grande y copiable.
                  InkWell(
                    onTap: () {
                      Clipboard.setData(ClipboardData(text: lobby.code));
                      ScaffoldMessenger.of(context)
                        ..clearSnackBars()
                        ..showSnackBar(
                            const SnackBar(content: Text('Código copiado')));
                    },
                    child: Container(
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      decoration: BoxDecoration(
                        border: Border.all(color: theme.colorScheme.primary),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Text(
                        lobby.code,
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                          fontSize: 40,
                          fontWeight: FontWeight.bold,
                          letterSpacing: 10,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 20),

                  Text('Elige tu color', style: theme.textTheme.labelLarge),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 10,
                    runSpacing: 10,
                    children: [
                      for (final color in lobby.colors)
                        _ColorChip(
                          color: color,
                          // Un color que ya cogió otro no se puede elegir.
                          taken: lobby.taken.contains(color.id) &&
                              lobby.yourColor != color.id,
                          mine: lobby.yourColor == color.id,
                          onTap: () => _tanks.pickColor(color.id),
                        ),
                    ],
                  ),
                  const SizedBox(height: 24),

                  Text('Jugadores (${lobby.players.length})',
                      style: theme.textTheme.labelLarge),
                  const SizedBox(height: 8),
                  for (final player in lobby.players)
                    ListTile(
                      dense: true,
                      contentPadding: EdgeInsets.zero,
                      leading: CircleAvatar(
                        radius: 12,
                        backgroundColor: player.color == null
                            ? Colors.white24
                            : Color(lobby.colors
                                .firstWhere((c) => c.id == player.color)
                                .value),
                      ),
                      title: Text(player.name),
                      subtitle: Text(player.color == null
                          ? 'Aún sin color'
                          : 'Color ${player.color}'),
                      trailing: player.isHost
                          ? const Icon(Icons.star, size: 18)
                          : null,
                    ),

                  if (lobby.cpuTanks > 0)
                    Padding(
                      padding: const EdgeInsets.only(top: 8),
                      child: Row(
                        children: [
                          const CircleAvatar(
                            radius: 12,
                            backgroundColor: Color(0xFF8E8E93),
                          ),
                          const SizedBox(width: 12),
                          Text('${lobby.cpuTanks} de la máquina',
                              style: theme.textTheme.bodyMedium),
                        ],
                      ),
                    ),

                  const SizedBox(height: 24),
                  if (lobby.youAreHost)
                    FilledButton.icon(
                      onPressed: lobby.canStart ? _tanks.start : null,
                      icon: const Icon(Icons.play_arrow),
                      label: Text(lobby.canStart
                          ? '¡A la batalla!'
                          : 'Faltan jugadores o colores'),
                    )
                  else
                    Text(
                      lobby.canStart
                          ? 'Esperando a que empiece quien creó la sala…'
                          : 'Elige color y espera al resto.',
                      textAlign: TextAlign.center,
                      style: theme.textTheme.bodyMedium,
                    ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  // -------------------------------------------------------------------------
  // 3. La batalla
  // -------------------------------------------------------------------------

  Widget _battle(TankWorld world) {
    final me = world.yourTank;

    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            _Scoreboard(world: world, onLeave: () {
              _tanks.leave();
              widget.onBack();
            }),

            Expanded(
              child: Center(
                child: Padding(
                  padding: const EdgeInsets.all(8),
                  child: AspectRatio(
                    aspectRatio: 1,
                    child: CustomPaint(painter: TankFieldPainter(world: world)),
                  ),
                ),
              ),
            ),

            // La mejora se elige sin parar el juego: la batalla sigue mientras.
            if (me != null && me.upgrades > 0 && me.alive)
              _UpgradeBar(
                pending: me.upgrades,
                onChoose: _tanks.chooseUpgrade,
              ),

            if (world.finished)
              _Outcome(world: world, onLeave: () {
                _tanks.leave();
                widget.onBack();
              })
            else if (me != null && !me.alive)
              const Padding(
                padding: EdgeInsets.all(16),
                child: Text('Te han destruido. A ver quién gana…',
                    style: TextStyle(fontSize: 16)),
              )
            else
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 8, 20, 20),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    TankPad(direction: _direction, onDirection: _press),
                    FireButton(firing: _firing, onFiring: _setFiring),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _Scoreboard extends StatelessWidget {
  const _Scoreboard({required this.world, required this.onLeave});

  final TankWorld world;
  final VoidCallback onLeave;

  @override
  Widget build(BuildContext context) {
    final players = world.tanks.where((t) => !t.isCpu).toList();

    return Padding(
      padding: const EdgeInsets.fromLTRB(4, 4, 12, 0),
      child: Row(
        children: [
          IconButton(icon: const Icon(Icons.arrow_back), onPressed: onLeave),
          Expanded(
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: [
                  for (final tank in players)
                    Padding(
                      padding: const EdgeInsets.only(right: 14),
                      child: Opacity(
                        opacity: tank.alive ? 1 : 0.35,
                        child: Row(
                          children: [
                            Container(
                              width: 12,
                              height: 12,
                              decoration: BoxDecoration(
                                color: Color(tank.color),
                                borderRadius: BorderRadius.circular(3),
                              ),
                            ),
                            const SizedBox(width: 6),
                            Text(
                              '${tank.name}  ${tank.hp}/${tank.maxHp}'
                              '  ⚔${tank.attack} 🛡${tank.defense}',
                              style: const TextStyle(fontSize: 12),
                            ),
                          ],
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _UpgradeBar extends StatelessWidget {
  const _UpgradeBar({required this.pending, required this.onChoose});

  final int pending;
  final void Function(String) onChoose;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      color: Theme.of(context).colorScheme.secondaryContainer,
      padding: const EdgeInsets.all(12),
      child: Column(
        children: [
          Text(pending == 1
              ? '¡Has destruido un tanque! Elige tu mejora'
              : 'Tienes $pending mejoras por elegir'),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: FilledButton.tonal(
                  onPressed: () => onChoose('life'),
                  child: const Text('+ Vida'),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: FilledButton.tonal(
                  onPressed: () => onChoose('defense'),
                  child: const Text('+ Defensa'),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: FilledButton.tonal(
                  onPressed: () => onChoose('attack'),
                  child: const Text('+ Ataque'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _Outcome extends StatelessWidget {
  const _Outcome({required this.world, required this.onLeave});

  final TankWorld world;
  final VoidCallback onLeave;

  @override
  Widget build(BuildContext context) {
    final winner = world.winner;
    final youWon = winner != null && world.yourTank?.color == winner.color;

    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        children: [
          Text(
            winner == null
                ? 'Han caído todos. Ganan las máquinas.'
                : youWon
                    ? '¡Has ganado!'
                    : 'Gana ${winner.name}',
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const SizedBox(height: 12),
          FilledButton(onPressed: onLeave, child: const Text('Volver')),
        ],
      ),
    );
  }
}

class _ColorChip extends StatelessWidget {
  const _ColorChip({
    required this.color,
    required this.taken,
    required this.mine,
    required this.onTap,
  });

  final TankColorOption color;
  final bool taken;
  final bool mine;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Opacity(
      opacity: taken ? 0.3 : 1,
      child: InkWell(
        onTap: taken ? null : onTap,
        borderRadius: BorderRadius.circular(10),
        child: Container(
          width: 62,
          height: 62,
          decoration: BoxDecoration(
            color: Color(color.value),
            borderRadius: BorderRadius.circular(10),
            border: mine ? Border.all(color: Colors.white, width: 3) : null,
          ),
          child: taken
              ? const Icon(Icons.lock, color: Colors.white70)
              : mine
                  ? const Icon(Icons.check, color: Colors.white)
                  : null,
        ),
      ),
    );
  }
}
