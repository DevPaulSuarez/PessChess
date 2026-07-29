/**
 * Mandos y teclado para hasta cuatro jugadores.
 *
 * Cada jugador se ata a una "fuente" (un teclado o un mando concreto). El resto
 * del juego nunca pregunta por teclas: pide el estado de una fuente y recibe
 * siempre la misma forma, venga de donde venga.
 */

const TECLADO_1 = {
  izquierda: 'ArrowLeft',
  derecha: 'ArrowRight',
  arriba: 'ArrowUp',
  abajo: 'ArrowDown',
  disparo: 'KeyZ',
  bomba: 'KeyX',
  donar: 'KeyC',
};

const TECLADO_2 = {
  izquierda: 'KeyA',
  derecha: 'KeyD',
  arriba: 'KeyW',
  abajo: 'KeyS',
  disparo: 'KeyN',
  bomba: 'KeyM',
  donar: 'KeyB',
};

/** Botones de mando, en la numeración estándar del navegador. */
const BOTON = { disparo: 0, bomba: 1, donar: 2, pausa: 9, atras: 8 };

const VACIO = {
  x: 0,
  y: 0,
  disparo: false,
  bomba: false,
  donar: false,
  pausa: false,
  atras: false,
};

export class Entrada {
  constructor() {
    this.teclas = new Set();
    /** Estado de cada fuente en este fotograma y en el anterior. */
    this.actual = new Map();
    this.previo = new Map();
    /** Se marca al pulsar cualquier cosa: los menús lo usan para "pulsa algo". */
    this.ultimaFuente = null;

    addEventListener('keydown', (e) => {
      // Las flechas y el espacio hacen scroll en la página si no se corta.
      if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
      this.teclas.add(e.code);
    });
    addEventListener('keyup', (e) => this.teclas.delete(e.code));
    // Al perder el foco se sueltan todas las teclas: si no, la nave se queda
    // pegada moviéndose al volver a la pestaña.
    addEventListener('blur', () => this.teclas.clear());
  }

  /** Fuentes conectadas ahora mismo, para el menú de jugadores. */
  fuentes() {
    const lista = [
      { id: 'teclado1', nombre: 'Teclado  ←↑→↓ · Z X' },
      { id: 'teclado2', nombre: 'Teclado  WASD · N M' },
    ];
    for (const mando of this._mandos()) {
      lista.push({ id: `mando${mando.index}`, nombre: `Mando ${mando.index + 1}` });
    }
    return lista;
  }

  _mandos() {
    if (!navigator.getGamepads) return [];
    return [...navigator.getGamepads()].filter(Boolean).slice(0, 4);
  }

  /**
   * Se llama una vez por fotograma, antes de leer nada.
   *
   * Los mandos no avisan de sus cambios: hay que preguntarles. Y para saber si
   * un botón *acaba* de pulsarse hace falta guardar el fotograma anterior.
   */
  nuevoFotograma() {
    this.previo = this.actual;
    this.actual = new Map();

    this.actual.set('teclado1', this._leerTeclado(TECLADO_1));
    this.actual.set('teclado2', this._leerTeclado(TECLADO_2));

    for (const mando of this._mandos()) {
      this.actual.set(`mando${mando.index}`, this._leerMando(mando));
    }

    for (const [id, estado] of this.actual) {
      if (estado.x || estado.y || estado.disparo || estado.bomba || estado.pausa) {
        this.ultimaFuente = id;
      }
    }
  }

  _leerTeclado(mapa) {
    const pulsada = (codigo) => (this.teclas.has(codigo) ? 1 : 0);
    return {
      x: pulsada(mapa.derecha) - pulsada(mapa.izquierda),
      y: pulsada(mapa.abajo) - pulsada(mapa.arriba),
      disparo: this.teclas.has(mapa.disparo) || this.teclas.has('Space'),
      bomba: this.teclas.has(mapa.bomba),
      donar: this.teclas.has(mapa.donar),
      pausa: this.teclas.has('Enter') || this.teclas.has('Escape'),
      atras: this.teclas.has('Escape') || this.teclas.has('Backspace'),
    };
  }

  _leerMando(mando) {
    // Zona muerta: los sticks analógicos nunca descansan exactamente en cero.
    const eje = (n) => (Math.abs(mando.axes[n] ?? 0) > 0.28 ? mando.axes[n] : 0);
    const boton = (n) => Boolean(mando.buttons[n]?.pressed);
    const cruceta = (n) => (boton(n) ? 1 : 0);

    return {
      x: eje(0) || cruceta(15) - cruceta(14),
      y: eje(1) || cruceta(13) - cruceta(12),
      disparo: boton(BOTON.disparo),
      bomba: boton(BOTON.bomba),
      donar: boton(BOTON.donar),
      pausa: boton(BOTON.pausa),
      atras: boton(BOTON.atras),
    };
  }

  /** Estado sostenido de una fuente. */
  estado(fuente) {
    return this.actual.get(fuente) ?? VACIO;
  }

  /** Si una acción *acaba* de pulsarse en esta fuente. */
  pulsado(fuente, accion) {
    return Boolean(this.estado(fuente)[accion]) && !(this.previo.get(fuente) ?? VACIO)[accion];
  }

  /** Lo mismo, pero valiendo cualquier fuente: para moverse por los menús. */
  pulsadoEnCualquiera(accion) {
    for (const id of this.actual.keys()) {
      if (this.pulsado(id, accion)) return id;
    }
    return null;
  }

  /**
   * Dirección recién marcada en cualquier fuente, para navegar menús.
   * Devuelve -1, 0 o 1 en el eje pedido.
   */
  direccionPulsada(ejeNombre) {
    for (const [id, estado] of this.actual) {
      const antes = this.previo.get(id) ?? VACIO;
      const ahora = Math.sign(estado[ejeNombre]);
      if (ahora !== 0 && Math.sign(antes[ejeNombre]) !== ahora) return ahora;
    }
    return 0;
  }
}
