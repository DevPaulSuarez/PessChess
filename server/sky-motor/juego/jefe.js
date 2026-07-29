import { ANCHO, ALTO } from '../core/constantes.js';
import { balaEnemiga } from './balas.js';
import { barra, texto, estrella } from '../core/pintor.js';
import { proyectilesExtra, velocidadProyectil, vidaDeJefe } from '../sistemas/dificultad.js';
import { PUNTOS } from '../sistemas/puntuacion.js';

/**
 * Los jefes: varias fases, partes que se destruyen aparte y un láser.
 *
 * Un jefe se describe con datos en `datos/stages.js` (fases, ataques, partes) y
 * esta clase los ejecuta. Lo que hace que un jefe se sienta distinto de otro no
 * es su código sino el orden de sus fases y lo que obliga a hacer al equipo:
 * repartirse las partes, turnarse el láser, o dejar de disparar y sobrevivir.
 */

const MOVIMIENTOS = {
  vaiven(j, dt) {
    j.x = ANCHO / 2 + Math.sin(j.t * (j.ritmo ?? 0.9)) * (ANCHO / 2 - j.radio - 10);
    j.y = j.alturaBase + Math.sin(j.t * 1.7) * 12;
  },

  zigzag(j, dt) {
    j.x += j.vx * dt;
    if (j.x < j.radio + 8 || j.x > ANCHO - j.radio - 8) {
      j.vx *= -1;
      j.x = Math.max(j.radio + 8, Math.min(ANCHO - j.radio - 8, j.x));
    }
    j.y = j.alturaBase + Math.abs(Math.sin(j.t * 2.4)) * 40;
  },

  persigue(j, dt, partida) {
    const objetivo = partida.jugadorMasCercano(j.x, j.y);
    if (objetivo) j.x += Math.sign(objetivo.x - j.x) * (j.velocidadCaza ?? 70) * dt;
    j.x = Math.max(j.radio, Math.min(ANCHO - j.radio, j.x));
    j.y = j.alturaBase + Math.sin(j.t * 2) * 18;
  },

  ascenso(j, dt) {
    // Sube despacio mientras el escenario cae: da la sensación de perseguirlo.
    j.y = j.alturaBase - Math.min(60, j.tFase * 12);
    j.x = ANCHO / 2 + Math.sin(j.t * 1.3) * 90;
  },

  quieto(j) {
    j.x = ANCHO / 2;
    j.y = j.alturaBase;
  },
};

