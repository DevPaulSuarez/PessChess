/**
 * El mundo de Tank 1990: un campo con muros, tanques y balas que avanza a
 * pequeños saltos de tiempo.
 *
 * No sabe nada de red ni de jugadores conectados: recibe las teclas que aprieta
 * cada uno, adelanta el reloj y dice cómo queda todo. Así se puede probar
 * entero sin levantar un servidor.
 *
 * A diferencia del ajedrez y las damas, esto no va por turnos: el servidor
 * adelanta el mundo muchas veces por segundo y reparte el resultado.
 */

export type Direction = 'up' | 'down' | 'left' | 'right';

/** Lo que el jugador tiene pulsado ahora mismo. */
export interface TankInput {
  /** Hacia dónde empuja, o null si no se mueve. */
  dir: Direction | null;
  firing: boolean;
}

export type Upgrade = 'life' | 'defense' | 'attack';

/** Lo que sueltan los cofres que aparecen por el campo. */
export type PickupKind = 'life' | 'defense' | 'attack';

export interface Pickup {
  id: number;
  kind: PickupKind;
  x: number;
  y: number;
}

export interface Tank {
  id: string;
  /** Null en los tanques de la máquina. */
  playerId: string | null;
  /** El color elegido por el jugador; los de la máquina van en plomo. */
  color: string;
  x: number;
  y: number;
  dir: Direction;
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  alive: boolean;
  /** Milisegundos que faltan para poder volver a disparar. */
  cooldown: number;
  /** Milisegundos que lleva pulsado el disparo, o null si no está cargando. */
  charging: number | null;
  kills: number;
  /** Mejoras ganadas por destruir tanques y aún sin gastar. */
  pendingUpgrades: number;
}

export interface Bullet {
  id: number;
  tankId: string;
  x: number;
  y: number;
  dir: Direction;
  damage: number;
}

/** 0 vacío, 1 ladrillo (se rompe), 2 acero (no se rompe), 3 arbusto. */
export type Cell = 0 | 1 | 2 | 3;

export const ARENA = {
  /** El campo es cuadrado y se mide en celdas. */
  size: 26,
  /**
   * Los pasillos miden dos celdas. Con el tanque a 1.5 quedan 0.5 de holgura,
   * suficiente para entrar sin tener que alinearse al milímetro.
   */
  tankSize: 1.5,
  tankSpeed: 6, // celdas por segundo
  bulletSpeed: 18,
  bulletCooldown: 400, // ms
  /** Cuánto hay que mantener pulsado para que el disparo salga cargado. */
  chargeMs: 550,
  /** Cada cuánto aparece un cofre, y cuántos puede haber a la vez. */
  pickupEveryMs: 9000,
  maxPickups: 3,
  /** Vida y blindaje con los que empieza cada tanque. */
  startingHp: 5,
  startingDefense: 2,
  /** Cada cuánto adelanta el mundo el servidor. */
  tickMs: 50,
} as const;

export const CPU_COLOR = '#8E8E93'; // plomo

export interface TankSpec {
  id: string;
  playerId: string | null;
  color: string;
}

export class Arena {
  readonly walls: Cell[][];
  readonly tanks: Tank[] = [];
  bullets: Bullet[] = [];

  /** Cofres que hay ahora mismo por el campo. */
  pickups: Pickup[] = [];

  private inputs = new Map<string, TankInput>();
  private nextBulletId = 1;
  private nextPickupId = 1;
  private sincePickup = 0;
  /** Semilla propia para que una partida se pueda repetir igual en pruebas. */
  private seed: number;

  constructor(specs: TankSpec[], seed = Date.now()) {
    this.seed = seed >>> 0;
    this.walls = this.buildWalls();

    const spots = this.startingSpots(specs.length);
    specs.forEach((spec, i) => {
      const spot = spots[i];
      this.tanks.push({
        id: spec.id,
        playerId: spec.playerId,
        color: spec.color,
        x: spot.x,
        y: spot.y,
        dir: spot.y < ARENA.size / 2 ? 'down' : 'up',
        hp: ARENA.startingHp,
        maxHp: ARENA.startingHp,
        attack: 1,
        defense: ARENA.startingDefense,
        alive: true,
        cooldown: 0,
        charging: null,
        kills: 0,
        pendingUpgrades: 0,
      });
      this.clearAround(spot.x, spot.y);
    });
  }

  // -------------------------------------------------------------------------
  // Entrada
  // -------------------------------------------------------------------------

  setInput(tankId: string, input: TankInput): void {
    this.inputs.set(tankId, input);
  }

