/**
 * Pruebas del mundo de Tank 1990, sin red ni interfaz.
 *
 * Se ejecutan sobre el código compilado: `npm run build && npm run test:tanques`.
 */
import { Arena, ARENA, CPU_COLOR } from '../dist/tanks/arena.js';

/** Pulsa y suelta el gatillo: así sale un disparo normal. */
function tapFire(arena, tankId) {
  arena.setInput(tankId, { dir: null, firing: true });
  arena.tick(ARENA.tickMs);
  arena.setInput(tankId, { dir: null, firing: false });
  arena.tick(ARENA.tickMs);
}

/** Mantiene el gatillo lo suficiente y lo suelta: disparo cargado. */
function chargedFire(arena, tankId) {
  arena.setInput(tankId, { dir: null, firing: true });
  for (let t = 0; t <= ARENA.chargeMs; t += ARENA.tickMs) arena.tick(ARENA.tickMs);
  arena.setInput(tankId, { dir: null, firing: false });
  arena.tick(ARENA.tickMs);
}

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

/** Dos tanques de jugador, uno enfrente del otro, sin muros en medio. */
function duel() {
  const arena = new Arena(
    [
      { id: 't1', playerId: 'p1', color: '#ff0000' },
      { id: 't2', playerId: 'p2', color: '#0000ff' },
    ],
    1234,
  );
  const [a, b] = arena.tanks;
  // Colocarlos a mano, mirándose, con el pasillo despejado.
  a.x = 5; a.y = 13; a.dir = 'right';
  b.x = 15; b.y = 13; b.dir = 'left';
  for (let x = 3; x <= 17; x++) arena.walls[13][x] = 0;
  for (let x = 3; x <= 17; x++) arena.walls[12][x] = 0;
  return { arena, a, b };
}

/** Adelanta el mundo el tiempo indicado, a los saltos que usa el servidor. */
function advance(arena, ms) {
  for (let t = 0; t < ms; t += ARENA.tickMs) arena.tick(ARENA.tickMs);
}

// ---------------------------------------------------------------------------

console.log('\nEl campo:');
{
  const arena = new Arena([{ id: 't1', playerId: 'p1', color: '#f00' }], 1);
  check('es cuadrado', arena.walls.length === ARENA.size && arena.walls[0].length === ARENA.size);
  check('tiene muros', arena.walls.flat().some((c) => c !== 0));
  check('tiene ladrillos y acero',
    arena.walls.flat().includes(1) && arena.walls.flat().includes(2));

  const tank = arena.tanks[0];
  const libre = arena.walls[Math.floor(tank.y)][Math.floor(tank.x)] === 0;
  check('el tanque no nace dentro de un muro', libre);
}

console.log('\nMoverse:');
{
  const { arena, a } = duel();
  const x0 = a.x;
  arena.setInput('t1', { dir: 'right', firing: false });
  advance(arena, 200);
  check('avanza al empujar', a.x > x0, `${x0} -> ${a.x}`);
  check('mira hacia donde va', a.dir === 'right', a.dir);

  const x1 = a.x;
  arena.setInput('t1', { dir: null, firing: false });
  advance(arena, 200);
  check('se para al soltar', a.x === x1, `${x1} -> ${a.x}`);
}

{
  const { arena, a } = duel();
  a.x = 1.5; a.y = 13;
  arena.setInput('t1', { dir: 'left', firing: false });
  advance(arena, 2000);
  check('no se sale del campo', a.x >= ARENA.tankSize / 2, `${a.x}`);
}

{
  const { arena, a } = duel();
  // Un muro de acero justo delante.
  arena.walls[13][7] = 2;
  arena.setInput('t1', { dir: 'right', firing: false });
  advance(arena, 2000);
  check('no atraviesa los muros', a.x < 7, `${a.x}`);
}

{
  const { arena, a, b } = duel();
  b.x = 8; b.y = 13;
  arena.setInput('t1', { dir: 'right', firing: false });
  advance(arena, 2000);
  check('no atraviesa a otro tanque', a.x < 8 - ARENA.tankSize + 0.5, `${a.x}`);
}

console.log('\nDisparar:');
{
  const { arena } = duel();
  tapFire(arena, 't1');
  check('al soltar el gatillo sale la bala', arena.bullets.length === 1, `${arena.bullets.length}`);
  check('el disparo normal hace 1 de daño', arena.bullets[0]?.damage === 1, `${arena.bullets[0]?.damage}`);
}

