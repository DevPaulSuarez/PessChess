import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

import { cargarMotor } from './motor.js';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Los países y los escenarios, con los retoques hechos desde el editor.
 *
 * Los datos de verdad siguen viviendo en el código, en `sky-motor/datos/`, y lo
 * que se guarda aquí es **solo lo que se ha cambiado**. Así un retoque que
 * estropee un país se deshace borrándolo, sin tocar nada más, y los veinte que
 * nadie ha editado siguen siendo exactamente los de siempre. Guardar una copia
 * entera tendría el problema contrario: cualquier arreglo o país nuevo que se
 * añadiese al código no llegaría nunca a quien ya hubiese editado algo.
 */

/** Lo editado, por id. Cada entrada es un trozo suelto que se pega encima. */
interface Retoques {
  paises: Record<string, any>;
  stages: Record<string, any>;
}

/**
 * Pega un retoque encima de un original.
 *
 * Entra en los objetos para que cambiar el color de un arma no borre su
 * cadencia. Las listas se reemplazan enteras a propósito: media lista de
 * franjas de bandera no significa nada, y mezclarlas por posición daría
 * resultados que nadie ha pedido.
 */
function pegar<T>(original: T, retoque: any): T {
  if (retoque === null || retoque === undefined) return original;
  if (Array.isArray(retoque)) return retoque as T;
  if (typeof retoque !== 'object') return retoque as T;

  const base: any = original && typeof original === 'object' ? { ...original } : {};
  for (const [clave, valor] of Object.entries(retoque)) {
    base[clave] = pegar(base[clave], valor);
  }
  return base as T;
}

export class DatosStore {
  private retoques: Retoques = { paises: {}, stages: {} };

  constructor(private readonly file: string) {
    this.cargar();
  }

  /** Los veintiún países, ya con lo editado encima. */
  async paises(): Promise<any[]> {
    const motor = await cargarMotor();
    return Object.values(motor.PAIS_POR_ID).map((pais: any) =>
      pegar(pais, this.retoques.paises[pais.id]),
    );
  }

  async pais(id: string): Promise<any | undefined> {
    const motor = await cargarMotor();
    const original = motor.PAIS_POR_ID[id];
    return original ? pegar(original, this.retoques.paises[id]) : undefined;
  }

  async stages(): Promise<any[]> {
    const motor = await cargarMotor();
    return motor.STAGES.map((stage: any) => pegar(stage, this.retoques.stages[stage.id]));
  }

  async stage(indice: number): Promise<any | undefined> {
    const todos = await this.stages();
    return todos[indice];
  }

  /** Qué se ha tocado, para que el editor lo enseñe marcado. */
  get editados(): { paises: string[]; stages: string[] } {
    return {
      paises: Object.keys(this.retoques.paises),
      stages: Object.keys(this.retoques.stages),
    };
  }

  // -------------------------------------------------------------------------

  async guardarPais(id: string, retoque: any): Promise<{ ok: true; pais: any } | { ok: false; error: string }> {
    const motor = await cargarMotor();
    if (!motor.PAIS_POR_ID[id]) return { ok: false, error: `No existe el país "${id}".` };

    const problema = validarPais(retoque);
    if (problema) return { ok: false, error: problema };

    this.retoques.paises[id] = pegar(this.retoques.paises[id] ?? {}, retoque);
    this.guardar();
    return { ok: true, pais: (await this.pais(id))! };
  }

  async guardarStage(id: string, retoque: any): Promise<{ ok: true; stage: any } | { ok: false; error: string }> {
    const motor = await cargarMotor();
    if (!motor.STAGES.some((s: any) => s.id === id)) {
      return { ok: false, error: `No existe el escenario "${id}".` };
    }

    this.retoques.stages[id] = pegar(this.retoques.stages[id] ?? {}, retoque);
    this.guardar();
    const todos = await this.stages();
    return { ok: true, stage: todos.find((s: any) => s.id === id) };
  }

