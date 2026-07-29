import { ANCHO, ALTO } from '../core/constantes.js';
import { balaEnemiga } from './balas.js';
import { proyectilesExtra, velocidadProyectil } from '../sistemas/dificultad.js';

/**
 * Todo lo que hay que abatir.
 *
 * Un enemigo es una plantilla de datos (`datos/stages.js`) más un patrón de
 * movimiento y otro de disparo. Los patrones son estos ocho y estos cuatro:
 * combinándolos salen los enemigos de los tres escenarios sin escribir una
 * clase por bicho.
 */

const MOVIMIENTOS = {
  recto(e, dt) {
    e.x += e.vx * dt;
    e.y += e.vy * dt;
  },

  seno(e, dt) {
    e.y += e.vy * dt;
    e.x = e.xBase + Math.sin(e.t * (e.frecuencia ?? 2.2)) * (e.amplitud ?? 70);
  },

  zigzag(e, dt) {
    e.y += e.vy * dt;
    // Cambia de lado cada tramo: más brusco que el seno y más difícil de leer.
    const tramo = Math.floor(e.t * 1.6) % 2 === 0 ? 1 : -1;
    e.x += tramo * (e.amplitud ?? 120) * dt;
  },

  picada(e, dt, partida) {
    if (!e.presa) {
      const objetivo = partida.jugadorMasCercano(e.x, e.y);
      if (objetivo) {
        const angulo = Math.atan2(objetivo.y - e.y, objetivo.x - e.x);
        e.vx = Math.cos(angulo) * e.velocidadPicada;
        e.vy = Math.sin(angulo) * e.velocidadPicada;
        e.presa = true;
      }
    }
    e.x += e.vx * dt;
    e.y += e.vy * dt;
  },

  /** Entra, se planta a una altura y se queda disparando. */
  entrar(e, dt) {
    if (e.y < e.alturaParada) {
      e.y += e.vy * dt;
    } else {
      e.y = e.alturaParada;
      e.x += Math.cos(e.t * 0.9) * 40 * dt;
    }
  },

  /** Unidades de tierra: bajan con el suelo del escenario. */
  suelo(e, dt) {
    e.y += e.vy * dt;
    e.x = e.xBase;
  },

  lateral(e, dt) {
    e.x += e.vx * dt;
    e.y += Math.sin(e.t * 2) * 30 * dt;
  },

  /** Da vueltas alrededor del punto donde apareció. */
  orbita(e, dt) {
    e.centroY += (e.vy ?? 20) * dt;
    e.x = e.xBase + Math.cos(e.t * 1.8) * (e.amplitud ?? 60);
    e.y = e.centroY + Math.sin(e.t * 1.8) * 26;
  },

  quieto() {},
};

const DISPAROS = {
  ninguno: () => [],

  directo(e, partida) {
    const objetivo = partida.jugadorMasCercano(e.x, e.y);
    if (!objetivo) return [];

    const base = Math.atan2(objetivo.y - e.y, objetivo.x - e.x);
    const cuantas = e.disparo.balas + proyectilesExtra(partida.numJugadores);
    const velocidad = velocidadProyectil(e.disparo.velocidad, partida.numJugadores);

    return Array.from({ length: cuantas }, (_, i) => {
      const desvio = (i - (cuantas - 1) / 2) * 0.16;
      return balaEnemiga(e.x, e.y, base + desvio, velocidad, { color: e.disparo.color });
    });
  },

  espiral(e, partida) {
    const cuantas = e.disparo.balas + proyectilesExtra(partida.numJugadores);
    const velocidad = velocidadProyectil(e.disparo.velocidad, partida.numJugadores);
    e.anguloEspiral = (e.anguloEspiral ?? 0) + 0.7;

    return Array.from({ length: cuantas }, (_, i) =>
      balaEnemiga(e.x, e.y, e.anguloEspiral + (i * Math.PI * 2) / cuantas, velocidad, {
        color: e.disparo.color,
      }),
    );
  },

  abanico(e, partida) {
    const cuantas = e.disparo.balas + 2 * proyectilesExtra(partida.numJugadores);
    const velocidad = velocidadProyectil(e.disparo.velocidad, partida.numJugadores);
    const apertura = e.disparo.apertura ?? 1.1;

    return Array.from({ length: cuantas }, (_, i) => {
      const angulo = Math.PI / 2 + (i - (cuantas - 1) / 2) * (apertura / cuantas);
      return balaEnemiga(e.x, e.y, angulo, velocidad, { color: e.disparo.color });
    });
  },
};

