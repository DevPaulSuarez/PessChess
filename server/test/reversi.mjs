/**
 * Pruebas de las reglas del reversi, sin red ni servidor.
 *
 * Se ejecutan con `npm run test:reversi` sobre el código ya compilado, así que
 * antes hay que hacer `npm run build`.
 */
import { ReversiRules } from '../dist/rules/reversi.js';

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

/** El tablero como texto, para comparar posiciones de un vistazo. */
const board = (rules) => rules.fen().split(' ')[0];

/** Las casillas donde se puede colocar ahora mismo. */
const options = (rules) =>
  rules
    .legalMoves()
    .map((m) => m.to)
    .sort();

/** Coloca en una casilla y falla si la jugada fue rechazada. */
function place(rules, ...squares) {
  for (const square of squares) {
    if (!rules.move(square, square)) {
      throw new Error(`la jugada ${square} fue rechazada`);
    }
  }
}

/** Quién ocupa una casilla: 'W', 'B' o '.'. */
function at(rules, square) {
  const file = square.charCodeAt(0) - 97;
  const rank = Number(square.slice(1));
  const row = board(rules).split('/')[8 - rank];

  let index = 0;
  for (const cell of row) {
    const empty = Number(cell);
    if (empty) {
      if (file < index + empty) return '.';
      index += empty;
      continue;
    }
    if (index === file) return cell === 'P' ? 'W' : 'B';
    index++;
  }
  return '.';
}

// ---------------------------------------------------------------------------

console.log('\nPosición inicial:');
{
  const r = new ReversiRules();
  check(
    'cuatro fichas cruzadas en el centro',
    board(r) === '8/8/8/3pP3/3Pp3/8/8/8',
    board(r),
  );
  check('empiezan las blancas', r.turn() === 'w', r.turn());
  check('dos fichas por bando', r.count('w') === 2 && r.count('b') === 2);
  check(
    'cuatro sitios donde abrir',
    options(r).join() === 'c5,d6,e3,f4',
    options(r).join(),
  );
  check('la partida no ha terminado', r.outcome() === null);
  check('en reversi no hay jaque', r.inCheck() === false);
}

console.log('\nColocar da la vuelta a lo encerrado:');
{
  const r = new ReversiRules();
  place(r, 'd6'); // encierra la negra de d5 contra la blanca de d4

  check('la ficha se queda donde se colocó', at(r, 'd6') === 'W', at(r, 'd6'));
  check('la del medio cambia de color', at(r, 'd5') === 'W', at(r, 'd5'));
  check('las de fuera de la línea no', at(r, 'e4') === 'B', at(r, 'e4'));
  check('el marcador queda 4 a 1', r.count('w') === 4 && r.count('b') === 1,
    `${r.count('w')}-${r.count('b')}`);
  check('el turno pasa al rival', r.turn() === 'b', r.turn());
  check('la jugada se anota con la casilla', r.history().join() === 'd6',
    r.history().join());
}

{
  // Una blanca en d4 con tres negras seguidas y otra blanca cerrando en d8:
  // colocar no hace falta, la línea ya está; se coloca en d3 para cerrarla al
  // otro lado y comprobar que se voltea la fila entera.
  const r = ReversiRules.fromDiagram([
    '...W....', // 8
    '...B....', // 7
    '...B....', // 6
    '...B....', // 5
    '...B....', // 4
    '........',
    '........',
    '........',
  ]);
  place(r, 'd3');
  check(
    'voltea una línea larga de una vez',
    at(r, 'd4') === 'W' && at(r, 'd5') === 'W' && at(r, 'd6') === 'W' && at(r, 'd7') === 'W',
    board(r),
  );
}

{
  // Tres negras encerradas en tres direcciones distintas desde d5: en columna
  // (d6 contra d7), en fila (e5 contra f5) y en diagonal (e6 contra f7).
  const r = ReversiRules.fromDiagram([
    '........',
    '...W.W..', // 7: d7 y f7
    '...BB...', // 6: d6 y e6
    '....BW..', // 5: e5 y f5
    '........',
    '........',
    '........',
    '........',
  ]);
  place(r, 'd5');

  check(
    'voltea las tres direcciones a la vez',
    at(r, 'd6') === 'W' && at(r, 'e5') === 'W' && at(r, 'e6') === 'W',
    board(r),
  );
  check('al rival no le queda ninguna ficha', r.count('b') === 0, `${r.count('b')}`);
  check('y la partida termina ahí', r.outcome()?.result === '1-0',
    JSON.stringify(r.outcome()));
}