  /**
   * Poner (o quitar) el dibujo propio de una nave.
   *
   * Va aparte de `guardarPais` porque no es un dato que se escriba a mano: es
   * el resultado de haber subido un fichero, y quitarlo tiene que ser posible
   * sin tener que mandar el país entero.
   */
  async guardarImagenNave(
    paisId: string,
    indice: number,
    url: string | null,
  ): Promise<{ ok: true; pais: any } | { ok: false; error: string }> {
    const pais = await this.pais(paisId);
    if (!pais) return { ok: false, error: `No existe el país "${paisId}".` };
    if (indice !== 0 && indice !== 1) return { ok: false, error: 'Cada país tiene dos naves.' };

    // Las naves viajan siempre las dos: media lista no significa nada.
    const naves = pais.naves.map((n: any) => ({ ...n }));
    if (url) naves[indice].imagen = url;
    else delete naves[indice].imagen;

    this.retoques.paises[paisId] = pegar(this.retoques.paises[paisId] ?? {}, { naves });
    this.guardar();
    return { ok: true, pais: (await this.pais(paisId))! };
  }

  /** Devolver algo a como estaba en el código. */
  restaurar(tipo: 'paises' | 'stages', id?: string): void {
    if (id) delete this.retoques[tipo][id];
    else this.retoques[tipo] = {};
    this.guardar();
  }

  // -------------------------------------------------------------------------

  private cargar(): void {
    if (!existsSync(this.file)) return;
    try {
      const crudo = JSON.parse(readFileSync(this.file, 'utf8'));
      this.retoques = {
        paises: crudo?.paises && typeof crudo.paises === 'object' ? crudo.paises : {},
        stages: crudo?.stages && typeof crudo.stages === 'object' ? crudo.stages : {},
      };
    } catch {
      // Un fichero corrupto no puede tumbar el servidor: se juega con los datos
      // del código, que es justamente para lo que están.
    }
  }

  private guardar(): void {
    try {
      mkdirSync(dirname(this.file), { recursive: true });
      writeFileSync(this.file, JSON.stringify(this.retoques, null, 2), 'utf8');
    } catch {
      // Si no se puede escribir, se sigue jugando con lo que haya en memoria.
    }
  }
}

/** Colores en `#rgb` o `#rrggbb`; lo demás no se guarda. */
const COLOR = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/**
 * Lo justo para que un retoque no rompa una partida.
 *
 * No se comprueba todo: el editor enseña lo que va a pasar y quien lo usa está
 * de este lado. Pero un color inválido o una cadencia de cero sí cuelgan el
 * juego, y eso no puede depender de que nadie se equivoque.
 */
function validarPais(retoque: any): string | null {
  if (!retoque || typeof retoque !== 'object') return 'No hay nada que guardar.';

  const colores = [
    ...(Array.isArray(retoque.colores) ? retoque.colores : []),
    ...(Array.isArray(retoque.bandera?.franjas) ? retoque.bandera.franjas : []),
    retoque.arma?.color,
    retoque.bomba?.color,
    retoque.bandera?.emblema,
  ].filter((c) => c !== undefined && c !== null);

  for (const color of colores) {
    if (typeof color !== 'string' || !COLOR.test(color)) {
      return `"${color}" no es un color; van en formato #rrggbb.`;
    }
  }

  if (retoque.colores && retoque.colores.length !== 3) {
    return 'Un país lleva exactamente tres colores.';
  }

  const cadencia = retoque.arma?.cadencia;
  if (cadencia !== undefined && (!(cadencia > 0) || cadencia > 2)) {
    return 'La cadencia va entre 0 y 2 segundos por disparo.';
  }

  const dano = retoque.arma?.dano;
  if (dano !== undefined && (!(dano > 0) || dano > 500)) {
    return 'El daño va entre 1 y 500.';
  }

  if (retoque.naves !== undefined) {
    if (!Array.isArray(retoque.naves) || retoque.naves.length !== 2) {
      return 'Cada país lleva exactamente dos naves.';
    }
    for (const nave of retoque.naves) {
      for (const campo of ['velocidad', 'poder'] as const) {
        const v = nave?.[campo];
        if (v !== undefined && (!(v >= 1) || v > 5)) return `La ${campo} de una nave va de 1 a 5.`;
      }
      if (nave?.bombas !== undefined && (!(nave.bombas >= 0) || nave.bombas > 6)) {
        return 'Las bombas de una nave van de 0 a 6.';
      }
    }
  }

  return null;
}
