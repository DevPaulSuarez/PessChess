/**
 * Pruebas del mundo de Tank 1990, sin red ni interfaz.
 *
 * Se ejecutan sobre el código compilado: `npm run build && npm run test:tanques`.
 */
import { Arena, ARENA, CPU_COLOR } from '../dist/tanks/arena.js';

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
  const { arena, a } = duel();
  arena.setInput('t1', { dir: null, firing: true });
  arena.tick(ARENA.tickMs);
  check('dispara una bala', arena.bullets.length === 1, `${arena.bullets.length}`);

  arena.tick(ARENA.tickMs);
  check('no dispara en ráfaga', arena.bullets.length <= 2, `${arena.bullets.length}`);

  advance(arena, ARENA.bulletCooldown + 100);
  check('la bala acaba desapareciendo', arena.bullets.length < 5, `${arena.bullets.length}`);
}

{
  const { arena, a } = duel();
  // Un ladrillo justo delante, a la altura del cañón.
  arena.walls[13][8] = 1;
  arena.setInput('t1', { dir: null, firing: true });
  advance(arena, 500);
  check('la bala rompe el ladrillo', arena.walls[13][8] === 0, `${arena.walls[13][8]}`);
}

{
  const { arena } = duel();
  arena.walls[13][8] = 2;
  arena.setInput('t1', { dir: null, firing: true });
  advance(arena, 500);
  check('el acero aguanta', arena.walls[13][8] === 2, `${arena.walls[13][8]}`);
}

console.log('\nDaño, defensa y ataque:');
{
  const { arena, a, b } = duel();
  const vidaInicial = b.hp;
  arena.setInput('t1', { dir: null, firing: true });
  advance(arena, 800);
  check('el impacto quita vida', b.hp < vidaInicial, `${vidaInicial} -> ${b.hp}`);
  check('la bala se consume al impactar', arena.bullets.length < 3);
}

{
  const { arena, b } = duel();
  b.defense = 5; // más defensa que el ataque del rival
  const vidaInicial = b.hp;
  arena.setInput('t1', { dir: null, firing: true });
  advance(arena, 800);
  check('la defensa no hace invencible', b.hp < vidaInicial, `${vidaInicial} -> ${b.hp}`);
  check('pero aguanta más', vidaInicial - b.hp === 1, `${vidaInicial - b.hp}`);
}

{
  const { arena, a, b } = duel();
  a.attack = 3;
  b.hp = 10; b.maxHp = 10;
  arena.setInput('t1', { dir: null, firing: true });
  advance(arena, 800);
  check('más ataque hace más daño', b.hp === 7, `${b.hp}`);
}

console.log('\nDestruir y mejorar:');
{
  const { arena, a, b } = duel();
  b.hp = 1;
  arena.setInput('t1', { dir: null, firing: true });
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

{
  const { arena, a, b } = duel();
  b.hp = 1;
  arena.setInput('t1', { dir: null, firing: true });
  advance(arena, 800);
  a.pendingUpgrades = 2;
  const defensa = a.defense;
  const ataque = a.attack;
  arena.applyUpgrade('t1', 'defense');
  arena.applyUpgrade('t1', 'attack');
  check('puede subir defensa', a.defense === defensa + 1, `${a.defense}`);
  check('puede subir ataque', a.attack === ataque + 1, `${a.attack}`);
}

console.log('\nGanar:');
{
  const { arena, a, b } = duel();
  check('con dos en pie no hay ganador', arena.winner() === null);
  b.hp = 1;
  arena.setInput('t1', { dir: null, firing: true });
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
  arena.setInput('t0', { dir: 'right', firing: true });
  arena.setInput('t1', { dir: 'up', firing: true });

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