  /**
   * Gasta una mejora ganada al destruir un tanque.
   * Devuelve false si ese tanque no tenía ninguna pendiente.
   */
  applyUpgrade(tankId: string, upgrade: Upgrade): boolean {
    const tank = this.tanks.find((t) => t.id === tankId);
    if (!tank || tank.pendingUpgrades <= 0) return false;

    tank.pendingUpgrades--;
    switch (upgrade) {
      case 'life':
        tank.maxHp++;
        tank.hp++;
        break;
      case 'defense':
        tank.defense++;
        break;
      case 'attack':
        tank.attack++;
        break;
    }
    return true;
  }

  // -------------------------------------------------------------------------
  // El paso del tiempo
  // -------------------------------------------------------------------------

  /** Adelanta el mundo los milisegundos indicados. */
  tick(deltaMs: number): void {
    const dt = deltaMs / 1000;

    for (const tank of this.tanks) {
      if (!tank.alive) continue;
      tank.cooldown = Math.max(0, tank.cooldown - deltaMs);

      // Los cofres se recogen estés haciendo algo o no: quedarse quieto encima
      // de uno y que no pasara nada sería desconcertante.
      this.collectPickups(tank);

      const input = tank.playerId
        ? this.inputs.get(tank.id)
        : this.cpuInput(tank);
      if (!input) continue;

      if (input.dir) {
        tank.dir = input.dir;
        this.moveTank(tank, input.dir, ARENA.tankSpeed * dt);
      }
      this.handleTrigger(tank, input.firing, deltaMs);
    }

    this.moveBullets(dt);
    this.spawnPickups(deltaMs);
  }

  /**
   * El gatillo: al soltarlo sale el disparo. Si se mantuvo pulsado el tiempo
   * suficiente, sale cargado y hace el doble de daño.
   */
  private handleTrigger(tank: Tank, firing: boolean, deltaMs: number): void {
    if (firing) {
      tank.charging = (tank.charging ?? 0) + deltaMs;
      return;
    }

    if (tank.charging === null) return;
    const charged = tank.charging >= ARENA.chargeMs;
    tank.charging = null;
    this.fire(tank, charged ? tank.attack + 1 : tank.attack);
  }

  private moveTank(tank: Tank, dir: Direction, distance: number): void {
    const [dx, dy] = VECTORS[dir];
    if (this.tankFits(tank, tank.x + dx * distance, tank.y + dy * distance)) {
      tank.x += dx * distance;
      tank.y += dy * distance;
      return;
    }

    // Encaje automático. Sin esto, entrar en un pasillo obliga a alinearse casi
    // al milímetro y el juego se vuelve frustrante: si el hueco está ahí al
    // lado, el tanque se desliza solo hacia él.
    const [px, py] = dx !== 0 ? [0, 1] : [1, 0];
    for (let reach = 1; reach <= 4; reach++) {
      for (const sign of [1, -1]) {
        const sx = tank.x + px * sign * distance * reach;
        const sy = tank.y + py * sign * distance * reach;
        if (!this.tankFits(tank, sx, sy)) continue;
        if (!this.tankFits(tank, sx + dx * distance, sy + dy * distance)) continue;

        // Se avanza un solo paso hacia el pasillo, no el salto entero: así el
        // deslizamiento se ve suave en vez de a tirones.
        const nx = tank.x + px * sign * distance;
        const ny = tank.y + py * sign * distance;
        if (this.tankFits(tank, nx, ny)) {
          tank.x = nx;
          tank.y = ny;
        }
        return;
      }
    }
  }

  private fire(tank: Tank, damage: number): void {
    if (tank.cooldown > 0) return;
    tank.cooldown = ARENA.bulletCooldown;

    const [dx, dy] = VECTORS[tank.dir];
    const nose = ARENA.tankSize / 2 + 0.1;
    this.bullets.push({
      id: this.nextBulletId++,
      tankId: tank.id,
      x: tank.x + dx * nose,
      y: tank.y + dy * nose,
      dir: tank.dir,
      damage,
    });
  }

  /**
   * Las balas se mueven a pasitos en vez de un salto entero, porque a su
   * velocidad podrían atravesar un muro fino de un solo tirón.
   */
  private moveBullets(dt: number): void {
    const total = ARENA.bulletSpeed * dt;
    const steps = Math.max(1, Math.ceil(total / 0.4));
    const step = total / steps;

    const survivors: Bullet[] = [];
    for (const bullet of this.bullets) {
      let alive = true;
      for (let i = 0; i < steps && alive; i++) {
        const [dx, dy] = VECTORS[bullet.dir];
        bullet.x += dx * step;
        bullet.y += dy * step;
        alive = this.resolveBullet(bullet);
      }
      if (alive) survivors.push(bullet);
    }
    this.bullets = survivors;
  }