/** Para que las pruebas puedan comprobar que un escenario no pide algo que no existe. */
export const MOVIMIENTOS_VALIDOS = Object.keys(MOVIMIENTOS);
export const DISPAROS_VALIDOS = Object.keys(DISPAROS);

export class Enemigo {
  constructor(plantilla, posicion, partida) {
    Object.assign(this, {
      forma: 'dron',
      movimiento: 'recto',
      radio: 13,
      vida: 20,
      puntos: 150,
      vx: 0,
      vy: 90,
      amplitud: 70,
      velocidadPicada: 260,
      alturaParada: 120,
      colores: ['#78909c', '#455a64', '#ff7043'],
      categoria: 'enemigo',
      disparo: null,
      sueltaPowerUp: null,
      ...plantilla,
      ...posicion,
    });

    // Los enemigos aguantan más cuanta más gente haya: si no, cuatro jugadores
    // barrerían la pantalla antes de que llegase a verse.
    this.vida *= 1 + 0.22 * (partida.numJugadores - 1);
    this.vidaMax = this.vida;

    this.xBase = this.x;
    this.centroY = this.y;
    this.t = 0;
    this.viva = true;
    this.destelloDano = 0;
    this.lento = 0;
    this.cadencia = this.disparo ? this.disparo.cada * (0.4 + Math.random() * 0.6) : Infinity;
    /** Quién le ha pegado hace poco: es lo que detecta el ataque combinado. */
    this.golpesRecientes = new Map();
  }

  actualizar(dt, partida) {
    this.t += dt;
    this.destelloDano = Math.max(0, this.destelloDano - dt * 6);

    // Los cristales de sal y demás efectos de frenado.
    const escala = this.lento > 0 ? 0.45 : 1;
    this.lento = Math.max(0, this.lento - dt);

    (MOVIMIENTOS[this.movimiento] ?? MOVIMIENTOS.recto)(this, dt * escala, partida);

    if (this.disparo && partida.jugadoresVivos.length > 0) {
      this.cadencia -= dt * escala;
      if (this.cadencia <= 0) {
        this.cadencia = this.disparo.cada;
        const generar = DISPAROS[this.disparo.tipo] ?? DISPAROS.directo;
        partida.balasEnemigo.push(...generar(this, partida));
      }
    }

    for (const [indice, cuando] of this.golpesRecientes) {
      if (partida.tiempo - cuando > 0.6) this.golpesRecientes.delete(indice);
    }

    // Fuera de pantalla por abajo o por los lados: se va sin dejar rastro. No
    // cuenta como abatido, y por eso dejar escapar enemigos baja el porcentaje.
    const margen = 60;
    if (this.y > ALTO + margen || this.x < -margen || this.x > ANCHO + margen) {
      this.viva = false;
      this.escapo = true;
    }
  }

  /**
   * Recibe daño. Devuelve los puntos ganados si ha muerto con este golpe.
   *
   * Aquí vive el "ataque combinado": si tres jugadores o más le están pegando a
   * la vez, el daño se multiplica por dos y medio. Es la mecánica que convierte
   * cuatro jugadores dispersos en un equipo concentrando fuego.
   */
  golpear(dano, duenno, partida) {
    this.golpesRecientes.set(duenno, partida.tiempo);

    let multiplicador = 1;
    if (this.golpesRecientes.size >= 3) {
      multiplicador = 2.5;
      partida.combinadoActivo = 0.4;
    }

    this.vida -= dano * multiplicador;
    this.destelloDano = 1;

    if (this.vida > 0) return 0;

    this.viva = false;
    return this.puntos;
  }

