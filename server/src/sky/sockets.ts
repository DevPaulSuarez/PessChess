import type { Server, Socket } from 'socket.io';

import type { DatosStore } from './datos.js';
import { instantanea, lobby } from './estado.js';
import { MAX_PILOTOS, PASOS_POR_SEGUNDO, SkyMatch } from './match.js';
import { cargarMotor } from './motor.js';
import type { ProgresoStore } from './progreso.js';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Sky Warriors en red: cada piloto en su móvil, todos en el mismo escenario.
 *
 * Funciona como los tanques y al revés que el ajedrez: nadie espera turno, el
 * servidor adelanta el mundo sesenta veces por segundo y reparte cómo va
 * quedando. La diferencia con los tanques es que aquí no se juega contra los
 * demás, sino con ellos: las vidas son de todos y el escenario aprieta según
 * cuántos sean.
 */

/** Sin I, O, 0 ni 1: se confunden al dictarlos en voz alta. */
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Una sala terminada o vacía se recoge pasado este tiempo. */
const CADUCA_MS = 20 * 60 * 1000;

/**
 * El mundo avanza a 60 pasos por segundo porque el motor está escrito así, pero
 * el estado sale a 30: el ojo no distingue la diferencia en un móvil y la mitad
 * de mensajes es la mitad de datos para quien juega con datos móviles.
 */
const PASOS_POR_ENVIO = 2;

export class SkyServer {
  private salas = new Map<string, SkyMatch>();
  private socketSala = new Map<string, string>();
  private bucle: NodeJS.Timeout | null = null;

  constructor(
    private readonly io: Server,
    private readonly progreso: ProgresoStore,
    private readonly datos: DatosStore,
  ) {}

  get stats() {
    return {
      skyMatches: this.salas.size,
      skyFlying: [...this.salas.values()].filter((s) => s.estado === 'playing').length,
    };
  }

  // -------------------------------------------------------------------------

  register(socket: Socket): void {
    socket.on('sky_create', async (payload) => {
      const sala = new SkyMatch(this.codigoLibre(), this.datos);
      this.salas.set(sala.id, sala);

      const piloto = sala.anadir(limpiarNombre(payload?.name), socket.id, limpiarId(payload?.pilotId));
      if (!piloto) return this.fallo(socket, 'No se pudo crear la escuadrilla.');

      this.socketSala.set(socket.id, sala.id);
      socket.emit('sky_joined', {
        code: sala.id,
        token: piloto.token,
        indice: piloto.indice,
        paises: await this.catalogo(),
        progreso: this.progreso.ficha(piloto.pilotId),
      });
      this.mandarLobby(sala);
    });

    socket.on('sky_join', async (payload) => {
      const code = String(payload?.code ?? '').trim().toUpperCase();
      const sala = this.salas.get(code);
      if (!sala) return this.fallo(socket, 'No hay ninguna escuadrilla con ese código.');
      if (sala.estado !== 'lobby') return this.fallo(socket, 'Esa escuadrilla ya está volando.');
      if (sala.lleno) return this.fallo(socket, `No caben más de ${MAX_PILOTOS} pilotos.`);

      const piloto = sala.anadir(limpiarNombre(payload?.name), socket.id, limpiarId(payload?.pilotId));
      if (!piloto) return this.fallo(socket, 'No se pudo entrar en la escuadrilla.');

      this.socketSala.set(socket.id, sala.id);
      socket.emit('sky_joined', {
        code: sala.id,
        token: piloto.token,
        indice: piloto.indice,
        paises: await this.catalogo(),
        progreso: this.progreso.ficha(piloto.pilotId),
      });
      this.mandarLobby(sala);
    });

    /** Volver a la nave después de perder la cobertura. */
    socket.on('sky_resume', async (payload) => {
      const code = String(payload?.code ?? '').trim().toUpperCase();
      const sala = this.salas.get(code);
      const piloto = sala?.reconectar(String(payload?.token ?? ''), socket.id);
      if (!sala || !piloto) return this.fallo(socket, 'Esa escuadrilla ya no existe.');

      this.socketSala.set(socket.id, sala.id);
      socket.emit('sky_joined', {
        code: sala.id,
        token: piloto.token,
        indice: piloto.indice,
        paises: await this.catalogo(),
        progreso: this.progreso.ficha(piloto.pilotId),
      });
      this.mandarLobby(sala);
    });

    socket.on('sky_pick', (payload) => {
      const { sala, piloto } = this.buscar(socket);
      if (!sala || !piloto) return;

      const paisId = String(payload?.paisId ?? '');
      // Vale lo que tenga cualquiera de la escuadrilla, no solo lo tuyo. Se
      // comprueba aquí y no en el móvil: si viviera en la app, saltársela sería
      // editarla.
      const deTodos = this.progreso.desbloqueadosDe(sala.pilotos.map((p) => p.pilotId));
      if (!deTodos.includes(paisId)) {
        return this.fallo(socket, 'Ese país todavía no está desbloqueado.');
      }

      const ok = sala.elegir(piloto.token, paisId, Number(payload?.naveIndice));
      if (!ok) {
        return this.fallo(
          socket,
          sala.cogida(paisId, Number(payload?.naveIndice) === 1 ? 1 : 0, piloto.token)
              ? 'Esa nave ya la lleva otro piloto.'
              : 'No se pudo elegir esa nave.',
        );
      }
      this.mandarLobby(sala);
    });

    socket.on('sky_start', async () => {
      const { sala, piloto } = this.buscar(socket);
      if (!sala || !piloto) return;
      if (sala.hostToken !== piloto.token) {
        return this.fallo(socket, 'Solo quien creó la escuadrilla puede despegar.');
      }
      if (!sala.puedeEmpezar) return this.fallo(socket, 'Falta gente por elegir nave.');

      if (await sala.empezar()) {
        this.mandarLobby(sala);
        this.arrancarBucle();
      }
    });

    /**
     * El mando. Llega tan a menudo como el móvil quiera y no contesta nada: si
     * un paquete se pierde, el siguiente lo corrige veinte milisegundos después.
     */
    socket.on('sky_input', (payload) => {
      const { sala, piloto } = this.buscar(socket);
      if (!sala || !piloto || sala.estado !== 'playing') return;
      sala.entrada.aplicar(piloto.token, payload);
    });

    /** Al siguiente escenario de la campaña. */
    socket.on('sky_next', async () => {
      const { sala, piloto } = this.buscar(socket);
      if (!sala || !piloto || sala.hostToken !== piloto.token) return;

      if (await sala.siguiente()) {
        this.mandarLobby(sala);
        this.arrancarBucle();
      }
    });

    socket.on('sky_leave', () => this.soltar(socket));
    socket.on('disconnect', () => this.soltar(socket, { guardarSitio: true }));
  }

