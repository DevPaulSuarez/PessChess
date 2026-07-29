import 'dart:async';
import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';
import 'package:flutter/services.dart';

import '../../screens/home_screen.dart' show UpperCaseFormatter;
import '../../services/game_client.dart';
import '../motor/constantes.dart';
import '../datos/paises.dart' show Bandera;
import '../ui/naves.dart' show dibujarBanderaDe, dibujarNave;
import 'imagenes_naves.dart';
import 'pintor_red.dart';
import 'sky_client.dart';

/// Sky Warriors en red: la escuadrilla, la elección de nave y el vuelo.
///
/// Aquí no hay ni una regla del juego. La pantalla manda a dónde apunta el dedo
/// y pinta el mundo que contesta el servidor; si se quedara sin conexión, no
/// podría seguir sola ni un fotograma, que es exactamente lo que se busca.
class SkyRedScreen extends StatefulWidget {
  const SkyRedScreen({super.key, required this.client, required this.onBack});

  final GameClient client;
  final VoidCallback onBack;

  @override
  State<SkyRedScreen> createState() => _SkyRedScreenState();
}

class _SkyRedScreenState extends State<SkyRedScreen> with SingleTickerProviderStateMixin {
  SkyClient get _sky => widget.client.sky;

  late final Ticker _ticker;
  final _nombre = TextEditingController();
  final _codigo = TextEditingController();

  /// Reloj del móvil, solo para lo que se menea al pintar.
  double _t = 0;

  /// A dónde apunta el dedo, en coordenadas del campo.
  Offset? _destino;

  /// Se manda el mando treinta veces por segundo, no en cada fotograma: el
  /// servidor no necesita más y el móvil ahorra la mitad de los mensajes.
  Timer? _envio;

  /// El país que se está mirando, mientras se elige piloto. Null en la lista.
  String? _paisAbierto;


  @override
  void initState() {
    super.initState();
    _nombre.text = widget.client.playerName;
    _ticker = createTicker((elapsed) {
      setState(() => _t = elapsed.inMilliseconds / 1000);
    })..start();

    _envio = Timer.periodic(const Duration(milliseconds: 33), (_) => _mandarMando());
    _sky.addListener(_alCambiar);
  }

  @override
  void dispose() {
    _sky.removeListener(_alCambiar);
    _envio?.cancel();
    _ticker.dispose();
    _nombre.dispose();
    _codigo.dispose();
    super.dispose();
  }

  void _alCambiar() => setState(() {});

  /// El dedo manda una dirección, no una posición: la nave se mueve a su
  /// velocidad, que es lo que distingue a una nave lenta de una rápida.
  void _mandarMando() {
    final mundo = _sky.mundo;
    final destino = _destino;
    if (mundo == null || !(_sky.lobby?.volando ?? false)) return;

    final nave = mundo.tuNave;
    if (nave == null || destino == null) {
      _sky.mando(x: 0, y: 0, disparo: destino != null);
      return;
    }

    final dx = destino.dx - nave.x;
    final dy = destino.dy - nave.y;
    final distancia = math.sqrt(dx * dx + dy * dy);

    // Cerca del dedo se para, para que no tiemble encima del objetivo.
    if (distancia < 4) {
      _sky.mando(x: 0, y: 0, disparo: true);
      return;
    }
    _sky.mando(x: dx / distancia, y: dy / distancia, disparo: true);
  }

  void _salir() {
    _sky.salir();
    widget.onBack();
  }

