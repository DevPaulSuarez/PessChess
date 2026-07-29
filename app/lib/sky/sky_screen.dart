import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';
import 'package:flutter/services.dart';

import 'datos/paises.dart';
import 'datos/stages.dart';
import 'motor/constantes.dart';
import 'motor/dificultad.dart';
import 'motor/mandos.dart';
import 'motor/partida.dart';
import 'ui/hud.dart';
import 'ui/naves.dart';

/// Sky Warriors United: la pantalla que lo contiene todo.
///
/// El juego corre a paso fijo de sesenta por segundo con un `Ticker`, y se
/// dibuja en un único `CustomPaint`. Los menús sí son widgets normales: en un
/// móvil, tocar una tarjeta es mejor que mover un cursor por una parrilla.
class SkyScreen extends StatefulWidget {
  const SkyScreen({super.key, required this.onBack});

  final VoidCallback onBack;

  @override
  State<SkyScreen> createState() => _SkyScreenState();
}

enum _Pantalla { menu, pais, nave, juego, resultado, gameOver, finalCampana }

class _SkyScreenState extends State<SkyScreen> with SingleTickerProviderStateMixin {
  late final Ticker _ticker;

  /// Se incrementa en cada paso: es lo que hace repintar solo al lienzo del
  /// juego, sin reconstruir la pantalla entera sesenta veces por segundo.
  final ValueNotifier<int> _reloj = ValueNotifier(0);

  final Mandos _mandos = Mandos();

  _Pantalla _pantalla = _Pantalla.menu;
  int _numJugadores = 1;
  List<Pais> _paisesElegidos = [];
  List<int> _navesElegidas = [];
  int _configurando = 0;

  Partida? _partida;
  int _indiceStage = 0;
  final List<Evaluacion> _resultados = [];
  int _puntosCampana = 0;
  Ruta? _rutaFinal;

  Duration _anterior = Duration.zero;
  double _acumulado = 0;

  @override
  void initState() {
    super.initState();
    _ticker = createTicker(_tick)..start();
  }

  @override
  void dispose() {
    _ticker.dispose();
    _reloj.dispose();
    super.dispose();
  }

  // -------------------------------------------------------------------------
  // Bucle
  // -------------------------------------------------------------------------

  void _tick(Duration ahora) {
    // Si la app estuvo en segundo plano, el tiempo perdido se descarta:
    // recuperarlo haría avanzar el juego de golpe y matar a todo el mundo.
    final transcurrido = ((ahora - _anterior).inMicroseconds / 1e6).clamp(0.0, 0.25);
    _anterior = ahora;

    final partida = _partida;
    if (_pantalla != _Pantalla.juego || partida == null) return;

    _acumulado += transcurrido;
    var pasos = 0;
    while (_acumulado >= paso && pasos < 5) {
      _acumulado -= paso;
      pasos++;

      _leerTeclado();
      _mandos.nuevoFotograma();
      partida.actualizar(paso, _mandos);
    }

    _reloj.value++;

    if (partida.estado == EstadoPartida.terminado) {
      partida.cerrarInsignias();
      _resultados.add(partida.resultado!.evaluacion);
      _puntosCampana = partida.resultado!.puntos;
      setState(() => _pantalla = _Pantalla.resultado);
    } else if (partida.estado == EstadoPartida.gameOver) {
      setState(() => _pantalla = _Pantalla.gameOver);
    }
  }

  /// Teclado para escritorio: dos jugadores, como en las recreativas.
  void _leerTeclado() {
    final teclas = HardwareKeyboard.instance.logicalKeysPressed;
    double eje(LogicalKeyboardKey mas, LogicalKeyboardKey menos) =>
        (teclas.contains(mas) ? 1.0 : 0.0) - (teclas.contains(menos) ? 1.0 : 0.0);

    _mandos.aplicar(
      0,
      EstadoMando(
        x: eje(LogicalKeyboardKey.arrowRight, LogicalKeyboardKey.arrowLeft),
        y: eje(LogicalKeyboardKey.arrowDown, LogicalKeyboardKey.arrowUp),
        disparo: teclas.contains(LogicalKeyboardKey.keyZ) || teclas.contains(LogicalKeyboardKey.space),
        bomba: teclas.contains(LogicalKeyboardKey.keyX),
        donar: teclas.contains(LogicalKeyboardKey.keyC),
      ),
    );

    if (_numJugadores > 1) {
      _mandos.aplicar(
        1,
        EstadoMando(
          x: eje(LogicalKeyboardKey.keyD, LogicalKeyboardKey.keyA),
          y: eje(LogicalKeyboardKey.keyS, LogicalKeyboardKey.keyW),
          disparo: teclas.contains(LogicalKeyboardKey.keyN),
          bomba: teclas.contains(LogicalKeyboardKey.keyM),
          donar: teclas.contains(LogicalKeyboardKey.keyB),
        ),
      );
    }
  }

