/// Dificultad dinámica: lo que hace que jugar en equipo sea más duro, no más
/// fácil.
///
/// Es el corazón del diseño. Un matamarcianos cooperativo en el que cada
/// jugador nuevo solo suma potencia de fuego se rompe con dos personas; aquí
/// cada jugador multiplica también la presión, y además el juego aprieta cuando
/// al equipo le quedan pocas vidas.
///
/// Aquí no hay nada de Flutter a propósito: son cuentas puras y se comprueban
/// enteras desde `flutter test`.
library;

/// Multiplicador por número de jugadores.
const Map<int, double> multiplicadorJugadores = {1: 1.0, 2: 1.6, 3: 2.4, 4: 3.5};

/// Vidas del bote común. Desde dos jugadores, las vidas se comparten.
const Map<int, int> vidasEquipo = {1: 3, 2: 5, 3: 7, 4: 10};

/// Vida de los jefes.
///
/// Va como tabla y no como fórmula porque las cifras del diseño no salen de
/// multiplicar (con dos jugadores serían 16.000 y se piden 15.000). Se respeta
/// la tabla: hace que el jefe a dos se sienta algo más blando que el resto de
/// la curva, que es justo cuando más cuesta coordinarse.
const Map<int, double> vidaJefePorJugadores = {
  1: 10000,
  2: 15000,
  3: 24000,
  4: 35000,
};

/// Cuánto aprieta el juego según lo que le queda al equipo.
double factorVida(int vidasRestantes, int vidasIniciales) {
  final fraccion = vidasIniciales > 0 ? vidasRestantes / vidasIniciales : 0.0;
  if (fraccion > 0.75) return 1.0;
  if (fraccion > 0.5) return 1.2;
  if (fraccion > 0.25) return 1.5;
  if (fraccion > 0.1) return 2.0;
  return 2.5;
}

double dificultadTotal(double base, int jugadores, int vidasRestantes, int vidasIniciales) {
  return base * (multiplicadorJugadores[jugadores] ?? 1) * factorVida(vidasRestantes, vidasIniciales);
}

/// Cuántos enemigos trae una oleada.
///
/// El diseño dice "+25% por jugador adicional" y a la vez pone el ejemplo "50
/// enemigos → 125 con cuatro jugadores", que no es lo mismo: un +25% daría 88.
/// Manda el ejemplo. Cuatro jugadores son cuatro veces más potencia de fuego, y
/// 88 enemigos se barren antes de llegar a verse; 125 sí llenan la pantalla.
int enemigosDeOleada(int base, int jugadores) {
  return (base * (1 + 0.5 * (jugadores - 1))).round();
}

/// +15% de velocidad de proyectil por cada jugador de más.
double velocidadProyectil(double base, int jugadores) {
  return base * (1 + 0.15 * (jugadores - 1));
}

/// Proyectiles de más que suelta cada ataque enemigo.
int proyectilesExtra(int jugadores) => jugadores > 1 ? jugadores - 1 : 0;

double vidaDeJefe(int jugadores) => vidaJefePorJugadores[jugadores] ?? vidaJefePorJugadores[4]!;

int vidasDelEquipo(int jugadores) => vidasEquipo[jugadores] ?? vidasEquipo[4]!;

// ---------------------------------------------------------------------------
// La ruta del guerrero
// ---------------------------------------------------------------------------

class Condicion {
  const Condicion(this.id, this.texto, {required this.cumplida});

  final String id;
  final String texto;
  final bool cumplida;
}

class Evaluacion {
  const Evaluacion({
    required this.condiciones,
    required this.porcentaje,
    required this.cumplidas,
  });

  final List<Condicion> condiciones;
  final double porcentaje;
  final int cumplidas;

  /// Con dos de tres basta para ganarse al jefe de verdad.
  bool get jefeVerdadero => cumplidas >= 2;
  bool get perfecto => cumplidas == 3;
}

/// Las tres condiciones de cada escenario.
Evaluacion evaluarCondiciones({
  required int destruidos,
  required int generados,
  required int vidasPerdidas,
  required bool insignia,
}) {
  final porcentaje = generados > 0 ? destruidos / generados : 0.0;

  final condiciones = [
    Condicion('exterminio', 'Destruir el 85% de los enemigos', cumplida: porcentaje >= 0.85),
    Condicion('sinBajas', 'No perder más de 1 vida', cumplida: vidasPerdidas <= 1),
    Condicion('insignia', 'Encontrar la insignia del país', cumplida: insignia),
  ];

  return Evaluacion(
    condiciones: condiciones,
    porcentaje: porcentaje,
    cumplidas: condiciones.where((c) => c.cumplida).length,
  );
}

/// Nota global de la campaña, de 0 a 1: la media de condiciones cumplidas.
double desempenoGlobal(List<Evaluacion> resultados) {
  if (resultados.isEmpty) return 0;
  final suma = resultados.fold<double>(0, (total, r) => total + r.cumplidas / 3);
  return suma / resultados.length;
}

enum Ruta {
  verguenza('Ruta de la Vergüenza', 'La Tierra fue salvada… más o menos.'),
  guerrero('Ruta del Guerrero', 'La Tierra fue salvada, pero a un alto costo.'),
  gloria('Ruta de la Gloria', 'Los Guerreros del Cielo regresan como leyendas.');

  const Ruta(this.nombre, this.texto);

  final String nombre;
  final String texto;
}

Ruta rutaFinal(double desempeno) {
  if (desempeno > 0.85) return Ruta.gloria;
  if (desempeno >= 0.6) return Ruta.guerrero;
  return Ruta.verguenza;
}