  dibujar(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);

    if (this.destelloDano > 0) {
      ctx.shadowColor = '#fff';
      ctx.shadowBlur = 12 * this.destelloDano;
    }

    dibujarForma(ctx, this.forma, this.colores, this.radio, this.t);

    ctx.restore();

    // Barra de vida solo para los gordos: en los débiles sería ruido.
    if (this.vidaMax > 300 && this.vida < this.vidaMax) {
      const w = this.radio * 2;
      ctx.fillStyle = 'rgba(0,0,0,.6)';
      ctx.fillRect(this.x - w / 2, this.y - this.radio - 8, w, 3);
      ctx.fillStyle = '#ef5350';
      ctx.fillRect(this.x - w / 2, this.y - this.radio - 8, w * (this.vida / this.vidaMax), 3);
    }
  }
}

/**
 * Las siluetas de los enemigos.
 *
 * Todas miran hacia abajo (hacia el jugador) y caben en un círculo de `radio`,
 * que es justo el que se usa para las colisiones: lo que se ve es lo que choca.
 */
export function dibujarForma(ctx, forma, colores, radio, t = 0) {
  const [primario, secundario, acento] = colores;
  ctx.fillStyle = primario;

  switch (forma) {
    case 'dron':
      ctx.beginPath();
      ctx.moveTo(0, radio);
      ctx.lineTo(radio, -radio * 0.5);
      ctx.lineTo(0, -radio * 0.2);
      ctx.lineTo(-radio, -radio * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = acento;
      ctx.beginPath();
      ctx.arc(0, radio * 0.2, radio * 0.28, 0, Math.PI * 2);
      ctx.fill();
      break;

    case 'mosquito':
      ctx.beginPath();
      ctx.ellipse(0, 0, radio * 0.4, radio, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.4)';
      for (const lado of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(lado * radio * 0.7, -radio * 0.2, radio * 0.55, radio * 0.22,
          lado * Math.sin(t * 30) * 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
      break;

    case 'heli':
      ctx.fillStyle = primario;
      ctx.beginPath();
      ctx.ellipse(0, 0, radio * 0.55, radio * 0.9, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = secundario;
      ctx.fillRect(-radio * 0.15, radio * 0.6, radio * 0.3, radio * 0.7);
      // Palas: una barra que se estrecha y se ensancha, como al girar.
      ctx.fillStyle = 'rgba(220,230,240,.75)';
      ctx.fillRect(-radio * 1.3, -radio * 0.9, radio * 2.6, 2.5);
      ctx.save();
      ctx.scale(Math.cos(t * 18), 1);
      ctx.fillRect(-radio * 1.3, -radio * 0.9, radio * 2.6, 2.5);
      ctx.restore();
      break;

    case 'tanque':
      ctx.fillStyle = secundario;
      ctx.fillRect(-radio, -radio * 0.6, radio * 2, radio * 1.2);
      ctx.fillStyle = primario;
      ctx.fillRect(-radio * 0.6, -radio * 0.4, radio * 1.2, radio * 0.8);
      ctx.fillStyle = acento;
      ctx.fillRect(-radio * 0.12, radio * 0.3, radio * 0.24, radio * 0.8);
      break;

    case 'barco':
      ctx.beginPath();
      ctx.moveTo(-radio, -radio * 0.4);
      ctx.lineTo(radio, -radio * 0.4);
      ctx.lineTo(radio * 0.6, radio * 0.7);
      ctx.lineTo(-radio * 0.6, radio * 0.7);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = acento;
      ctx.fillRect(-radio * 0.3, -radio * 0.9, radio * 0.6, radio * 0.6);
      break;

    case 'submarino':
      ctx.beginPath();
      ctx.ellipse(0, 0, radio, radio * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = acento;
      ctx.fillRect(-radio * 0.2, -radio * 0.9, radio * 0.4, radio * 0.5);
      break;

    case 'arbol':
      ctx.fillStyle = secundario;
      ctx.fillRect(-radio * 0.2, -radio, radio * 0.4, radio * 2);
      ctx.fillStyle = primario;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(Math.cos(i * 2.1) * radio * 0.5, Math.sin(i * 2.1) * radio * 0.5, radio * 0.6, 0, Math.PI * 2);
        ctx.fill();
      }
      break;

    case 'pinguino':
      ctx.fillStyle = primario;
      ctx.beginPath();
      ctx.ellipse(0, 0, radio * 0.7, radio, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.ellipse(0, radio * 0.15, radio * 0.42, radio * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = acento;
      ctx.beginPath();
      ctx.moveTo(0, radio * 0.9);
      ctx.lineTo(radio * 0.25, radio * 1.2);
      ctx.lineTo(-radio * 0.25, radio * 1.2);
      ctx.closePath();
      ctx.fill();
      break;

    case 'ave':
      ctx.beginPath();
      ctx.moveTo(0, radio * 0.6);
      ctx.quadraticCurveTo(radio * 1.4, -radio * 0.2 + Math.sin(t * 8) * radio * 0.4, radio * 0.3, -radio * 0.7);
      ctx.lineTo(-radio * 0.3, -radio * 0.7);
      ctx.quadraticCurveTo(-radio * 1.4, -radio * 0.2 + Math.sin(t * 8) * radio * 0.4, 0, radio * 0.6);
      ctx.fill();
      break;

    case 'torreta':
      ctx.fillStyle = secundario;
      ctx.beginPath();
      ctx.arc(0, 0, radio, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = primario;
      ctx.beginPath();
      ctx.arc(0, 0, radio * 0.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = acento;
      ctx.fillRect(-radio * 0.15, 0, radio * 0.3, radio * 1.2);
      break;

    case 'campana':
      ctx.fillStyle = primario;
      ctx.beginPath();
      ctx.moveTo(-radio * 0.8, radio * 0.7);
      ctx.quadraticCurveTo(-radio * 0.8, -radio * 0.8, 0, -radio * 0.8);
      ctx.quadraticCurveTo(radio * 0.8, -radio * 0.8, radio * 0.8, radio * 0.7);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = acento;
      ctx.beginPath();
      ctx.arc(0, radio * 0.8, radio * 0.2, 0, Math.PI * 2);
      ctx.fill();
      break;

    case 'iceberg':
      ctx.fillStyle = primario;
      ctx.beginPath();
      ctx.moveTo(0, -radio);
      ctx.lineTo(radio, radio * 0.5);
      ctx.lineTo(radio * 0.3, radio);
      ctx.lineTo(-radio * 0.8, radio * 0.6);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.55)';
      ctx.beginPath();
      ctx.moveTo(0, -radio);
      ctx.lineTo(radio * 0.4, radio * 0.1);
      ctx.lineTo(-radio * 0.2, radio * 0.2);
      ctx.closePath();
      ctx.fill();
      break;

    case 'edificio':
      ctx.fillStyle = primario;
      ctx.fillRect(-radio, -radio, radio * 2, radio * 2);
      ctx.fillStyle = acento;
      for (let f = 0; f < 3; f++) {
        for (let c = 0; c < 3; c++) {
          ctx.fillRect(-radio * 0.7 + c * radio * 0.55, -radio * 0.7 + f * radio * 0.55, radio * 0.3, radio * 0.3);
        }
      }
      break;

    default:
      ctx.beginPath();
      ctx.arc(0, 0, radio, 0, Math.PI * 2);
      ctx.fill();
  }
}