  /** Devuelve false si la bala se ha consumido. */
  private resolveBullet(bullet: Bullet): boolean {
    if (bullet.x < 0 || bullet.y < 0 || bullet.x >= ARENA.size || bullet.y >= ARENA.size) {
      return false;
    }

    const cx = Math.floor(bullet.x);
    const cy = Math.floor(bullet.y);
    const cell = this.walls[cy][cx];
    if (cell === 1) {
      this.walls[cy][cx] = 0; // el ladrillo se rompe
      return false;
    }
    if (cell === 2) return false; // el acero aguanta
    // Por los arbustos (3) la bala pasa de largo: solo sirven para esconderse.

    for (const tank of this.tanks) {
      if (!tank.alive || tank.id === bullet.tankId) continue;
      const half = ARENA.tankSize / 2;
      if (
        Math.abs(bullet.x - tank.x) < half &&
        Math.abs(bullet.y - tank.y) < half
      ) {
        this.damage(tank, bullet);
        return false;
      }
    }
    return true;
  }

  private damage(target: Tank, bullet: Bullet): void {
    // La defensa es blindaje: aguanta los impactos antes de que toquen la vida,
    // y se gasta al hacerlo. Restar daño no serviría, porque con disparos de 1 o
    // 2 puntos una defensa de 2 haría al tanque invencible.
    let remaining = bullet.damage;
    const absorbed = Math.min(target.defense, remaining);
    target.defense -= absorbed;
    remaining -= absorbed;
    target.hp -= remaining;
    if (target.hp > 0) return;

    target.alive = false;
    const shooter = this.tanks.find((t) => t.id === bullet.tankId);
    if (shooter) {
      shooter.kills++;
      shooter.pendingUpgrades++;
    }
  }

  // -------------------------------------------------------------------------
  // Cofres
  // -------------------------------------------------------------------------

  /**
   * Cada cierto tiempo aparece un cofre en un hueco libre. Lo que da es al
   * azar: más pegada, más vida o más blindaje.
   */
  private spawnPickups(deltaMs: number): void {
    this.sincePickup += deltaMs;
    if (this.sincePickup < ARENA.pickupEveryMs) return;
    this.sincePickup = 0;
    if (this.pickups.length >= ARENA.maxPickups) return;

    // Se buscan unos cuantos sitios y se usa el primero que valga; si el campo
    // está muy lleno, sencillamente no sale cofre esta vez.
    for (let attempt = 0; attempt < 40; attempt++) {
      const x = this.random(ARENA.size - 2) + 1 + 0.5;
      const y = this.random(ARENA.size - 2) + 1 + 0.5;
      const cell = this.walls[Math.floor(y)][Math.floor(x)];
      if (cell === 1 || cell === 2) continue;
      if (this.pickups.some((p) => Math.abs(p.x - x) < 2 && Math.abs(p.y - y) < 2)) {
        continue;
      }

      const kinds: PickupKind[] = ['life', 'defense', 'attack'];
      this.pickups.push({
        id: this.nextPickupId++,
        kind: kinds[this.random(kinds.length)],
        x,
        y,
      });
      return;
    }
  }

  /** Recoge los cofres que pisa un tanque. */
  private collectPickups(tank: Tank): void {
    const reach = ARENA.tankSize / 2 + 0.4;
    this.pickups = this.pickups.filter((pickup) => {
      if (Math.abs(pickup.x - tank.x) > reach || Math.abs(pickup.y - tank.y) > reach) {
        return true;
      }
      this.grant(tank, pickup.kind);
      return false;
    });
  }

  private grant(tank: Tank, kind: PickupKind): void {
    switch (kind) {
      case 'life':
        tank.maxHp++;
        tank.hp = Math.min(tank.maxHp, tank.hp + 2);
        break;
      case 'defense':
        tank.defense++;
        break;
      case 'attack':
        tank.attack++;
        break;
    }
  }

  // -------------------------------------------------------------------------
  // Los tanques de la máquina
  // -------------------------------------------------------------------------

  private cpuMemory = new Map<string, { dir: Direction; until: number }>();

  /**
   * La máquina juega sencillo: se mueve en una dirección un rato, y dispara
   * cuando tiene a alguien enfrente. Suficiente para dar guerra sin volverse
   * imposible.
   */
  private cpuInput(tank: Tank): TankInput {
    const now = Date.now();
    let plan = this.cpuMemory.get(tank.id);
    if (!plan || plan.until < now) {
      plan = {
        dir: (['up', 'down', 'left', 'right'] as const)[this.random(4)],
        until: now + 600 + this.random(1200),
      };
      this.cpuMemory.set(tank.id, plan);
    }

    // Si está pegado a un muro, cambiar de idea antes de tiempo.
    const [dx, dy] = VECTORS[plan.dir];
    if (!this.tankFits(tank, tank.x + dx * 0.3, tank.y + dy * 0.3)) {
      plan.until = 0;
    }

    return { dir: plan.dir, firing: this.hasTargetAhead(tank) };
  }

