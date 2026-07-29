import { ANCHO, ALTO } from '../core/constantes.js';

/**
 * Los fondos, generados sobre la marcha.
 *
 * Tres capas que bajan a distintas velocidades bastan para dar profundidad: lo
 * lejano casi no se mueve y lo cercano vuela. Cuando un elemento sale por abajo
 * vuelve a entrar por arriba con otra posición, así que el escenario nunca se
 * repite de forma reconocible y no ocupa memoria.
 */

const PALETAS = {
  ciudad: {
    cielo: ['#3e1f16', '#7c3b1e', '#c96a2b'], // amanecer con humo
    lejano: '#2b1a17',
    medio: '#3d2621',
    cercano: '#1a0f0d',
    brillo: '#ffb74d',
  },
  selva: {
    cielo: ['#052e16', '#0f4d2a', '#1b7a44'],
    lejano: '#08301c',
    medio: '#0d4526',
    cercano: '#041c11',
    brillo: '#a5d6a7',
  },
  glaciar: {
    cielo: ['#0b2a3d', '#14506e', '#3f8fb0'],
    lejano: '#1d5a76',
    medio: '#2b7492',
    cercano: '#0a1f2c',
    brillo: '#e1f5fe',
  },
};

export class Fondo {
  constructor(tipo) {
    this.tipo = tipo;
    this.paleta = PALETAS[tipo] ?? PALETAS.ciudad;
    this.t = 0;
    this.desplazamiento = 0;

    this.capas = [
      { velocidad: 22, elementos: this._generar(9, 'lejano') },
      { velocidad: 60, elementos: this._generar(7, 'medio') },
      { velocidad: 150, elementos: this._generar(14, 'cercano') },
    ];

    // Motas: nieve en el glaciar, brasas en la ciudad, polen en la selva.
    this.motas = Array.from({ length: 60 }, () => ({
      x: Math.random() * ANCHO,
      y: Math.random() * ALTO,
      v: 40 + Math.random() * 160,
      r: Math.random() * 1.8 + 0.6,
    }));
  }

  _generar(cuantos, capa) {
    return Array.from({ length: cuantos }, () => this._nuevoElemento(capa, Math.random() * ALTO));
  }

  _nuevoElemento(capa, y = -80) {
    const grande = capa === 'lejano';
    return {
      capa,
      x: Math.random() * ANCHO,
      y,
      w: (grande ? 50 : 26) + Math.random() * (grande ? 70 : 60),
      h: (grande ? 80 : 34) + Math.random() * (grande ? 130 : 90),
      variante: Math.random(),
    };
  }

  actualizar(dt, factor = 1) {
    this.t += dt;
    this.desplazamiento += dt * 60 * factor;

    for (const capa of this.capas) {
      for (const el of capa.elementos) {
        el.y += capa.velocidad * factor * dt;
        if (el.y - el.h > ALTO) Object.assign(el, this._nuevoElemento(el.capa, -el.h - 20));
      }
    }

    for (const mota of this.motas) {
      mota.y += mota.v * factor * dt;
      mota.x += Math.sin(this.t + mota.y * 0.01) * 12 * dt;
      if (mota.y > ALTO) {
        mota.y = -4;
        mota.x = Math.random() * ANCHO;
      }
    }
  }

  dibujar(ctx) {
    const p = this.paleta;

    const cielo = ctx.createLinearGradient(0, 0, 0, ALTO);
    cielo.addColorStop(0, p.cielo[0]);
    cielo.addColorStop(0.55, p.cielo[1]);
    cielo.addColorStop(1, p.cielo[2]);
    ctx.fillStyle = cielo;
    ctx.fillRect(0, 0, ANCHO, ALTO);

    if (this.tipo === 'selva') this._dibujarRio(ctx);

    for (const capa of this.capas) {
      for (const el of capa.elementos) this._dibujarElemento(ctx, el);
    }

    ctx.fillStyle = 'rgba(255,255,255,.5)';
    for (const mota of this.motas) {
      ctx.globalAlpha = 0.15 + mota.r * 0.25;
      ctx.fillRect(mota.x, mota.y, mota.r, mota.r * 2);
    }
    ctx.globalAlpha = 1;

    // Viñeta: oscurece los bordes para que las balas se lean en el centro.
    const viñeta = ctx.createRadialGradient(ANCHO / 2, ALTO / 2, ALTO * 0.3, ANCHO / 2, ALTO / 2, ALTO * 0.8);
    viñeta.addColorStop(0, 'rgba(0,0,0,0)');
    viñeta.addColorStop(1, 'rgba(0,0,0,.55)');
    ctx.fillStyle = viñeta;
    ctx.fillRect(0, 0, ANCHO, ALTO);
  }

  _dibujarRio(ctx) {
    // Una cinta oscura que serpentea: es "la zona del río" de la insignia.
    ctx.fillStyle = 'rgba(20,60,90,.75)';
    ctx.beginPath();
    ctx.moveTo(ANCHO * 0.3, 0);
    for (let y = 0; y <= ALTO; y += 40) {
      ctx.lineTo(ANCHO * 0.3 + Math.sin((y + this.desplazamiento) * 0.008) * 60, y);
    }
    for (let y = ALTO; y >= 0; y -= 40) {
      ctx.lineTo(ANCHO * 0.55 + Math.sin((y + this.desplazamiento) * 0.008) * 60, y);
    }
    ctx.closePath();
    ctx.fill();
  }

  _dibujarElemento(ctx, el) {
    const p = this.paleta;
    ctx.fillStyle = p[el.capa];

    switch (this.tipo) {
      case 'ciudad':
        ctx.fillRect(el.x, el.y, el.w, el.h);
        // Ventanas encendidas: lo único con color en una ciudad apagada.
        if (el.capa !== 'cercano') {
          ctx.fillStyle = 'rgba(255,183,77,.35)';
          for (let f = 0; f < Math.floor(el.h / 18); f++) {
            for (let c = 0; c < Math.floor(el.w / 16); c++) {
              if ((f * 7 + c * 3 + Math.floor(el.variante * 10)) % 4 !== 0) continue;
              ctx.fillRect(el.x + 5 + c * 16, el.y + 6 + f * 18, 6, 8);
            }
          }
        }
        break;

      case 'selva':
        // Copas de árbol: tres círculos que se solapan.
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.arc(el.x + el.w * (0.25 + i * 0.25), el.y + el.h * 0.5, el.w * 0.3, 0, Math.PI * 2);
          ctx.fill();
        }
        break;

      case 'glaciar':
        ctx.beginPath();
        ctx.moveTo(el.x, el.y + el.h);
        ctx.lineTo(el.x + el.w * 0.5, el.y);
        ctx.lineTo(el.x + el.w, el.y + el.h * 0.8);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.18)';
        ctx.beginPath();
        ctx.moveTo(el.x + el.w * 0.5, el.y);
        ctx.lineTo(el.x + el.w * 0.7, el.y + el.h * 0.6);
        ctx.lineTo(el.x + el.w * 0.35, el.y + el.h * 0.7);
        ctx.closePath();
        ctx.fill();
        break;

      default:
        ctx.fillRect(el.x, el.y, el.w, el.h);
    }
  }
}