  // -------------------------------------------------------------------------
  // Campaña
  // -------------------------------------------------------------------------

  void _empezarCampana() {
    _indiceStage = 0;
    _resultados.clear();
    _puntosCampana = 0;
    _empezarStage();
  }

  void _empezarStage() {
    final alineaciones = [
      for (var i = 0; i < _numJugadores; i++)
        Alineacion(_paisesElegidos[i], _paisesElegidos[i].naves[_navesElegidas[i]]),
    ];

    final partida = Partida(stage: stages[_indiceStage], alineaciones: alineaciones)
      ..puntos = _puntosCampana;
    partida.anunciar(
      'STAGE ${stages[_indiceStage].numero}  ·  ${stages[_indiceStage].titulo.toUpperCase()}',
      3,
    );

    setState(() {
      _partida = partida;
      _pantalla = _Pantalla.juego;
      _acumulado = 0;
    });
  }

  void _siguienteStage() {
    _indiceStage++;
    if (_indiceStage < stages.length) {
      _empezarStage();
      return;
    }
    setState(() {
      _rutaFinal = rutaFinal(desempenoGlobal(_resultados));
      _pantalla = _Pantalla.finalCampana;
    });
  }

  void _volverAlMenu() {
    setState(() {
      _partida = null;
      _pantalla = _Pantalla.menu;
    });
  }