  /** ¿Hay algún tanque enemigo en la línea de tiro? */
  private hasTargetAhead(tank: Tank): boolean {
    const [dx, dy] = VECTORS[tank.dir];
    for (const other of this.tanks) {
      if (!other.alive || other.id === tank.id) continue;
      const offX = other.x - tank.x;
      const offY = other.y - tank.y;
      const alongAxis = dx !== 0 ? offX * dx : offY * dy;
      const offAxis = dx !== 0 ? Math.abs(offY) : Math.abs(offX);
      if (alongAxis > 0 && alongAxis < 12 && offAxis < ARENA.tankSize / 2) {
        return true;
      }
    }
    return false;
  }

  // -------------------------------------------------------------------------
  // Estado de la partida
  // -------------------------------------------------------------------------

  /** Los tanques de jugadores que siguen vivos. */
  livingPlayers(): Tank[] {
    return this.tanks.filter((t) => t.alive && t.playerId !== null);
  }

  /** Null mientras haya más de un jugador en pie. */
  winner(): Tank | null {
    const alive = this.livingPlayers();
    return alive.length === 1 ? alive[0] : null;
  }

  get everyoneIsDown(): boolean {
    return this.livingPlayers().length === 0;
  }

  // -------------------------------------------------------------------------
  // El campo
  // -------------------------------------------------------------------------

  /** ¿Cabe el tanque con el centro en esa posición? */
  private tankFits(tank: Tank, x: number, y: number): boolean {
    const half = ARENA.tankSize / 2;
    if (x - half < 0 || y - half < 0 || x + half > ARENA.size || y + half > ARENA.size) {
      return false;
    }

    for (let cy = Math.floor(y - half); cy <= Math.floor(y + half - 0.001); cy++) {
      for (let cx = Math.floor(x - half); cx <= Math.floor(x + half - 0.001); cx++) {
        // Los arbustos no estorban: se puede pasar por encima y esconderse.
        const cell = this.walls[cy]?.[cx];
        if (cell === 1 || cell === 2) return false;
      }
    }

    for (const other of this.tanks) {
      if (other.id === tank.id || !other.alive) continue;
      if (Math.abs(other.x - x) < ARENA.tankSize && Math.abs(other.y - y) < ARENA.tankSize) {
        return false;
      }
    }
    return true;
  }

  /**
   * Muros repartidos en bloques, con un borde de acero por dentro para que el
   * campo no sea una explanada vacía. El patrón es simétrico para que ninguna
   * esquina salga favorecida.
   */
  private buildWalls(): Cell[][] {
    const n = ARENA.size;
    const walls: Cell[][] = Array.from({ length: n }, () => Array<Cell>(n).fill(0));

    for (let y = 3; y < n - 3; y += 4) {
      for (let x = 3; x < n - 3; x += 4) {
        // Uno de cada tres bloques es de acero, contando por posición de bloque
        // y no por coordenada: los bloques van de cuatro en cuatro, así que
        // mirar la coordenada daba siempre el mismo resto y no salía ninguno.
        const block = (x - 3) / 4 + (y - 3) / 4;
        // Uno de cada tres bloques es de acero y uno de cada cinco, arbustos:
        // no frenan, pero tapan a quien se meta dentro.
        const cell: Cell = block % 5 === 2 ? 3 : block % 3 === 0 ? 2 : 1;
        for (let dy = 0; dy < 2; dy++) {
          for (let dx = 0; dx < 2; dx++) {
            walls[y + dy][x + dx] = cell;
          }
        }
      }
    }
    return walls;
  }

  /** Deja despejado el sitio donde aparece un tanque. */
  private clearAround(x: number, y: number): void {
    for (let cy = Math.floor(y) - 1; cy <= Math.floor(y) + 1; cy++) {
      for (let cx = Math.floor(x) - 1; cx <= Math.floor(x) + 1; cx++) {
        if (this.walls[cy]?.[cx] !== undefined) this.walls[cy][cx] = 0;
      }
    }
  }

  /** Posiciones de salida repartidas por el borde, lo más separadas posible. */
  private startingSpots(count: number): Array<{ x: number; y: number }> {
    const n = ARENA.size;
    const margin = 2;
    const ring = [
      { x: margin, y: margin },
      { x: n - margin, y: n - margin },
      { x: n - margin, y: margin },
      { x: margin, y: n - margin },
      { x: n / 2, y: margin },
      { x: n / 2, y: n - margin },
      { x: margin, y: n / 2 },
      { x: n - margin, y: n / 2 },
    ];
    return Array.from({ length: count }, (_, i) => ring[i % ring.length]);
  }

  /** Números pseudoaleatorios propios, para poder repetir una partida igual. */
  private random(max: number): number {
    this.seed = (this.seed * 1664525 + 1013904223) >>> 0;
    return this.seed % max;
  }
}

const VECTORS: Record<Direction, [number, number]> = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
};
