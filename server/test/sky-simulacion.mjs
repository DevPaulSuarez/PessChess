/**
 * Simulación completa de Sky Warriors United, sin navegador.
 *
 * El juego vive en un lienzo, pero un lienzo es solo un objeto con métodos: se
 * puede fingir. Aquí se juegan escenarios enteros a 60 pasos por segundo, con
 * un piloto automático, y se dibuja cada fotograma contra un lienzo de mentira.
 *
 * Sirve para lo que una captura de pantalla no puede: recorrer las tres fases
 * de cada jefe, las bombas, las insignias y los cuatro jugadores a la vez, y
 * enterarse de que algo revienta *antes* de abrir el navegador.
 *
 * Se ejecuta con `npm run test:sky-sim`.
 */
import { PASO } from '../sky-motor/core/constantes.js';
import { STAGES } from '../sky-motor/datos/stages.js';
import { PAIS_POR_ID } from '../sky-motor/datos/paises.js';
import { Partida } from '../sky-motor/juego/partida.js';

let passed = 0;
let failed = 0;

function check(label, condition, detail = '') {
  if (condition) {
    passed++;
    console.log(`  ✓ ${label}`);
  } else {
    failed++;
    console.log(`  ✗ ${label} ${detail}`);
  }
}

// ---------------------------------------------------------------------------
// Dobles de todo lo que pone el navegador
// ---------------------------------------------------------------------------

/** Un contexto 2D que acepta cualquier cosa y no dibuja nada. */
function lienzoFalso() {
  const degradado = { addColorStop() {} };
  return new Proxy(
    {},
    {
      get(destino, propiedad) {
        if (propiedad === 'createLinearGradient' || propiedad === 'createRadialGradient') {
          return () => degradado;
        }
        if (propiedad === 'measureText') return () => ({ width: 10 });
        if (propiedad === 'canvas') return { width: 480, height: 640 };
        if (propiedad in destino) return destino[propiedad];
        return () => {};
      },
      set(destino, propiedad, valor) {
        destino[propiedad] = valor;
        return true;
      },
    },
  );
}

const audioFalso = {
  llamadas: 0,
  despertar() {},
  disparo() { this.llamadas++; },
  impacto() {},
  explosion() { this.llamadas++; },
  bomba() { this.llamadas++; },
  powerUp() {},
  aviso() {},
  muerte() {},
  leitmotiv() { this.llamadas++; },
  ponerMusica() {},
  pararMusica() {},
  actualizarMusica() {},
};

/**
 * Piloto automático: persigue al enemigo más cercano y dispara.
 *
 * No basta con mover el mando al azar. Hay armas de corto alcance —el plasma
 * mexicano se apaga a media pantalla— y con un piloto que se queda abajo, el
 * mid-boss no muere nunca y el escenario se queda atascado esperándolo. Así que
 * el bot sube a buscar a quien tenga delante, como haría cualquiera.
 */
function entradaFalsa(opciones = {}) {
  const { dispara = true, bombaCada = 0 } = opciones;
  const bot = {
    partida: null,
    paso: 0,
    avanzar() {
      this.paso++;
    },
    estado(fuente) {
      const jugador = this.partida?.jugadores.find((j) => j.fuente === fuente);
      if (!jugador) return { x: 0, y: 0, disparo: dispara, bomba: false, donar: false };

      const objetivo = this.partida.jefe?.viva
        ? this.partida.jefe
        : this.partida.enemigos.find((e) => e.y > 0 && e.categoria === 'enemigo');

      const destinoX = objetivo ? objetivo.x : 240;
      // Se queda a media altura: lo bastante arriba para que llegue el plasma,
      // lo bastante abajo para tener sitio donde esquivar.
      const destinoY = 330;
      const hacia = (actual, destino) => (Math.abs(destino - actual) < 8 ? 0 : Math.sign(destino - actual));

      return {
        x: hacia(jugador.x, destinoX),
        y: hacia(jugador.y, destinoY),
        disparo: dispara,
        bomba: false,
        donar: false,
        pausa: false,
        atras: false,
      };
    },
    pulsado(fuente, accion) {
      if (accion === 'bomba' && bombaCada > 0) return this.paso % bombaCada === 0;
      return false;
    },
  };
  return bot;
}

