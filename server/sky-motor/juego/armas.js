import { Bala } from './balas.js';

/**
 * Cómo dispara cada tipo de arma.
 *
 * Un país no trae código: trae el *tipo* de su arma y sus números. Estas diez
 * funciones cubren las veintiuna armas del diseño, y las diferencias entre dos
 * países que comparten tipo (color, cadencia, daño, alcance) bastan para que en
 * las manos se noten distintas.
 *
 * Todas reciben el jugador y devuelven la lista de balas que salen del morro.
 */

/** Cuántos cañones escupe cada nivel de potencia. */
const CANONES = { 1: 2, 2: 3, 3: 4, 4: 6 };

/** El daño sube con el nivel y con la estadística de poder de la nave. */
function dano(jugador, base) {
  const porNivel = 1 + (jugador.nivel - 1) * 0.18;
  const porNave = 0.85 + jugador.nave.poder * 0.05;
  return base * porNivel * porNave;
}

const TIPOS = {
  /** Lo clásico: cañones paralelos hacia arriba. */
  recto(j, arma) {
    const n = CANONES[j.nivel];
    return Array.from({ length: n }, (_, i) => {
      const separacion = (i - (n - 1) / 2) * 9;
      return new Bala({
        x: j.x + separacion,
        y: j.y - 14,
        vx: 0,
        vy: -620,
        radio: 3.5,
        color: arma.color,
        forma: 'esfera',
        dano: dano(j, arma.dano),
        duenno: j.indice,
        efecto: arma.efecto ?? null,
      });
    });
  },

  /** Abanico: cubre mucho ancho, pero reparte el daño. */
  abanico(j, arma) {
    const n = 1 + j.nivel * 2;
    const apertura = arma.apertura ?? 0.4;
    return Array.from({ length: n }, (_, i) => {
      const angulo = -Math.PI / 2 + (i - (n - 1) / 2) * (apertura / n) * 2;
      return new Bala({
        x: j.x,
        y: j.y - 12,
        vx: Math.cos(angulo) * 540,
        vy: Math.sin(angulo) * 540,
        radio: 3.5,
        color: arma.color,
        dano: dano(j, arma.dano),
        duenno: j.indice,
      });
    });
  },

  /** Misiles que buscan solos: poco daño por unidad, pero no fallan. */
  guiado(j, arma) {
    const n = Math.min(4, 1 + Math.floor(j.nivel / 1.2));
    return Array.from({ length: n }, (_, i) => {
      const lado = i % 2 === 0 ? -1 : 1;
      return new Bala({
        x: j.x + lado * (10 + Math.floor(i / 2) * 8),
        y: j.y,
        vx: lado * 90,
        vy: -400,
        radio: 4,
        color: arma.color,
        forma: 'misil',
        guia: arma.giro ?? 5.5,
        dano: dano(j, arma.dano),
        duenno: j.indice,
      });
    });
  },

  /** Bola gorda y lenta que se apaga a media pantalla. */
  plasma(j, arma) {
    const balas = [
      new Bala({
        x: j.x,
        y: j.y - 12,
        vx: 0,
        vy: -430,
        radio: 6 + j.nivel * 1.6,
        color: arma.color,
        forma: 'plasma',
        alcance: arma.alcance ?? 260,
        dano: dano(j, arma.dano),
        duenno: j.indice,
        penetra: true, // atraviesa la fila entera mientras le quede alcance
      }),
    ];
    if (j.nivel >= 3) {
      for (const lado of [-1, 1]) {
        balas.push(
          new Bala({
            x: j.x + lado * 16,
            y: j.y - 4,
            vx: lado * 70,
            vy: -420,
            radio: 4 + j.nivel,
            color: arma.color,
            forma: 'plasma',
            alcance: (arma.alcance ?? 260) * 0.8,
            dano: dano(j, arma.dano) * 0.5,
            duenno: j.indice,
            penetra: true,
          }),
        );
      }
    }
    return balas;
  },

  /** Lanza que atraviesa todo lo que se le ponga delante. */
  penetrante(j, arma) {
    const n = j.nivel >= 3 ? 2 : 1;
    return Array.from({ length: n }, (_, i) => {
      const separacion = (i - (n - 1) / 2) * 18;
      return new Bala({
        x: j.x + separacion,
        y: j.y - 18,
        vx: 0,
        vy: -780,
        radio: 5 + j.nivel,
        color: arma.color,
        forma: 'lanza',
        penetra: true,
        dano: dano(j, arma.dano),
        duenno: j.indice,
        efecto: arma.efecto ?? null,
      });
    });
  },

  /**
   * Rayo continuo.
   *
   * No es un haz de verdad sino balas muy seguidas y muy rápidas que atraviesan:
   * se ve igual, se siente igual y no obliga a inventar un tipo de colisión
   * aparte para una sola arma.
   */
  rayo(j, arma) {
    const n = j.nivel >= 4 ? 2 : 1;
    return Array.from({ length: n }, (_, i) => {
      const separacion = (i - (n - 1) / 2) * 14;
      return new Bala({
        x: j.x + separacion,
        y: j.y - 20,
        vx: 0,
        vy: -1100,
        radio: 4 + j.nivel * 0.8,
        color: arma.color,
        forma: 'rayo',
        penetra: true,
        dano: dano(j, arma.dano),
        duenno: j.indice,
      });
    });
  },

  /** Discos que rebotan en las paredes: castigan a quien se pega a los bordes. */
  rebote(j, arma) {
    const n = Math.min(3, j.nivel);
    return Array.from({ length: n }, (_, i) => {
      const angulo = -Math.PI / 2 + (i - (n - 1) / 2) * 0.55;
      return new Bala({
        x: j.x,
        y: j.y - 12,
        vx: Math.cos(angulo) * 480,
        vy: Math.sin(angulo) * 480,
        radio: 7,
        color: arma.color,
        forma: 'disco',
        rebotes: 3,
        dano: dano(j, arma.dano),
        duenno: j.indice,
      });
    });
  },

  /** Dos balas que bailan en sentidos opuestos. */
  onda(j, arma) {
    const n = CANONES[j.nivel];
    return Array.from({ length: n }, (_, i) => {
      const fase = i % 2 === 0 ? 1 : -1;
      return new Bala({
        x: j.x + (i - (n - 1) / 2) * 6,
        y: j.y - 12,
        vx: 0,
        vy: -560,
        radio: 4,
        color: arma.color,
        dano: dano(j, arma.dano),
        duenno: j.indice,
        amplitud: (arma.amplitud ?? 34) * fase,
        frecuencia: 9,
        efecto: arma.efecto ?? null,
      });
    });
  },

  /** Muchos cohetes pequeños, sin puntería fina. */
  enjambre(j, arma) {
    const n = 2 + j.nivel;
    const dispersion = arma.dispersion ?? 0.25;
    return Array.from({ length: n }, () => {
      const angulo = -Math.PI / 2 + (Math.random() - 0.5) * dispersion * 2;
      return new Bala({
        x: j.x + (Math.random() - 0.5) * 18,
        y: j.y - 10,
        vx: Math.cos(angulo) * 620,
        vy: Math.sin(angulo) * 620,
        radio: 3,
        color: arma.color,
        forma: 'misil',
        dano: dano(j, arma.dano),
        duenno: j.indice,
      });
    });
  },

  /** Torpedo que al reventar suelta esquirlas en todas direcciones. */
  fragmenta(j, arma) {
    return [
      new Bala({
        x: j.x,
        y: j.y - 14,
        vx: 0,
        vy: -500,
        radio: 6,
        color: arma.color,
        forma: 'misil',
        dano: dano(j, arma.dano),
        duenno: j.indice,
        esquirlas: (arma.esquirlas ?? 6) + j.nivel,
      }),
    ];
  },
};

export function dispararArma(jugador) {
  const arma = jugador.pais.arma;
  const generar = TIPOS[arma.tipo] ?? TIPOS.recto;
  const balas = generar(jugador, arma);

  // Cada tipo de disparo trae su forma, que es la que le pega. Pero si el país
  // pide una en concreto —se hace desde el editor—, manda esa: es lo que
  // permite que dos países con el mismo tipo de arma se distingan en el aire.
  if (arma.forma) {
    for (const bala of balas) bala.forma = arma.forma;
  }
  return balas;
}

/** Las esquirlas que salen cuando revienta un proyectil de fragmentación. */
export function esquirlasDe(bala) {
  const total = bala.esquirlas;
  return Array.from({ length: total }, (_, i) => {
    const angulo = (i / total) * Math.PI * 2;
    return new Bala({
      x: bala.x,
      y: bala.y,
      vx: Math.cos(angulo) * 300,
      vy: Math.sin(angulo) * 300,
      radio: 3,
      color: bala.color,
      dano: bala.dano * 0.35,
      duenno: bala.duenno,
      alcance: 90,
    });
  });
}

export const TIPOS_DE_ARMA = Object.keys(TIPOS);
