import { ANCHO, ALTO } from '../core/constantes.js';
import { Jugador } from './jugador.js';
import { Enemigo } from './enemigos.js';
import { Jefe } from './jefe.js';
import { PowerUp, sorteoDePowerUp } from './powerups.js';
import { Efectos } from './efectos.js';
import { Fondo } from './fondos.js';
import { esquirlasDe } from './armas.js';
import { JEFE_SUSTITUTO } from '../datos/stages.js';
import { evaluarCondiciones, vidasDelEquipo, enemigosDeOleada } from '../sistemas/dificultad.js';
import { PUNTOS, puntuarStage } from '../sistemas/puntuacion.js';

/**
 * Una partida a un escenario: el árbitro de todo lo que pasa en pantalla.
 *
 * Sabe de reglas, no de dibujos ni de menús. Lleva el guion del escenario, las
 * colisiones, el bote de vidas compartido y —lo que de verdad importa— las tres
 * condiciones que deciden si el equipo se gana al jefe de verdad o le sale el
 * mono.
 */
export class Partida {
  constructor({ stage, configuraciones, audio }) {
    this.stage = stage;
    this.audio = audio;
    this.numJugadores = configuraciones.length;

    this.jugadores = configuraciones.map((config, indice) => new Jugador({ indice, ...config }));

    this.balasJugador = [];
    this.balasEnemigo = [];
    this.enemigos = [];
    this.powerups = [];
    this.bombas = [];
    this.escudos = [];
    this.jefe = null;

    this.efectos = new Efectos();
    this.fondo = new Fondo(stage.fondo);

    this.vidasIniciales = vidasDelEquipo(this.numJugadores);
    this.vidas = this.vidasIniciales;
    this.puntos = 0;

    this.tiempo = 0;
    this.estado = 'jugando'; // jugando | terminado | gameover
    this.resultado = null;

    // Guion
    this.paso = 0;
    this.esperaGuion = 0;
    this.bloqueado = null;

    // Contadores de las condiciones del escenario.
    this.generados = 0;
    this.destruidos = 0;
    this.vidasPerdidas = 0;
    this.insignia = false;
    this.jefeVerdadero = null;

    // Estado propio de cada insignia.
    this.campanasEnOrden = [];
    this.edificioDestruido = false;
    this.icebergsRotos = 0;
    this.silencio = 0;
    this.zona = null;

    this.anuncio = null;
    this.combinadoActivo = 0;
    this.ultimaBombaEn = new Map();
    this.viento = 0;
    this.vientoObjetivo = 0;
  }

  // -------------------------------------------------------------------------
  // Consultas que usan las entidades
  // -------------------------------------------------------------------------

  get jugadoresVivos() {
    return this.jugadores.filter((j) => j.vivo);
  }

  jugadorMasCercano(x, y) {
    let mejor = null;
    let mejorDistancia = Infinity;
    for (const jugador of this.jugadoresVivos) {
      const d = (jugador.x - x) ** 2 + (jugador.y - y) ** 2;
      if (d < mejorDistancia) {
        mejorDistancia = d;
        mejor = jugador;
      }
    }
    return mejor;
  }

  enemigoMasCercano(x, y) {
    let mejor = null;
    let mejorDistancia = Infinity;
    for (const enemigo of this.enemigos) {
      if (!enemigo.viva || enemigo.y < 0) continue;
      const d = (enemigo.x - x) ** 2 + (enemigo.y - y) ** 2;
      if (d < mejorDistancia) {
        mejorDistancia = d;
        mejor = enemigo;
      }
    }
    if (!mejor && this.jefe?.viva && !this.jefe.entrando) return this.jefe;
    return mejor;
  }

  sumarPuntos(n) {
    this.puntos += Math.round(n);
  }

  anunciar(texto, duracion = 2.4) {
    this.anuncio = { texto, restante: duracion, total: duracion };
  }

  // -------------------------------------------------------------------------
  // Bucle
  // -------------------------------------------------------------------------