const ATAQUES = {
  abanico(j, partida, a) {
    const cuantas = a.balas + 2 * proyectilesExtra(partida.numJugadores);
    const velocidad = velocidadProyectil(a.velocidad, partida.numJugadores);
    const apertura = a.apertura ?? 1.3;

    for (let i = 0; i < cuantas; i++) {
      const angulo = Math.PI / 2 + (i - (cuantas - 1) / 2) * (apertura / cuantas);
      partida.balasEnemigo.push(
        balaEnemiga(j.x, j.y + j.radio * 0.4, angulo, velocidad, { color: a.color, forma: a.forma }),
      );
    }
  },

  circulo(j, partida, a) {
    const cuantas = a.balas + 3 * proyectilesExtra(partida.numJugadores);
    const velocidad = velocidadProyectil(a.velocidad, partida.numJugadores);
    j.anguloGiro = (j.anguloGiro ?? 0) + (a.giro ?? 0.35);

    for (let i = 0; i < cuantas; i++) {
      partida.balasEnemigo.push(
        balaEnemiga(j.x, j.y, j.anguloGiro + (i * Math.PI * 2) / cuantas, velocidad, {
          color: a.color,
          forma: a.forma,
        }),
      );
    }
  },

  dirigido(j, partida, a) {
    const objetivo = partida.jugadorMasCercano(j.x, j.y);
    if (!objetivo) return;

    const base = Math.atan2(objetivo.y - j.y, objetivo.x - j.x);
    const cuantas = a.balas + proyectilesExtra(partida.numJugadores);
    const velocidad = velocidadProyectil(a.velocidad, partida.numJugadores);

    for (let i = 0; i < cuantas; i++) {
      partida.balasEnemigo.push(
        balaEnemiga(j.x, j.y, base + (i - (cuantas - 1) / 2) * 0.13, velocidad, {
          color: a.color,
          forma: a.forma,
        }),
      );
    }
  },

  /** Cae del cielo en columnas: obliga a moverse en horizontal. */
  lluvia(j, partida, a) {
    const cuantas = a.balas + 2 * proyectilesExtra(partida.numJugadores);
    const velocidad = velocidadProyectil(a.velocidad, partida.numJugadores);

    for (let i = 0; i < cuantas; i++) {
      partida.balasEnemigo.push(
        balaEnemiga(Math.random() * ANCHO, -10, Math.PI / 2, velocidad, {
          color: a.color,
          forma: a.forma,
        }),
      );
    }
  },

  /** Nube que se queda flotando un rato y hace daño mientras esté. */
  veneno(j, partida, a) {
    for (let i = 0; i < (a.balas ?? 3); i++) {
      const bala = balaEnemiga(
        j.x + (Math.random() - 0.5) * 80,
        j.y + 20,
        Math.PI / 2,
        30,
        { color: a.color, radio: 16 },
      );
      bala.alcance = 90; // baja poco y se queda estorbando
      partida.balasEnemigo.push(bala);
    }
  },

  /** Enciende el láser giratorio: el ataque que obliga a coordinarse. */
  laser(j, partida, a) {
    j.laser = {
      angulo: a.desde ?? 0,
      giro: (a.giro ?? 0.6) * (Math.random() < 0.5 ? 1 : -1),
      restante: a.duracion ?? 5,
      color: a.color ?? '#ff5252',
    };
    partida.audio.aviso();
  },
};

export const MOVIMIENTOS_JEFE = Object.keys(MOVIMIENTOS);
export const ATAQUES_JEFE = Object.keys(ATAQUES);

export class Jefe {
  constructor(definicion, partida) {
    this.def = definicion;
    this.nombre = definicion.nombre;
    this.forma = definicion.forma ?? 'esfera';
    this.colores = definicion.colores ?? ['#8d6e63', '#5d4037', '#ffd54f'];
    this.radio = definicion.radio ?? 60;
    this.alturaBase = definicion.altura ?? 130;

    this.x = ANCHO / 2;
    this.y = -80;
    this.vx = definicion.velocidad ?? 120;

    // La vida sale de la tabla de dificultad, no del escenario: así todos los
    // jefes escalan igual con el número de jugadores.
    this.vidaTotal = vidaDeJefe(partida.numJugadores) * (definicion.escalaVida ?? 1);
    this.faseIndice = 0;
    this.vida = this.vidaTotal * this.fase.vida;
    this.vidaFase = this.vida;

    this.t = 0;
    this.tFase = 0;
    this.entrando = true;
    this.invulnerable = 0;
    this.destelloDano = 0;
    this.laser = null;
    this.viva = true;
    this.recibioDano = false;

    this.temporizadores = new Map();
    this.partes = [];
    this.rastro = [];
    this._montarPartes();
  }

  /**
   * La fase en curso.
   *
   * Se recorta al último índice porque al morir el jefe `faseIndice` se pasa
   * del final, y todavía queda un fotograma en el que alguien lo dibuja.
   */
  get fase() {
    return this.def.fases[Math.min(this.faseIndice, this.def.fases.length - 1)];
  }

  get fraccionVida() {
    return this.vida / this.vidaFase;
  }

  _montarPartes() {
    this.partes = (this.fase.partes ?? []).map((parte, i) => ({
      ...parte,
      indice: i,
      vida: parte.vida * (this.vidaTotal / 10000),
      vidaMax: parte.vida * (this.vidaTotal / 10000),
      x: this.x,
      y: this.y,
      viva: true,
      destelloDano: 0,
    }));
  }