console.log('\nDónde no se puede colocar:');
{
  const r = new ReversiRules();
  check('rechaza una casilla ocupada', r.move('d4', 'd4') === null);
  check('rechaza una casilla que no encierra nada', r.move('a1', 'a1') === null);
  check('rechaza una jugada de dos casillas', r.move('d6', 'd5') === null);
  check('rechaza una casilla pegada pero sin cerrar', r.move('c4', 'c4') === null);
}

console.log('\nQuien no puede colocar, pasa:');
{
  // Blancas en la esquina, una negra sola: tras la jugada negra, las blancas
  // no tendrán dónde colocar y repetirán las negras.
  const r = ReversiRules.fromDiagram([
    'BW......', // 8: a8 negra, b8 blanca
    'WW......', // 7
    '........',
    '........',
    '........',
    '........',
    '........',
    '........',
  ], 'b');

  place(r, 'c8'); // encierra b8 contra a8
  check('las tres de arriba son negras',
    at(r, 'a8') === 'B' && at(r, 'b8') === 'B' && at(r, 'c8') === 'B', board(r));
  check('las blancas no tienen dónde colocar y repiten las negras',
    r.turn() === 'b', r.turn());
  check('el paso queda anotado en el historial',
    r.history().join(' ') === 'c8 paso', r.history().join(' '));
}

console.log('\nFinal de la partida:');
{
  // Tablero casi lleno: solo queda h1 libre, y colocarla lo cierra todo.
  const r = ReversiRules.fromDiagram([
    'WWWWWWWW', // 8
    'WWWWWWWW',
    'WWWWWWWW',
    'WWWWWWWW',
    'BBBBBBBB',
    'BBBBBBBB',
    'BBBBBBBB',
    'BBBBBBB.', // 1: falta h1
  ], 'w');

  check('solo queda una casilla', options(r).join() === 'h1', options(r).join());
  place(r, 'h1');
  const fin = r.outcome();
  check('con el tablero lleno la partida acaba', fin !== null, JSON.stringify(fin));
  check('gana quien tiene más fichas', fin?.result === '1-0', JSON.stringify(fin));
  check('por el recuento final', fin?.reason === 'final_count', fin?.reason);
  check('y ya no se puede seguir jugando', r.legalMoves().length === 0);
}

{
  // Otro tablero al que le falta h1, pero medido para que la última jugada lo
  // deje 32 a 32: solo voltea las tres de la columna h.
  const r = ReversiRules.fromDiagram([
    'WWWWWWWW', // 8
    'WWWWWWWW', // 7
    'BBBBBWWW', // 6
    'BBBBBBBW', // 5
    'BBBBBBBB', // 4
    'BBBBBBBB', // 3
    'BBBBBBWB', // 2
    'WWWWWWW.', // 1: falta h1
  ], 'w');

  place(r, 'h1');
  const fin = r.outcome();
  check('empate a fichas son tablas', fin?.result === '1/2-1/2', JSON.stringify(fin));
  check('con 32 fichas cada uno', r.count('w') === 32 && r.count('b') === 32,
    `${r.count('w')}-${r.count('b')}`);
}

{
  // A quien se queda sin fichas ya no le vale ganar por tiempo: no podría
  // volver a colocar nunca.
  const r = ReversiRules.fromDiagram([
    '........',
    '........',
    '........',
    '...W....',
    '........',
    '........',
    '........',
    '........',
  ]);
  check('sin fichas no se puede ganar', r.canStillWin('b') === false);
  check('con fichas sí', r.canStillWin('w') === true);
}

console.log(`\n${passed} comprobaciones correctas, ${failed} fallidas`);
process.exit(failed === 0 ? 0 : 1);