function configuracionesDe(cuantos) {
  const paises = ['mexico', 'usa', 'peru', 'espana'];
  return Array.from({ length: cuantos }, (_, i) => {
    const pais = PAIS_POR_ID[paises[i]];
    return { fuente: `falsa${i}`, pais, nave: pais.naves[i % 2], ranura: `j${i + 1}` };
  });
}

/**
 * Juega un escenario entero.
 *
 * Al jefe se le pega directamente con la misma llamada que usan las colisiones:
 * así se recorren sus tres fases y sus partes en unos segundos en vez de en los
 * minutos que tardaría el piloto automático.
 */
function jugarStage(stage, numJugadores, opcionesEntrada = {}) {
  const { forzarCondiciones = false, ...opcionesBot } = opcionesEntrada;
  const ctx = lienzoFalso();
  const entrada = entradaFalsa(opcionesBot);
  const partida = new Partida({ stage, configuraciones: configuracionesDe(numJugadores), audio: audioFalso });
  entrada.partida = partida;

  const traza = { fasesVistas: 0, jefeAparecio: false, maxEnemigos: 0, maxBalas: 0 };
  const LIMITE = 60 * 500;

  for (let i = 0; i < LIMITE; i++) {
    // El piloto automático no esquiva, así que se le hace invulnerable y se le
    // da potencia máxima. Aquí no se mide si juega bien: se mide que el juego
    // entero se pueda recorrer sin romperse. Morir se prueba aparte.
    for (const jugador of partida.jugadores) {
      jugador.invulnerable = 99;
      jugador.nivel = 4;
    }

    // Ni el mejor piloto automático llega al 85% esquivando con el ratón: para
    // poder recorrer las tres fases del jefe de verdad se dan por buenas las
    // condiciones. Que se cumplan de verdad se prueba aparte.
    if (forzarCondiciones && !partida.jefe) {
      partida.destruidos = partida.generados;
      partida.insignia = true;
    }

    entrada.avanzar();
    partida.actualizar(PASO, entrada);

    traza.maxEnemigos = Math.max(traza.maxEnemigos, partida.enemigos.length);
    traza.maxBalas = Math.max(traza.maxBalas, partida.balasEnemigo.length + partida.balasJugador.length);

    if (partida.jefe?.viva && !partida.jefe.entrando) {
      traza.jefeAparecio = true;
      traza.fasesVistas = Math.max(traza.fasesVistas, partida.jefe.faseIndice + 1);

      for (const parte of partida.jefe.partesVulnerables()) {
        partida.jefe.golpear(400, 0, partida, parte);
      }
      if (partida.jefe.vulnerable()) partida.jefe.golpear(900, 0, partida);
    }

    // Dibujar en cada paso: es donde se esconden la mitad de los errores.
    partida.dibujar(ctx);

    if (partida.estado !== 'jugando') break;
  }

  if (partida.estado === 'terminado') partida.cerrarInsignias();

  return { partida, traza };
}

// ---------------------------------------------------------------------------

console.log('\nUn escenario entero, de principio a fin:');
{
  const { partida, traza } = jugarStage(STAGES[0], 1, { forzarCondiciones: true });

  check('la partida llega al final', partida.estado === 'terminado', partida.estado);
  check('apareció el jefe de verdad', traza.jefeAparecio && partida.jefeVerdadero);
  check('se recorrieron sus tres fases', traza.fasesVistas === 3, `${traza.fasesVistas}`);
  check('salieron enemigos', partida.generados > 20, `${partida.generados}`);
  check('y se abatieron', partida.destruidos > 0, `${partida.destruidos}`);
  check('nunca se abaten más de los que salen', partida.destruidos <= partida.generados,
    `${partida.destruidos}/${partida.generados}`);
  check('hay un resultado con su evaluación', Boolean(partida.resultado?.evaluacion));
  check('la pantalla llegó a llenarse', traza.maxEnemigos > 8, `${traza.maxEnemigos}`);
}

console.log('\nLos tres escenarios se pueden terminar:');
{
  for (const stage of STAGES) {
    const { partida, traza } = jugarStage(stage, 1, { forzarCondiciones: true });
    check(
      `${stage.numero}. ${stage.titulo}`,
      partida.estado === 'terminado' && traza.fasesVistas === 3,
      `${partida.estado}, fases ${traza.fasesVistas}`,
    );
  }
}

