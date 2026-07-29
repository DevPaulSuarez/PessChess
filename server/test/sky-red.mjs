/**
 * Sky Warriors por la red: dos pilotos, cada uno con su cliente, volando el
 * mismo escenario contra el servidor real. Requiere el servidor levantado.
 *
 * Lo que se comprueba aquí no lo puede comprobar la simulación de un solo
 * proceso: que dos móviles distintos ven el mismo mundo, que el mando de cada
 * uno mueve su nave y no la del otro, y que quien se cae puede volver a la suya.
 *
 * Se ejecuta con `npm run test:sky-red`.
 */
import { io } from 'socket.io-client';

const URL = process.env.SERVER_URL ?? 'http://localhost:3000';
const TIMEOUT = Number(process.env.TIMEOUT_MS ?? (URL.startsWith('https') ? 20000 : 5000));

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

function connect() {
  const socket = io(URL, { transports: ['websocket'], forceNew: true });
  // Guardar lo último de cada tipo: escuchar tarde no debe costar un mensaje.
  socket.lastLobby = null;
  socket.lastState = null;
  socket.lastResult = null;
  socket.on('sky_lobby', (l) => (socket.lastLobby = l));
  socket.on('sky_state', (s) => (socket.lastState = s));
  socket.on('sky_result', (r) => (socket.lastResult = r));
  return new Promise((resolve, reject) => {
    socket.once('connect', () => resolve(socket));
    socket.once('connect_error', reject);
  });
}

