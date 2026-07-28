/**
 * Pruebas de las reglas de damas inglesas, sin red ni servidor.
 *
 * Se ejecutan con `npm run test:damas` sobre el código ya compilado, así que
 * antes hay que hacer `npm run build`.
 */
import { DraughtsRules } from '../dist/rules/draughts.js';

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

/** Aplica una lista de jugadas y falla en cuanto una sea rechazada. */
function play(rules, moves) {
  for (const [from, to] of moves) {
    const made = rules.move(from, to);
    if (!made) throw new Error(`la jugada ${from}-${to} fue rechazada`);
  }
}

/** Las casillas a las que puede ir la ficha de una casilla dada. */
const destinationsFrom = (rules, square) =>
  rules
    .legalMoves()
    .filter((m) => m.from === square)
    .map((m) => m.to)
    .sort();

// ---------------------------------------------------------------------------

console.log('\nPosición inicial:');
{
  const d = new DraughtsRules();
  check(
    'doce fichas por bando en las casillas negras',
    board(d) === '1p1p1p1p/p1p1p1p1/1p1p1p1p/8/8/P1P1P1P1/1P1P1P1P/P1P1P1P1',
    board(d),
  );
  check('empiezan las blancas', d.turn() === 'w', d.turn());
  check('siete aperturas posibles', d.legalMoves().length === 7, `${d.legalMoves().length}`);
  check('la partida no ha terminado', d.outcome() === null);
  check('en damas no hay jaque', d.inCheck() === false);
}

console.log('\nEl peón solo avanza:');
{
  const d = new DraughtsRules();
  check(
    'a3 solo puede ir a b4',
    destinationsFrom(d, 'a3').join() === 'b4',
    destinationsFrom(d, 'a3').join(),
  );
  check(
    'c3 puede ir a b4 y d4',
    destinationsFrom(d, 'c3').join() === 'b4,d4',
    destinationsFrom(d, 'c3').join(),
  );
  check('las fichas de la fila 1 están tapadas', destinationsFrom(d, 'a1').length === 0);
  check('rechaza mover hacia atrás', d.move('a3', 'b2') === null);
  check('rechaza mover en recto', d.move('a3', 'a4') === null);
  check('rechaza mover una ficha del rival', d.move('b6', 'a5') === null);
}

console.log('\nComer no es obligatorio:');
{
  const d = new DraughtsRules();
  play(d, [['c3', 'd4'], ['b6', 'c5']]); // las negras se ponen a tiro

  const capturas = d.legalMoves().filter((m) => m.san.includes('x'));
  check('se ofrece la captura', capturas.length === 1, capturas.map((m) => m.san).join());
  check('y también el resto de jugadas', d.legalMoves().length > 1, `${d.legalMoves().length}`);
  check('deja mover otra ficha en vez de comer', d.move('a3', 'b4') !== null);
}

{
  const d = new DraughtsRules();
  play(d, [['c3', 'd4'], ['b6', 'c5']]);
  play(d, [['d4', 'b6']]);
  check('pero comer funciona', d.fen().split(' ')[0].split('/')[2] === '1P1p1p1p',
    d.fen().split(' ')[0].split('/')[2]);
  check('el turno pasa al rival', d.turn() === 'b', d.turn());
}

console.log('\nSaltos encadenados:');
{
  // Blanca en c3 con dos negras servidas: c3 salta a e5 comiendo d4, y desde
  // e5 vuelve a saltar a c7 comiendo d6.
  const d = DraughtsRules.fromPosition({ c3: 'P', d4: 'p', d6: 'p' });

  check('la captura está entre las opciones',
    d.legalMoves().some((m) => m.san === 'c3xe5'),
    d.legalMoves().map((m) => m.san).join());

  d.move('c3', 'e5');
  check('tras el primer salto sigue moviendo el mismo jugador', d.turn() === 'w', d.turn());
  check('y solo con la ficha que viene comiendo',
    d.legalMoves().every((m) => m.from === 'e5'),
    d.legalMoves().map((m) => m.san).join());
  check('el segundo salto es el esperado',
    d.legalMoves().map((m) => m.san).join() === 'e5xc7',
    d.legalMoves().map((m) => m.san).join());

  d.move('e5', 'c7');
  check('se comieron las dos fichas', !board(d).includes('p'), board(d));
  check('la cadena queda anotada como dos jugadas',
    d.history().join(' ') === 'c3xe5 e5xc7', d.history().join(' '));
}