  // -------------------------------------------------------------------------

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF08070A),
      body: SafeArea(
        child: switch (_pantalla) {
          _Pantalla.menu => _menu(),
          _Pantalla.pais => _selectorDePais(),
          _Pantalla.nave => _selectorDeNave(),
          _Pantalla.juego => _juego(),
          _Pantalla.resultado => _resultado(),
          _Pantalla.gameOver => _gameOver(),
          _Pantalla.finalCampana => _final(),
        },
      ),
    );
  }

  // ------------------------------------------------------------------- menú

  Widget _menu() {
    final tema = Theme.of(context);

    return Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 460),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  IconButton(onPressed: widget.onBack, icon: const Icon(Icons.arrow_back)),
                  const Spacer(),
                ],
              ),
              Text('SKY WARRIORS',
                  textAlign: TextAlign.center,
                  style: tema.textTheme.displaySmall
                      ?.copyWith(fontWeight: FontWeight.bold, color: const Color(0xFFFFD54F))),
              Text('U N I T E D',
                  textAlign: TextAlign.center,
                  style: tema.textTheme.titleLarge?.copyWith(color: const Color(0xFF4FC3F7))),
              const SizedBox(height: 8),
              Text(
                'El cielo no tiene fronteras',
                textAlign: TextAlign.center,
                style: tema.textTheme.bodySmall?.copyWith(color: Colors.white54),
              ),
              const SizedBox(height: 28),

              Text('JUGADORES', style: tema.textTheme.labelLarge?.copyWith(color: Colors.white60)),
              const SizedBox(height: 8),
              Row(
                children: [
                  for (var n = 1; n <= 4; n++)
                    Expanded(
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 3),
                        child: _BotonNumero(
                          numero: n,
                          elegido: _numJugadores == n,
                          onTap: () => setState(() => _numJugadores = n),
                        ),
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 10),
              Text(
                _numJugadores == 1
                    ? '3 vidas · dificultad ×1.0'
                    : '${vidasDelEquipo(_numJugadores)} vidas COMPARTIDAS · '
                        'dificultad ×${multiplicadorJugadores[_numJugadores]}',
                style: tema.textTheme.bodySmall?.copyWith(color: const Color(0xFFFFD54F)),
              ),
              const SizedBox(height: 4),
              Text(
                'En cooperativo el juego se vuelve más duro, no más fácil. '
                'Con más de un jugador hace falta teclado: el segundo vuela con WASD + N, M.',
                style: tema.textTheme.bodySmall?.copyWith(color: Colors.white38),
              ),

              const SizedBox(height: 28),
              FilledButton(
                onPressed: () {
                  setState(() {
                    _paisesElegidos = List.filled(_numJugadores, paises.first);
                    _navesElegidas = List.filled(_numJugadores, 0);
                    _configurando = 0;
                    _pantalla = _Pantalla.pais;
                  });
                },
                child: const Text('EMPEZAR'),
              ),
              const SizedBox(height: 16),
              Text(
                'Táctil: arrastra para volar (y disparas mientras arrastras).\n'
                'Teclado: flechas + Z disparo · X bomba · C donar vida.',
                textAlign: TextAlign.center,
                style: tema.textTheme.bodySmall?.copyWith(color: Colors.white38),
              ),
            ],
          ),
        ),
      ),
    );
  }

  // ------------------------------------------------------------------- país

  Widget _selectorDePais() {
    final tema = Theme.of(context);

    return Column(
      children: [
        _Cabecera(
          titulo: 'Jugador ${_configurando + 1} · elige país',
          onBack: () => setState(() => _pantalla = _Pantalla.menu),
        ),
        Expanded(
          child: GridView.builder(
            padding: const EdgeInsets.all(12),
            gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
              maxCrossAxisExtent: 130,
              childAspectRatio: 1.15,
              mainAxisSpacing: 8,
              crossAxisSpacing: 8,
            ),
            itemCount: paises.length,
            itemBuilder: (context, i) {
              final pais = paises[i];
              final elegido = _paisesElegidos[_configurando].id == pais.id;

              return InkWell(
                borderRadius: BorderRadius.circular(10),
                onTap: () => setState(() => _paisesElegidos[_configurando] = pais),
                child: Container(
                  decoration: BoxDecoration(
                    color: elegido ? const Color(0x26FFD54F) : Colors.white.withValues(alpha: 0.04),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(
                      color: elegido ? const Color(0xFFFFD54F) : Colors.transparent,
                    ),
                  ),
                  padding: const EdgeInsets.all(6),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      SizedBox(
                        width: 54,
                        height: 34,
                        child: CustomPaint(painter: _PintorBandera(pais)),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        pais.nombre,
                        textAlign: TextAlign.center,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: tema.textTheme.bodySmall?.copyWith(
                          color: elegido ? Colors.white : Colors.white60,
                        ),
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
        ),
        _FichaPais(pais: _paisesElegidos[_configurando]),
        Padding(
          padding: const EdgeInsets.all(12),
          child: FilledButton(
            onPressed: () => setState(() => _pantalla = _Pantalla.nave),
            child: const Text('CONTINUAR'),
          ),
        ),
      ],
    );
  }

  // ------------------------------------------------------------------- nave

  Widget _selectorDeNave() {
    final pais = _paisesElegidos[_configurando];

    return Column(
      children: [
        _Cabecera(
          titulo: 'Jugador ${_configurando + 1} · elige nave',
          onBack: () => setState(() => _pantalla = _Pantalla.pais),
        ),
        Expanded(
          child: ListView(
            padding: const EdgeInsets.all(12),
            children: [
              for (var n = 0; n < pais.naves.length; n++)
                _TarjetaNave(
                  pais: pais,
                  nave: pais.naves[n],
                  elegida: _navesElegidas[_configurando] == n,
                  onTap: () => setState(() => _navesElegidas[_configurando] = n),
                ),
            ],
          ),
        ),
        Padding(
          padding: const EdgeInsets.all(12),
          child: FilledButton(
            onPressed: () {
              if (_configurando + 1 < _numJugadores) {
                setState(() {
                  _configurando++;
                  _pantalla = _Pantalla.pais;
                });
              } else {
                _empezarCampana();
              }
            },
            child: Text(_configurando + 1 < _numJugadores ? 'SIGUIENTE JUGADOR' : 'DESPEGAR'),
          ),
        ),
      ],
    );
  }

  // ------------------------------------------------------------------ juego

  Widget _juego() {
    final partida = _partida!;

    return LayoutBuilder(
      builder: (context, constraints) {
        // El campo mantiene su proporción y se escala al hueco disponible.
        final escala = (constraints.maxWidth / anchoCampo)
            .clamp(0.0, constraints.maxHeight / altoCampo);
        final ancho = anchoCampo * escala;
        final alto = altoCampo * escala;

        Offset aCampo(Offset local) => Offset(local.dx / escala, local.dy / escala);

        return Center(
          child: SizedBox(
            width: ancho,
            height: alto,
            child: Stack(
              children: [
                GestureDetector(
                  behavior: HitTestBehavior.opaque,
                  onPanStart: (d) {
                    final jugador = partida.jugadores.first;
                    final dedo = aCampo(d.localPosition);
                    // El destino guarda la distancia entre el dedo y la nave,
                    // para que la nave no salte bajo el dedo al empezar a
                    // arrastrar y para que el dedo no la tape.
                    _agarre = Offset(jugador.x - dedo.dx, jugador.y - dedo.dy);
                    jugador.destinoTactil = Offset(jugador.x, jugador.y);
                  },
                  onPanUpdate: (d) {
                    final dedo = aCampo(d.localPosition);
                    partida.jugadores.first.destinoTactil = dedo + _agarre;
                  },
                  onPanEnd: (_) => partida.jugadores.first.destinoTactil = null,
                  onPanCancel: () => partida.jugadores.first.destinoTactil = null,
                  child: CustomPaint(
                    painter: _PintorJuego(partida: partida, repaint: _reloj),
                    size: Size(ancho, alto),
                  ),
                ),

                // Botones de acción. Van arriba a la derecha porque abajo está
                // el pulgar que pilota, y taparían la nave.
                Positioned(
                  right: 8,
                  bottom: 44,
                  child: Column(
                    children: [
                      _BotonAccion(
                        etiqueta: 'BOMBA',
                        color: const Color(0xFF4FC3F7),
                        onTap: () => partida.lanzarBomba(partida.jugadores.first),
                      ),
                      const SizedBox(height: 10),
                      if (partida.numJugadores > 1)
                        _BotonAccion(
                          etiqueta: 'DONAR',
                          color: const Color(0xFFEF5350),
                          onTap: () => partida.donarVida(partida.jugadores.first),
                        ),
                    ],
                  ),
                ),

                Positioned(
                  left: 4,
                  top: 4,
                  child: IconButton(
                    icon: const Icon(Icons.close, size: 18),
                    color: Colors.white38,
                    onPressed: _volverAlMenu,
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Offset _agarre = Offset.zero;

  // -------------------------------------------------------------- resultado

  Widget _resultado() {
    final resultado = _partida!.resultado!;
    final tema = Theme.of(context);

    return Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 420),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(resultado.stage.titulo.toUpperCase(),
                  textAlign: TextAlign.center,
                  style: tema.textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.bold)),
              const SizedBox(height: 4),
              Text(
                resultado.jefeVerdadero ? 'JEFE VERDADERO DERROTADO' : 'JEFE SUSTITUTO DERROTADO',
                textAlign: TextAlign.center,
                style: tema.textTheme.bodyMedium?.copyWith(
                  color: resultado.jefeVerdadero ? const Color(0xFFAED581) : const Color(0xFFFF8A65),
                ),
              ),
              const SizedBox(height: 24),

              Text('CONDICIONES', style: tema.textTheme.labelLarge?.copyWith(color: Colors.white54)),
              const SizedBox(height: 8),
              for (final condicion in resultado.evaluacion.condiciones)
                ListTile(
                  dense: true,
                  contentPadding: EdgeInsets.zero,
                  leading: Icon(
                    condicion.cumplida ? Icons.check_circle : Icons.cancel,
                    color: condicion.cumplida ? const Color(0xFFAED581) : const Color(0xFFEF5350),
                  ),
                  title: Text(condicion.texto, style: tema.textTheme.bodyMedium),
                ),

              const SizedBox(height: 16),
              for (final bono in resultado.detalle)
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(bono.concepto, style: tema.textTheme.bodySmall),
                    Text('+${bono.puntos}',
                        style: tema.textTheme.bodySmall?.copyWith(color: const Color(0xFFFFD54F))),
                  ],
                ),

              const SizedBox(height: 16),
              Text('${resultado.puntos}',
                  textAlign: TextAlign.right,
                  style: tema.textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.bold)),

              const SizedBox(height: 24),
              FilledButton(
                onPressed: _siguienteStage,
                child: Text(_indiceStage + 1 < stages.length ? 'SIGUIENTE ESCENARIO' : 'VER EL FINAL'),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _gameOver() {
    final tema = Theme.of(context);

    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text('GAME OVER',
              style: tema.textTheme.displaySmall
                  ?.copyWith(fontWeight: FontWeight.bold, color: const Color(0xFFEF5350))),
          const SizedBox(height: 12),
          Text('Puntuación: ${_partida?.puntos ?? 0}', style: tema.textTheme.titleMedium),
          const SizedBox(height: 32),
          FilledButton(onPressed: _volverAlMenu, child: const Text('VOLVER AL MENÚ')),
        ],
      ),
    );
  }

  Widget _final() {
    final ruta = _rutaFinal!;
    final tema = Theme.of(context);
    final color = switch (ruta) {
      Ruta.gloria => const Color(0xFFFFD54F),
      Ruta.guerrero => const Color(0xFFFFB74D),
      Ruta.verguenza => const Color(0xFF9E9E9E),
    };

    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(ruta.nombre.toUpperCase(),
                textAlign: TextAlign.center,
                style: tema.textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.bold, color: color)),
            const SizedBox(height: 8),
            Text('Desempeño global: ${(desempenoGlobal(_resultados) * 100).round()}%',
                style: tema.textTheme.bodyMedium?.copyWith(color: Colors.white60)),
            const SizedBox(height: 24),
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                border: Border.all(color: color),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Text(ruta.texto, textAlign: TextAlign.center, style: tema.textTheme.titleMedium),
            ),
            const SizedBox(height: 24),
            Text('PUNTUACIÓN FINAL  $_puntosCampana',
                style: tema.textTheme.titleLarge?.copyWith(color: const Color(0xFFFFD54F))),
            if (ruta != Ruta.gloria) ...[
              const SizedBox(height: 16),
              Text(
                'Cumple las tres condiciones de cada escenario\npara desbloquear la Ruta de la Gloria.',
                textAlign: TextAlign.center,
                style: tema.textTheme.bodySmall?.copyWith(color: Colors.white38),
              ),
            ],
            const SizedBox(height: 32),
            FilledButton(onPressed: _volverAlMenu, child: const Text('VOLVER AL MENÚ')),
          ],
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Piezas sueltas
// ---------------------------------------------------------------------------

class _PintorJuego extends CustomPainter {
  _PintorJuego({required this.partida, required super.repaint});

  final Partida partida;

  @override
  void paint(Canvas canvas, Size size) {
    canvas.save();
    canvas.scale(size.width / anchoCampo, size.height / altoCampo);
    canvas.clipRect(const Rect.fromLTWH(0, 0, anchoCampo, altoCampo));

    partida.dibujar(canvas);
    dibujarHUD(canvas, partida);

    // El fogonazo de las bombas va por encima de todo, incluso del HUD.
    if (partida.efectos.destello > 0) {
      canvas.drawRect(
        const Rect.fromLTWH(0, 0, anchoCampo, altoCampo),
        Paint()
          ..color = const Color(0xFFFFFFFF)
              .withValues(alpha: (partida.efectos.destello * 0.6).clamp(0, 0.85)),
      );
    }

    canvas.restore();
  }

  @override
  bool shouldRepaint(_PintorJuego old) => true;
}

class _PintorBandera extends CustomPainter {
  const _PintorBandera(this.pais);

  final Pais pais;

  @override
  void paint(Canvas canvas, Size size) {
    dibujarBandera(canvas, pais, Rect.fromLTWH(0, 0, size.width, size.height));
  }

  @override
  bool shouldRepaint(_PintorBandera old) => old.pais.id != pais.id;
}

class _PintorNave extends CustomPainter {
  const _PintorNave(this.pais, this.nave);

  final Pais pais;
  final Nave nave;

  @override
  void paint(Canvas canvas, Size size) {
    canvas.translate(size.width / 2, size.height / 2);
    dibujarNave(canvas, nave.silueta, pais.colores, escala: size.shortestSide * 0.9);
  }

  @override
  bool shouldRepaint(_PintorNave old) => old.nave.nombre != nave.nombre;
}

class _Cabecera extends StatelessWidget {
  const _Cabecera({required this.titulo, required this.onBack});

  final String titulo;
  final VoidCallback onBack;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        IconButton(onPressed: onBack, icon: const Icon(Icons.arrow_back)),
        Expanded(child: Text(titulo, style: Theme.of(context).textTheme.titleMedium)),
      ],
    );
  }
}

class _BotonNumero extends StatelessWidget {
  const _BotonNumero({required this.numero, required this.elegido, required this.onTap});

  final int numero;
  final bool elegido;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(10),
      onTap: onTap,
      child: Container(
        height: 56,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: elegido ? const Color(0x26FFD54F) : Colors.white.withValues(alpha: 0.05),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: elegido ? const Color(0xFFFFD54F) : Colors.transparent),
        ),
        child: Text('$numero',
            style: TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.bold,
              color: elegido ? Colors.white : Colors.white54,
            )),
      ),
    );
  }
}