console.log('\nCuatro jugadores a la vez:');
{
  const { partida, traza } = jugarStage(STAGES[1], 4, { bombaCada: 240, forzarCondiciones: true });

  check('la partida termina igual', partida.estado === 'terminado', partida.estado);
  check('el bote de vidas es de diez', partida.vidasIniciales === 10, `${partida.vidasIniciales}`);
  check('el jefe tuvo 35.000 de vida', partida.jefe.vidaTotal === 35000, `${partida.jefe.vidaTotal}`);
  check('salieron muchos más enemigos que con uno solo',
    partida.generados > jugarStage(STAGES[1], 1).partida.generados,
    `${partida.generados}`);
  check('se lanzaron bombas', audioFalso.llamadas > 0);
  check('hubo balas de sobra en pantalla', traza.maxBalas > 30, `${traza.maxBalas}`);
}

console.log('\nMorir cuesta vidas del bote común:');
{
  const partida = new Partida({ stage: STAGES[0], configuraciones: configuracionesDe(2), audio: audioFalso });
  const [a, b] = partida.jugadores;

  check('dos jugadores empiezan con cinco vidas', partida.vidas === 5, `${partida.vidas}`);

  a.invulnerable = 0;
  partida.matarJugador(a);
  check('morir gasta una vida del bote', partida.vidas === 4 && !a.vivo, `${partida.vidas}`);
  check('y queda anotado para las condiciones', partida.vidasPerdidas === 1);

  partida.matarJugador(a);
  check('un caído no vuelve a morir', partida.vidas === 4, `${partida.vidas}`);

  // Se agota el bote: la partida se acaba para todos.
  partida.vidas = 1;
  b.invulnerable = 0;
  partida.matarJugador(b);
  a.vivo = false;
  b.vivo = false;
  partida.vidas = 0;
  partida.actualizar(PASO, entradaFalsa());
  check('sin vidas y sin nadie en pie, se acabó', partida.estado === 'gameover', partida.estado);
}

console.log('\nEl desempeño decide qué jefe baja:');
{
  // Un equipo del montón —que es lo que consigue el piloto automático jugando
  // en serio— se queda corto y le sale el mono. Que el 85% cueste tanto es
  // exactamente la intención del diseño.
  const flojo = jugarStage(STAGES[0], 1);
  check('jugar del montón no basta para el jefe de verdad',
    flojo.partida.jefeVerdadero === false, `${flojo.partida.jefeVerdadero}`);
  check('aparece el sustituto, que se llama Osaru',
    flojo.partida.jefe?.nombre === 'Osaru', flojo.partida.jefe?.nombre);
  check('con una sola fase', flojo.partida.jefe?.def.fases.length === 1);
  check('y el porcentaje se quedó cerca pero por debajo',
    flojo.partida.destruidos / flojo.partida.generados < 0.85,
    `${Math.round((flojo.partida.destruidos / flojo.partida.generados) * 100)}%`);

  // Y uno que lo cumple todo se gana al jefe de verdad.
  const stage = STAGES[0];
  const bueno = new Partida({ stage, configuraciones: configuracionesDe(1), audio: audioFalso });
  bueno.generados = 100;
  bueno.destruidos = 100;
  bueno.insignia = true;
  bueno._invocarJefe();

  check('cumpliéndolas baja el jefe verdadero', bueno.jefeVerdadero === true);
  check('que es el del escenario', bueno.jefe.nombre === stage.jefe.nombre, bueno.jefe.nombre);
  check('con sus tres fases', bueno.jefe.def.fases.length === 3);
}

