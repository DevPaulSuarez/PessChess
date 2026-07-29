/**
 * Dificultad dinámica: lo que hace que jugar en equipo sea más duro, no más
 * fácil.
 *
 * Es el corazón del diseño. Un shmup cooperativo en el que cada jugador nuevo
 * solo suma potencia de fuego se rompe con dos personas; aquí cada jugador
 * multiplica también la presión, y además se aprieta cuando al equipo le
 * quedan pocas vidas.
 *
 * Este fichero no toca el navegador a propósito: son cuentas puras y se pueden
 * comprobar desde Node (ver `server/test/sky.mjs`).
 */

/** Multiplicador por número de jugadores. */
export const MULTIPLICADOR_JUGADORES = { 1: 1.0, 2: 1.6, 3: 2.4, 4: 3.5 };

/** Vidas del bote común del equipo. Desde dos jugadores, las vidas se comparten. */
export const VIDAS_EQUIPO = { 1: 3, 2: 5, 3: 7, 4: 10 };

/**
 * Vida de los jefes.
 *
 * Va como tabla y no como fórmula porque las cifras del diseño no salen de
 * multiplicar (con dos jugadores serían 16.000 y el documento pide 15.000).
 * Se respeta la tabla: está pensada para que el jefe con dos jugadores se
 * sienta algo más blando que el resto de la curva.
 */
export const VIDA_JEFE = { 1: 10000, 2: 15000, 3: 24000, 4: 35000 };

/** Cuánto aprieta el juego según lo que le queda al equipo. */
export function factorVida(vidasRestantes, vidasIniciales) {
  const fraccion = vidasIniciales > 0 ? vidasRestantes / vidasIniciales : 0;
  if (fraccion > 0.75) return 1.0;
  if (fraccion > 0.5) return 1.2;
  if (fraccion > 0.25) return 1.5;
  if (fraccion > 0.1) return 2.0;
  return 2.5;
}

export function dificultadTotal(base, jugadores, vidasRestantes, vidasIniciales) {
  return base * (MULTIPLICADOR_JUGADORES[jugadores] ?? 1) * factorVida(vidasRestantes, vidasIniciales);
}

/**
 * Cuántos enemigos trae una oleada.
 *
 * El diseño dice "+25% por jugador adicional" y a la vez pone el ejemplo "50
 * enemigos → 125 con cuatro jugadores", que no es lo mismo: un +25% daría 88.
 * Manda el ejemplo. Cuatro jugadores son cuatro veces más potencia de fuego, y
 * 88 enemigos se barren antes de que lleguen a verse; 125 sí llenan la
 * pantalla. Sale un +50% por cada jugador de más.
 */
export function enemigosDeOleada(base, jugadores) {
  return Math.round(base * (1 + 0.5 * (jugadores - 1)));
}

/** +15% de velocidad de proyectil por cada jugador de más. */
export function velocidadProyectil(base, jugadores) {
  return base * (1 + 0.15 * (jugadores - 1));
}

/** Proyectiles de más que suelta cada ataque enemigo. */
export function proyectilesExtra(jugadores) {
  return Math.max(0, jugadores - 1);
}

export function vidaDeJefe(jugadores) {
  return VIDA_JEFE[jugadores] ?? VIDA_JEFE[4];
}

export function vidasDelEquipo(jugadores) {
  return VIDAS_EQUIPO[jugadores] ?? VIDAS_EQUIPO[4];
}

// ---------------------------------------------------------------------------
// La ruta del guerrero
// ---------------------------------------------------------------------------

/**
 * Las tres condiciones de cada stage. Hay que cumplir al menos dos para que
 * aparezca el jefe de verdad; con menos sale un sustituto y el equipo cae en la
 * ruta mala.
 */
export function evaluarCondiciones({ destruidos, generados, vidasPerdidas, insignia }) {
  const porcentaje = generados > 0 ? destruidos / generados : 0;

  const condiciones = [
    { id: 'exterminio', texto: 'Destruir el 85% de los enemigos', cumplida: porcentaje >= 0.85 },
    { id: 'sinBajas', texto: 'No perder más de 1 vida', cumplida: vidasPerdidas <= 1 },
    { id: 'insignia', texto: 'Encontrar la insignia del país', cumplida: Boolean(insignia) },
  ];

  const cumplidas = condiciones.filter((c) => c.cumplida).length;
  return {
    condiciones,
    porcentaje,
    cumplidas,
    jefeVerdadero: cumplidas >= 2,
    perfecto: cumplidas === 3,
  };
}

/**
 * Nota global de la campaña, de 0 a 1: la media de condiciones cumplidas.
 * Es lo que decide cuál de los tres finales se juega.
 */
export function desempenoGlobal(resultados) {
  if (resultados.length === 0) return 0;
  const suma = resultados.reduce((total, r) => total + r.cumplidas / 3, 0);
  return suma / resultados.length;
}

export function rutaFinal(desempeno) {
  if (desempeno > 0.85) return 'gloria';
  if (desempeno >= 0.6) return 'guerrero';
  return 'verguenza';
}

export const RUTAS = {
  verguenza: {
    nombre: 'Ruta de la Vergüenza',
    color: '#9e9e9e',
    texto: 'La Tierra fue salvada… más o menos.',
  },
  guerrero: {
    nombre: 'Ruta del Guerrero',
    color: '#ffb74d',
    texto: 'La Tierra fue salvada, pero a un alto costo.',
  },
  gloria: {
    nombre: 'Ruta de la Gloria',
    color: '#ffd54f',
    texto: 'Los Guerreros del Cielo regresan como leyendas.',
  },
};
