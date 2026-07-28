/**
 * Prueba de la sala de tanques y de la partida por la red, con clientes reales
 * contra el servidor. Requiere el servidor levantado.
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
  // Guardar lo último de cada tipo, para no perderse mensajes por llegar tarde
  // a escuchar. Es el mismo problema que dio guerra en las pruebas de ajedrez.
  socket.lastLobby = null;
  socket.lastState = null;
  socket.on('tank_lobby', (l) => (socket.lastLobby = l));
  socket.on('tank_state', (s) => {
    // Los muros solo viajan cuando cambian, así que hay que guardarlos igual
    // que hace la app: quedándose con el último estado a secas se perderían.
    if (s.walls !== undefined) socket.walls = s.walls;
    socket.lastState = s;
  });
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

/** Espera a que se cumpla algo sobre el último mensaje recibido. */
async function until(socket, field, predicate, what, timeoutMs = TIMEOUT) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = socket[field];
    if (value && predicate(value)) return value;
    await new Promise((r) => setTimeout(r, 40));
  }
  throw new Error(`timeout esperando ${what}; último: ${JSON.stringify(socket[field])?.slice(0, 200)}`);
}

// ---------------------------------------------------------------------------

async function testLobby() {
  console.log('\nLa sala y los colores:');
  const ana = await connect();
  const beto = await connect();

  ana.emit('tank_create', { name: 'Ana', tankCount: 5 });
  const joined = await once(ana, 'tank_joined');
  check('la sala tiene código de 4 caracteres', joined.code.length === 4, joined.code);

  const lobby = await until(ana, 'lastLobby', (l) => l.players.length === 1, 'la sala');
  check('quien crea la sala es el anfitrión', lobby.youAreHost === true);
  check('el número de tanques es el pedido', lobby.tankCount === 5, `${lobby.tankCount}`);
  check('ofrece ocho colores', lobby.colors.length === 8, `${lobby.colors.length}`);
  check('aún no hay ninguno cogido', lobby.taken.length === 0);
  check('no se puede empezar solo', lobby.canStart === false);

  beto.emit('tank_join', { code: joined.code, name: 'Beto' });
  await once(beto, 'tank_joined');
  const conDos = await until(ana, 'lastLobby', (l) => l.players.length === 2, 'el segundo jugador');
  check('el segundo entra en la sala', conDos.players.length === 2);
  check('y no es el anfitrión',
    conDos.players.find((p) => p.name === 'Beto').isHost === false);

  // Ana elige rojo.
  ana.emit('tank_pick_color', { color: 'rojo' });
  const conRojo = await until(ana, 'lastLobby', (l) => l.taken.includes('rojo'), 'el color rojo');
  check('el color elegido queda marcado', conRojo.taken.includes('rojo'));
  check('y se sabe cuál es el tuyo', conRojo.yourColor === 'rojo', conRojo.yourColor);

  // Beto intenta el mismo color: debe rechazarse.
  beto.emit('tank_pick_color', { color: 'rojo' });
  const error = await once(beto, 'error_msg');
  check('un color cogido no se puede volver a elegir', /ya lo ha cogido/i.test(error.message), error.message);

  const betoLobby = await until(beto, 'lastLobby', () => true, 'la sala de Beto');
  check('y sigue sin color', betoLobby.yourColor === null, betoLobby.yourColor);

  check('todavía no se puede empezar', betoLobby.canStart === false);
  beto.emit('tank_pick_color', { color: 'azul' });
  const listos = await until(ana, 'lastLobby', (l) => l.canStart === true, 'poder empezar');
  check('con todos con color ya se puede empezar', listos.canStart === true);
  check('los dos colores figuran cogidos',
    listos.taken.includes('rojo') && listos.taken.includes('azul'), listos.taken.join());

  ana.close();
  beto.close();
}