  // -------------------------------------------------------------------------

  /**
   * Un solo temporizador para todas las escuadrillas: con uno por sala, diez
   * salas serían diez temporizadores peleándose por el mismo hilo.
   */
  private arrancarBucle(): void {
    if (this.bucle) return;

    let paso = 0;
    this.bucle = setInterval(async () => {
      const motor = await cargarMotor();
      let alguienVuela = false;

      for (const sala of this.salas.values()) {
        if (sala.estado !== 'playing') continue;
        alguienVuela = true;

        const termino = sala.paso(motor.PASO);
        if (termino) {
          await this.repartirPremios(sala);
          this.mandarLobby(sala);
          continue;
        }

        if (paso % PASOS_POR_ENVIO === 0) this.mandarEstado(sala);
      }

      paso++;
      this.recoger();

      if (!alguienVuela) {
        clearInterval(this.bucle!);
        this.bucle = null;
      }
    }, 1000 / PASOS_POR_SEGUNDO);
  }

  /**
   * Apunta lo ganado y se lo cuenta a cada uno.
   *
   * El escenario se vuela en equipo, así que todos cobran lo mismo: quien pone
   * la nave para que otro cumpla las condiciones ha hecho tanto como él. Lo que
   * cambia de un móvil a otro es qué países se le abren, porque cada uno va por
   * su sitio de la lista.
   */
  private async repartirPremios(sala: SkyMatch): Promise<void> {
    const resultado = sala.resultado;

    for (const piloto of sala.pilotos) {
      const nuevos = this.progreso.apuntar(piloto.pilotId, {
        estado: resultado.estado,
        jefeVerdadero: resultado.jefeVerdadero,
        cumplidas: resultado.evaluacion?.cumplidas ?? 0,
        puntos: resultado.puntos,
      });

      if (!piloto.socketId) continue;
      this.io.to(piloto.socketId).emit('sky_result', {
        ...resultado,
        desbloqueados: nuevos,
        progreso: this.progreso.ficha(piloto.pilotId),
        paises: await this.catalogo(),
      });
    }
  }

  private mandarEstado(sala: SkyMatch): void {
    const estado = instantanea(sala);
    if (!estado) return;

    for (const piloto of sala.pilotos) {
      if (!piloto.socketId) continue;
      // Lo único que cambia de un móvil a otro es cuál de las naves es la suya.
      this.io.to(piloto.socketId).emit('sky_state', { ...estado, tuIndice: piloto.indice });
    }
  }

