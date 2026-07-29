/**
 * Pruebas de Sky Warriors United, sin navegador.
 *
 * El juego corre en un lienzo, pero sus reglas no lo necesitan: la dificultad,
 * la puntuación y las condiciones de ruta son cuentas puras, y los escenarios
 * son datos que se pueden revisar uno a uno. Eso es justo lo que se comprueba
 * aquí, que es lo que se rompe al añadir un país o un stage nuevo.
 *
 * Se ejecuta con `npm run test:sky`. No hace falta compilar nada.
 */
import {
  MULTIPLICADOR_JUGADORES,
  VIDAS_EQUIPO,
  factorVida,
  dificultadTotal,
  enemigosDeOleada,
  velocidadProyectil,
  proyectilesExtra,
  vidaDeJefe,
  vidasDelEquipo,
  evaluarCondiciones,
  desempenoGlobal,
  rutaFinal,
} from '../sky-motor/sistemas/dificultad.js';
import { puntuarStage, PUNTOS } from '../sky-motor/sistemas/puntuacion.js';
import { PAISES, PAIS_POR_ID } from '../sky-motor/datos/paises.js';
import { STAGES, JEFE_SUSTITUTO } from '../sky-motor/datos/stages.js';
import { TIPOS_DE_ARMA } from '../sky-motor/juego/armas.js';
import { MOVIMIENTOS_VALIDOS, DISPAROS_VALIDOS } from '../sky-motor/juego/enemigos.js';
import { MOVIMIENTOS_JEFE, ATAQUES_JEFE } from '../sky-motor/juego/jefe.js';
import { siluetasDisponibles } from '../sky-motor/core/pintor.js';
// El progreso sí es del servidor, así que viene de lo compilado: hay que haber
// pasado `npm run build` antes.
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';

import {
  insigniasDe,
  ORDEN_DE_DESBLOQUEO,
  PAISES_DE_SALIDA,
  ProgresoStore,
} from '../dist/sky/progreso.js';

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

const casi = (a, b) => Math.abs(a - b) < 0.0001;

// ---------------------------------------------------------------------------

console.log('\nLa dificultad sube con cada jugador:');
{
  check('un jugador no multiplica nada', MULTIPLICADOR_JUGADORES[1] === 1);
  check('cuatro jugadores multiplican por 3.5', MULTIPLICADOR_JUGADORES[4] === 3.5);
  check(
    'la curva siempre crece',
    [1, 2, 3, 4].every((n, i, todos) => i === 0 || MULTIPLICADOR_JUGADORES[n] > MULTIPLICADOR_JUGADORES[todos[i - 1]]),
  );

  check('cuatro jugadores comparten diez vidas', vidasDelEquipo(4) === 10, `${vidasDelEquipo(4)}`);
  check('uno solo lleva tres', vidasDelEquipo(1) === 3, `${vidasDelEquipo(1)}`);
  check(
    'desde dos jugadores las vidas son menos por cabeza',
    VIDAS_EQUIPO[4] / 4 < VIDAS_EQUIPO[1],
    `${VIDAS_EQUIPO[4] / 4}`,
  );
}

console.log('\nY sube también cuando el equipo va mal:');
{
  check('con todo intacto no aprieta', factorVida(10, 10) === 1);
  check('a media vida aprieta un 50%', factorVida(5, 10) === 1.5, `${factorVida(5, 10)}`);
  check('al borde del final, por 2.5', factorVida(1, 10) === 2.5, `${factorVida(1, 10)}`);
  check('sin vidas no se rompe la cuenta', factorVida(0, 0) === 2.5);

  check(
    'los dos multiplicadores se combinan',
    casi(dificultadTotal(100, 4, 5, 10), 100 * 3.5 * 1.5),
    `${dificultadTotal(100, 4, 5, 10)}`,
  );
}