  /**
   * El núcleo solo es vulnerable cuando toca.
   *
   * Es lo que convierte a un jefe en un puzle además de en un saco de vida: la
   * torre pide tirar las torretas primero, y la serpiente hay que comérsela de
   * la cola a la cabeza.
   */
  vulnerable() {
    if (this.invulnerable > 0 || this.entrando) return false;
    if (!this.fase.requierePartes) return true;
    return this.partes.every((p) => !p.viva);
  }

  /** Partes a las que se puede disparar ahora mismo. */
  partesVulnerables() {
    const vivas = this.partes.filter((p) => p.viva);
    if (!this.fase.deLaColaALaCabeza) return vivas;
    // Solo la última: la serpiente se destruye por el rabo.
    return vivas.slice(-1);
  }

  actualizar(dt, partida) {
    this.t += dt;
    this.tFase += dt;
    this.destelloDano = Math.max(0, this.destelloDano - dt * 6);
    this.invulnerable = Math.max(0, this.invulnerable - dt);

    if (this.entrando) {
      this.y += 90 * dt;
      if (this.y >= this.alturaBase) {
        this.y = this.alturaBase;
        this.entrando = false;
      }
      this._moverPartes(dt);
      return;
    }

    (MOVIMIENTOS[this.fase.movimiento] ?? MOVIMIENTOS.vaiven)(this, dt, partida);
    this._moverPartes(dt);

    if (this.invulnerable <= 0) {
      this._ejecutarAtaques(dt, partida);
      this._actualizarLaser(dt, partida);
    }
  }

  _moverPartes(dt) {
    // El rastro guarda por dónde ha pasado la cabeza; los segmentos van
    // colocándose en posiciones antiguas y así la serpiente ondula sola.
    this.rastro.unshift({ x: this.x, y: this.y });
    if (this.rastro.length > 240) this.rastro.length = 240;

    for (const parte of this.partes) {
      if (parte.rastro !== undefined) {
        const punto = this.rastro[Math.min(this.rastro.length - 1, parte.rastro)];
        parte.x = punto.x;
        parte.y = punto.y;
      } else {
        parte.x = this.x + (parte.dx ?? 0);
        parte.y = this.y + (parte.dy ?? 0);
      }
      parte.destelloDano = Math.max(0, parte.destelloDano - dt * 6);
    }
  }

  _ejecutarAtaques(dt, partida) {
    for (const ataque of this.fase.ataques ?? []) {
      const clave = ataque;
      const restante = (this.temporizadores.get(clave) ?? ataque.espera ?? 0.8) - dt;

      if (restante <= 0) {
        // Con más jugadores el jefe dispara más seguido, no solo más balas.
        const prisa = 1 - 0.08 * (partida.numJugadores - 1);
        this.temporizadores.set(clave, ataque.cada * prisa);
        (ATAQUES[ataque.tipo] ?? ATAQUES.abanico)(this, partida, ataque);
      } else {
        this.temporizadores.set(clave, restante);
      }
    }

    const invoca = this.fase.invoca;
    if (invoca) {
      const restante = (this.temporizadores.get(invoca) ?? invoca.cada) - dt;
      if (restante <= 0) {
        this.temporizadores.set(invoca, invoca.cada);
        partida.invocarEsbirros(invoca.plantilla, invoca.cuantos, this.x, this.y);
      } else {
        this.temporizadores.set(invoca, restante);
      }
    }
  }

  _actualizarLaser(dt, partida) {
    if (!this.laser) return;

    this.laser.angulo += this.laser.giro * dt;
    this.laser.restante -= dt;
    if (this.laser.restante <= 0) {
      this.laser = null;
      return;
    }

    // El daño del láser lo aplica la partida, que es quien conoce a los
    // jugadores; aquí solo se dice por dónde pasa.
    for (const jugador of partida.jugadoresVivos) {
      const dx = jugador.x - this.x;
      const dy = jugador.y - this.y;
      const proyeccion = dx * Math.cos(this.laser.angulo) + dy * Math.sin(this.laser.angulo);
      if (proyeccion < 0) continue;

      const distancia = Math.abs(-dx * Math.sin(this.laser.angulo) + dy * Math.cos(this.laser.angulo));
      if (distancia < 10) partida.matarJugador(jugador);
    }
  }

