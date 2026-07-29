import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

/**
 * Lo que cada piloto se ha ganado.
 *
 * Se empieza con dos países y los demás se abren volando: es lo que convierte
 * la lista de veintiuno en algo que se recorre en vez de un menú que se mira
 * una vez. Y se lleva en el servidor, no en el móvil, por lo mismo que las
 * jugadas del ajedrez: si el progreso viviese en la app, desbloquearlo todo
 * sería editar un fichero.
 *
 * Se guarda en un JSON, como los mapas del editor. Son unos cientos de bytes
 * por piloto; montar una base de datos para esto sería desproporcionado.
 */

/** Con lo que se empieza sin haber volado nada. */
export const PAISES_DE_SALIDA = ['usa', 'peru'];

/**
 * En qué orden se van abriendo los demás.
 *
 * Sigue el mapa de sur a norte y termina en los tres de fuera del continente,
 * que son los más raros de pilotar: el orden importa porque es la sensación de
 * ir avanzando por el mundo, no una lista alfabética.
 */
export const ORDEN_DE_DESBLOQUEO = [
  'mexico',
  'colombia',
  'ecuador',
  'bolivia',
  'chile',
  'argentina',
  'venezuela',
  'guatemala',
  'panama',
  'costarica',
  'uruguay',
  'paraguay',
  'honduras',
  'nicaragua',
  'salvador',
  'cuba',
  'dominicana',
  'espana',
  'china',
];

/**
 * Qué hace falta para abrir cada país.
 *
 * Terminar un escenario abre uno. Ganárselo de verdad —el jefe verdadero, que
 * pide dos de las tres condiciones— abre otro. Y hacerlo perfecto, las tres,
 * abre un tercero. Así el que solo llega al final avanza despacio y el que
 * cumple los retos avanza al triple.
 */
export function insigniasDe(resultado: {
  estado: string;
  jefeVerdadero: boolean;
  cumplidas: number;
}): number {
  if (resultado.estado !== 'terminado') return 0;

  let ganadas = 1;
  if (resultado.jefeVerdadero) ganadas++;
  if (resultado.cumplidas >= 3) ganadas++;
  return ganadas;
}

interface Ficha {
  /** Cuántas insignias lleva ganadas en total. */
  insignias: number;
  /** Escenarios terminados, para saber por dónde va la campaña. */
  escenarios: number;
  puntos: number;
  visto: number;
}

export class ProgresoStore {
  private fichas = new Map<string, Ficha>();

  constructor(private readonly file: string) {
    this.cargar();
  }

  /**
   * Los países que puede pilotar alguien.
   *
   * Un piloto sin ficha —la primera vez, o alguien que juega sin que el móvil
   * le haya dado un identificador— vuela con los dos de salida. Nunca se queda
   * sin poder jugar.
   */
  desbloqueados(pilotId: string | null): string[] {
    const ficha = pilotId ? this.fichas.get(pilotId) : undefined;
    const ganadas = ficha?.insignias ?? 0;
    return [...PAISES_DE_SALIDA, ...ORDEN_DE_DESBLOQUEO.slice(0, ganadas)];
  }

  puede(pilotId: string | null, paisId: string): boolean {
    return this.desbloqueados(pilotId).includes(paisId);
  }

  /**
   * Lo que puede volar una escuadrilla entera: todo lo que tenga cualquiera de
   * sus pilotos.
   *
   * Volar juntos es el modo de juego, y que el novato se quede mirando la lista
   * corta mientras el veterano elige de la larga es justo lo contrario de eso.
   * Prestar los países dura lo que dura la escuadrilla: al salir, cada uno se
   * queda con los que se ganó, que se siguen ganando de uno en uno volando.
   */
  desbloqueadosDe(pilotIds: Array<string | null>): string[] {
    const abiertos = new Set(PAISES_DE_SALIDA);
    for (const id of pilotIds) {
      for (const pais of this.desbloqueados(id)) abiertos.add(pais);
    }
    // En el orden de la lista, no en el que se hayan ido juntando.
    return [...PAISES_DE_SALIDA, ...ORDEN_DE_DESBLOQUEO].filter((p) => abiertos.has(p));
  }

  ficha(pilotId: string | null) {
    const f = pilotId ? this.fichas.get(pilotId) : undefined;
    return {
      insignias: f?.insignias ?? 0,
      escenarios: f?.escenarios ?? 0,
      puntos: f?.puntos ?? 0,
      desbloqueados: this.desbloqueados(pilotId),
      total: PAISES_DE_SALIDA.length + ORDEN_DE_DESBLOQUEO.length,
    };
  }

  /**
   * Apunta lo que se ha ganado en un escenario.
   *
   * Devuelve los países recién abiertos, que es lo único que hay que contarle
   * al jugador: «te has ganado México» dice más que «llevas 4 insignias».
   */
  apuntar(
    pilotId: string | null,
    resultado: { estado: string; jefeVerdadero: boolean; cumplidas: number; puntos: number },
  ): string[] {
    if (!pilotId) return [];

    const antes = this.desbloqueados(pilotId);
    const ficha = this.fichas.get(pilotId) ?? { insignias: 0, escenarios: 0, puntos: 0, visto: 0 };

    ficha.insignias += insigniasDe(resultado);
    if (resultado.estado === 'terminado') ficha.escenarios++;
    ficha.puntos = Math.max(ficha.puntos, resultado.puntos);
    ficha.visto = Date.now();

    this.fichas.set(pilotId, ficha);
    this.guardar();

    return this.desbloqueados(pilotId).filter((p) => !antes.includes(p));
  }

  // -------------------------------------------------------------------------

  private cargar(): void {
    if (!existsSync(this.file)) return;
    try {
      const crudo = JSON.parse(readFileSync(this.file, 'utf8')) as Record<string, Ficha>;
      for (const [id, ficha] of Object.entries(crudo)) {
        this.fichas.set(id, {
          insignias: Number(ficha.insignias) || 0,
          escenarios: Number(ficha.escenarios) || 0,
          puntos: Number(ficha.puntos) || 0,
          visto: Number(ficha.visto) || 0,
        });
      }
    } catch {
      // Un fichero corrupto no puede tumbar el servidor: se empieza de cero y
      // el primer guardado lo deja bien.
    }
  }

  private guardar(): void {
    try {
      mkdirSync(dirname(this.file), { recursive: true });
      writeFileSync(this.file, JSON.stringify(Object.fromEntries(this.fichas)), 'utf8');
    } catch {
      // Si no se puede escribir, se sigue jugando: el progreso se pierde, pero
      // dejar a alguien tirado a mitad de vuelo sería peor.
    }
  }
}