class _FichaPais extends StatelessWidget {
  const _FichaPais({required this.pais});

  final Pais pais;

  @override
  Widget build(BuildContext context) {
    final tema = Theme.of(context);

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 12),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.04),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(pais.nombre.toUpperCase(), style: tema.textTheme.titleSmall),
          const SizedBox(height: 4),
          Text('Arma: ${pais.arma.nombre}',
              style: tema.textTheme.bodySmall?.copyWith(color: const Color(0xFF4FC3F7))),
          Text('Bomba: ${pais.bomba.nombre}',
              style: tema.textTheme.bodySmall?.copyWith(color: const Color(0xFFFFD54F))),
        ],
      ),
    );
  }
}

class _TarjetaNave extends StatelessWidget {
  const _TarjetaNave({
    required this.pais,
    required this.nave,
    required this.elegida,
    required this.onTap,
  });

  final Pais pais;
  final Nave nave;
  final bool elegida;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final tema = Theme.of(context);

    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: elegida ? const Color(0x26FFD54F) : Colors.white.withValues(alpha: 0.04),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: elegida ? const Color(0xFFFFD54F) : Colors.transparent),
          ),
          child: Row(
            children: [
              SizedBox(width: 64, height: 64, child: CustomPaint(painter: _PintorNave(pais, nave))),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(nave.nombre, style: tema.textTheme.titleSmall),
                    Text(nave.piloto,
                        style: tema.textTheme.bodySmall?.copyWith(color: Colors.white54)),
                    const SizedBox(height: 8),
                    for (final (etiqueta, valor) in [
                      ('VEL', nave.velocidad),
                      ('POD', nave.poder),
                      ('BMB', nave.bombas),
                    ])
                      Padding(
                        padding: const EdgeInsets.only(bottom: 3),
                        child: Row(
                          children: [
                            SizedBox(
                              width: 30,
                              child: Text(etiqueta,
                                  style: tema.textTheme.bodySmall?.copyWith(color: Colors.white38)),
                            ),
                            Expanded(
                              child: LinearProgressIndicator(
                                value: valor / 5,
                                minHeight: 5,
                                backgroundColor: Colors.white10,
                                color: const Color(0xFF4FC3F7),
                              ),
                            ),
                          ],
                        ),
                      ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _BotonAccion extends StatelessWidget {
  const _BotonAccion({required this.etiqueta, required this.color, required this.onTap});

  final String etiqueta;
  final Color color;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 58,
        height: 58,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: color.withValues(alpha: 0.18),
          border: Border.all(color: color.withValues(alpha: 0.7), width: 2),
        ),
        child: Text(
          etiqueta,
          style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: color),
        ),
      ),
    );
  }
}
