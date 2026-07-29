/**
 * Sonido sintetizado en el momento: ni un fichero de audio.
 *
 * Un shmup sin sonido está muerto, pero un shmup con veinte megas de MP3 tarda
 * en cargar. Todo sale de osciladores: los efectos son envolventes cortas y la
 * música es un patrón de dieciséis pasos que se programa por delante del reloj
 * de audio, que es la única forma de que no se oigan tirones.
 */

const ESCALA_MENOR = [0, 2, 3, 5, 7, 8, 10, 12]; // la escala de todo el juego

export class Audio {
  constructor() {
    this.ctx = null;
    this.efectos = true;
    this.musica = true;
    this.volumen = 0.5;
    this._siguientePaso = 0;
    this._paso = 0;
    this._tempo = 132;
    this._patron = null;
  }

  /**
   * Los navegadores no dejan sonar nada hasta que el usuario toca algo, así que
   * esto se llama en la primera pulsación real.
   */
  despertar() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const Contexto = window.AudioContext ?? window.webkitAudioContext;
    if (!Contexto) return;

    this.ctx = new Contexto();
    this.maestro = this.ctx.createGain();
    this.maestro.gain.value = this.volumen;
    this.maestro.connect(this.ctx.destination);
  }

  _tono(frecuencia, duracion, opciones = {}) {
    if (!this.ctx || !this.efectos) return;
    const { forma = 'square', volumen = 0.2, desde = 0, hasta = null, salida = null } = opciones;

    const t = this.ctx.currentTime + desde;
    const osc = this.ctx.createOscillator();
    const gan = this.ctx.createGain();

    osc.type = forma;
    osc.frequency.setValueAtTime(frecuencia, t);
    if (hasta !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(20, hasta), t + duracion);

    gan.gain.setValueAtTime(volumen, t);
    gan.gain.exponentialRampToValueAtTime(0.0001, t + duracion);

    osc.connect(gan).connect(salida ?? this.maestro);
    osc.start(t);
    osc.stop(t + duracion + 0.02);
  }

  /** Ruido blanco con envolvente: la base de cualquier explosión. */
  _ruido(duracion, opciones = {}) {
    if (!this.ctx || !this.efectos) return;
    const { volumen = 0.3, corte = 1200, desde = 0 } = opciones;

    const t = this.ctx.currentTime + desde;
    const muestras = Math.floor(this.ctx.sampleRate * duracion);
    const buffer = this.ctx.createBuffer(1, muestras, this.ctx.sampleRate);
    const datos = buffer.getChannelData(0);
    for (let i = 0; i < muestras; i++) datos[i] = Math.random() * 2 - 1;

    const fuente = this.ctx.createBufferSource();
    fuente.buffer = buffer;

    const filtro = this.ctx.createBiquadFilter();
    filtro.type = 'lowpass';
    filtro.frequency.setValueAtTime(corte, t);
    filtro.frequency.exponentialRampToValueAtTime(120, t + duracion);

    const gan = this.ctx.createGain();
    gan.gain.setValueAtTime(volumen, t);
    gan.gain.exponentialRampToValueAtTime(0.0001, t + duracion);

    fuente.connect(filtro).connect(gan).connect(this.maestro);
    fuente.start(t);
  }

  disparo(tono = 1) {
    this._tono(760 * tono, 0.06, { forma: 'square', volumen: 0.055, hasta: 320 * tono });
  }

  impacto() {
    this._ruido(0.06, { volumen: 0.1, corte: 2600 });
  }

  explosion(tamano = 1) {
    this._ruido(0.28 * tamano, { volumen: 0.28, corte: 900 * tamano });
    this._tono(120 / tamano, 0.3 * tamano, { forma: 'triangle', volumen: 0.18, hasta: 40 });
  }

  bomba() {
    this._ruido(0.9, { volumen: 0.35, corte: 2400 });
    this._tono(70, 0.9, { forma: 'sawtooth', volumen: 0.22, hasta: 25 });
  }

  powerUp() {
    [0, 4, 7, 12].forEach((semitono, i) => {
      this._tono(392 * 2 ** (semitono / 12), 0.1, { volumen: 0.14, desde: i * 0.045 });
    });
  }

  aviso() {
    this._tono(880, 0.12, { volumen: 0.16 });
    this._tono(1320, 0.12, { volumen: 0.14, desde: 0.12 });
  }

  muerte() {
    this._tono(420, 0.6, { forma: 'sawtooth', volumen: 0.22, hasta: 60 });
    this._ruido(0.5, { volumen: 0.2, corte: 700 });
  }

  /**
   * El motivo del país, que suena al soltar su bomba.
   *
   * Cada país tiene su melodía sacada de su propio nombre: no es azar, siempre
   * suena igual para el mismo país, y así una bomba mexicana no se confunde con
   * una china aunque no se mire la pantalla.
   */
  leitmotiv(pais) {
    let semilla = 0;
    for (const letra of pais.id) semilla = (semilla * 31 + letra.charCodeAt(0)) >>> 0;

    for (let i = 0; i < 5; i++) {
      const grado = ESCALA_MENOR[(semilla >> (i * 3)) % ESCALA_MENOR.length];
      this._tono(330 * 2 ** (grado / 12), 0.16, {
        forma: 'triangle',
        volumen: 0.2,
        desde: i * 0.09,
      });
    }
  }

  // -------------------------------------------------------------------------
  // Música
  // -------------------------------------------------------------------------

  ponerMusica(patron) {
    this._patron = patron;
    this._paso = 0;
    this._siguientePaso = this.ctx ? this.ctx.currentTime : 0;
    this._tempo = patron?.tempo ?? 132;
  }

  pararMusica() {
    this._patron = null;
  }

  /**
   * Programa por delante los pasos que caen en el próximo cuarto de segundo.
   *
   * Se llama en cada fotograma. Programar con antelación es lo que hace que la
   * música no se entrecorte cuando el juego se atasca dibujando.
   */
  actualizarMusica() {
    if (!this.ctx || !this.musica || !this._patron) return;

    const duracionPaso = 60 / this._tempo / 4;
    while (this._siguientePaso < this.ctx.currentTime + 0.25) {
      const paso = this._paso % 16;
      const desde = Math.max(0, this._siguientePaso - this.ctx.currentTime);

      const bajo = this._patron.bajo[paso % this._patron.bajo.length];
      if (bajo !== null) {
        this._tono(65.4 * 2 ** (bajo / 12), duracionPaso * 1.6, {
          forma: 'sawtooth',
          volumen: 0.09,
          desde,
        });
      }

      const arpa = this._patron.arpa[paso % this._patron.arpa.length];
      if (arpa !== null) {
        this._tono(523 * 2 ** (arpa / 12), duracionPaso * 0.8, {
          forma: 'square',
          volumen: 0.035,
          desde,
        });
      }

      if (paso % 4 === 0) this._ruido(0.05, { volumen: 0.08, corte: 4000, desde });

      this._siguientePaso += duracionPaso;
      this._paso++;
    }
  }
}