function once(socket, event, timeoutMs = TIMEOUT) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout esperando "${event}"`)), timeoutMs);
    socket.once(event, (payload) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

async function until(socket, field, predicate, what, timeoutMs = TIMEOUT) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = socket[field];
    if (value && predicate(value)) return value;
    await new Promise((r) => setTimeout(r, 40));
  }
  throw new Error(`timeout esperando ${what}; último: ${JSON.stringify(socket[field])?.slice(0, 200)}`);
}

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

/** Mantener el mando pulsado un rato, como haría un dedo. */
async function pilotar(socket, mando, ms) {
  const hasta = Date.now() + ms;
  while (Date.now() < hasta) {
    socket.emit('sky_input', mando);
    await espera(33);
  }
}

// ---------------------------------------------------------------------------

async function testEscuadrilla() {
  console.log('\nLa escuadrilla:');
  const ana = await connect();
  const beto = await connect();

  ana.emit('sky_create', { name: 'Ana', pilotId: `prueba-${Date.now()}` });
  const creada = await once(ana, 'sky_joined');
  check('la escuadrilla tiene código de 4 caracteres', creada.code.length === 4, creada.code);
  check('y le manda los veintiún países', creada.paises.length === 21, `${creada.paises.length}`);
  check('cada país trae sus dos naves', creada.paises.every((p) => p.naves.length === 2));

  check('el progreso empieza a cero', creada.progreso.insignias === 0, `${creada.progreso.insignias}`);

  // Se empieza con dos países y los demás hay que ganárselos. Cuáles se pueden
  // volar lo dice la sala, porque depende de quién esté en ella.
  const sinNadie = await until(ana, 'lastLobby', (l) => l.pilotos.length === 1, 'la sala');
  check('de salida solo hay dos países', sinNadie.desbloqueados.length === 2,
    sinNadie.desbloqueados.join());
  check('y son Estados Unidos y Perú', sinNadie.desbloqueados.join() === 'usa,peru',
    sinNadie.desbloqueados.join());
  check('los otros diecinueve se ven igual', creada.paises.length - sinNadie.desbloqueados.length === 19);
  check('entre novatos, lo prestado y lo propio es lo mismo',
    sinNadie.tuyos.join() === sinNadie.desbloqueados.join(),
    `${sinNadie.tuyos.join()} vs ${sinNadie.desbloqueados.join()}`);

  const sola = sinNadie;
  check('quien la crea es el anfitrión', sola.eresHost === true);
  check('todavía no se puede despegar', sola.puedeEmpezar === false);

  beto.emit('sky_join', { code: creada.code, name: 'Beto' });
  const entrada = await once(beto, 'sky_joined');
  check('el segundo piloto entra con el código', entrada.code === creada.code);
  check('y ocupa el segundo sitio', entrada.indice === 1, `${entrada.indice}`);

  const dos = await until(ana, 'lastLobby', (l) => l.pilotos.length === 2, 'los dos pilotos');
  check('los dos se ven en la sala', dos.pilotos.map((p) => p.nombre).join(',') === 'Ana,Beto');
  check('Beto no es el anfitrión', (await until(beto, 'lastLobby', () => true, 'sala')).eresHost === false);

  ana.emit('sky_start');
  const error = await once(ana, 'error_msg');
  check('no se despega sin haber elegido nave', /elegir/i.test(error.message), error.message);

  ana.emit('sky_pick', { paisId: 'espana', naveIndice: 0 });
  const bloqueado = await once(ana, 'error_msg');
  check('no se puede volar un país sin desbloquear', /desbloque/i.test(bloqueado.message), bloqueado.message);

  ana.emit('sky_pick', { paisId: 'usa', naveIndice: 0 });
  await until(ana, 'lastLobby', (l) => l.pilotos[0].listo, 'la nave de Ana');

  // Cada piloto lleva la suya: dos naves iguales en el aire no se distinguen.
  beto.emit('sky_pick', { paisId: 'usa', naveIndice: 0 });
  const repetida = await once(beto, 'error_msg');
  check('dos pilotos no pueden llevar la misma nave', /ya la lleva/i.test(repetida.message),
    repetida.message);

  // La otra nave del mismo país sí está libre.
  beto.emit('sky_pick', { paisId: 'usa', naveIndice: 1 });
  const mismoPais = await until(ana, 'lastLobby', (l) => l.pilotos[1].listo, 'la nave de Beto');
  check('la otra nave del mismo país sí se puede', mismoPais.pilotos[1].naveIndice === 1,
    `${mismoPais.pilotos[1].naveIndice}`);
  check('la sala dice qué naves están cogidas', mismoPais.ocupadas.length === 2,
    JSON.stringify(mismoPais.ocupadas));

  beto.emit('sky_pick', { paisId: 'peru', naveIndice: 1 });
  const listos = await until(ana, 'lastLobby', (l) => l.pilotos[1].paisId === 'peru', 'el cambio de Beto');
  check('cada uno lleva su país', listos.pilotos.map((p) => p.paisId).join(',') === 'usa,peru');
  check('cambiar de nave libera la anterior',
    !listos.ocupadas.some((o) => o.paisId === 'usa' && o.naveIndice === 1),
    JSON.stringify(listos.ocupadas));
  check('ahora sí se puede despegar', listos.puedeEmpezar === true);

  beto.emit('sky_start');
  const denegado = await once(beto, 'error_msg');
  check('solo el anfitrión despega', /anfitri|creó/i.test(denegado.message), denegado.message);

  return { ana, beto, code: creada.code, tokenBeto: entrada.token };
}

async function testVuelo({ ana, beto }) {
  console.log('\nEl vuelo:');

  ana.emit('sky_start');
  const volando = await until(ana, 'lastLobby', (l) => l.estado === 'playing', 'el despegue');
  check('la escuadrilla despega', volando.estado === 'playing');

  const estadoAna = await until(ana, 'lastState', (s) => s.j.length === 2, 'el primer fotograma');
  const estadoBeto = await until(beto, 'lastState', (s) => s.j.length === 2, 'el fotograma de Beto');
  check('los dos reciben el mundo', estadoAna.j.length === 2 && estadoBeto.j.length === 2);
  check('cada uno sabe cuál es su nave', estadoAna.tuIndice === 0 && estadoBeto.tuIndice === 1);
  check('las vidas son del equipo', estadoAna.vidas === 5, `${estadoAna.vidas}`);

  // El motor pone a los dos jugadores en su sitio de la formación.
  const xInicialAna = estadoAna.j[0][1];
  const xInicialBeto = estadoAna.j[1][1];

  // Ana empuja a la izquierda un buen rato; Beto no toca nada.
  await pilotar(ana, { x: -1, y: 0, disparo: true }, 700);
  const movido = await until(ana, 'lastState', (s) => s.j[0][1] < xInicialAna - 20, 'que Ana se mueva');

  check('el mando de cada uno mueve su nave', movido.j[0][1] < xInicialAna - 20,
    `${movido.j[0][1]} vs ${xInicialAna}`);
  check('y no la del compañero', Math.abs(movido.j[1][1] - xInicialBeto) < 5,
    `${movido.j[1][1]} vs ${xInicialBeto}`);

  const desdeBeto = beto.lastState;
  check('los dos ven a Ana en el mismo sitio', Math.abs(desdeBeto.j[0][1] - movido.j[0][1]) < 40,
    `${desdeBeto.j[0][1]} vs ${movido.j[0][1]}`);

  check('disparar llena el cielo de balas', movido.bj.length > 0, `${movido.bj.length}`);
  check('las balas viajan como números, no como texto', Array.isArray(movido.bj[0]));
  check('con su tabla de estilos', movido.est.length > 0 && movido.est[0].includes('|'));

  const conEnemigos = await until(ana, 'lastState', (s) => s.en.length > 0, 'la primera oleada', 15000);
  check('bajan enemigos', conEnemigos.en.length > 0, `${conEnemigos.en.length}`);
  check('el escenario lleva la cuenta de lo generado', conEnemigos.gen > 0, `${conEnemigos.gen}`);

  // El fotograma siempre avanza: es lo que deja al cliente tirar lo que llegue
  // desordenado.
  const antes = ana.lastState.f;
  await espera(300);
  check('el número de fotograma avanza', ana.lastState.f > antes, `${antes} → ${ana.lastState.f}`);
}

async function testBombaYReconexion({ ana, beto, code, tokenBeto }) {
  console.log('\nBombas y caídas:');

  const antes = ana.lastState.j[0][6];
  ana.emit('sky_input', { x: 0, y: 0, disparo: false, bomba: true });
  const gastada = await until(ana, 'lastState', (s) => s.j[0][6] < antes, 'que se gaste la bomba');
  check('el botón de bomba gasta una sola', gastada.j[0][6] === antes - 1,
    `${antes} → ${gastada.j[0][6]}`);

  // Mantener el botón pulsado no debe vaciar el arsenal: es una pulsación.
  const trasUna = gastada.j[0][6];
  await pilotar(ana, { x: 0, y: 0, disparo: false, bomba: true }, 300);
  await espera(200);
  check('tenerlo pulsado no gasta todas', ana.lastState.j[0][6] >= trasUna - 2,
    `${trasUna} → ${ana.lastState.j[0][6]}`);

  // Un móvil que se queda sin cobertura no debe tirar la partida de los demás.
  beto.disconnect();
  await espera(500);
  const sinBeto = ana.lastState.f;
  await espera(300);
  check('la partida sigue sin el que se cayó', ana.lastState.f > sinBeto,
    `${sinBeto} → ${ana.lastState.f}`);
  check('y su nave sigue en el aire', ana.lastState.j.length === 2, `${ana.lastState.j.length}`);

  const vuelto = await connect();
  vuelto.emit('sky_resume', { code, token: tokenBeto });
  const recuperado = await once(vuelto, 'sky_joined');
  check('quien se cayó vuelve a su nave', recuperado.indice === 1, `${recuperado.indice}`);

  const suyo = await until(vuelto, 'lastState', (s) => s.j.length === 2, 'el mundo otra vez');
  check('y recibe el mundo donde iba', suyo.f > 0 && suyo.tuIndice === 1);
  vuelto.disconnect();
}

async function main() {
  console.log(`Sky Warriors por la red contra ${URL}`);
  const sala = await testEscuadrilla();
  await testVuelo(sala);
  await testBombaYReconexion(sala);

  sala.ana.disconnect();
  sala.beto.disconnect();

  console.log(`\n${passed} comprobaciones correctas, ${failed} fallidas`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error('\nLa prueba se rompió:', error.message);
  process.exit(1);
});