console.log('\nLos números concretos del diseño:');
{
  check('50 enemigos con 4 jugadores son 125', enemigosDeOleada(50, 4) === 125, `${enemigosDeOleada(50, 4)}`);
  check('con un jugador la oleada no cambia', enemigosDeOleada(50, 1) === 50);
  check('y la cuenta crece parejo', enemigosDeOleada(50, 2) === 75 && enemigosDeOleada(50, 3) === 100);
  check(
    'los proyectiles van un 45% más rápido con cuatro',
    casi(velocidadProyectil(100, 4), 145),
    `${velocidadProyectil(100, 4)}`,
  );
  check('cada jugador de más añade un proyectil', proyectilesExtra(4) === 3 && proyectilesExtra(1) === 0);

  check('el jefe base tiene 10.000', vidaDeJefe(1) === 10000);
  check('con cuatro jugadores, 35.000', vidaDeJefe(4) === 35000);
  check('nunca menos que con un jugador', [1, 2, 3, 4].every((n) => vidaDeJefe(n) >= vidaDeJefe(1)));
}

console.log('\nLas tres condiciones deciden qué jefe baja:');
{
  const perfecto = evaluarCondiciones({ destruidos: 90, generados: 100, vidasPerdidas: 0, insignia: true });
  check('cumplirlas todas da el jefe verdadero', perfecto.jefeVerdadero && perfecto.perfecto);

  const dosDeTres = evaluarCondiciones({ destruidos: 90, generados: 100, vidasPerdidas: 1, insignia: false });
  check('con dos de tres también baja el de verdad', dosDeTres.jefeVerdadero, `${dosDeTres.cumplidas}`);

  const unaSola = evaluarCondiciones({ destruidos: 40, generados: 100, vidasPerdidas: 3, insignia: true });
  check('con una sola sale el sustituto', !unaSola.jefeVerdadero, `${unaSola.cumplidas}`);

  const justo = evaluarCondiciones({ destruidos: 85, generados: 100, vidasPerdidas: 5, insignia: false });
  check('el 85% cuenta como cumplido', justo.condiciones[0].cumplida);

  const casiJusto = evaluarCondiciones({ destruidos: 84, generados: 100, vidasPerdidas: 5, insignia: false });
  check('el 84% no', !casiJusto.condiciones[0].cumplida);

  const unaVida = evaluarCondiciones({ destruidos: 0, generados: 100, vidasPerdidas: 1, insignia: false });
  check('perder una vida todavía cumple', unaVida.condiciones[1].cumplida);
  const dosVidas = evaluarCondiciones({ destruidos: 0, generados: 100, vidasPerdidas: 2, insignia: false });
  check('perder dos ya no', !dosVidas.condiciones[1].cumplida);

  const sinEnemigos = evaluarCondiciones({ destruidos: 0, generados: 0, vidasPerdidas: 0, insignia: false });
  check('un stage sin enemigos no divide por cero', sinEnemigos.porcentaje === 0);
}

console.log('\nLa ruta final sale de toda la campaña:');
{
  const todoPerfecto = [1, 2, 3].map(() => ({ cumplidas: 3 }));
  check('tres stages perfectos llevan a la gloria', rutaFinal(desempenoGlobal(todoPerfecto)) === 'gloria');

  const aMedias = [{ cumplidas: 2 }, { cumplidas: 2 }, { cumplidas: 2 }];
  check('cumplir dos de tres siempre es ruta del guerrero',
    rutaFinal(desempenoGlobal(aMedias)) === 'guerrero',
    `${desempenoGlobal(aMedias)}`);

  const mal = [{ cumplidas: 1 }, { cumplidas: 0 }, { cumplidas: 1 }];
  check('descuidarlo lleva a la vergüenza', rutaFinal(desempenoGlobal(mal)) === 'verguenza');
  check('sin stages jugados no revienta', desempenoGlobal([]) === 0);
}

