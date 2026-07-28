import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';

import { ARENA, type Cell } from './arena.js';

/**
 * Los mapas que la gente dibuja en el editor.
 *
 * Se guardan en un fichero JSON y no en una base de datos: son unos pocos
 * mapas de texto y montar una base de datos para esto sería desproporcionado.
 * Si algún día hay cuentas y campeonatos, ya se moverán con lo demás.
 */

export interface TankMap {
  id: string;
  name: string;
  /**
   * El campo entero como una cadena de dígitos, fila a fila. Cada carácter es
   * una celda: 0 vacío, 1 ladrillo, 2 acero, 3 arbusto, 4 agua, 5 hielo.
   */
  cells: string;
  updatedAt: number;
}

/** Cuántos mapas se guardan como mucho, para que el fichero no crezca sin fin. */
const MAX_MAPS = 50;

export class MapStore {
  private maps = new Map<string, TankMap>();

  constructor(private readonly file: string) {
    this.load();
  }

  list(): Array<{ id: string; name: string; updatedAt: number }> {
    return [...this.maps.values()]
      .map(({ id, name, updatedAt }) => ({ id, name, updatedAt }))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  get(id: string): TankMap | undefined {
    return this.maps.get(id);
  }

  /**
   * Guarda un mapa nuevo o pisa uno existente.
   * Devuelve un mensaje de error si el mapa no vale.
   */
  save(input: { id?: string; name?: string; cells?: string }):
    | { ok: true; map: TankMap }
    | { ok: false; error: string } {
    const problem = validate(input.cells);
    if (problem) return { ok: false, error: problem };

    const id = input.id && this.maps.has(input.id) ? input.id : randomUUID();
    const name = (input.name ?? '').trim().slice(0, 40) || 'Mapa sin nombre';

    if (!this.maps.has(id) && this.maps.size >= MAX_MAPS) {
      return { ok: false, error: `No caben más de ${MAX_MAPS} mapas guardados.` };
    }

    const map: TankMap = { id, name, cells: input.cells!, updatedAt: Date.now() };
    this.maps.set(id, map);
    this.persist();
    return { ok: true, map };
  }

  remove(id: string): boolean {
    const existed = this.maps.delete(id);
    if (existed) this.persist();
    return existed;
  }

  /** El mapa listo para la arena, o null si ese mapa ya no existe. */
  layout(id: string): Cell[][] | null {
    const map = this.maps.get(id);
    if (!map) return null;

    const rows: Cell[][] = [];
    for (let y = 0; y < ARENA.size; y++) {
      const row: Cell[] = [];
      for (let x = 0; x < ARENA.size; x++) {
        row.push(Number(map.cells[y * ARENA.size + x]) as Cell);
      }
      rows.push(row);
    }
    return rows;
  }

  // -------------------------------------------------------------------------

  private load(): void {
    if (!existsSync(this.file)) return;
    try {
      const saved = JSON.parse(readFileSync(this.file, 'utf8')) as TankMap[];
      for (const map of saved) {
        if (!validate(map.cells)) this.maps.set(map.id, map);
      }
    } catch {
      // Un fichero corrupto no debe impedir arrancar el servidor: se empieza
      // sin mapas y el editor los volverá a crear.
    }
  }

  private persist(): void {
    mkdirSync(dirname(this.file), { recursive: true });
    writeFileSync(this.file, JSON.stringify([...this.maps.values()], null, 2));
  }
}

/** Devuelve el problema encontrado, o null si el mapa es correcto. */
function validate(cells: unknown): string | null {
  if (typeof cells !== 'string') return 'Falta el dibujo del mapa.';
  if (cells.length !== ARENA.size * ARENA.size) {
    return `El mapa debe tener ${ARENA.size} por ${ARENA.size} casillas.`;
  }
  if (!/^[0-5]+$/.test(cells)) return 'El mapa tiene casillas de un tipo que no existe.';

  // Sin sitio donde aparecer, la partida no podría ni empezar.
  const free = [...cells].filter((c) => c === '0' || c === '3' || c === '5').length;
  if (free < ARENA.size * 4) return 'El mapa está demasiado lleno: deja más espacio libre.';

  return null;
}
