import { ANCHO, ALTO, RADIO_JUGADOR, NIVEL_MAX, BOMBAS_MAX, VELOCIDAD_EXTRA_MAX } from '../core/constantes.js';
import { dibujarNave } from '../core/pintor.js';
import { dibujarPersonalizada } from '../sistemas/naves-custom.js';
import { dispararArma } from './armas.js';

/** Colores del casco de cada jugador, para distinguirlos de un vistazo. */
export const COLORES_JUGADOR = ['#4fc3f7', '#ff8a65', '#aed581', '#ce93d8'];

export class Jugador {
  constructor({ indice, fuente, pais, nave, ranura }) {
    this.indice = indice;
    this.fuente = fuente;
    this.pais = pais;
    this.nave = nave;
    this.ranura = ranura; // dónde busca su dibujo personalizado

    this.x = ANCHO / 2 + (indice - 1.5) * 52;
    this.y = ALTO - 90;
    this.radio = RADIO_JUGADOR;

    this.nivel = 1;
    this.bombas = nave.bombas;
    this.velocidadExtra = 0;

    this.vivo = true;
    this.invulnerable = 2.5; // al empezar, para no morir en la cuenta atrás
    this.esperandoRevivir = 0;

    this.cadencia = 0;
    this.inclinacion = 0;
    this.t = 0;
    this.disparando = false;
    this.bajas = 0;
  }

  get color() {
    return COLORES_JUGADOR[this.indice % COLORES_JUGADOR.length];
  }

  get velocidad() {
    return (150 + this.nave.velocidad * 22) * (1 + this.velocidadExtra);
  }

  actualizar(dt, partida, entrada) {
    this.t += dt;

    if (!this.vivo) {
      this.esperandoRevivir -= dt;
      if (this.esperandoRevivir <= 0 && partida.vidas > 0) this._revivir();
      return;
    }

    this.invulnerable = Math.max(0, this.invulnerable - dt);

    const mando = entrada.estado(this.fuente);
    const largo = Math.hypot(mando.x, mando.y) || 1;
    // Normalizar la diagonal: sin esto, moverse en diagonal sería un 41% más
    // rápido que moverse recto, y todo el mundo jugaría en diagonal.
    const factor = Math.min(1, largo);

    this.x += (mando.x / largo) * factor * this.velocidad * dt;
    this.y += (mando.y / largo) * factor * this.velocidad * dt;

    this.x = Math.max(14, Math.min(ANCHO - 14, this.x));
    this.y = Math.max(24, Math.min(ALTO - 20, this.y));

    // El alabeo persigue a la dirección en vez de saltar: se nota mucho en el
    // tacto aunque el jugador no sepa decir por qué.
    this.inclinacion += (Math.sign(mando.x) - this.inclinacion) * Math.min(1, dt * 9);

    this.disparando = Boolean(mando.disparo);
    this.cadencia -= dt;
    if (this.disparando && this.cadencia <= 0) {
      this.cadencia = this.pais.arma.cadencia;
      partida.balasJugador.push(...dispararArma(this));
      partida.audio.disparo(1 + this.indice * 0.06);
    }

    if (entrada.pulsado(this.fuente, 'bomba')) partida.lanzarBomba(this);
    if (entrada.pulsado(this.fuente, 'donar')) partida.donarVida(this);
  }

  _revivir() {
    this.vivo = true;
    this.x = ANCHO / 2 + (this.indice - 1.5) * 52;
    this.y = ALTO - 60;
    this.invulnerable = 2.5;
  }

  /**
   * Le han dado. Devuelve true si ha muerto de verdad.
   *
   * Perder una vida solo baja un nivel de potencia, no lo quita todo: el
   * original castigaba tanto morir que la partida se volvía imposible de
   * remontar, y en cooperativo eso arruina la tarde de quien va peor.
   */
  golpear(partida) {
    if (!this.vivo || this.invulnerable > 0) return false;

    this.vivo = false;
    this.esperandoRevivir = 1.4;
    this.nivel = Math.max(1, this.nivel - 1);
    partida.efectos.explosion(this.x, this.y, { tamano: 1.6, color: this.color });
    partida.audio.muerte();
    return true;
  }

  recoger(tipo, partida) {
    switch (tipo) {
      case 'P':
        this.nivel = Math.min(NIVEL_MAX, this.nivel + 1);
        partida.efectos.rotulo(this.x, this.y - 20, `POTENCIA ${this.nivel}`, { color: '#ffd54f' });
        break;
      case 'F':
        this.nivel = NIVEL_MAX;
        partida.efectos.rotulo(this.x, this.y - 20, '¡POTENCIA MÁXIMA!', { color: '#ffd54f' });
        break;
      case 'B':
        this.bombas = Math.min(BOMBAS_MAX, this.bombas + 1);
        partida.efectos.rotulo(this.x, this.y - 20, 'BOMBA', { color: '#4fc3f7' });
        break;
      case 'S':
        this.velocidadExtra = Math.min(VELOCIDAD_EXTRA_MAX, this.velocidadExtra + 0.1);
        partida.efectos.rotulo(this.x, this.y - 20, 'VELOCIDAD', { color: '#aed581' });
        break;
      default:
        break;
    }
  }

  dibujar(ctx) {
    if (!this.vivo) return;
    // Parpadeo mientras es invulnerable: se ve que está protegido, y se ve
    // también que eso se acaba.
    if (this.invulnerable > 0 && Math.floor(this.t * 14) % 2 === 0) return;

    ctx.save();
    ctx.translate(this.x, this.y);

    const animacion = this.inclinacion < -0.4 ? 'left' : this.inclinacion > 0.4 ? 'right' : 'idle';
    const propia = dibujarPersonalizada(ctx, this.ranura, {
      escala: 38,
      animacion,
      t: this.t,
      tinte: this.pais.colores[0],
    });

    if (!propia) {
      dibujarNave(ctx, this.nave.silueta, this.pais.colores, {
        escala: 34,
        inclinacion: this.inclinacion,
        t: this.t,
      });
    }

    ctx.restore();

    // Marca del jugador y punto de choque: en cuatro jugadores es la única
    // forma de saber cuál eres cuando la pantalla se llena.
    ctx.fillStyle = this.color;
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.arc(this.x, this.y, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}
