import { ALTO } from '../core/constantes.js';
import { texto } from '../core/pintor.js';

/** Qué hace cada letra, y de qué color se pinta. */
export const TIPOS_POWERUP = {
  P: { color: '#ffd54f', nombre: 'Potencia' },
  F: { color: '#ff8a65', nombre: 'Potencia máxima' },
  B: { color: '#4fc3f7', nombre: 'Bomba' },
  S: { color: '#aed581', nombre: 'Velocidad' },
  M: { color: '#ce93d8', nombre: 'Moneda' },
  H: { color: '#ef5350', nombre: 'Vida' },
  I: { color: '#ffd700', nombre: 'Insignia del país' },
};

export class PowerUp {
  constructor(x, y, tipo) {
    this.x = x;
    this.y = y;
    this.tipo = tipo;
    this.radio = 11;
    this.vy = 55;
    this.t = 0;
    this.viva = true;
  }

  actualizar(dt) {
    this.t += dt;
    this.y += this.vy * dt;
    this.x += Math.sin(this.t * 3) * 26 * dt;
    if (this.y > ALTO + 20) this.viva = false;
  }

  dibujar(ctx) {
    const { color } = TIPOS_POWERUP[this.tipo] ?? TIPOS_POWERUP.P;
    const pulso = 1 + Math.sin(this.t * 7) * 0.08;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.scale(pulso, pulso);

    ctx.shadowColor = color;
    ctx.shadowBlur = 12;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(-this.radio, -this.radio, this.radio * 2, this.radio * 2, 4);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.fillStyle = 'rgba(0,0,0,.75)';
    ctx.beginPath();
    ctx.roundRect(-this.radio + 2, -this.radio + 2, this.radio * 2 - 4, this.radio * 2 - 4, 3);
    ctx.fill();

    texto(ctx, this.tipo, 0, 5, { tam: 14, color, alineado: 'center', sombra: false });
    ctx.restore();
  }
}

/**
 * Qué suelta un enemigo al morir.
 *
 * La vida solo cae cuando el equipo va mal: es una red de seguridad para que
 * una partida mal empezada no sea una condena, sin regalar nada a quien va
 * sobrado.
 */
export function sorteoDePowerUp(enemigo, partida) {
  if (enemigo.sueltaPowerUp) return enemigo.sueltaPowerUp;

  const suerte = Math.random();
  if (suerte < 0.06) return 'P';
  if (suerte < 0.08) return 'B';
  if (suerte < 0.095) return 'S';
  if (suerte < 0.105 && partida.vidas < partida.vidasIniciales / 2) return 'H';
  if (suerte < 0.16) return 'M';
  return null;
}