  actualizar(dt, entrada) {
    if (this.estado !== 'jugando') return;

    this.tiempo += dt;
    this.combinadoActivo = Math.max(0, this.combinadoActivo - dt);

    this._avanzarGuion(dt);
    this._actualizarViento(dt);

    this.fondo.actualizar(dt, this.jefe && this.jefe.fase.movimiento === 'ascenso' ? 3 : 1);

    for (const jugador of this.jugadores) {
      jugador.actualizar(dt, this, entrada);
      if (jugador.vivo && this.viento) jugador.x = Math.max(14, Math.min(ANCHO - 14, jugador.x + this.viento * dt));
    }

    for (const bala of this.balasJugador) bala.actualizar(dt, this);
    for (const bala of this.balasEnemigo) bala.actualizar(dt, this);
    for (const enemigo of this.enemigos) enemigo.actualizar(dt, this);
    for (const powerup of this.powerups) powerup.actualizar(dt);
    this.jefe?.actualizar(dt, this);

    this._actualizarBombas(dt);
    this._calcularEscudos();
    this._colisiones();
    this._recogerInsignia(dt);

    this.efectos.actualizar(dt);

    if (this.anuncio) {
      this.anuncio.restante -= dt;
      if (this.anuncio.restante <= 0) this.anuncio = null;
    }

    this._limpiar();
    this._comprobarFinal();
  }

  _limpiar() {
    for (const enemigo of this.enemigos) {
      if (enemigo.viva || enemigo.contabilizado) continue;
      enemigo.contabilizado = true;
      // Escaparse no cuenta como derribo: por eso dejar pasar enemigos baja el
      // porcentaje y puede costar el jefe de verdad.
      if (enemigo.categoria === 'enemigo' && !enemigo.escapo) this.destruidos++;
    }

    this.balasJugador = this.balasJugador.filter((b) => b.viva);
    this.balasEnemigo = this.balasEnemigo.filter((b) => b.viva);
    this.enemigos = this.enemigos.filter((e) => e.viva);
    this.powerups = this.powerups.filter((p) => p.viva);
  }

  _comprobarFinal() {
    if (this.jefe && !this.jefe.viva) {
      this._terminarStage();
      return;
    }
    if (this.vidas <= 0 && this.jugadores.every((j) => !j.vivo)) {
      this.estado = 'gameover';
      this.audio.pararMusica();
    }
  }

  // -------------------------------------------------------------------------
  // Guion del escenario
  // -------------------------------------------------------------------------

  _avanzarGuion(dt) {
    if (this.zona) {
      this.zona.restante -= dt;
      if (this.zona.restante <= 0) this.zona = null;
    }

    if (this.paso >= this.stage.guion.length) return;

    if (this.bloqueado === 'limpio') {
      if (this.enemigos.some((e) => e.categoria === 'enemigo')) return;
      this.bloqueado = null;
    }

    this.esperaGuion -= dt;
    if (this.esperaGuion > 0) return;

    const suceso = this.stage.guion[this.paso];
    this.paso++;
    this.esperaGuion = this.stage.guion[this.paso]?.espera ?? 0;

    this._ejecutarSuceso(suceso);
  }

  _ejecutarSuceso(suceso) {
    switch (suceso.tipo) {
      case 'anuncio':
        this.anunciar(suceso.texto);
        this.audio.aviso();
        break;

      case 'oleada':
        this._soltarOleada(suceso);
        break;

      case 'esperarLimpio':
        this.bloqueado = 'limpio';
        break;

      case 'zonaEspecial':
        this.zona = { nombre: suceso.zona, restante: suceso.duracion };
        break;

      case 'jefe':
        this._invocarJefe();
        break;

      default:
        break;
    }
  }

  _soltarOleada({ plantilla, cuantos, formacion }) {
    const base = this.stage.plantillas[plantilla];
    if (!base) return;

    // Solo se multiplican los enemigos normales: multiplicar las campanas de la
    // catedral o los mid-boss rompería el escenario.
    const total = base.categoria === 'escenario' || base.esMidBoss
      ? cuantos
      : enemigosDeOleada(cuantos, this.numJugadores);

    for (let i = 0; i < total; i++) {
      const enemigo = new Enemigo(base, this._posicionEn(formacion, i, total), this);
      if (base.categoria !== 'escenario') this.generados++;
      this.enemigos.push(enemigo);
    }

    // Las campanas se numeran de izquierda a derecha nada más aparecer: es el
    // orden en el que hay que tocarlas.
    if (plantilla === 'campana') {
      const campanas = this.enemigos.filter((e) => e.forma === 'campana');
      campanas.sort((a, b) => a.x - b.x).forEach((c, i) => (c.orden = i));
    }
  }

