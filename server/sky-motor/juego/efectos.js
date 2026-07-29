import { texto as pintarTexto } from '../core/pintor.js';

/**
 * Explosiones, chispas, rótulos y sacudidas de pantalla.
 *
 * Nada de esto afecta a la partida: si se borrase entero, el juego seguiría
 * funcionando igual. Pero es lo que separa "el enemigo desapareció" de "he
 * reventado al enemigo", así que tiene su sitio propio.
 */
export class Efectos {
  constructor() {
    this.particulas = [];
    this.rotulos = [];
    this.ondas = [];
    this.sacudida = 0;
    this.destello = 0;
  }

  explosion(x, y, opciones = {}) {
    const { tamano = 1, color = '#ffb74d' } = opciones;
    const cuantas = Math.round(10 * tamano);

    for (let i = 0; i < cuantas; i++) {
      const angulo = Math.random() * Math.PI * 2;
      const velocidad = (40 + Math.random() * 150) * tamano;
      this.particulas.push({
        x,
        y,
        vx: Math.cos(angulo) * velocidad,
        vy: Math.sin(angulo) * velocidad,
        radio: (2 + Math.random() * 3) * tamano,
        vida: 0.3 + Math.random() * 0.4 * tamano,
        edad: 0,
        color: Math.random() < 0.4 ? '#ffffff' : color,
      });
    }
    this.ondas.push({ x, y, radio: 4 * tamano, radioMax: 40 * tamano, edad: 0, vida: 0.35, color });
    this.sacudir(2.5 * tamano);
  }

  chispa(x, y, color) {
    for (let i = 0; i < 3; i++) {
      const angulo = Math.random() * Math.PI * 2;
      this.particulas.push({
        x,
        y,
        vx: Math.cos(angulo) * 90,
        vy: Math.sin(angulo) * 90,
        radio: 1.6,
        vida: 0.16,
        edad: 0,
        color,
      });
    }
  }

  rotulo(x, y, cadena, opciones = {}) {
    this.rotulos.push({
      x,
      y,
      cadena,
      color: opciones.color ?? '#ffe082',
      tam: opciones.tam ?? 13,
      vida: opciones.vida ?? 1.1,
      edad: 0,
    });
  }

  /** Fogonazo blanco a pantalla completa, para las bombas. */
  fogonazo(intensidad = 1) {
    this.destello = Math.max(this.destello, intensidad);
  }

  sacudir(intensidad) {
    this.sacudida = Math.min(14, this.sacudida + intensidad);
  }

  actualizar(dt) {
    for (const p of this.particulas) {
      p.edad += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.94;
      p.vy *= 0.94;
    }
    this.particulas = this.particulas.filter((p) => p.edad < p.vida);

    for (const o of this.ondas) o.edad += dt;
    this.ondas = this.ondas.filter((o) => o.edad < o.vida);

    for (const r of this.rotulos) {
      r.edad += dt;
      r.y -= 26 * dt;
    }
    this.rotulos = this.rotulos.filter((r) => r.edad < r.vida);

    this.sacudida = Math.max(0, this.sacudida - dt * 34);
    this.destello = Math.max(0, this.destello - dt * 3.2);
  }

  /** Desplazamiento que hay que aplicar al mundo por la sacudida. */
  desplazamiento() {
    if (this.sacudida <= 0) return [0, 0];
    return [
      (Math.random() - 0.5) * this.sacudida,
      (Math.random() - 0.5) * this.sacudida,
    ];
  }

  dibujar(ctx) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    for (const o of this.ondas) {
      const avance = o.edad / o.vida;
      ctx.strokeStyle = o.color;
      ctx.globalAlpha = 1 - avance;
      ctx.lineWidth = 3 * (1 - avance) + 1;
      ctx.beginPath();
      ctx.arc(o.x, o.y, o.radio + (o.radioMax - o.radio) * avance, 0, Math.PI * 2);
      ctx.stroke();
    }

    for (const p of this.particulas) {
      ctx.globalAlpha = 1 - p.edad / p.vida;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radio * (1 - p.edad / p.vida), 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();

    for (const r of this.rotulos) {
      ctx.globalAlpha = 1 - (r.edad / r.vida) ** 2;
      pintarTexto(ctx, r.cadena, r.x, r.y, { tam: r.tam, color: r.color, alineado: 'center' });
    }
    ctx.globalAlpha = 1;
  }

  /** El fogonazo va por encima de todo, incluso del HUD. */
  dibujarDestello(ctx, ancho, alto) {
    if (this.destello <= 0) return;
    ctx.fillStyle = `rgba(255,255,255,${Math.min(0.85, this.destello * 0.6)})`;
    ctx.fillRect(0, 0, ancho, alto);
  }
}
