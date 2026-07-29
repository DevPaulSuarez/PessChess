import { randomUUID } from 'node:crypto';

import type { DatosStore } from './datos.js';
import { audioMudo, cargarMotor } from './motor.js';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Una escuadrilla: la sala donde se junta la gente y, después, el escenario que
 * están volando entre todos.
 *
 * Es el mismo trato que en los tanques y en el ajedrez: manda el servidor. Aquí
 * la razón pesa todavía más que en un tablero, porque cuatro móviles no pueden
 * ponerse de acuerdo por su cuenta sobre dónde está cada bala sin que alguno
 * vea una muerte que a los demás no les ha pasado.
 */

export const MAX_PILOTOS = 4;

/** Cuántas veces por segundo avanza el mundo. El motor está escrito para 60. */
export const PASOS_POR_SEGUNDO = 60;

export type EstadoSala = 'lobby' | 'playing' | 'finished';

export interface SkyPiloto {
  /** Credencial secreta para volver si se cae la conexión, como en el ajedrez. */
  token: string;
  socketId: string | null;
  nombre: string;
  /**
   * Quién es entre partidas: lo guarda el móvil y es a lo que va atado lo que
   * lleva desbloqueado. Sin él se juega igual, pero no se guarda el progreso.
   */
  pilotId: string | null;
  paisId: string | null;
  naveIndice: number;
  listo: boolean;
  /** Sitio en la formación: es lo que el motor usa como `fuente`. */
  indice: number;
}

interface MandoRecibido {
  x: number;
  y: number;
  disparo: boolean;
}

/**
 * Lo que el motor entiende por «los mandos», servido desde la red.
 *
 * El motor pregunta por el estado de una fuente y por si acaba de pulsarse una
 * acción. Los ejes y el disparo son continuos: vale el último que llegó. La
 * bomba y la donación no: son pulsaciones sueltas, y si se guardasen como un
 * booleano continuo, un móvil que va a 30 mensajes por segundo contra un mundo
 * que avanza a 60 gastaría dos bombas por cada toque. Por eso se guardan como
 * pulsos pendientes y se consumen de uno en uno.
 */
export class EntradaDeRed {
  private mandos = new Map<string, MandoRecibido>();
  private pendientes = new Map<string, number>();

  aplicar(fuente: string, datos: any): void {
    const x = Number(datos?.x);
    const y = Number(datos?.y);
    this.mandos.set(fuente, {
      x: Number.isFinite(x) ? Math.max(-1, Math.min(1, x)) : 0,
      y: Number.isFinite(y) ? Math.max(-1, Math.min(1, y)) : 0,
      disparo: Boolean(datos?.disparo),
    });

    if (datos?.bomba) this.encolar(fuente, 'bomba');
    if (datos?.donar) this.encolar(fuente, 'donar');
  }

  /** Un jugador que se va deja de pilotar: si no, su nave seguiría disparando. */
  olvidar(fuente: string): void {
    this.mandos.delete(fuente);
  }

  private encolar(fuente: string, accion: string): void {
    const clave = `${fuente}:${accion}`;
    // Dos pulsos pendientes es todo lo que se guarda. Más significa que alguien
    // está machacando el botón, y encolarlos solo retrasaría el efecto.
    this.pendientes.set(clave, Math.min(2, (this.pendientes.get(clave) ?? 0) + 1));
  }

  estado(fuente: string) {
    const mando = this.mandos.get(fuente);
    return {
      x: mando?.x ?? 0,
      y: mando?.y ?? 0,
      disparo: mando?.disparo ?? false,
      bomba: false,
      donar: false,
      pausa: false,
      atras: false,
    };
  }

  pulsado(fuente: string, accion: string): boolean {
    const clave = `${fuente}:${accion}`;
    const quedan = this.pendientes.get(clave) ?? 0;
    if (quedan <= 0) return false;
    this.pendientes.set(clave, quedan - 1);
    return true;
  }
}

export class SkyMatch {
  readonly id: string;
  readonly createdAt = Date.now();