  _posicionEn(formacion, i, total) {
    const margen = 46;
    const util = ANCHO - margen * 2;

    switch (formacion) {
      case 'fila':
        return { x: margen + (util * (i + 0.5)) / total, y: -40 - i * 12 };

      case 'uve': {
        const centro = (i - (total - 1) / 2) / Math.max(1, total / 2);
        return { x: ANCHO / 2 + centro * (util / 2), y: -40 - Math.abs(centro) * 90 };
      }

      case 'lados': {
        const izquierda = i % 2 === 0;
        return {
          x: izquierda ? margen + (i * 9) % 60 : ANCHO - margen - ((i * 9) % 60),
          y: -40 - Math.floor(i / 2) * 55,
        };
      }

      case 'suelo':
        return { x: margen + (util * (i + 0.5)) / total, y: -50 - i * 90 };

      case 'centro':
        return { x: ANCHO / 2, y: -60 };

      case 'aleatoria':
      default:
        return { x: margen + Math.random() * util, y: -40 - i * 34 };
    }
  }

  invocarEsbirros(plantilla, cuantos, x, y) {
    const base = this.stage.plantillas[plantilla];
    if (!base) return;
    for (let i = 0; i < cuantos; i++) {
      this.generados++;
      this.enemigos.push(new Enemigo(base, { x: x + (i - cuantos / 2) * 40, y: y + 20 }, this));
    }
  }

  /**
   * Aquí se decide todo.
   *
   * Se miran las tres condiciones del escenario: si se cumplen dos, baja el
   * jefe de verdad; si no, aparece el sustituto y el equipo se lleva la nota
   * mala aunque lo derrote.
   */
  _invocarJefe() {
    // Hay insignias que solo se pueden juzgar cuando ya no queda escenario por
    // delante, como la de los siete icebergs: se cierran justo antes de mirar
    // las condiciones, porque de eso depende qué jefe baja.
    this.cerrarInsignias();

    const evaluacion = evaluarCondiciones({
      destruidos: this.destruidos,
      generados: this.generados,
      vidasPerdidas: this.vidasPerdidas,
      insignia: this.insignia,
    });

    this.evaluacion = evaluacion;
    this.jefeVerdadero = evaluacion.jefeVerdadero;

    const definicion = evaluacion.jefeVerdadero ? this.stage.jefe : JEFE_SUSTITUTO;
    this.jefe = new Jefe(definicion, this);

    this.anunciar(
      evaluacion.jefeVerdadero ? definicion.nombre.toUpperCase() : 'APARECE… ¿UN MONO?',
      3.2,
    );
    this.audio.aviso();
    this.balasEnemigo.length = 0;
  }

  _terminarStage() {
    if (this.estado !== 'jugando') return;
    this.estado = 'terminado';
    this.audio.pararMusica();

    const evaluacion = this.evaluacion ?? evaluarCondiciones({
      destruidos: this.destruidos,
      generados: this.generados,
      vidasPerdidas: this.vidasPerdidas,
      insignia: this.insignia,
    });

    const { total, detalle } = puntuarStage({
      base: this.puntos,
      sinDanoEnJefe: this.jefe ? !this.jefe.recibioDanoAlEquipo : false,
      sinMuertes: this.vidasPerdidas === 0,
      naveDeTuPais: false,
    });

    this.puntos = total;
    this.resultado = {
      stage: this.stage,
      puntos: total,
      detalle,
      evaluacion,
      jefeVerdadero: this.jefeVerdadero,
      vidas: this.vidas,
    };
  }

  // -------------------------------------------------------------------------
  // Viento y zonas
  // -------------------------------------------------------------------------

  _actualizarViento(dt) {
    if (!this.stage.viento) return;

    // Cuanta más gente, más fuerte y más caprichoso: es la mecánica ambiental
    // del escenario de hielo.
    if (this.tiempo > (this.proximoCambio ?? 0)) {
      this.proximoCambio = this.tiempo + 3 + Math.random() * 4;
      const fuerza = 26 * (1 + 0.35 * (this.numJugadores - 1));
      this.vientoObjetivo = (Math.random() * 2 - 1) * fuerza;
    }
    this.viento += (this.vientoObjetivo - this.viento) * Math.min(1, dt * 1.6);
  }