console.log('\nCoronar:');
{
  // Una blanca a un paso de la última fila, y una negra lejos para que la
  // partida no termine.
  const d = DraughtsRules.fromPosition({ b7: 'P', h2: 'p' });
  check('puede avanzar a las dos casillas de la última fila',
    destinationsFrom(d, 'b7').join() === 'a8,c8', destinationsFrom(d, 'b7').join());

  d.move('b7', 'c8');
  check('se convierte en dama', board(d).split('/')[0].includes('K'), board(d).split('/')[0]);
  check('la jugada queda anotada como coronación',
    d.history().at(-1) === 'b7-c8=D', d.history().at(-1));
  check('y pasa el turno', d.turn() === 'b', d.turn());
}

console.log('\nCoronar termina el turno aunque se pudiera seguir comiendo:');
{
  // Regla propia de las damas inglesas. La blanca de b6 come la de c7 y cae en
  // d8, donde corona; desde ahí podría comerse la de e7, pero no le toca.
  const d = DraughtsRules.fromPosition({ b6: 'P', c7: 'p', e7: 'p' });
  d.move('b6', 'd8');

  check('corona al llegar a la última fila',
    board(d).split('/')[0].includes('K'), board(d).split('/')[0]);
  check('el turno pasa al rival pese a haber otra captura', d.turn() === 'b', d.turn());
  check('la ficha de e7 sigue viva', board(d).split('/')[1].includes('p'), board(d).split('/')[1]);
}

console.log('\nLa dama vuela por la diagonal:');
{
  const d = DraughtsRules.fromPosition({ d4: 'K', h8: 'p' });
  const destinos = destinationsFrom(d, 'd4');
  check('recorre la diagonal entera',
    destinos.includes('a1') && destinos.includes('g7') && destinos.includes('a7'),
    destinos.join());
  check('no salta por encima de nadie', !destinos.includes('h8'), destinos.join());
}

{
  // Dama blanca en a1 con una negra lejos en e5: puede comerla y caer detrás.
  const d = DraughtsRules.fromPosition({ a1: 'K', e5: 'p' });
  const capturas = d.legalMoves().filter((m) => m.san.includes('x'));
  check('come a distancia', capturas.length > 0, `${capturas.length}`);
  check('y elige dónde cae detrás',
    capturas.map((m) => m.to).sort().join() === 'f6,g7,h8',
    capturas.map((m) => m.to).join());

  d.move('a1', 'g7');
  check('la ficha lejana desaparece', !d.fen().includes('p'), d.fen().split(' ')[0]);
  check('la dama acaba donde eligió',
    d.fen().split(' ')[0].split('/')[1] === '6K1', d.fen().split(' ')[0].split('/')[1]);
}

{
  // Una ficha propia en medio tapa la diagonal.
  const d = DraughtsRules.fromPosition({ a1: 'K', c3: 'P', e5: 'p' });
  const destinos = destinationsFrom(d, 'a1');
  check('llega hasta justo antes de la ficha propia',
    destinos.join() === 'b2', destinos.join());
  check('y no la salta ni come lo que hay detrás',
    !destinos.includes('d4') && !destinos.includes('f6'), destinos.join());
}

console.log('\nGanar y empatar:');
{
  // Una blanca sola: en cuanto mueva, las negras no tendrán nada que jugar.
  const d = DraughtsRules.fromPosition({ d4: 'P' });
  d.move('d4', 'c5');
  const fin = d.outcome();
  check('quien no puede mover, pierde', fin !== null && fin.result === '1-0', JSON.stringify(fin));
  check('el motivo es quedarse sin jugadas', fin?.reason === 'blocked', fin?.reason);
}

{
  // Dos damas solas dando vueltas: sin regla de tablas no acabaría nunca.
  const d = DraughtsRules.fromPosition({ a1: 'K', h8: 'k' });
  const vueltas = [
    ['a1', 'b2'], ['h8', 'g7'],
    ['b2', 'a1'], ['g7', 'h8'],
  ];
  let jugadas = 0;
  outer: for (let i = 0; i < 30; i++) {
    for (const [from, to] of vueltas) {
      if (d.outcome()) break outer;
      if (!d.move(from, to)) break outer;
      jugadas++;
    }
  }
  const fin = d.outcome();
  check('las damas dando vueltas acaban en tablas', fin?.result === '1/2-1/2', JSON.stringify(fin));
  check('por falta de progreso', fin?.reason === 'no_progress', fin?.reason);
  check('tras unas 80 jugadas', jugadas >= 78 && jugadas <= 82, `${jugadas}`);
}

console.log(`\n${passed} comprobaciones correctas, ${failed} fallidas`);
process.exit(failed === 0 ? 0 : 1);