  @override
  Widget build(BuildContext context) {
    final lobby = _sky.lobby;

    // Solo el vuelo va sobre negro: es una pantalla de juego a oscuras. Entrar
    // y esperar en la sala se parecen a los demás juegos, y por eso llevan el
    // tema de la app.
    final volando = lobby?.volando ?? false;

    // Al terminar un escenario la sala vuelve a estar en espera, pero antes de
    // enseñarla hay que contar cómo ha ido: las condiciones cumplidas y lo que
    // se ha ganado son media razón para volver a jugar.
    final resultado = _sky.resultado;

    return Scaffold(
      backgroundColor: volando ? const Color(0xFF070A18) : null,
      body: SafeArea(
        child: switch (lobby) {
          null => _entrada(),
          final sala when sala.volando => _vuelo(),
          _ when resultado != null => _resultado(resultado),
          final sala => _sala(sala),
        },
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // Crear o entrar
  // ---------------------------------------------------------------------------

  /// Entrar es igual que en los demás juegos: tu nombre, crear, o un código.
  ///
  /// Mismo orden y mismas palabras que en el ajedrez y en los tanques a
  /// propósito. Lo que cambia entre juegos son las reglas, no cómo se queda con
  /// alguien para jugar.
  Widget _entrada() {
    final theme = Theme.of(context);

    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 420),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  IconButton(icon: const Icon(Icons.arrow_back), onPressed: _salir),
                  const Text('✈️', style: TextStyle(fontSize: 30)),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      'Sky Warriors',
                      style: theme.textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.bold),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                'Hasta cuatro pilotos, cada uno en su móvil, en el mismo cielo.',
                style: theme.textTheme.bodySmall?.copyWith(color: Colors.white60),
              ),
              const SizedBox(height: 24),

              TextField(
                controller: _nombre,
                maxLength: 20,
                decoration: const InputDecoration(
                  labelText: 'Tu nombre',
                  counterText: '',
                  prefixIcon: Icon(Icons.person_outline),
                ),
              ),
              const SizedBox(height: 20),

              FilledButton.icon(
                onPressed: () {
                  widget.client.setPlayerName(_nombre.text);
                  _sky.crear(_nombre.text);
                },
                icon: const Icon(Icons.add),
                label: const Text('Crear escuadrilla'),
              ),

              const SizedBox(height: 24),
              Row(children: [
                const Expanded(child: Divider()),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  child: Text('o entra con un código', style: theme.textTheme.bodySmall),
                ),
                const Expanded(child: Divider()),
              ]),
              const SizedBox(height: 16),

              Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _codigo,
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
                      decoration: const InputDecoration(labelText: 'Código', counterText: ''),
                    ),
                  ),
                  const SizedBox(width: 12),
                  SizedBox(
                    height: 56,
                    child: FilledButton(
                      onPressed: () {
                        widget.client.setPlayerName(_nombre.text);
                        _sky.unirse(_codigo.text, _nombre.text);
                      },
                      child: const Text('Entrar'),
                    ),
                  ),
                ],
              ),

              if (_sky.error != null) ...[
                const SizedBox(height: 20),
                Text(
                  _sky.error!,
                  textAlign: TextAlign.center,
                  style: TextStyle(color: theme.colorScheme.error),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // La sala
  // ---------------------------------------------------------------------------

  Widget _sala(SkyLobby lobby) {
    final progreso = _sky.progreso;
    final theme = Theme.of(context);

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
          child: Row(
            children: [
              IconButton(icon: const Icon(Icons.arrow_back), onPressed: _salir),
              const Text('✈️', style: TextStyle(fontSize: 24)),
              const SizedBox(width: 8),
              Expanded(child: Text('Escuadrilla', style: theme.textTheme.titleLarge)),
            ],
          ),
        ),

        // El código, grande y copiable, como en la sala de los tanques: se
        // dicta por teléfono tantas veces como se pega en un chat.
        InkWell(
          onTap: () {
            Clipboard.setData(ClipboardData(text: lobby.code));
            ScaffoldMessenger.of(context)
              ..clearSnackBars()
              ..showSnackBar(const SnackBar(content: Text('Código copiado')));
          },
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
            child: Text(
              lobby.code,
              style: const TextStyle(fontSize: 40, letterSpacing: 12, fontWeight: FontWeight.bold),
            ),
          ),
        ),
        Text('Comparte este código', style: theme.textTheme.bodySmall),
        const SizedBox(height: 12),

        _pilotos(lobby),

        if (progreso != null)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: Text(
              'Países: ${progreso.desbloqueados.length} de ${progreso.total}'
              '${progreso.insignias > 0 ? ' · ${progreso.insignias} insignias' : ''}',
              style: const TextStyle(color: Colors.white54, fontSize: 12),
            ),
          ),

        Expanded(
          child: switch (_sky.pais(_paisAbierto)) {
            final abierto? => _elegirPiloto(lobby, abierto),
            null => _elegirPais(lobby),
          },
        ),

        if (_sky.error != null)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Text(_sky.error!, style: const TextStyle(color: Color(0xFFEF9A9A))),
          ),

        Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              if (lobby.eresHost)
                Expanded(
                  child: FilledButton(
                    onPressed: lobby.puedeEmpezar ? _sky.despegar : null,
                    child: Text(lobby.puedeEmpezar ? 'Despegar' : 'Falta gente por elegir'),
                  ),
                )
              else
                const Expanded(
                  child: Text(
                    'Esperando a que despegue quien creó la escuadrilla…',
                    style: TextStyle(color: Colors.white54),
                    textAlign: TextAlign.center,
                  ),
                ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _pilotos(SkyLobby lobby) {
    return SizedBox(
      height: 64,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        itemCount: lobby.pilotos.length,
        separatorBuilder: (_, _) => const SizedBox(width: 10),
        itemBuilder: (context, i) {
          final piloto = lobby.pilotos[i];
          final pais = _sky.pais(piloto.paisId);
          return Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
            decoration: BoxDecoration(
              color: piloto.listo ? const Color(0x2266BB6A) : Colors.white10,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(
                color: piloto.indice == lobby.tuIndice ? Colors.white54 : Colors.transparent,
              ),
            ),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  piloto.nombre,
                  style: TextStyle(
                    color: piloto.conectado ? Colors.white : Colors.white38,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                Text(
                  pais?.nombre ?? 'eligiendo…',
                  style: const TextStyle(color: Colors.white54, fontSize: 11),
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  /// Elegir en dos pasos: primero el país, después el piloto.
  ///
  /// Enseñar de golpe las cuarenta y dos naves obliga a comparar cosas que no
  /// se comparan: lo primero que se decide es de dónde vuelas —con su arma y su
  /// bomba, que es lo que cambia cómo se juega— y solo después cuál de sus dos
  /// pilotos llevas.
  Widget _elegirPais(SkyLobby lobby) {
    final paises = _sky.paises;
    if (paises.isEmpty) return const Center(child: CircularProgressIndicator());

    return GridView.builder(
      padding: const EdgeInsets.all(16),
      gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
        maxCrossAxisExtent: 170,
        childAspectRatio: 2.1,
        mainAxisSpacing: 10,
        crossAxisSpacing: 10,
      ),
      itemCount: paises.length,
      itemBuilder: (context, i) {
        final pais = paises[i];

        // Un país se agota cuando sus dos pilotos están cogidos por otros.
        final libres = [
          for (var n = 0; n < pais.naves.length; n++)
            if (lobby.duenno(pais.id, n) == null ||
                lobby.duenno(pais.id, n)!.indice == lobby.tuIndice)
              n,
        ];
        final bloqueado = !lobby.puedeVolar(pais.id);
        final prestado = lobby.esPrestado(pais.id);
        final agotado = libres.isEmpty;
        final tuyo = lobby.duenno(pais.id, 0)?.indice == lobby.tuIndice ||
            lobby.duenno(pais.id, 1)?.indice == lobby.tuIndice;

        return GestureDetector(
          onTap: bloqueado || agotado
              ? null
              : () => setState(() => _paisAbierto = pais.id),
          child: Opacity(
            opacity: bloqueado ? 0.35 : (agotado ? 0.5 : 1),
            child: Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: tuyo ? const Color(0x3364B5F6) : Colors.white10,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: tuyo ? Colors.white70 : Colors.transparent),
              ),
              child: Row(
                children: [
                  SizedBox(
                    width: 30,
                    height: 30,
                    child: bloqueado
                        ? const Icon(Icons.lock, color: Colors.white54, size: 16)
                        : CustomPaint(painter: _Bandera(bandera: pais.bandera)),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(
                          pais.nombre,
                          style: const TextStyle(color: Colors.white, fontSize: 13),
                          overflow: TextOverflow.ellipsis,
                        ),
                        Text(
                          bloqueado
                              ? 'Por ganar'
                              : agotado
                                  ? 'Sin pilotos libres'
                                  // Prestado: lo trae otro de la escuadrilla y
                                  // solo se puede volar mientras esté con vosotros.
                                  : prestado
                                      ? 'Prestado por la escuadrilla'
                                      : pais.arma,
                          style: TextStyle(
                            color: agotado
                                ? const Color(0xFFFFAB91)
                                : prestado
                                    ? const Color(0xFF80DEEA)
                                    : Colors.white38,
                            fontSize: 10,
                          ),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  /// Los dos pilotos del país abierto, con su nave.
  Widget _elegirPiloto(SkyLobby lobby, PaisRemoto pais) {
    final theme = Theme.of(context);

    return Column(
      children: [
        Row(
          children: [
            IconButton(
              icon: const Icon(Icons.arrow_back),
              onPressed: () => setState(() => _paisAbierto = null),
            ),
            Expanded(
              child: Text(pais.nombre, style: theme.textTheme.titleMedium),
            ),
            Padding(
              padding: const EdgeInsets.only(right: 12),
              child: Text(
                '${pais.arma} · ${pais.bomba}',
                style: theme.textTheme.bodySmall,
              ),
            ),
          ],
        ),
        Expanded(
          child: ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: pais.naves.length,
            separatorBuilder: (_, _) => const SizedBox(height: 12),
            itemBuilder: (context, i) {
              final nave = pais.naves[i];
              final duenno = lobby.duenno(pais.id, i);
              final tuya = duenno?.indice == lobby.tuIndice;
              final deOtro = duenno != null && !tuya;

              return GestureDetector(
                onTap: deOtro ? null : () => _sky.elegir(pais.id, i),
                child: Opacity(
                  opacity: deOtro ? 0.5 : 1,
                  child: Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: tuya ? const Color(0x3364B5F6) : Colors.white10,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: tuya ? Colors.white70 : Colors.transparent),
                    ),
                    child: Row(
                      children: [
                        SizedBox(
                          width: 54,
                          height: 54,
                          child: CustomPaint(
                            painter: _MiniNave(silueta: nave.silueta, colores: pais.colores),
                          ),
                        ),
                        const SizedBox(width: 14),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(nave.piloto, style: theme.textTheme.titleSmall),
                              Text(
                                nave.nombre,
                                style: theme.textTheme.bodySmall?.copyWith(color: Colors.white60),
                              ),
                              const SizedBox(height: 6),
                              Text(
                                deOtro
                                    ? 'La lleva ${duenno.nombre}'
                                    : 'Velocidad ${nave.velocidad.toInt()} · '
                                        'Poder ${nave.poder.toInt()} · ${nave.bombas} bombas',
                                style: TextStyle(
                                  color: deOtro
                                      ? const Color(0xFFFFAB91)
                                      : Colors.white38,
                                  fontSize: 11,
                                ),
                              ),
                            ],
                          ),
                        ),
                        if (tuya) const Icon(Icons.check_circle, color: Color(0xFF66BB6A)),
                      ],
                    ),
                  ),
                ),
              );
            },
          ),
        ),
      ],
    );
  }

  // ---------------------------------------------------------------------------
  // El vuelo
  // ---------------------------------------------------------------------------

  Widget _vuelo() {
    final mundo = _sky.mundo;
    if (mundo == null) {
      return const Center(
        child: Text('Despegando…', style: TextStyle(color: Colors.white70)),
      );
    }

    final lobby = _sky.lobby!;
    final colores = <int, List<Color>>{};
    final siluetas = <int, String>{};
    final imagenes = <int, ui.Image>{};
    for (final piloto in lobby.pilotos) {
      final pais = _sky.pais(piloto.paisId);
      if (pais == null) continue;
      final nave = pais.naves[piloto.naveIndice.clamp(0, pais.naves.length - 1)];
      colores[piloto.indice] = pais.colores;
      siluetas[piloto.indice] = nave.silueta;

      // Si la nave trae dibujo propio se pide una vez y se pinta en cuanto
      // llegue; hasta entonces vuela con su silueta.
      final propia = ImagenesDeNaves.instancia
          .imagen(nave.imagen, servidor: widget.client.serverUrl);
      if (propia != null) imagenes[piloto.indice] = propia;
    }

    return LayoutBuilder(
      builder: (context, caja) {
        // De píxeles de pantalla a coordenadas del campo, que es en lo único
        // que piensan el juego y el servidor.
        final escala = math.min(caja.maxWidth / anchoCampo, caja.maxHeight / altoCampo);
        final margen = Offset(
          (caja.maxWidth - anchoCampo * escala) / 2,
          (caja.maxHeight - altoCampo * escala) / 2,
        );
        Offset aCampo(Offset local) => (local - margen) / escala;

        return Stack(
          children: [
            GestureDetector(
              behavior: HitTestBehavior.opaque,
              onPanStart: (d) => setState(() => _destino = aCampo(d.localPosition)),
              onPanUpdate: (d) => setState(() => _destino = aCampo(d.localPosition)),
              onPanEnd: (_) => setState(() => _destino = null),
              onPanCancel: () => setState(() => _destino = null),
              child: CustomPaint(
                size: Size(caja.maxWidth, caja.maxHeight),
                painter: PintorDeRed(
                  mundo: mundo,
                  colorPorPiloto: colores,
                  siluetaPorPiloto: siluetas,
                  imagenPorPiloto: imagenes,
                  t: _t,
                ),
              ),
            ),

            _hud(mundo),

            Positioned(
              right: 10,
              bottom: 40,
              child: Column(
                children: [
                  _boton('BOMBA', const Color(0xFF4FC3F7), _sky.bomba),
                  const SizedBox(height: 10),
                  if (mundo.jugadores.length > 1)
                    _boton('DONAR', const Color(0xFFEF5350), _sky.donar),
                ],
              ),
            ),

            Positioned(
              left: 4,
              top: 4,
              child: IconButton(
                icon: const Icon(Icons.close, size: 18),
                color: Colors.white38,
                onPressed: _salir,
              ),
            ),
          ],
        );
      },
    );
  }

  Widget _hud(SkyMundo mundo) {
    final tuya = mundo.tuNave;

    return Positioned(
      left: 0,
      right: 0,
      top: 0,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        child: Column(
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                // Las vidas del bote común: el recurso que de verdad comparte
                // el equipo, y lo primero que hay que poder mirar.
                Row(
                  children: List.generate(
                    math.min(mundo.vidas, 12),
                    (_) => const Padding(
                      padding: EdgeInsets.only(right: 3),
                      child: Icon(Icons.favorite, color: Color(0xFFEF5350), size: 14),
                    ),
                  ),
                ),
                Text(
                  mundo.puntos.toString().padLeft(8, '0'),
                  style: const TextStyle(
                    color: Color(0xFFFFF8E1),
                    fontFeatures: [FontFeature.tabularFigures()],
                  ),
                ),
                if (tuya != null)
                  Text(
                    'P${tuya.nivel} · ${tuya.bombas}💣',
                    style: const TextStyle(color: Colors.white70, fontSize: 12),
                  ),
              ],
            ),
            if (mundo.jefe != null && !mundo.jefe!.entrando) ...[
              const SizedBox(height: 6),
              Text(
                mundo.jefe!.nombre.toUpperCase(),
                style: const TextStyle(color: Colors.white, fontSize: 11, letterSpacing: 2),
              ),
              const SizedBox(height: 2),
              LinearProgressIndicator(
                value: mundo.jefe!.vida / 100,
                minHeight: 4,
                backgroundColor: Colors.white12,
                color: const Color(0xFFEF5350),
              ),
            ],
            if (mundo.anuncio != null)
              Padding(
                padding: const EdgeInsets.only(top: 20),
                child: Text(
                  mundo.anuncio!,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    color: Color(0xFFFFE082),
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // El resultado
  // ---------------------------------------------------------------------------

  Widget _resultado(SkyResultado resultado) {
    final lobby = _sky.lobby;

    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            resultado.derrota ? 'Se acabó' : 'Escenario superado',
            textAlign: TextAlign.center,
            style: const TextStyle(color: Colors.white, fontSize: 26, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 8),
          Text(
            '${resultado.puntos} puntos',
            textAlign: TextAlign.center,
            style: const TextStyle(color: Colors.white70),
          ),
          const SizedBox(height: 24),

          for (final condicion in resultado.condiciones)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 4),
              child: Row(
                children: [
                  Icon(
                    condicion.cumplida ? Icons.check_circle : Icons.cancel,
                    color: condicion.cumplida ? const Color(0xFF66BB6A) : Colors.white24,
                    size: 18,
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      condicion.texto,
                      style: const TextStyle(color: Colors.white70, fontSize: 13),
                    ),
                  ),
                ],
              ),
            ),

          if (resultado.desbloqueados.isNotEmpty) ...[
            const SizedBox(height: 24),
            const Text(
              'Te has ganado:',
              style: TextStyle(color: Colors.white54, fontSize: 12),
            ),
            const SizedBox(height: 6),
            Text(
              resultado.desbloqueados
                  .map((id) => _sky.pais(id)?.nombre ?? id)
                  .join(' · '),
              style: const TextStyle(
                color: Color(0xFFFFE082),
                fontSize: 18,
                fontWeight: FontWeight.bold,
              ),
            ),
          ],

          const SizedBox(height: 32),
          if (lobby?.eresHost ?? false)
            if (resultado.derrota)
              // Perder no echa a nadie de la escuadrilla: se vuelve a despegar
              // en el mismo escenario, con las naves que ya están elegidas.
              FilledButton.icon(
                onPressed: _sky.despegar,
                icon: const Icon(Icons.refresh),
                label: const Text('Volver a intentarlo'),
              )
            else if (!resultado.ultimo)
              FilledButton(
                onPressed: _sky.siguienteEscenario,
                child: const Text('Siguiente escenario'),
              ),
          const SizedBox(height: 10),
          OutlinedButton(onPressed: _salir, child: const Text('Volver')),
        ],
      ),
    );
  }

  // ---------------------------------------------------------------------------

  Widget _boton(String etiqueta, Color color, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 62,
        height: 62,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.22),
          shape: BoxShape.circle,
          border: Border.all(color: color, width: 2),
        ),
        child: Text(
          etiqueta,
          style: TextStyle(color: color, fontSize: 11, fontWeight: FontWeight.bold),
        ),
      ),
    );
  }
}

/// La bandera del país, con el mismo dibujo que usa el resto del juego.
class _Bandera extends CustomPainter {
  _Bandera({required this.bandera});

  final Bandera bandera;

  @override
  void paint(Canvas canvas, Size size) {
    dibujarBanderaDe(canvas, bandera, Rect.fromLTWH(0, 0, size.width, size.height));
  }

  @override
  bool shouldRepaint(_Bandera anterior) => anterior.bandera != bandera;
}

/// La nave de un país, pequeña, para la cuadrícula de elección.
class _MiniNave extends CustomPainter {
  _MiniNave({required this.silueta, required this.colores});

  final String silueta;
  final List<Color> colores;

  @override
  void paint(Canvas canvas, Size size) {
    canvas.translate(size.width / 2, size.height / 2);
    dibujarNave(canvas, silueta, colores, escala: 22, propulsor: false);
  }

  @override
  bool shouldRepaint(_MiniNave anterior) =>
      anterior.silueta != silueta || anterior.colores != colores;
}