{
  const { arena } = duel();
  arena.setInput('t1', { dir: null, firing: true });
  advance(arena, 2000);
  check('mientras se mantiene pulsado no dispara', arena.bullets.length === 0, `${arena.bullets.length}`);
}

{
  const { arena } = duel();
  chargedFire(arena, 't1');
  check('el disparo cargado hace el doble', arena.bullets[0]?.damage === 2, `${arena.bullets[0]?.damage}`);
}

{
  const { arena, a } = duel();
  a.attack = 3;
  chargedFire(arena, 't1');
  check('cargar suma sobre el ataque que tengas', arena.bullets[0]?.damage === 4, `${arena.bullets[0]?.damage}`);
}

{
  const { arena } = duel();
  arena.walls[13][8] = 1;
  tapFire(arena, 't1');
  advance(arena, 500);
  check('la bala rompe el ladrillo', arena.walls[13][8] === 0, `${arena.walls[13][8]}`);
}

{
  const { arena } = duel();
  arena.walls[13][8] = 2;
  tapFire(arena, 't1');
  advance(arena, 500);
  check('el acero aguanta', arena.walls[13][8] === 2, `${arena.walls[13][8]}`);
}

console.log('\nArbustos:');
{
  const { arena, a } = duel();
  for (let x = 6; x <= 9; x++) arena.walls[13][x] = 3;
  const x0 = a.x;
  arena.setInput('t1', { dir: 'right', firing: false });
  advance(arena, 700);
  check('se puede entrar en el arbusto', a.x > x0 + 1, `${x0} -> ${a.x}`);
  check('y el arbusto sigue ahí', arena.walls[13][8] === 3, `${arena.walls[13][8]}`);
}

{
  const { arena, b } = duel();
  arena.walls[13][8] = 3;
  const antes = b.hp + b.defense;
  tapFire(arena, 't1');
  advance(arena, 800);
  check('las balas atraviesan los arbustos', b.hp + b.defense < antes, `${antes} -> ${b.hp + b.defense}`);
}

console.log('\nVida y blindaje:');
{
  const { arena, b } = duel();
  check('empieza con 5 de vida', b.hp === 5, `${b.hp}`);
  check('y 2 de blindaje', b.defense === 2, `${b.defense}`);

  tapFire(arena, 't1');
  advance(arena, 800);
  check('el blindaje encaja el primer impacto', b.defense === 1 && b.hp === 5,
    `blindaje ${b.defense}, vida ${b.hp}`);
}

{
  const { arena, b } = duel();
  b.defense = 0;
  tapFire(arena, 't1');
  advance(arena, 800);
  check('sin blindaje el daño va a la vida', b.hp === 4, `${b.hp}`);
}

{
  const { arena, b } = duel();
  b.defense = 1;
  chargedFire(arena, 't1');
  advance(arena, 800);
  check('un cargado atraviesa el blindaje que sobra',
    b.defense === 0 && b.hp === 4, `blindaje ${b.defense}, vida ${b.hp}`);
}

console.log('\nEncajar en los pasillos:');
{
  const { arena, a } = duel();
  for (let y = 0; y < ARENA.size; y++) arena.walls[y][10] = 2;
  arena.walls[12][10] = 0;
  arena.walls[13][10] = 0;
  a.x = 8; a.y = 13.4; // desalineado a propósito

  arena.setInput('t1', { dir: 'right', firing: false });
  advance(arena, 1500);
  check('se cuela por el hueco aunque no venga alineado', a.x > 11, `${a.x}`);
}

console.log('\nCofres:');
{
  const arena = new Arena([{ id: 't1', playerId: 'p1', color: '#f00' }], 5);
  check('al principio no hay cofres', arena.pickups.length === 0);

  advance(arena, ARENA.pickupEveryMs + 200);
  check('aparecen solos con el tiempo', arena.pickups.length >= 1, `${arena.pickups.length}`);
  check('y dan una de las tres cosas',
    ['life', 'defense', 'attack'].includes(arena.pickups[0]?.kind), arena.pickups[0]?.kind);

  advance(arena, ARENA.pickupEveryMs * 6);
  check('no se llena el campo de cofres', arena.pickups.length <= ARENA.maxPickups, `${arena.pickups.length}`);
}

{
  const arena = new Arena([{ id: 't1', playerId: 'p1', color: '#f00' }], 5);
  const t = arena.tanks[0];
  const ataque = t.attack;
  arena.pickups.push({ id: 99, kind: 'attack', x: t.x, y: t.y });
  arena.tick(ARENA.tickMs);
  check('se recoge al pasarle por encima', arena.pickups.length === 0);
  check('y sube el ataque', t.attack === ataque + 1, `${t.attack}`);
}