console.log('\nLa puntuación premia jugar bien, no jugar mucho:');
{
  const limpio = puntuarStage({ base: 10000, sinDanoEnJefe: true, sinMuertes: true, naveDeTuPais: false });
  check('sin daño y sin bajas se duplica y medio', limpio.total === 25000, `${limpio.total}`);
  check('y se explica de dónde sale cada bono', limpio.detalle.length === 2);

  const pelado = puntuarStage({ base: 10000, sinDanoEnJefe: false, sinMuertes: false, naveDeTuPais: false });
  check('sin bonos no se toca la base', pelado.total === 10000);

  const patriota = puntuarStage({ base: 1000, sinDanoEnJefe: false, sinMuertes: false, naveDeTuPais: true });
  check('volar tu bandera da un 25%', patriota.total === 1250, `${patriota.total}`);

  check('un jefe vale más que un mid-boss', PUNTOS.faseJefe > PUNTOS.midboss);
}

console.log('\nLos países están completos:');
{
  check('hay más de veinte', PAISES.length >= 20, `${PAISES.length}`);
  check('no hay identificadores repetidos', new Set(PAISES.map((p) => p.id)).size === PAISES.length);
  check('el índice por id los tiene todos', Object.keys(PAIS_POR_ID).length === PAISES.length);

  const siluetas = siluetasDisponibles();
  const problemas = [];

  for (const pais of PAISES) {
    if (pais.naves.length !== 2) problemas.push(`${pais.id}: no tiene dos naves`);
    if (!TIPOS_DE_ARMA.includes(pais.arma.tipo)) problemas.push(`${pais.id}: arma "${pais.arma.tipo}"`);
    if (!['pantalla', 'barrido', 'escudo', 'columna', 'lluvia'].includes(pais.bomba.tipo)) {
      problemas.push(`${pais.id}: bomba "${pais.bomba.tipo}"`);
    }
    if (pais.colores.length !== 3) problemas.push(`${pais.id}: no tiene tres colores`);
    if (!pais.arma.cadencia || pais.arma.cadencia > 0.5) problemas.push(`${pais.id}: cadencia rara`);

    for (const nave of pais.naves) {
      if (!siluetas.includes(nave.silueta)) problemas.push(`${pais.id}/${nave.nombre}: silueta "${nave.silueta}"`);
      if (nave.velocidad < 1 || nave.velocidad > 5) problemas.push(`${pais.id}/${nave.nombre}: velocidad`);
      if (nave.poder < 1 || nave.poder > 5) problemas.push(`${pais.id}/${nave.nombre}: poder`);
      if (!nave.piloto) problemas.push(`${pais.id}/${nave.nombre}: sin piloto`);
    }
  }

  check('cada uno tiene dos pilotos, arma, bomba y siluetas que existen',
    problemas.length === 0, problemas.join(' | '));

  check('todos los tipos de arma se usan al menos una vez',
    TIPOS_DE_ARMA.every((tipo) => PAISES.some((p) => p.arma.tipo === tipo)),
    TIPOS_DE_ARMA.filter((tipo) => !PAISES.some((p) => p.arma.tipo === tipo)).join());
}

console.log('\nLos escenarios no piden nada que no exista:');
{
  const formaciones = ['fila', 'uve', 'lados', 'suelo', 'centro', 'aleatoria'];
  const problemas = [];

  for (const stage of STAGES) {
    for (const [nombre, plantilla] of Object.entries(stage.plantillas)) {
      if (!MOVIMIENTOS_VALIDOS.includes(plantilla.movimiento)) {
        problemas.push(`${stage.id}/${nombre}: movimiento "${plantilla.movimiento}"`);
      }
      if (plantilla.disparo && !DISPAROS_VALIDOS.includes(plantilla.disparo.tipo)) {
        problemas.push(`${stage.id}/${nombre}: disparo "${plantilla.disparo.tipo}"`);
      }
    }

    for (const suceso of stage.guion) {
      if (suceso.tipo === 'oleada') {
        if (!stage.plantillas[suceso.plantilla]) problemas.push(`${stage.id}: no existe "${suceso.plantilla}"`);
        if (!formaciones.includes(suceso.formacion)) problemas.push(`${stage.id}: formación "${suceso.formacion}"`);
      }
    }

    if (!stage.guion.some((s) => s.tipo === 'jefe')) problemas.push(`${stage.id}: nunca llega el jefe`);
    if (!stage.insignia) problemas.push(`${stage.id}: sin insignia`);
  }

  check('las oleadas, movimientos y disparos son válidos', problemas.length === 0, problemas.join(' | '));
}