  golpear(dano, duenno, partida, parte = null) {
    this.recibioDano = true;

    if (parte) {
      parte.vida -= dano;
      parte.destelloDano = 1;
      if (parte.vida <= 0) {
        parte.viva = false;
        partida.efectos.explosion(parte.x, parte.y, { tamano: 1.4, color: this.colores[2] });
        partida.audio.explosion(1.2);
        partida.sumarPuntos(PUNTOS.pesado);
      }
      return;
    }

    if (!this.vulnerable()) return;

    this.vida -= dano;
    this.destelloDano = 1;
    if (this.vida > 0) return;

    this._siguienteFase(partida);
  }

  _siguienteFase(partida) {
    partida.sumarPuntos(PUNTOS.faseJefe);
    partida.efectos.explosion(this.x, this.y, { tamano: 3, color: this.colores[2] });
    partida.efectos.fogonazo(0.7);
    partida.audio.explosion(2);
    partida.balasEnemigo.length = 0; // respiro entre fases: es justo y se agradece

    this.faseIndice++;
    if (this.faseIndice >= this.def.fases.length) {
      this.viva = false;
      return;
    }

    this.vida = this.vidaTotal * this.fase.vida;
    this.vidaFase = this.vida;
    this.tFase = 0;
    this.invulnerable = 1.2;
    this.laser = null;
    this.temporizadores.clear();
    this._montarPartes();
    partida.anunciar(`FASE ${this.faseIndice + 1}: ${this.fase.nombre.toUpperCase()}`);
  }

  // -------------------------------------------------------------------------