  pilotos: SkyPiloto[] = [];
  estado: EstadoSala = 'lobby';
  hostToken: string | null = null;

  /** Por dónde va la campaña: 0, 1 y 2 son los tres escenarios hechos. */
  stageIndice = 0;

  partida: any = null;
  entrada = new EntradaDeRed();

  /** Lo que se cuenta al terminar un escenario, hasta que el anfitrión sigue. */
  resultado: any = null;

  /** Se mueve en cada paso: el cliente descarta lo que llegue desordenado. */
  fotograma = 0;

  /**
   * Cuántas veces se ha despegado en esta sala.
   *
   * El fotograma vuelve a cero en cada despegue, así que sin esto un móvil que
   * acaba de ver el fotograma veinte mil daría por atrasados todos los del
   * vuelo siguiente y se quedaría con la pantalla congelada. Con el número de
   * vuelo delante sabe que lo que llega es otra partida, no un retraso.
   */
  generacion = 0;

  /**
   * Los datos salen del almacén, no del motor, para que lo editado en el editor
   * valga desde la partida siguiente sin reiniciar nada.
   */
  constructor(id: string, private readonly datos: DatosStore) {
    this.id = id;
  }

  get vivos(): SkyPiloto[] {
    return this.pilotos.filter((p) => p.socketId !== null);
  }

  get lleno(): boolean {
    return this.pilotos.length >= MAX_PILOTOS;
  }

  /** Una sala sin nadie conectado se puede recoger. */
  get vacia(): boolean {
    return this.vivos.length === 0;
  }

  // -------------------------------------------------------------------------
  // La sala
  // -------------------------------------------------------------------------

  anadir(nombre: string, socketId: string, pilotId: string | null = null): SkyPiloto | null {
    if (this.lleno || this.estado !== 'lobby') return null;

    const piloto: SkyPiloto = {
      token: randomUUID(),
      socketId,
      nombre,
      pilotId,
      paisId: null,
      naveIndice: 0,
      listo: false,
      indice: this.siguienteIndice(),
    };
    this.pilotos.push(piloto);
    this.hostToken ??= piloto.token;
    return piloto;
  }

  /** El hueco más bajo que quede libre, para que la formación no tenga saltos. */
  private siguienteIndice(): number {
    const ocupados = new Set(this.pilotos.map((p) => p.indice));
    for (let i = 0; i < MAX_PILOTOS; i++) if (!ocupados.has(i)) return i;
    return this.pilotos.length;
  }

  porToken(token: string): SkyPiloto | undefined {
    return this.pilotos.find((p) => p.token === token);
  }

  porSocket(socketId: string): SkyPiloto | undefined {
    return this.pilotos.find((p) => p.socketId === socketId);
  }

  /**
   * Elegir país y nave. En vuelo ya no se puede: cambiar de arma a mitad de un
   * escenario dejaría al resto del equipo con una dificultad que no pidieron.
   */
  elegir(token: string, paisId: string, naveIndice: number): boolean {
    if (this.estado !== 'lobby') return false;
    const piloto = this.porToken(token);
    if (!piloto) return false;

    const nave = naveIndice === 1 ? 1 : 0;
    if (this.cogida(paisId, nave, token)) return false;

    piloto.paisId = paisId;
    piloto.naveIndice = nave;
    piloto.listo = true;
    return true;
  }

  /**
   * Si otro piloto ya vuela esa nave.
   *
   * Cada uno lleva la suya, como los colores en los tanques: con dos naves
   * iguales en pantalla no se sabe cuál eres, y saberlo es lo único que impide
   * esquivar con la nave del compañero. De salida hay dos países con dos naves
   * cada uno, justo cuatro, que son los pilotos que caben.
   */
  cogida(paisId: string, naveIndice: number, salvo?: string): boolean {
    return this.pilotos.some(
      (p) => p.token !== salvo && p.paisId === paisId && p.naveIndice === naveIndice,
    );
  }