  // -------------------------------------------------------------------------
  // Bombas
  // -------------------------------------------------------------------------

  lanzarBomba(jugador) {
    if (!jugador.vivo || jugador.bombas <= 0) return;

    jugador.bombas--;
    this.ultimaBombaEn.set(jugador.indice, this.tiempo);

    // Bomba conjunta: si todos sueltan la suya en el mismo segundo, se funden
    // en una sola mucho mayor. Es la recompensa de coordinarse de verdad.
    const recientes = [...this.ultimaBombaEn.values()].filter((t) => this.tiempo - t < 1);
    const conjunta = this.numJugadores > 1 && recientes.length === this.numJugadores;

    const bomba = jugador.pais.bomba;
    this.bombas.push({
      tipo: conjunta ? 'pantalla' : bomba.tipo,
      color: conjunta ? '#ffffff' : bomba.color,
      x: jugador.x,
      y: jugador.y,
      duenno: jugador.indice,
      t: 0,
      duracion: conjunta ? 1.6 : bomba.tipo === 'escudo' ? 4.5 : 1,
      dano: (conjunta ? 5200 : 1500) * (1 + jugador.nave.poder * 0.05),
      conjunta,
    });

    if (bomba.tipo !== 'escudo') this.balasEnemigo.length = 0;
    jugador.invulnerable = Math.max(jugador.invulnerable, 1.2);

    this.efectos.fogonazo(conjunta ? 1.4 : 0.8);
    this.audio.bomba();
    this.audio.leitmotiv(jugador.pais);
    this.anunciar(conjunta ? '¡ARMAGEDÓN!' : bomba.nombre.toUpperCase(), conjunta ? 2.6 : 1.4);
  }

  _actualizarBombas(dt) {
    for (const bomba of this.bombas) {
      bomba.t += dt;
      const avance = bomba.t / bomba.duracion;

      switch (bomba.tipo) {
        case 'escudo': {
          const jugador = this.jugadores[bomba.duenno];
          if (jugador?.vivo) {
            bomba.x = jugador.x;
            bomba.y = jugador.y;
          }
          // El escudo no daña: se come las balas que le entran.
          this.balasEnemigo = this.balasEnemigo.filter(
            (b) => Math.hypot(b.x - bomba.x, b.y - bomba.y) > 62,
          );
          break;
        }

        case 'barrido': {
          const y = avance * ALTO;
          this._danarEnFranja(y - 40, y + 40, bomba.dano * dt / bomba.duracion, bomba.duenno);
          break;
        }

        case 'columna':
          for (const cx of [bomba.x - 90, bomba.x, bomba.x + 90]) {
            this._danarEnColumna(cx, 34, bomba.dano * dt / bomba.duracion, bomba.duenno);
          }
          break;

        case 'lluvia':
          if (Math.random() < 0.6) {
            this.efectos.explosion(Math.random() * ANCHO, Math.random() * ALTO * 0.8, {
              tamano: 0.7,
              color: bomba.color,
            });
          }
          this._danarEnFranja(0, ALTO, (bomba.dano * 0.7 * dt) / bomba.duracion, bomba.duenno);
          break;

        case 'pantalla':
        default:
          this._danarEnFranja(0, ALTO, (bomba.dano * dt) / bomba.duracion, bomba.duenno);
          break;
      }
    }

    this.bombas = this.bombas.filter((b) => b.t < b.duracion);
  }

  _danarEnFranja(y1, y2, dano, duenno) {
    for (const enemigo of this.enemigos) {
      if (enemigo.y >= y1 && enemigo.y <= y2) this._matar(enemigo, dano, duenno);
    }
    if (this.jefe?.viva && this.jefe.y >= y1 && this.jefe.y <= y2) {
      this.jefe.golpear(dano, duenno, this);
    }
    this.balasEnemigo = this.balasEnemigo.filter((b) => b.y < y1 || b.y > y2);
  }

  _danarEnColumna(x, radio, dano, duenno) {
    for (const enemigo of this.enemigos) {
      if (Math.abs(enemigo.x - x) <= radio) this._matar(enemigo, dano, duenno);
    }
    if (this.jefe?.viva && Math.abs(this.jefe.x - x) <= radio + this.jefe.radio) {
      this.jefe.golpear(dano, duenno, this);
    }
    this.balasEnemigo = this.balasEnemigo.filter((b) => Math.abs(b.x - x) > radio);
  }

