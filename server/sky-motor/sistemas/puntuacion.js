/**
 * Puntos, bonificaciones y tabla de récords.
 *
 * Las cuentas son puras y se comprueban desde Node; lo único que toca el
 * navegador es la tabla de récords, y va aparte y protegida.
 */

export const PUNTOS = {
  basico: 150,
  medio: 1200,
  pesado: 3000,
  midboss: 10000,
  faseJefe: 25000,
  insignia: 20000,
  moneda: 500,
};

/**
 * Cierre de stage.
 *
 * Los dos bonos grandes premian jugar bien, no jugar mucho: acabar con el jefe
 * sin recibir un rasguño y que no muera nadie del equipo.
 */
export function puntuarStage({ base, sinDanoEnJefe, sinMuertes, naveDeTuPais }) {
  let total = base;
  const detalle = [];

  if (sinDanoEnJefe) {
    const bono = Math.round(base * 0.5);
    total += bono;
    detalle.push(['Precisión: jefe sin recibir daño', bono]);
  }
  if (sinMuertes) {
    const bono = base;
    total += bono;
    detalle.push(['Equipo intacto: nadie cayó', bono]);
  }
  if (naveDeTuPais) {
    const bono = Math.round(base * 0.25);
    total += bono;
    detalle.push(['Vuelas la bandera de tu país', bono]);
  }

  return { total, detalle };
}

// ---------------------------------------------------------------------------
// Récords
// ---------------------------------------------------------------------------

const CLAVE = 'sky.records';

/** Devuelve los récords guardados, de mayor a menor. */
export function records() {
  if (typeof localStorage === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(CLAVE) ?? '[]');
  } catch {
    return []; // si alguien retoca el almacenamiento a mano, se empieza de cero
  }
}

export function guardarRecord({ puntos, jugadores, paises, ruta, stage }) {
  if (typeof localStorage === 'undefined') return records();

  const tabla = [...records(), { puntos, jugadores, paises, ruta, stage, fecha: Date.now() }]
    .sort((a, b) => b.puntos - a.puntos)
    .slice(0, 10);

  localStorage.setItem(CLAVE, JSON.stringify(tabla));
  return tabla;
}