  /** Las naves ya ocupadas, para que el móvil las enseñe marcadas. */
  get ocupadas(): Array<{ paisId: string; naveIndice: number }> {
    return this.pilotos
      .filter((p) => p.paisId !== null)
      .map((p) => ({ paisId: p.paisId!, naveIndice: p.naveIndice }));
  }

  desconectar(socketId: string): SkyPiloto | undefined {
    const piloto = this.porSocket(socketId);
    if (!piloto) return undefined;

    piloto.socketId = null;
    this.entrada.olvidar(piloto.token);

    // En el lobby el sitio se libera del todo; en vuelo no, porque la nave sigue
    // en el aire y quien se cayó puede volver a ella.
    if (this.estado === 'lobby') {
      this.pilotos = this.pilotos.filter((p) => p.token !== piloto.token);
      if (this.hostToken === piloto.token) this.hostToken = this.pilotos[0]?.token ?? null;
    }
    return piloto;
  }

  reconectar(token: string, socketId: string): SkyPiloto | undefined {
    const piloto = this.porToken(token);
    if (!piloto) return undefined;
    piloto.socketId = socketId;
    return piloto;
  }

  // -------------------------------------------------------------------------
  // El vuelo
  // -------------------------------------------------------------------------

  /** Todos los que han elegido, y al menos uno. */
  get puedeEmpezar(): boolean {
    const listos = this.pilotos.filter((p) => p.listo && p.paisId);
    return listos.length > 0 && listos.length === this.pilotos.length;
  }

  async empezar(): Promise<boolean> {
    if (this.estado === 'playing' || !this.puedeEmpezar) return false;

    const stage = await this.datos.stage(this.stageIndice);
    if (!stage) return false;

    const paises = await this.datos.paises();
    const porId = new Map(paises.map((p: any) => [p.id, p]));

    const configuraciones = this.pilotos.map((piloto) => {
      const pais = porId.get(piloto.paisId!);
      return {
        // La fuente es el token: así el motor pregunta por el mando de cada
        // jugador sin saber nada de sockets.
        fuente: piloto.token,
        pais,
        nave: pais.naves[piloto.naveIndice] ?? pais.naves[0],
        ranura: `j${piloto.indice + 1}`,
      };
    });

    const motor = await cargarMotor();
    this.partida = new motor.Partida({ stage, configuraciones, audio: audioMudo });
    this.resultado = null;
    this.estado = 'playing';
    this.fotograma = 0;
    this.generacion++;
    return true;
  }

  /**
   * Avanza el mundo un paso.
   *
   * Devuelve `true` cuando el escenario acaba de terminarse, que es cuando hay
   * algo que contar además del estado.
   */
  paso(dt: number): boolean {
    if (this.estado !== 'playing' || !this.partida) return false;

    this.partida.actualizar(dt, this.entrada);
    this.fotograma++;

    const estadoPartida = this.partida.estado;
    if (estadoPartida === 'jugando') return false;

    this.resultado = {
      estado: estadoPartida,
      stage: this.stageIndice,
      puntos: this.partida.puntos,
      evaluacion: this.evaluacionPlana(),
      jefeVerdadero: Boolean(this.partida.jefeVerdadero),
      ultimo: this.stageIndice >= 2,
    };
    this.estado = 'finished';
    return true;
  }

  /** Las tres condiciones, sin funciones ni ciclos, listas para viajar. */
  private evaluacionPlana() {
    const ev = this.partida?.evaluacion;
    if (!ev) return null;
    return {
      porcentaje: ev.porcentaje,
      cumplidas: ev.cumplidas,
      jefeVerdadero: ev.jefeVerdadero,
      condiciones: (ev.condiciones ?? []).map((c: any) => ({
        texto: c.texto,
        cumplida: c.cumplida,
      })),
    };
  }

  /** Pasar al siguiente escenario de la campaña, si queda alguno. */
  async siguiente(): Promise<boolean> {
    if (this.estado !== 'finished') return false;
    if (this.resultado?.estado === 'gameover') return false;
    if (this.stageIndice >= 2) return false;

    this.stageIndice++;
    this.estado = 'lobby';
    return this.empezar();
  }
}