console.log('\nLos jefes están bien montados:');
{
  const problemas = [];

  for (const jefe of [...STAGES.map((s) => s.jefe), JEFE_SUSTITUTO]) {
    const suma = jefe.fases.reduce((total, f) => total + f.vida, 0);
    if (!casi(suma, 1)) problemas.push(`${jefe.nombre}: las fases suman ${suma}`);

    for (const fase of jefe.fases) {
      if (!MOVIMIENTOS_JEFE.includes(fase.movimiento)) {
        problemas.push(`${jefe.nombre}/${fase.nombre}: movimiento "${fase.movimiento}"`);
      }
      for (const ataque of fase.ataques ?? []) {
        if (!ATAQUES_JEFE.includes(ataque.tipo)) {
          problemas.push(`${jefe.nombre}/${fase.nombre}: ataque "${ataque.tipo}"`);
        }
      }
      if (fase.requierePartes && !fase.partes?.length) {
        problemas.push(`${jefe.nombre}/${fase.nombre}: pide partes y no las tiene`);
      }
    }
  }

  check('cada jefe reparte toda su vida entre sus fases', problemas.length === 0, problemas.join(' | '));

  check('los tres jefes tienen tres fases',
    STAGES.every((s) => s.jefe.fases.length === 3),
    STAGES.map((s) => s.jefe.fases.length).join());

  check('el sustituto es mucho más blando',
    JEFE_SUSTITUTO.escalaVida <= 0.5 && JEFE_SUSTITUTO.fases.length === 1);

  const invocaciones = STAGES.flatMap((s) => s.jefe.fases.filter((f) => f.invoca).map((f) => [s, f]));
  check('lo que invocan los jefes existe en su escenario',
    invocaciones.every(([stage, fase]) => Boolean(stage.plantillas[fase.invoca.plantilla])),
    invocaciones.map(([s, f]) => `${s.id}:${f.invoca.plantilla}`).join());
}

console.log('\nLos países se ganan volando:');
{
  const perfecto = { estado: 'terminado', jefeVerdadero: true, cumplidas: 3 };
  const digno = { estado: 'terminado', jefeVerdadero: true, cumplidas: 2 };
  const raspado = { estado: 'terminado', jefeVerdadero: false, cumplidas: 1 };
  const derrota = { estado: 'gameover', jefeVerdadero: false, cumplidas: 0 };

  check('terminar un escenario abre un país', insigniasDe(raspado) === 1, `${insigniasDe(raspado)}`);
  check('ganarse al jefe de verdad abre otro', insigniasDe(digno) === 2, `${insigniasDe(digno)}`);
  check('y hacerlo perfecto, un tercero', insigniasDe(perfecto) === 3, `${insigniasDe(perfecto)}`);
  check('perder no abre nada', insigniasDe(derrota) === 0, `${insigniasDe(derrota)}`);

  check('se sale con dos países', PAISES_DE_SALIDA.length === 2, PAISES_DE_SALIDA.join());
  check('Estados Unidos y Perú', PAISES_DE_SALIDA.join() === 'usa,peru', PAISES_DE_SALIDA.join());

  const todos = new Set([...PAISES_DE_SALIDA, ...ORDEN_DE_DESBLOQUEO]);
  check('entre los dos suman los veintiuno', todos.size === PAISES.length, `${todos.size}`);
  check('y no hay ninguno repetido',
    PAISES_DE_SALIDA.length + ORDEN_DE_DESBLOQUEO.length === todos.size);
  check('todos los que se desbloquean existen',
    ORDEN_DE_DESBLOQUEO.every((id) => Boolean(PAIS_POR_ID[id])),
    ORDEN_DE_DESBLOQUEO.filter((id) => !PAIS_POR_ID[id]).join());

  // La campaña son tres escenarios: ni el mejor equipo lo abre todo de una vez.
  const deUnaCampanaPerfecta = 3 * insigniasDe(perfecto);
  check('ni una campaña perfecta lo abre todo',
    deUnaCampanaPerfecta < ORDEN_DE_DESBLOQUEO.length,
    `${deUnaCampanaPerfecta} de ${ORDEN_DE_DESBLOQUEO.length}`);
}

