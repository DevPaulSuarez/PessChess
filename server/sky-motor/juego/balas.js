import { ANCHO, ALTO } from '../core/constantes.js';

/**
 * Un proyectil, sea de quien sea.
 *
 * Hay una sola clase para todos porque en un shmup lo que distingue a un
 * disparo no es su código sino sus números: a dónde va, cuánto duele y qué
 * hace al chocar. Meter una subclase por arma multiplicaría los ficheros sin
 * añadir ni una idea.
 */
export class Bala {
  constructor(opciones) {
    Object.assign(
      this,
      {
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        radio: 4,
        dano: 10,
        color: '#fff',
        forma: 'bala',
        equipo: 'jugador',
        duenno: 0,
        viva: true,
        t: 0,
        // Extras que solo usan algunas armas.
        guia: 0, // radianes por segundo que puede corregir el rumbo
        objetivo: null,
        penetra: false,
        rebotes: 0,
        amplitud: 0, // vaivén lateral
        frecuencia: 8,
        alcance: 0, // si es > 0, se apaga tras recorrer esa distancia
        recorrido: 0,
        esquirlas: 0,
        efecto: null,
        tocados: null, // a quién ya ha golpeado, para los que penetran
      },
      opciones,
    );
    this.xBase = this.x;
    if (this.penetra) this.tocados = new Set();
  }

  actualizar(dt, partida) {
    this.t += dt;

    if (this.guia > 0) this._perseguir(dt, partida);

    if (this.amplitud > 0) {
      // El vaivén se aplica sobre la trayectoria recta, no sobre la posición
      // anterior: así la bala serpentea pero no se desvía de su rumbo.
      this.xBase += this.vx * dt;
      this.y += this.vy * dt;
      this.x = this.xBase + Math.sin(this.t * this.frecuencia) * this.amplitud;
    } else {
      this.x += this.vx * dt;
      this.y += this.vy * dt;
    }

    this.recorrido += Math.hypot(this.vx, this.vy) * dt;
    if (this.alcance > 0 && this.recorrido > this.alcance) this.viva = false;

    if (this.rebotes > 0) {
      if (this.x < this.radio || this.x > ANCHO - this.radio) {
        this.vx *= -1;
        this.x = Math.max(this.radio, Math.min(ANCHO - this.radio, this.x));
        this.rebotes--;
      }
      if (this.y < this.radio) {
        this.vy *= -1;
        this.y = this.radio;
        this.rebotes--;
      }
    }

    const margen = 40;
    if (this.y < -margen || this.y > ALTO + margen || this.x < -margen || this.x > ANCHO + margen) {
      this.viva = false;
    }
  }

  _perseguir(dt, partida) {
    if (!this.objetivo?.viva) this.objetivo = partida.enemigoMasCercano(this.x, this.y);
    if (!this.objetivo) return;

    const deseado = Math.atan2(this.objetivo.y - this.y, this.objetivo.x - this.x);
    const actual = Math.atan2(this.vy, this.vx);
    // Diferencia de ángulos normalizada a [-π, π]: sin esto un misil daría la
    // vuelta por el lado largo al cruzar el eje.
    let giro = ((deseado - actual + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    giro = Math.max(-this.guia * dt, Math.min(this.guia * dt, giro));

    const velocidad = Math.hypot(this.vx, this.vy);
    this.vx = Math.cos(actual + giro) * velocidad;
    this.vy = Math.sin(actual + giro) * velocidad;
  }

  dibujar(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.fillStyle = this.color;

    switch (this.forma) {
      case 'misil':
        ctx.rotate(Math.atan2(this.vy, this.vx) + Math.PI / 2);
        ctx.fillRect(-2, -7, 4, 12);
        ctx.fillStyle = 'rgba(255,220,120,.85)';
        ctx.fillRect(-1.5, 5, 3, 5 + Math.random() * 4);
        break;

      case 'lanza':
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 10;
        ctx.fillRect(-this.radio / 2, -16, this.radio, 32);
        break;

      case 'rayo':
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 14;
        ctx.fillRect(-this.radio / 2, -24, this.radio, 48);
        ctx.fillStyle = '#fff';
        ctx.fillRect(-this.radio / 6, -24, this.radio / 3, 48);
        break;

      case 'plasma': {
        const halo = ctx.createRadialGradient(0, 0, 0, 0, 0, this.radio * 1.6);
        halo.addColorStop(0, '#ffffff');
        halo.addColorStop(0.4, this.color);
        halo.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(0, 0, this.radio * 1.6, 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      case 'disco':
        ctx.rotate(this.t * 14);
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, this.radio, 0, Math.PI * 1.6);
        ctx.stroke();
        break;

      case 'pluma':
        ctx.rotate(Math.atan2(this.vy, this.vx) + Math.PI / 2);
        ctx.beginPath();
        ctx.moveTo(0, -this.radio * 1.8);
        ctx.lineTo(this.radio, this.radio);
        ctx.lineTo(0, this.radio * 0.4);
        ctx.lineTo(-this.radio, this.radio);
        ctx.closePath();
        ctx.fill();
        break;

      case 'esfera':
      default:
        ctx.beginPath();
        ctx.arc(0, 0, this.radio, 0, Math.PI * 2);
        ctx.fill();
        if (this.equipo === 'enemigo') {
          // Núcleo claro: las balas enemigas tienen que leerse sobre cualquier
          // fondo, y en este juego los fondos son muy oscuros y muy claros.
          ctx.fillStyle = 'rgba(255,255,255,.9)';
          ctx.beginPath();
          ctx.arc(0, 0, this.radio * 0.45, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
    }

    ctx.restore();
  }
}

/** Bala enemiga genérica, apuntada hacia donde se le diga. */
export function balaEnemiga(x, y, angulo, velocidad, opciones = {}) {
  return new Bala({
    x,
    y,
    vx: Math.cos(angulo) * velocidad,
    vy: Math.sin(angulo) * velocidad,
    equipo: 'enemigo',
    radio: opciones.radio ?? 5,
    color: opciones.color ?? '#ff7043',
    forma: opciones.forma ?? 'esfera',
    dano: 1,
    ...opciones,
  });
}
