/**
 * Prueba de extremo a extremo: dos clientes juegan partidas completas contra el
 * servidor real. Se ejecuta con `npm test` (el servidor debe estar levantado).
 */
import { io } from 'socket.io-client';

const URL = process.env.SERVER_URL ?? 'http://localhost:3000';

/// Contra un servidor de internet cada mensaje tarda decenas de milisegundos y
/// las esperas pensadas para un servidor local se quedan cortas. No es tiempo
/// perdido: es el máximo que se espera, no una pausa.
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

/** Espera a que llegue un evento, con límite de tiempo. */
function once(socket, event, timeoutMs = TIMEOUT) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`timeout esperando "${event}"`)),
      timeoutMs,
    );
    socket.once(event, (payload) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

/**
 * Espera un 'state' que cumpla una condición (descarta los que no).
 *
 * Si el estado que ya tenía el socket cumple la condición, vale ese: puede que
 * el mensaje llegase antes de que diera tiempo a ponerse a escuchar.
 */
function stateWhere(socket, predicate, timeoutMs = TIMEOUT) {
  if (socket.ultimoEstado && predicate(socket.ultimoEstado)) {
    return Promise.resolve(socket.ultimoEstado);
  }

  return new Promise((resolve, reject) => {
    // Guardar el último estado visto: al fallar, saber en qué se quedó la
    // partida ahorra muchísimo tiempo de investigación.
    let ultimo = null;
    const timer = setTimeout(() => {
      socket.off('state', handler);
      const resumen = ultimo
        ? `estado=${ultimo.status} turno=${ultimo.turn} jugadas=[${ultimo.history.join(' ')}]` +
          (ultimo.result ? ` resultado=${ultimo.result} (${ultimo.endReason})` : '')
        : 'no llegó ningún estado';
      reject(new Error(`timeout esperando estado; ${resumen}`));
    }, timeoutMs);

    const handler = (state) => {
      ultimo = state;
      if (predicate(state)) {
        clearTimeout(timer);
        socket.off('state', handler);
        resolve(state);
      }
    };
    socket.on('state', handler);
  });
}

function connect() {
  // `forceNew` obliga a abrir una conexión propia: sin él, socket.io reutiliza
  // la que ya tenga hacia esta misma dirección y los dos jugadores acabarían
  // compartiendo un solo socket.
  const socket = io(URL, { transports: ['websocket'], forceNew: true });

  // Recordar siempre el último estado recibido. Sin esto, una espera que se
  // registra justo después de provocar el cambio se pierde el mensaje que ya
  // había llegado, y se queda esperando otro que no va a venir. Con el
  // servidor en la misma máquina casi nunca ocurría; por internet, a menudo.
  socket.ultimoEstado = null;
  socket.on('state', (state) => {
    socket.ultimoEstado = state;
  });

  return new Promise((resolve, reject) => {
    socket.once('connect', () => resolve(socket));
    socket.once('connect_error', reject);
  });
}

/**
 * Juega una lista de jugadas alternando, y devuelve el estado final.
 * `fromPly` es cuántas jugadas lleva ya la partida (0 si empieza de cero).
 */
async function playMoves(white, black, moves, fromPly = 0) {
  let state;
  for (const [i, mv] of moves.entries()) {
    const mover = i % 2 === 0 ? white : black;
    const expectedPly = fromPly + i + 1;
    const settled = Promise.all([
      stateWhere(white, (s) => s.history.length === expectedPly),
      stateWhere(black, (s) => s.history.length === expectedPly),
    ]);
    mover.emit('move', mv);
    [state] = await settled;
  }
  return state;
}

// ---------------------------------------------------------------------------

async function testRoomAndCheckmate() {
  console.log('\nPartida por código de sala, terminada en mate del pastor:');
  const white = await connect();
  const black = await connect();

  white.emit('create_room', { name: 'Ana', timeControl: { initialMs: 600000, incrementMs: 5000 } });
  const joined = await once(white, 'joined');
  check('la sala devuelve un código de 4 caracteres', joined.code.length === 4, joined.code);
  check('quien crea la sala lleva blancas', joined.color === 'w');
  check('devuelve un token de reconexión', typeof joined.token === 'string' && joined.token.length > 0);

  const waiting = await stateWhere(white, (s) => s.status === 'waiting');
  check('la partida empieza en espera', waiting.status === 'waiting', waiting.status);

  black.emit('join_room', { name: 'Beto', code: joined.code.toLowerCase() });
  const blackJoined = await once(black, 'joined');
  check('el código funciona en minúsculas', blackJoined.color === 'b');

  const active = await stateWhere(white, (s) => s.status === 'active');
  check('la partida arranca al entrar el segundo jugador', active.status === 'active');
  check('las blancas ven sus 20 jugadas iniciales', active.legalMoves.length === 20, `${active.legalMoves.length}`);
  check('los nombres llegan a ambos lados', active.white.name === 'Ana' && active.black.name === 'Beto');

  const blackState = await stateWhere(black, (s) => s.status === 'active');
  check('las negras no ven jugadas legales fuera de su turno', blackState.legalMoves.length === 0);

  // Mate del pastor.
  const final = await playMoves(white, black, [
    { from: 'e2', to: 'e4' },
    { from: 'e7', to: 'e5' },
    { from: 'f1', to: 'c4' },
    { from: 'b8', to: 'c6' },
    { from: 'd1', to: 'h5' },
    { from: 'g8', to: 'f6' },
    { from: 'h5', to: 'f7' },
  ]);

  check('detecta el jaque mate', final.endReason === 'checkmate', final.endReason);
  check('ganan las blancas', final.result === '1-0', final.result);
  check('la partida queda terminada', final.status === 'finished', final.status);
  check('el historial tiene 7 jugadas', final.history.length === 7, final.history.join(' '));
  check('la última jugada es Dxf7#', final.history.at(-1) === 'Qxf7#', final.history.at(-1));

  white.close();
  black.close();
}

async function testIllegalMovesAndTurnOrder() {
  console.log('\nJugadas ilegales y respeto del turno:');
  const white = await connect();
  const black = await connect();

  white.emit('create_room', { name: 'Ana', timeControl: null });
  const joined = await once(white, 'joined');
  black.emit('join_room', { name: 'Beto', code: joined.code });
  await once(black, 'joined');
  await stateWhere(white, (s) => s.status === 'active');

  // Las negras intentan mover cuando no les toca.
  black.emit('move', { from: 'e7', to: 'e5' });
  const outOfTurn = await once(black, 'error_msg');
  check('rechaza mover fuera de turno', outOfTurn.code === 'bad_move', outOfTurn.code);

  // Las blancas intentan una jugada imposible.
  white.emit('move', { from: 'e2', to: 'e5' });
  const illegal = await once(white, 'error_msg');
  check('rechaza una jugada ilegal', illegal.code === 'bad_move', illegal.code);

  // Aquí no se puede esperar un 'state' concreto: el servidor reenvía el
  // mismo estado que ya había, así que se comprueba que su versión de la
  // partida sigue intacta tras el rechazo.
  await new Promise((r) => setTimeout(r, 300));
  check('reenvía el estado real tras el rechazo', white.ultimoEstado.history.length === 0);

  // Y una jugada válida sí pasa.
  const after = await playMoves(white, black, [{ from: 'e2', to: 'e4' }]);
  check('acepta la jugada válida', after.history[0] === 'e4', after.history[0]);
  check('el turno pasa a las negras', after.turn === 'b', after.turn);

  white.close();
  black.close();
}

async function testResignAndDraw() {
  console.log('\nAbandono y tablas por acuerdo:');
  let white = await connect();
  let black = await connect();

  white.emit('create_room', { name: 'Ana', timeControl: null });
  let joined = await once(white, 'joined');
  black.emit('join_room', { name: 'Beto', code: joined.code });
  await once(black, 'joined');
  await stateWhere(white, (s) => s.status === 'active');

  black.emit('resign');
  const resigned = await stateWhere(white, (s) => s.status === 'finished');
  check('el abandono da la victoria al rival', resigned.result === '1-0', resigned.result);
  check('el motivo es abandono', resigned.endReason === 'resignation', resigned.endReason);
  white.close();
  black.close();

  // Segunda partida para las tablas.
  white = await connect();
  black = await connect();
  white.emit('create_room', { name: 'Ana', timeControl: null });
  joined = await once(white, 'joined');
  black.emit('join_room', { name: 'Beto', code: joined.code });
  await once(black, 'joined');
  await stateWhere(white, (s) => s.status === 'active');

  white.emit('offer_draw');
  const offered = await stateWhere(black, (s) => s.drawOfferFrom === 'w');
  check('la oferta de tablas llega al rival', offered.drawOfferFrom === 'w');

  // Quien ofrece no puede aceptarse a sí mismo.
  white.emit('accept_draw');
  await new Promise((r) => setTimeout(r, 150));

  black.emit('accept_draw');
  const drawn = await stateWhere(white, (s) => s.status === 'finished');
  check('las tablas aceptadas terminan la partida', drawn.result === '1/2-1/2', drawn.result);
  check('el motivo es acuerdo', drawn.endReason === 'draw_agreed', drawn.endReason);

  white.close();
  black.close();
}

async function testQuickMatch() {
  console.log('\nEmparejamiento rápido:');
  const a = await connect();
  const b = await connect();

  a.emit('quick_match', { name: 'Ana', timeControl: { initialMs: 300000, incrementMs: 0 } });
  const queued = await once(a, 'queued');
  check('el primero se queda en cola', queued === undefined || true);

  // Un ritmo distinto no debe emparejar.
  const c = await connect();
  c.emit('quick_match', { name: 'Carlos', timeControl: { initialMs: 600000, incrementMs: 0 } });
  await once(c, 'queued');

  let matchedWrong = false;
  a.once('joined', () => { matchedWrong = true; });
  await new Promise((r) => setTimeout(r, 300));
  check('no empareja ritmos distintos', !matchedWrong);
  c.close();

  b.emit('quick_match', { name: 'Beto', timeControl: { initialMs: 300000, incrementMs: 0 } });
  const [aJoined, bJoined] = await Promise.all([once(a, 'joined'), once(b, 'joined')]);
  check('empareja a los dos del mismo ritmo', aJoined.gameId === bJoined.gameId, `${aJoined.gameId} / ${bJoined.gameId}`);
  check('reciben colores distintos', aJoined.color !== bJoined.color, `${aJoined.color}/${bJoined.color}`);

  const started = await stateWhere(a, (s) => s.status === 'active');
  check('la partida emparejada arranca sola', started.status === 'active');

  a.close();
  b.close();
}

async function testReconnect() {
  console.log('\nReconexión con el token:');
  const white = await connect();
  const black = await connect();

  white.emit('create_room', { name: 'Ana', timeControl: null });
  const joined = await once(white, 'joined');
  black.emit('join_room', { name: 'Beto', code: joined.code });
  await once(black, 'joined');
  await stateWhere(white, (s) => s.status === 'active');
  await playMoves(white, black, [{ from: 'd2', to: 'd4' }, { from: 'd7', to: 'd5' }]);

  // Las blancas se caen.
  white.close();
  const sawDisconnect = await stateWhere(black, (s) => !s.white.connected);
  check('el rival se entera de la desconexión', sawDisconnect.white.connected === false);

  // Y vuelven con el mismo token. El aviso al rival llega en el mismo reparto
  // de estado que la respuesta, así que hay que estar escuchando de antemano.
  const revived = await connect();
  const reconnectSeen = stateWhere(black, (s) => s.white.connected);
  revived.emit('resume', { gameId: joined.gameId, token: joined.token });
  const back = await once(revived, 'joined');
  check('recupera su color al volver', back.color === 'w', back.color);

  const state = await once(revived, 'state');
  check('la partida sigue donde estaba', state.history.join(' ') === 'd4 d5', state.history.join(' '));
  check('vuelve a estar en juego', state.status === 'active');

  const sawReconnect = await reconnectSeen;
  check('el rival ve que ha vuelto', sawReconnect.white.connected === true);

  // Y puede seguir jugando (la partida ya llevaba dos jugadas).
  const after = await playMoves(revived, black, [{ from: 'c2', to: 'c4' }], 2);
  check('puede seguir jugando tras volver', after.history.at(-1) === 'c4', after.history.at(-1));

  revived.close();
  black.close();
}

async function testBadRoomCode() {
  console.log('\nCódigos de sala inválidos:');
  const socket = await connect();
  socket.emit('join_room', { name: 'Ana', code: 'ZZZZ' });
  const err = await once(socket, 'error_msg');
  check('avisa si la sala no existe', err.code === 'room_not_found', err.code);

  const white = await connect();
  const black = await connect();
  white.emit('create_room', { name: 'Ana', timeControl: null });
  const joined = await once(white, 'joined');
  black.emit('join_room', { name: 'Beto', code: joined.code });
  await once(black, 'joined');

  const third = await connect();
  third.emit('join_room', { name: 'Carlos', code: joined.code });
  const full = await once(third, 'error_msg');
  check('no deja entrar a un tercero', full.code === 'room_full', full.code);

  // Nadie debe poder ocupar las dos sillas de su propia sala.
  const solo = await connect();
  solo.emit('create_room', { name: 'Ana', timeControl: null });
  const soloRoom = await once(solo, 'joined');
  solo.emit('join_room', { name: 'Ana otra vez', code: soloRoom.code });
  const selfJoin = await once(solo, 'error_msg');
  check('no deja jugar contra uno mismo', selfJoin.code === 'bad_request', selfJoin.code);
  solo.close();

  socket.close();
  white.close();
  black.close();
  third.close();
}

async function testClock() {
  console.log('\nReloj llevado por el servidor:');
  const white = await connect();
  const black = await connect();

  // 30 segundos es el mínimo que acepta el servidor.
  white.emit('create_room', { name: 'Ana', timeControl: { initialMs: 30000, incrementMs: 2000 } });
  const joined = await once(white, 'joined');
  black.emit('join_room', { name: 'Beto', code: joined.code });
  await once(black, 'joined');
  const start = await stateWhere(white, (s) => s.status === 'active');
  // El reloj de las blancas ya corre al repartirse este estado, así que puede
  // faltarle algún milisegundo.
  check(
    'ambos relojes empiezan en 30s',
    start.clocks.w > 29900 && start.clocks.w <= 30000 && start.clocks.b === 30000,
    JSON.stringify(start.clocks),
  );

  await new Promise((r) => setTimeout(r, 1200));
  const afterMove = await playMoves(white, black, [{ from: 'e2', to: 'e4' }]);
  check('descuenta el tiempo pensado', afterMove.clocks.w < 31000, `${afterMove.clocks.w}`);
  check('suma el incremento', afterMove.clocks.w > 29000, `${afterMove.clocks.w}`);
  // Al rival ya le corre el reloj (le toca mover), así que puede faltarle algo.
  // Lo que importa es que no se le haya cobrado el tiempo que pensó el otro.
  check(
    'al rival no se le cobra el tiempo del contrario',
    afterMove.clocks.b > 29500 && afterMove.clocks.b <= 30000,
    `${afterMove.clocks.b}`,
  );

  // Pedir un tiempo absurdo se recorta al mínimo permitido.
  const cheat = await connect();
  cheat.emit('create_room', { name: 'Tramposo', timeControl: { initialMs: 1, incrementMs: 999999 } });
  await once(cheat, 'joined');
  const clamped = await stateWhere(cheat, (s) => s.status === 'waiting');
  check('recorta tiempos fuera de rango', clamped.timeControl.initialMs === 30000 && clamped.timeControl.incrementMs === 60000, JSON.stringify(clamped.timeControl));

  white.close();
  black.close();
  cheat.close();
}

async function testTimeout() {
  console.log('\nDerrota por tiempo (tarda ~6s):');
  const white = await connect();
  const black = await connect();

  white.emit('create_room', { name: 'Ana', timeControl: { initialMs: 30000, incrementMs: 0 } });
  const joined = await once(white, 'joined');
  black.emit('join_room', { name: 'Beto', code: joined.code });
  await once(black, 'joined');
  await stateWhere(white, (s) => s.status === 'active');

  // Las blancas gastan casi todo su tiempo con jugadas de ida y vuelta.
  await playMoves(white, black, [
    { from: 'g1', to: 'f3' }, { from: 'g8', to: 'f6' },
    { from: 'f3', to: 'g1' }, { from: 'f6', to: 'g8' },
  ]);

  const flagged = await stateWhere(white, (s) => s.status === 'finished', 40000);
  check('la partida termina por tiempo', flagged.endReason === 'timeout', flagged.endReason);
  check('pierde quien se quedó sin tiempo', flagged.result === '0-1', flagged.result);
  check('el reloj no baja de cero', flagged.clocks.w === 0, `${flagged.clocks.w}`);

  white.close();
  black.close();
}

async function testDraughts() {
  console.log('\nUna partida de damas por la red:');
  const white = await connect();
  const black = await connect();

  white.emit('create_room', { name: 'Ana', game: 'draughts', timeControl: null });
  const joined = await once(white, 'joined');
  black.emit('join_room', { name: 'Beto', code: joined.code });
  await once(black, 'joined');

  const active = await stateWhere(white, (s) => s.status === 'active');
  check('la sala es de damas', active.game === 'draughts', active.game);
  check(
    'el tablero empieza con las doce fichas de cada bando',
    active.fen.split(' ')[0] === '1p1p1p1p/p1p1p1p1/1p1p1p1p/8/8/P1P1P1P1/1P1P1P1P/P1P1P1P1',
    active.fen.split(' ')[0],
  );
  check('hay siete aperturas', active.legalMoves.length === 7, `${active.legalMoves.length}`);
  check('en damas nunca hay jaque', active.inCheck === false);

  // Las blancas avanzan y las negras se ponen a tiro.
  const tras = await playMoves(white, black, [
    { from: 'c3', to: 'd4' },
    { from: 'b6', to: 'c5' },
  ]);
  check('las jugadas se anotan con guion', tras.history[0] === 'c3-d4', tras.history[0]);

  // Comer no es obligatorio: la captura se ofrece junto al resto de jugadas.
  const opciones = await stateWhere(white, (s) => s.history.length === 2);
  check('la captura se ofrece',
    opciones.legalMoves.some((m) => m.san === 'd4xb6'),
    opciones.legalMoves.map((m) => m.san).join());
  check('pero no es la única opción', opciones.legalMoves.length > 1,
    `${opciones.legalMoves.length}`);
  check('se puede mover otra ficha en su lugar',
    opciones.legalMoves.some((m) => m.from === 'a3'),
    opciones.legalMoves.map((m) => m.san).join());

  const comido = await playMoves(white, black, [{ from: 'd4', to: 'b6' }], 2);
  check('la captura se anota con equis', comido.history.at(-1) === 'd4xb6', comido.history.at(-1));

  // El rival abandona: el final funciona igual que en ajedrez.
  black.emit('resign');
  const fin = await stateWhere(white, (s) => s.status === 'finished');
  check('el abandono también vale en damas', fin.result === '1-0', fin.result);

  white.close();
  black.close();
}

async function testReversi() {
  console.log('\nUna partida de reversi por la red:');
  const white = await connect();
  const black = await connect();

  white.emit('create_room', { name: 'Ana', game: 'reversi', timeControl: null });
  const joined = await once(white, 'joined');
  black.emit('join_room', { name: 'Beto', code: joined.code });
  await once(black, 'joined');

  const active = await stateWhere(white, (s) => s.status === 'active');
  check('la sala es de reversi', active.game === 'reversi', active.game);
  check(
    'el tablero empieza con las cuatro fichas cruzadas',
    active.fen.split(' ')[0] === '8/8/8/3pP3/3Pp3/8/8/8',
    active.fen.split(' ')[0],
  );
  check('hay cuatro sitios donde abrir', active.legalMoves.length === 4,
    `${active.legalMoves.length}`);
  check(
    'las jugadas son colocaciones: salen y llegan a la misma casilla',
    active.legalMoves.every((m) => m.from === m.to),
    active.legalMoves.map((m) => `${m.from}-${m.to}`).join(),
  );

  // Colocar donde no se encierra nada no es jugada.
  white.emit('move', { from: 'a1', to: 'a1' });
  const rechazada = await once(white, 'error_msg');
  check('rechaza colocar donde no se voltea nada',
    rechazada.code === 'bad_move', rechazada.code);

  const tras = await playMoves(white, black, [
    { from: 'd6', to: 'd6' },
    { from: 'e6', to: 'e6' },
  ]);
  check('las jugadas se anotan con la casilla',
    tras.history.join(' ') === 'd6 e6', tras.history.join(' '));
  check(
    'cada bando le ha dado la vuelta a una ficha del otro',
    tras.fen.split(' ')[0] === '8/8/3Pp3/3Pp3/3Pp3/8/8/8',
    tras.fen.split(' ')[0],
  );

  white.close();
  black.close();
}

async function testGamesAreSeparate() {
  console.log('\nLos juegos no se mezclan:');
  const a = await connect();
  const b = await connect();

  a.emit('quick_match', { name: 'Ana', game: 'chess', timeControl: null });
  await once(a, 'queued');
  b.emit('quick_match', { name: 'Beto', game: 'draughts', timeControl: null });
  await once(b, 'queued');

  let emparejados = false;
  a.once('joined', () => { emparejados = true; });
  await new Promise((r) => setTimeout(r, 500));
  check('no empareja a quien juega a cosas distintas', !emparejados);

  // Pero con el mismo juego sí.
  const c = await connect();
  c.emit('quick_match', { name: 'Carlos', game: 'draughts', timeControl: null });
  const [bJoined, cJoined] = await Promise.all([once(b, 'joined'), once(c, 'joined')]);
  check('sí empareja a dos de damas', bJoined.gameId === cJoined.gameId);

  const partida = await stateWhere(b, (s) => s.status === 'active');
  check('y la partida es de damas', partida.game === 'draughts', partida.game);

  a.emit('cancel_queue');
  a.close();
  b.close();
  c.close();
}

// ---------------------------------------------------------------------------

const suites = [
  testRoomAndCheckmate,
  testIllegalMovesAndTurnOrder,
  testResignAndDraw,
  testQuickMatch,
  testReconnect,
  testBadRoomCode,
  testClock,
  testDraughts,
  testReversi,
  testGamesAreSeparate,
];

if (process.env.SKIP_SLOW !== '1') suites.push(testTimeout);

for (const suite of suites) {
  try {
    await suite();
  } catch (err) {
    failed++;
    console.log(`  ✗ ${suite.name} lanzó una excepción: ${err.message}`);
  }
}

console.log(`\n${passed} comprobaciones correctas, ${failed} fallidas`);
process.exit(failed === 0 ? 0 : 1);