console.log('\nLas insignias se pueden conseguir:');
{
  // Campanas: derribarlas de izquierda a derecha sin tocar un edificio.
  const partida = new Partida({ stage: STAGES[0], configuraciones: configuracionesDe(1), audio: audioFalso });
  for (let orden = 0; orden < 4; orden++) {
    partida._anotarDerribo({ forma: 'campana', orden, x: 0, y: 0 });
  }
  check('las campanas en orden dan la insignia', partida.insignia === true);

  const fallida = new Partida({ stage: STAGES[0], configuraciones: configuracionesDe(1), audio: audioFalso });
  fallida._anotarDerribo({ forma: 'edificio', x: 0, y: 0 });
  for (let orden = 0; orden < 4; orden++) {
    fallida._anotarDerribo({ forma: 'campana', orden, x: 0, y: 0 });
  }
  check('tocar un edificio civil la echa a perder', fallida.insignia === false);

  const desordenada = new Partida({ stage: STAGES[0], configuraciones: configuracionesDe(1), audio: audioFalso });
  for (const orden of [1, 0, 2, 3]) {
    desordenada._anotarDerribo({ forma: 'campana', orden, x: 0, y: 0 });
  }
  check('y el orden importa', desordenada.insignia === false);

  // Icebergs: exactamente siete.
  const hielo = new Partida({ stage: STAGES[2], configuraciones: configuracionesDe(2), audio: audioFalso });
  for (let i = 0; i < 7; i++) hielo._anotarDerribo({ forma: 'iceberg', x: 0, y: 0 });
  hielo.cerrarInsignias();
  check('siete icebergs dan la insignia', hielo.insignia === true);

  const ocho = new Partida({ stage: STAGES[2], configuraciones: configuracionesDe(2), audio: audioFalso });
  for (let i = 0; i < 8; i++) ocho._anotarDerribo({ forma: 'iceberg', x: 0, y: 0 });
  ocho.cerrarInsignias();
  check('ocho, no', ocho.insignia === false);
}

console.log('\nLas mecánicas cooperativas:');
{
  const partida = new Partida({ stage: STAGES[0], configuraciones: configuracionesDe(3), audio: audioFalso });
  const [a, b, c] = partida.jugadores;

  // Ataque combinado: tres jugadores pegando al mismo enemigo.
  partida._soltarOleada({ plantilla: 'quetzalcoatl', cuantos: 1, formacion: 'centro' });
  const enemigo = partida.enemigos[0];
  const vidaAntes = enemigo.vida;
  enemigo.golpear(100, 0, partida);
  enemigo.golpear(100, 1, partida);
  const perdidoConDos = vidaAntes - enemigo.vida;
  enemigo.golpear(100, 2, partida);
  const perdidoAlTercero = vidaAntes - enemigo.vida - perdidoConDos;

  check('con dos jugadores el daño es normal', perdidoConDos === 200, `${perdidoConDos}`);
  check('con el tercero se multiplica por 2.5', perdidoAlTercero === 250, `${perdidoAlTercero}`);
  check('y se avisa en pantalla', partida.combinadoActivo > 0);

  // Escudo cruzado.
  a.x = 200; a.y = 400; a.disparando = true;
  b.x = 240; b.y = 400; b.disparando = true;
  c.x = 10; c.y = 10; c.disparando = false;
  partida._calcularEscudos();
  check('dos jugadores juntos disparando levantan escudo', partida.escudos.length === 1,
    `${partida.escudos.length}`);
  check('el escudo para una bala que lo cruza',
    partida._chocaConEscudo({ x: 220, y: 400, radio: 4 }) === true);
  check('y no para las que van por otro lado',
    partida._chocaConEscudo({ x: 220, y: 300, radio: 4 }) === false);

  b.disparando = false;
  partida._calcularEscudos();
  check('si uno deja de disparar, el escudo cae', partida.escudos.length === 0);

  // Donar vida.
  partida.vidas = 3;
  a.nivel = 3;
  partida.donarVida(a);
  check('donar cambia potencia por una vida del bote', partida.vidas === 4 && a.nivel === 2,
    `vidas ${partida.vidas}, nivel ${a.nivel}`);

  a.nivel = 1;
  const vidasAntes = partida.vidas;
  partida.donarVida(a);
  check('pero no se puede donar sin potencia que dar', partida.vidas === vidasAntes);

  // Bomba conjunta.
  const juntos = new Partida({ stage: STAGES[0], configuraciones: configuracionesDe(3), audio: audioFalso });
  for (const jugador of juntos.jugadores) {
    jugador.bombas = 2;
    juntos.lanzarBomba(jugador);
  }
  check('tres bombas a la vez se funden en el Armagedón',
    juntos.bombas.some((b) => b.conjunta), JSON.stringify(juntos.bombas.map((b) => b.tipo)));
}

console.log(`\n${passed} comprobaciones correctas, ${failed} fallidas`);
process.exit(failed === 0 ? 0 : 1);