  // -------------------------------------------------------------------------
  // Cooperación
  // -------------------------------------------------------------------------

  /**
   * Escudo cruzado: dos jugadores cerca y disparando levantan una barrera entre
   * ellos que se come las balas. Premia volar juntos, que es justo lo contrario
   * de lo que apetece cuando la pantalla se llena.
   */
  _calcularEscudos() {
    this.escudos = [];
    const vivos = this.jugadoresVivos;

    for (let i = 0; i < vivos.length; i++) {
      for (let j = i + 1; j < vivos.length; j++) {
        const a = vivos[i];
        const b = vivos[j];
        if (!a.disparando || !b.disparando) continue;
        if (Math.hypot(a.x - b.x, a.y - b.y) > 96) continue;
        this.escudos.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y });
      }
    }
  }

  /** Donar: cambiar potencia propia por una vida para el bote común. */
  donarVida(jugador) {
    if (jugador.nivel <= 1 || this.vidas >= this.vidasIniciales) return;

    jugador.nivel--;
    this.vidas++;
    this.efectos.rotulo(jugador.x, jugador.y - 24, '¡VIDA DONADA!', { color: '#ef5350' });
    this.audio.powerUp();
  }

  matarJugador(jugador) {
    if (!jugador.golpear(this)) return;

    this.vidas = Math.max(0, this.vidas - 1);
    this.vidasPerdidas++;
    if (this.jefe) this.jefe.recibioDanoAlEquipo = true;
  }

  // -------------------------------------------------------------------------
  // Colisiones
  // -------------------------------------------------------------------------

  _matar(enemigo, dano, duenno) {
    const puntos = enemigo.golpear(dano, duenno, this);
    if (puntos === 0) return false;

    this.sumarPuntos(puntos);
    this.efectos.explosion(enemigo.x, enemigo.y, {
      tamano: enemigo.esMidBoss ? 3 : enemigo.radio / 14,
      color: enemigo.colores[2],
    });
    this.audio.explosion(enemigo.esMidBoss ? 2 : 1);

    const premio = sorteoDePowerUp(enemigo, this);
    if (premio) this.powerups.push(new PowerUp(enemigo.x, enemigo.y, premio));
    if (enemigo.esMidBoss) {
      for (const tipo of ['P', 'B']) this.powerups.push(new PowerUp(enemigo.x, enemigo.y, tipo));
    }

    this._anotarDerribo(enemigo);
    return true;
  }

  _colisiones() {
    // --- Balas del jugador contra todo lo que se pueda romper ---------------
    for (const bala of this.balasJugador) {
      if (!bala.viva) continue;

      for (const enemigo of this.enemigos) {
        if (!enemigo.viva) continue;
        if (bala.tocados?.has(enemigo)) continue;
        if (Math.hypot(bala.x - enemigo.x, bala.y - enemigo.y) > enemigo.radio + bala.radio) continue;

        if (bala.efecto === 'lento') enemigo.lento = 1.4;
        if (bala.efecto === 'arrastre') enemigo.y += 6;
        if (bala.efecto === 'empuje') enemigo.x += Math.sign(enemigo.x - bala.x) * 5;

        this._matar(enemigo, bala.dano, bala.duenno);
        this.efectos.chispa(bala.x, bala.y, bala.color);

        if (bala.penetra) {
          bala.tocados.add(enemigo);
        } else {
          bala.viva = false;
          if (bala.esquirlas > 0) this.balasJugador.push(...esquirlasDe(bala));
          break;
        }
      }

      if (!bala.viva || !this.jefe?.viva) continue;

      // Partes del jefe primero: son las que tapan el núcleo.
      let tocoParte = false;
      for (const parte of this.jefe.partesVulnerables()) {
        if (Math.hypot(bala.x - parte.x, bala.y - parte.y) > parte.radio + bala.radio) continue;
        this.jefe.golpear(bala.dano, bala.duenno, this, parte);
        this.efectos.chispa(bala.x, bala.y, bala.color);
        tocoParte = true;
        if (!bala.penetra) bala.viva = false;
        break;
      }
      if (tocoParte) continue;

      if (Math.hypot(bala.x - this.jefe.x, bala.y - this.jefe.y) < this.jefe.radio + bala.radio) {
        if (this.jefe.vulnerable()) {
          this.jefe.golpear(bala.dano, bala.duenno, this);
          this.efectos.chispa(bala.x, bala.y, bala.color);
        } else {
          this.efectos.chispa(bala.x, bala.y, '#9e9e9e');
        }
        if (!bala.penetra) bala.viva = false;
      }
    }

    // --- Balas enemigas contra escudos y jugadores --------------------------
    for (const bala of this.balasEnemigo) {
      if (!bala.viva) continue;

      if (this._chocaConEscudo(bala)) {
        bala.viva = false;
        this.efectos.chispa(bala.x, bala.y, '#4fc3f7');
        continue;
      }

      for (const jugador of this.jugadoresVivos) {
        if (Math.hypot(bala.x - jugador.x, bala.y - jugador.y) > jugador.radio + bala.radio) continue;
        bala.viva = false;
        this.matarJugador(jugador);
        break;
      }
    }

    // --- Choques directos ---------------------------------------------------
    for (const jugador of this.jugadoresVivos) {
      for (const enemigo of this.enemigos) {
        if (!enemigo.viva) continue;
        if (Math.hypot(jugador.x - enemigo.x, jugador.y - enemigo.y) > enemigo.radio + jugador.radio) continue;
        this.matarJugador(jugador);
        break;
      }

      if (this.jefe?.viva && !this.jefe.entrando) {
        if (Math.hypot(jugador.x - this.jefe.x, jugador.y - this.jefe.y) < this.jefe.radio + jugador.radio) {
          this.matarJugador(jugador);
        }
      }

      // --- Recoger cosas ----------------------------------------------------
      for (const powerup of this.powerups) {
        if (!powerup.viva) continue;
        if (Math.hypot(jugador.x - powerup.x, jugador.y - powerup.y) > powerup.radio + 16) continue;

        powerup.viva = false;
        this.audio.powerUp();

        if (powerup.tipo === 'M') {
          this.sumarPuntos(PUNTOS.moneda);
          this.efectos.rotulo(powerup.x, powerup.y, `+${PUNTOS.moneda}`, { color: '#ce93d8' });
        } else if (powerup.tipo === 'H') {
          this.vidas = Math.min(this.vidasIniciales, this.vidas + 1);
          this.efectos.rotulo(powerup.x, powerup.y, '¡VIDA!', { color: '#ef5350' });
        } else if (powerup.tipo === 'I') {
          this._ganarInsignia();
        } else {
          jugador.recoger(powerup.tipo, this);
        }
      }
    }
  }

  _chocaConEscudo(bala) {
    for (const escudo of this.escudos) {
      const dx = escudo.x2 - escudo.x1;
      const dy = escudo.y2 - escudo.y1;
      const largo2 = dx * dx + dy * dy;
      if (largo2 === 0) continue;

      // Proyección de la bala sobre el segmento, recortada a sus extremos.
      let t = ((bala.x - escudo.x1) * dx + (bala.y - escudo.y1) * dy) / largo2;
      t = Math.max(0, Math.min(1, t));
      const px = escudo.x1 + dx * t;
      const py = escudo.y1 + dy * t;
      if (Math.hypot(bala.x - px, bala.y - py) < 8 + bala.radio) return true;
    }
    return false;
  }

  // -------------------------------------------------------------------------
  // Insignias
  // -------------------------------------------------------------------------

  _anotarDerribo(enemigo) {
    const tipo = this.stage.insignia?.tipo;

    if (tipo === 'campanas') {
      if (enemigo.forma === 'campana') {
        this.campanasEnOrden.push(enemigo.orden);
        const enOrden = this.campanasEnOrden.every((n, i) => n === i);
        if (enOrden && this.campanasEnOrden.length === 4 && !this.edificioDestruido) {
          this._ganarInsignia();
        }
      }
      if (enemigo.forma === 'edificio') {
        this.edificioDestruido = true;
        this.efectos.rotulo(enemigo.x, enemigo.y, 'ERA UN EDIFICIO CIVIL', { color: '#ef5350' });
      }
    }

    if (tipo === 'icebergs' && enemigo.forma === 'iceberg') {
      this.icebergsRotos++;
    }
  }

  /**
   * La insignia del silencio: mientras el equipo sobrevuela el río sin disparar
   * un solo tiro, aparece el delfín rosa que la lleva.
   */
  _recogerInsignia(dt) {
    if (this.stage.insignia?.tipo !== 'silencio' || this.insignia) return;
    if (this.zona?.nombre !== 'rio') return;

    const alguienDispara = this.jugadoresVivos.some((j) => j.disparando);
    if (alguienDispara) {
      if (this.silencio > 3) this.efectos.rotulo(ANCHO / 2, 200, 'EL SILENCIO SE ROMPIÓ', { color: '#ef5350' });
      this.silencio = 0;
      return;
    }

    this.silencio += dt;
    if (this.silencio < this.stage.insignia.segundos || this.delfinFuera) return;

    this.delfinFuera = true;
    const delfin = new Enemigo(this.stage.plantillas.delfin, { x: -20, y: 300 }, this);
    this.enemigos.push(delfin);
    this.powerups.push(new PowerUp(ANCHO / 2, 260, 'I'));
    this.anunciar('¡UN DELFÍN ROSA!', 2.6);
  }

  _ganarInsignia() {
    if (this.insignia) return;
    this.insignia = true;
    this.sumarPuntos(PUNTOS.insignia);
    this.anunciar('¡INSIGNIA DEL PAÍS!', 3);
    this.efectos.fogonazo(0.6);
    this.audio.powerUp();
  }

  /** Al acabar el escenario hay insignias que solo se pueden juzgar al final. */
  cerrarInsignias() {
    if (this.stage.insignia?.tipo === 'icebergs' && this.icebergsRotos === this.stage.insignia.objetivo) {
      this._ganarInsignia();
    }
  }

  // -------------------------------------------------------------------------
  // Dibujo
  // -------------------------------------------------------------------------

  dibujar(ctx) {
    this.fondo.dibujar(ctx);

    const [sx, sy] = this.efectos.desplazamiento();
    ctx.save();
    ctx.translate(sx, sy);

    for (const powerup of this.powerups) powerup.dibujar(ctx);
    for (const enemigo of this.enemigos) enemigo.dibujar(ctx);
    if (this.jefe?.viva) this.jefe.dibujar(ctx);

    this._dibujarBombas(ctx);
    this._dibujarEscudos(ctx);

    for (const bala of this.balasJugador) bala.dibujar(ctx);
    for (const jugador of this.jugadores) jugador.dibujar(ctx);
    for (const bala of this.balasEnemigo) bala.dibujar(ctx);

    this.efectos.dibujar(ctx);
    ctx.restore();
  }

  _dibujarBombas(ctx) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    for (const bomba of this.bombas) {
      const avance = bomba.t / bomba.duracion;
      ctx.globalAlpha = 1 - avance;
      ctx.fillStyle = bomba.color;

      switch (bomba.tipo) {
        case 'escudo':
          ctx.globalAlpha = 0.45 + Math.sin(bomba.t * 12) * 0.12;
          ctx.beginPath();
          ctx.arc(bomba.x, bomba.y, 62, 0, Math.PI * 2);
          ctx.fill();
          break;
        case 'barrido':
          ctx.globalAlpha = 0.7;
          ctx.fillRect(0, avance * ALTO - 40, ANCHO, 80);
          break;
        case 'columna':
          for (const cx of [bomba.x - 90, bomba.x, bomba.x + 90]) {
            ctx.fillRect(cx - 34, 0, 68, ALTO);
          }
          break;
        default:
          ctx.beginPath();
          ctx.arc(bomba.x, bomba.y, avance * ALTO, 0, Math.PI * 2);
          ctx.fill();
      }
    }
    ctx.restore();
  }

  _dibujarEscudos(ctx) {
    if (this.escudos.length === 0) return;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = '#4fc3f7';
    ctx.lineWidth = 6;
    ctx.globalAlpha = 0.55 + Math.sin(this.tiempo * 14) * 0.15;
    for (const escudo of this.escudos) {
      ctx.beginPath();
      ctx.moveTo(escudo.x1, escudo.y1);
      ctx.lineTo(escudo.x2, escudo.y2);
      ctx.stroke();
    }
    ctx.restore();
  }
}