  dibujar(ctx) {
    if (this.laser) this._dibujarLaser(ctx);

    for (const parte of this.partes) {
      if (!parte.viva) continue;
      ctx.save();
      ctx.translate(parte.x, parte.y);
      if (parte.destelloDano > 0) {
        ctx.shadowColor = '#fff';
        ctx.shadowBlur = 14 * parte.destelloDano;
      }
      ctx.fillStyle = this.colores[1];
      ctx.beginPath();
      ctx.arc(0, 0, parte.radio, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = this.colores[2];
      ctx.beginPath();
      ctx.arc(0, 0, parte.radio * 0.45, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.save();
    ctx.translate(this.x, this.y);
    if (this.destelloDano > 0) {
      ctx.shadowColor = '#fff';
      ctx.shadowBlur = 20 * this.destelloDano;
    }
    // En la última fase el jefe late en rojo: se ve que está desesperado.
    if (this.faseIndice === this.def.fases.length - 1) {
      ctx.shadowColor = '#ff1744';
      ctx.shadowBlur = 18 + Math.sin(this.t * 9) * 10;
    }

    // Cada fase puede cambiar de forma: el colibrí se vuelve esfera solar.
    dibujarFormaJefe(ctx, this.fase.forma ?? this.forma, this.colores, this.radio, this.t, this.fraccionVida);
    ctx.restore();
  }

  _dibujarLaser(ctx) {
    const largo = 900;
    const dx = Math.cos(this.laser.angulo) * largo;
    const dy = Math.sin(this.laser.angulo) * largo;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = this.laser.color;
    ctx.lineWidth = 18;
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(this.x + dx, this.y + dy);
    ctx.stroke();

    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(this.x + dx, this.y + dy);
    ctx.stroke();
    ctx.restore();
  }

  /** La barra de arriba, con el nombre y las fases que quedan. */
  dibujarBarra(ctx) {
    const fases = this.def.fases.length;
    texto(ctx, this.nombre.toUpperCase(), ANCHO / 2, 26, {
      tam: 13,
      alineado: 'center',
      color: this.colores[2],
    });
    barra(ctx, 40, 32, ANCHO - 80, 8, this.fraccionVida, this.vulnerable() ? '#ef5350' : '#78909c');

    for (let i = 0; i < fases; i++) {
      ctx.fillStyle = i <= this.faseIndice ? this.colores[2] : 'rgba(255,255,255,.25)';
      ctx.beginPath();
      ctx.arc(40 + 10 + i * 16, 48, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    if (!this.vulnerable() && !this.entrando) {
      texto(ctx, 'NÚCLEO BLINDADO · DESTRUYE LAS PARTES', ANCHO / 2, 62, {
        tam: 9,
        alineado: 'center',
        color: '#ffd54f',
      });
    }
  }
}

function dibujarFormaJefe(ctx, forma, colores, radio, t, vida) {
  const [primario, secundario, acento] = colores;

  switch (forma) {
    case 'colibri': {
      // Alas que baten deprisa, cuerpo alargado y pico largo.
      const bateo = Math.sin(t * 16) * 0.5;
      ctx.fillStyle = secundario;
      for (const lado of [-1, 1]) {
        ctx.save();
        ctx.rotate(lado * (0.5 + bateo));
        ctx.beginPath();
        ctx.ellipse(lado * radio * 0.9, 0, radio * 0.95, radio * 0.3, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      ctx.fillStyle = primario;
      ctx.beginPath();
      ctx.ellipse(0, 0, radio * 0.55, radio * 0.85, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = acento;
      ctx.beginPath();
      ctx.moveTo(-radio * 0.12, radio * 0.7);
      ctx.lineTo(radio * 0.12, radio * 0.7);
      ctx.lineTo(0, radio * 1.5);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, -radio * 0.35, radio * 0.22, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case 'serpiente':
      ctx.fillStyle = primario;
      ctx.beginPath();
      ctx.ellipse(0, 0, radio * 0.8, radio, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = acento;
      for (const lado of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(lado * radio * 0.35, radio * 0.25, radio * 0.18, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = secundario;
      ctx.beginPath();
      ctx.moveTo(-radio * 0.2, radio * 0.9);
      ctx.lineTo(radio * 0.2, radio * 0.9);
      ctx.lineTo(0, radio * 1.4);
      ctx.closePath();
      ctx.fill();
      break;

    case 'torre': {
      // Tres cuerpos apilados que se estrechan hacia abajo.
      for (let i = 0; i < 3; i++) {
        const w = radio * (1.5 - i * 0.3);
        const h = radio * 0.55;
        ctx.fillStyle = i % 2 === 0 ? primario : secundario;
        ctx.fillRect(-w / 2, -radio + i * h * 1.2, w, h);
      }
      ctx.fillStyle = acento;
      ctx.beginPath();
      ctx.arc(0, radio * 0.5, radio * 0.35 * (0.7 + vida * 0.3), 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case 'esfera': {
      const halo = ctx.createRadialGradient(0, 0, radio * 0.2, 0, 0, radio);
      halo.addColorStop(0, '#ffffff');
      halo.addColorStop(0.5, acento);
      halo.addColorStop(1, primario);
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(0, 0, radio, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = acento;
      ctx.lineWidth = 3;
      for (let i = 0; i < 8; i++) {
        const a = t * 0.6 + (i * Math.PI) / 4;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * radio, Math.sin(a) * radio);
        ctx.lineTo(Math.cos(a) * radio * 1.35, Math.sin(a) * radio * 1.35);
        ctx.stroke();
      }
      break;
    }

    case 'mono':
      // El jefe sustituto: un mono en una nave. Es ridículo a propósito.
      ctx.fillStyle = secundario;
      ctx.beginPath();
      ctx.ellipse(0, radio * 0.3, radio, radio * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = primario;
      ctx.beginPath();
      ctx.arc(0, -radio * 0.25, radio * 0.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffe0b2';
      ctx.beginPath();
      ctx.arc(0, -radio * 0.2, radio * 0.38, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#000';
      for (const lado of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(lado * radio * 0.15, -radio * 0.28, radio * 0.06, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = primario;
      for (const lado of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(lado * radio * 0.62, -radio * 0.3, radio * 0.2, 0, Math.PI * 2);
        ctx.fill();
      }
      break;

    default:
      ctx.fillStyle = primario;
      ctx.beginPath();
      ctx.arc(0, 0, radio, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = acento;
      estrella(ctx, 0, 0, radio * 0.5);
  }
}