  private mandarLobby(sala: SkyMatch): void {
    const payload = lobby(sala);

    // Lo que puede volar la escuadrilla cambia cada vez que entra o sale
    // alguien, así que viaja con la sala y no con el catálogo, que es fijo.
    const deTodos = this.progreso.desbloqueadosDe(sala.pilotos.map((p) => p.pilotId));

    for (const piloto of sala.pilotos) {
      if (!piloto.socketId) continue;
      this.io.to(piloto.socketId).emit('sky_lobby', {
        ...payload,
        eresHost: sala.hostToken === piloto.token,
        tuIndice: piloto.indice,
        desbloqueados: deTodos,
        // Los tuyos aparte: prestado no es lo mismo que ganado.
        tuyos: this.progreso.desbloqueados(piloto.pilotId),
      });
    }
  }

  private mandarATodos(sala: SkyMatch, evento: string, datos: unknown): void {
    for (const piloto of sala.pilotos) {
      if (!piloto.socketId) continue;
      this.io.to(piloto.socketId).emit(evento, datos);
    }
  }

  /**
   * Los países y sus naves, para que el móvil pinte el menú sin inventarse nada.
   *
   * Van los veintiuno, también los que nadie tiene: enseñar lo que queda por
   * ganarse es la mitad de la gracia de ganárselo. Cuáles se pueden volar no se
   * dice aquí, sino en la sala, porque depende de quién esté en ella.
   */
  private async catalogo() {
    return (await this.datos.paises()).map((pais: any) => ({
      id: pais.id,
      nombre: pais.nombre,
      // La bandera va entera —tipo, franjas, pesos y emblema— porque el móvil
      // la dibuja, no la trae hecha: así añadir un país es tocar solo los datos.
      bandera: pais.bandera,
      colores: pais.colores,
      arma: { nombre: pais.arma.nombre, tipo: pais.arma.tipo },
      bomba: { nombre: pais.bomba.nombre, tipo: pais.bomba.tipo },
      naves: pais.naves.map((n: any) => ({
        nombre: n.nombre,
        piloto: n.piloto,
        silueta: n.silueta,
        velocidad: n.velocidad,
        poder: n.poder,
        bombas: n.bombas,
        // Si tiene dibujo propio, el móvil lo pinta en vez de la silueta.
        imagen: n.imagen ?? null,
      })),
    }));
  }

  // -------------------------------------------------------------------------

  private buscar(socket: Socket) {
    const id = this.socketSala.get(socket.id);
    const sala = id ? this.salas.get(id) : undefined;
    return { sala, piloto: sala?.porSocket(socket.id) };
  }

  /**
   * Al desconectarse se le guarda la nave, porque puede volver; al salir a
   * propósito, se le quita de la escuadrilla.
   */
  private soltar(socket: Socket, { guardarSitio = false } = {}): void {
    const { sala } = this.buscar(socket);
    this.socketSala.delete(socket.id);
    if (!sala) return;

    const piloto = sala.desconectar(socket.id);
    if (!piloto) return;

    // Fuera del vuelo, salir es salir: el sitio se libera para otro.
    if (!guardarSitio && sala.estado === 'playing') {
      sala.pilotos = sala.pilotos.filter((p) => p.token !== piloto.token);
    }
    this.mandarLobby(sala);
  }

  private recoger(): void {
    const ahora = Date.now();
    for (const [code, sala] of this.salas) {
      const caducada = ahora - sala.createdAt > CADUCA_MS;
      if (sala.pilotos.length === 0 || (sala.estado === 'finished' && caducada)) {
        this.salas.delete(code);
      }
    }
  }

  private fallo(socket: Socket, mensaje: string): void {
    socket.emit('error_msg', { code: 'bad_request', message: mensaje });
  }

  private codigoLibre(): string {
    for (let intento = 0; intento < 100; intento++) {
      let code = '';
      for (let i = 0; i < 4; i++) {
        code += ALFABETO[Math.floor(Math.random() * ALFABETO.length)];
      }
      if (!this.salas.has(code)) return code;
    }
    return Date.now().toString(36).toUpperCase().slice(-4);
  }
}

function limpiarNombre(raw: unknown): string {
  const nombre = typeof raw === 'string' ? raw.trim().slice(0, 20) : '';
  return nombre.length > 0 ? nombre : 'Piloto';
}

/** El identificador que guarda el móvil. Si no viene, se juega sin progreso. */
function limpiarId(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const id = raw.trim().slice(0, 64);
  return /^[A-Za-z0-9-]{8,64}$/.test(id) ? id : null;
}