{
  const arena = new Arena([{ id: 't1', playerId: 'p1', color: '#f00' }], 5);
  const t = arena.tanks[0];
  arena.pickups.push({ id: 98, kind: 'defense', x: t.x, y: t.y });
  arena.tick(ARENA.tickMs);
  check('el cofre de blindaje sube la defensa', t.defense === 3, `${t.defense}`);
}

{
  const arena = new Arena([{ id: 't1', playerId: 'p1', color: '#f00' }], 5);
  const t = arena.tanks[0];
  t.hp = 2;
  arena.pickups.push({ id: 97, kind: 'life', x: t.x, y: t.y });
  arena.tick(ARENA.tickMs);
  check('el cofre de vida cura y sube el máximo', t.hp === 4 && t.maxHp === 6,
    `vida ${t.hp}/${t.maxHp}`);
}

console.log('\nDestruir y mejorar:');
{
  const { arena, a, b } = duel();
  b.hp = 1; b.defense = 0;
  tapFire(arena, 't1');
  advance(arena, 800);

  check('el tanque destruido queda fuera', b.alive === false);
  check('el que destruye suma una baja', a.kills === 1, `${a.kills}`);
  check('y gana una mejora por gastar', a.pendingUpgrades === 1, `${a.pendingUpgrades}`);

  const vidaMax = a.maxHp;
  check('puede subir vida', arena.applyUpgrade('t1', 'life') === true);
  check('la vida sube de verdad', a.maxHp === vidaMax + 1, `${a.maxHp}`);
  check('la mejora se consume', a.pendingUpgrades === 0, `${a.pendingUpgrades}`);
  check('no puede mejorar sin haberla ganado', arena.applyUpgrade('t1', 'attack') === false);
}

console.log('\nGanar:');
{
  const { arena, a, b } = duel();
  check('con dos en pie no hay ganador', arena.winner() === null);
  b.hp = 1; b.defense = 0;
  tapFire(arena, 't1');
  advance(arena, 800);
  check('gana el último en pie', arena.winner()?.id === 't1', arena.winner()?.id);
}

console.log('\nTanques de la máquina:');
{
  const arena = new Arena(
    [
      { id: 't1', playerId: 'p1', color: '#f00' },
      { id: 'cpu1', playerId: null, color: CPU_COLOR },
      { id: 'cpu2', playerId: null, color: CPU_COLOR },
    ],
    99,
  );
  check('los de la máquina van en plomo',
    arena.tanks.filter((t) => t.playerId === null).every((t) => t.color === CPU_COLOR));
  check('no cuentan para ganar', arena.livingPlayers().length === 1,
    `${arena.livingPlayers().length}`);

  const cpu = arena.tanks[1];
  const antes = { x: cpu.x, y: cpu.y };
  advance(arena, 1500);
  check('se mueven solos', cpu.x !== antes.x || cpu.y !== antes.y,
    `${antes.x},${antes.y} -> ${cpu.x},${cpu.y}`);

  // Con el jugador muerto, no queda nadie en pie.
  arena.tanks[0].alive = false;
  check('sin jugadores vivos se acaba', arena.everyoneIsDown === true);
}

console.log('\nUna partida entera no se cuelga:');
{
  const arena = new Arena(
    Array.from({ length: 6 }, (_, i) => ({
      id: `t${i}`,
      playerId: i < 2 ? `p${i}` : null,
      color: i < 2 ? '#f00' : CPU_COLOR,
    })),
    7,
  );
  arena.setInput('t0', { dir: 'right', firing: false });
  arena.setInput('t1', { dir: 'up', firing: false });

  const t0 = Date.now();
  advance(arena, 60000); // un minuto de juego
  const tardanza = Date.now() - t0;

  check('simula un minuto en menos de un segundo', tardanza < 1000, `${tardanza} ms`);
  check('las balas no se acumulan sin fin', arena.bullets.length < 50, `${arena.bullets.length}`);
  check('los tanques siguen dentro del campo',
    arena.tanks.every((t) => t.x >= 0 && t.x <= ARENA.size && t.y >= 0 && t.y <= ARENA.size));
}

console.log(`\n${passed} comprobaciones correctas, ${failed} fallidas`);
process.exit(failed === 0 ? 0 : 1);