console.log('\nEl progreso es de cada piloto, no de la partida:');
{
  const fichero = `${tmpdir()}/sky-progreso-${Date.now()}.json`;
  const store = new ProgresoStore(fichero);

  const terminado = { estado: 'terminado', jefeVerdadero: false, cumplidas: 1, puntos: 1000 };
  const derrota = { estado: 'gameover', jefeVerdadero: false, cumplidas: 0, puntos: 9000 };

  // Volar el mismo escenario da lo mismo a todos: quien pone la nave para que
  // otro cumpla las condiciones ha hecho tanto como él.
  const deAna = store.apuntar('ana', terminado);
  const deBeto = store.apuntar('beto', terminado);
  check('los dos cobran lo mismo por el mismo vuelo', deAna.join() === deBeto.join(),
    `${deAna.join()} vs ${deBeto.join()}`);
  check('y es el primero de la lista', deAna.join() === 'mexico', deAna.join());

  // Pero cada uno arrastra lo suyo de antes: por eso dos que vuelan juntos
  // pueden tener países distintos abiertos.
  const nuevosDeAna = store.apuntar('ana', terminado);
  check('quien ya había volado abre el siguiente', nuevosDeAna.join() === 'colombia',
    nuevosDeAna.join());
  check('Ana lleva dos y Beto uno',
    store.ficha('ana').insignias === 2 && store.ficha('beto').insignias === 1,
    `${store.ficha('ana').insignias} y ${store.ficha('beto').insignias}`);
  check('así que Ana ve un país que Beto no',
    store.puede('ana', 'colombia') && !store.puede('beto', 'colombia'));

  // Perder no quita lo ganado ni suma nada, pero sí guarda el récord.
  const trasPerder = store.apuntar('beto', derrota);
  check('perder no abre países', trasPerder.length === 0, trasPerder.join());
  check('ni quita los que ya tenías', store.puede('beto', 'mexico'));
  check('pero el récord de puntos se guarda', store.ficha('beto').puntos === 9000,
    `${store.ficha('beto').puntos}`);

  // Volando juntos, el veterano presta lo suyo a los demás.
  const deLaEscuadrilla = store.desbloqueadosDe(['ana', 'beto']);
  check('la escuadrilla vuela lo que tenga cualquiera',
    deLaEscuadrilla.includes('colombia'), deLaEscuadrilla.join());
  check('y Beto solo, no', !store.puede('beto', 'colombia'));
  check('los de salida están siempre', deLaEscuadrilla.slice(0, 2).join() === 'usa,peru',
    deLaEscuadrilla.join());
  check('en el orden de la lista, no en el que se junten',
    deLaEscuadrilla.join() === 'usa,peru,mexico,colombia', deLaEscuadrilla.join());
  check('una escuadrilla de novatos vuela con los dos de salida',
    store.desbloqueadosDe(['nadie', null]).join() === 'usa,peru',
    store.desbloqueadosDe(['nadie', null]).join());

  // Un piloto sin identificador juega igual, pero no guarda nada.
  check('sin identificador se vuela con los dos de salida',
    store.desbloqueados(null).join() === 'usa,peru', store.desbloqueados(null).join());
  check('y no se le apunta nada', store.apuntar(null, terminado).length === 0);

  rmSync(fichero, { force: true });
}

console.log(`\n${passed} comprobaciones correctas, ${failed} fallidas`);
process.exit(failed === 0 ? 0 : 1);