async function testMatch() {
  console.log('\nLa partida en marcha:');
  const ana = await connect();
  const beto = await connect();

  ana.emit('tank_create', { name: 'Ana', tankCount: 4 });
  const joined = await once(ana, 'tank_joined');
  beto.emit('tank_join', { code: joined.code, name: 'Beto' });
  await once(beto, 'tank_joined');
  ana.emit('tank_pick_color', { color: 'verde' });
  beto.emit('tank_pick_color', { color: 'morado' });
  await until(ana, 'lastLobby', (l) => l.canStart, 'poder empezar');

  // Solo el anfitrión puede arrancar.
  beto.emit('tank_start');
  await new Promise((r) => setTimeout(r, 300));
  check('solo el anfitrión puede empezar', beto.lastState === null);

  ana.emit('tank_start');
  const estado = await until(ana, 'lastState', (s) => s.status === 'playing', 'el arranque');

  check('salen cuatro tanques', estado.tanks.length === 4, `${estado.tanks.length}`);
  check('dos son de jugadores', estado.tanks.filter((t) => t.name).length === 2);
  check('los otros dos son de la máquina, en plomo',
    estado.tanks.filter((t) => !t.name).every((t) => t.color === '#8E8E93'));
  check('cada uno sabe cuál es su tanque', typeof estado.yourTankId === 'string', `${estado.yourTankId}`);
  check('llega el campo de muros',
    typeof ana.walls === 'string' && ana.walls.length === 26 * 26,
    `${ana.walls?.length}`);
  check('los colores elegidos se respetan',
    estado.tanks.some((t) => t.color === '#2FBF71') && estado.tanks.some((t) => t.color === '#9B5DE5'));

  // El mundo avanza solo, sin que nadie haga nada.
  const antes = JSON.stringify(estado.tanks.map((t) => [t.x, t.y]));
  await new Promise((r) => setTimeout(r, 800));
  const despues = JSON.stringify(ana.lastState.tanks.map((t) => [t.x, t.y]));
  check('el mundo avanza sin esperar a nadie', antes !== despues);

  // Mover el propio tanque.
  const miTanque = () => ana.lastState.tanks.find((t) => t.id === ana.lastState.yourTankId);
  const posicionInicial = { x: miTanque().x, y: miTanque().y };
  ana.emit('tank_input', { dir: 'right', firing: false });
  await new Promise((r) => setTimeout(r, 600));
  ana.emit('tank_input', { dir: null, firing: false });
  const movido = miTanque();
  check('mi tanque responde a los mandos',
    movido.x !== posicionInicial.x || movido.y !== posicionInicial.y,
    `${posicionInicial.x},${posicionInicial.y} -> ${movido.x},${movido.y}`);
  check('mira hacia donde lo he movido', movido.dir === 'right', movido.dir);

  // Disparar.
  ana.emit('tank_input', { dir: null, firing: true });
  await new Promise((r) => setTimeout(r, 200));
  ana.emit('tank_input', { dir: null, firing: false });
  check('las balas llegan al cliente', Array.isArray(ana.lastState.bullets));

  // Los muros solo viajan cuando cambian.
  const conMuros = [];
  const contar = (s) => conMuros.push(s.walls !== undefined);
  ana.on('tank_state', contar);
  await new Promise((r) => setTimeout(r, 500));
  ana.off('tank_state', contar);
  check('los muros no se mandan en cada mensaje',
    conMuros.filter(Boolean).length < conMuros.length,
    `${conMuros.filter(Boolean).length} de ${conMuros.length}`);

  check('los dos jugadores reciben el mundo', beto.lastState?.status === 'playing');
  check('y cada uno ve su propio tanque',
    beto.lastState.yourTankId !== ana.lastState.yourTankId,
    `${beto.lastState.yourTankId} / ${ana.lastState.yourTankId}`);

  ana.close();
  beto.close();
}

async function testFullRoom() {
  console.log('\nLímites de la sala:');
  const ana = await connect();
  ana.emit('tank_create', { name: 'Ana', tankCount: 2 });
  const joined = await once(ana, 'tank_joined');

  const beto = await connect();
  beto.emit('tank_join', { code: joined.code, name: 'Beto' });
  await once(beto, 'tank_joined');

  // Con dos tanques pedidos no cabe un tercero.
  const carlos = await connect();
  carlos.emit('tank_join', { code: joined.code, name: 'Carlos' });
  const error = await once(carlos, 'error_msg');
  check('no entran más jugadores que tanques', /completa/i.test(error.message), error.message);

  const inexistente = await connect();
  inexistente.emit('tank_join', { code: 'ZZZZ', name: 'Nadie' });
  const noExiste = await once(inexistente, 'error_msg');
  check('avisa si la sala no existe', /No existe/i.test(noExiste.message), noExiste.message);

  ana.close();
  beto.close();
  carlos.close();
  inexistente.close();
}

async function testMapaDibujado() {
  console.log('\nJugar en un mapa dibujado:');

  // Un mapa reconocible: una franja de acero en la fila 5 y el resto vacío.
  const celdas = Array(26 * 26).fill('0');
  for (let x = 0; x < 26; x++) celdas[5 * 26 + x] = '2';
  const dibujo = celdas.join('');

  const guardado = await fetch(`${URL}/api/maps`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Franja de acero', cells: dibujo }),
  }).then((r) => r.json());
  check('el mapa se guarda desde el editor', typeof guardado.id === 'string', guardado.error);

  const ana = await connect();
  const beto = await connect();
  ana.emit('tank_create', { name: 'Ana', tankCount: 2 });
  const joined = await once(ana, 'tank_joined');
  beto.emit('tank_join', { code: joined.code, name: 'Beto' });
  await once(beto, 'tank_joined');

  ana.emit('tank_set_map', { mapId: guardado.id });
  const conMapa = await until(ana, 'lastLobby', (l) => l.mapId === guardado.id, 'el mapa elegido');
  check('la sala anuncia el mapa elegido', conMapa.mapName === 'Franja de acero', conMapa.mapName);
  check('y el mapa aparece en la lista de la sala',
    conMapa.maps.some((m) => m.id === guardado.id));

  const betoLobby = await until(beto, 'lastLobby', (l) => l.mapId === guardado.id, 'el mapa en el otro');
  check('el rival también lo ve', betoLobby.mapName === 'Franja de acero', betoLobby.mapName);

  ana.emit('tank_pick_color', { color: 'rojo' });
  beto.emit('tank_pick_color', { color: 'azul' });
  await until(ana, 'lastLobby', (l) => l.canStart, 'poder empezar');
  ana.emit('tank_start');
  await until(ana, 'lastState', (s) => s.status === 'playing', 'el arranque');

  const fila5 = ana.walls.slice(5 * 26, 6 * 26);
  check('se juega en el mapa dibujado, no en uno generado',
    fila5 === '2'.repeat(26), fila5);

  await fetch(`${URL}/api/maps/${guardado.id}`, { method: 'DELETE' });
  ana.close();
  beto.close();
}

// ---------------------------------------------------------------------------

for (const suite of [testLobby, testMatch, testFullRoom, testMapaDibujado]) {
  try {
    await suite();
  } catch (err) {
    failed++;
    console.log(`  ✗ ${suite.name} lanzó una excepción: ${err.message}`);
  }
}

console.log(`\n${passed} comprobaciones correctas, ${failed} fallidas`);
process.exit(failed === 0 ? 0 : 1);
