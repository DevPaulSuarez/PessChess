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

export type Upgrade = 'life' | 'defense' | 'attack' | 'speed';

/** Lo que sueltan los cofres que aparecen por el campo. */
export type PickupKind = 'life' | 'defense' | 'attack' | 'speed';

export interface Pickup {
  id: number;
  kind: PickupKind;
  x: number;
  y: number;
  /** Hay que reventarlo a tiros: el premio es de quien da el último. */
  hp: number;
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
  /** Celdas por segundo. Sube con los cofres de velocidad. */
  speed: number;
  alive: boolean;
  /** Milisegundos que faltan para poder volver a disparar. */
  cooldown: number;
  /** Milisegundos que lleva pulsado el disparo, o null si no está cargando. */
  charging: number | null;
  /** Espera antes de que un arbusto vuelva a teletransportarlo. */
  teleportCooldown: number;
  kills: number;
  /** Mejoras ganadas por destruir tanques y aún sin gastar. */
  pendingUpgrades: number;
  /** Momento del último disparo: dispara desde un arbusto y te delatas. */
  lastShotAt: number;
  /** Milisegundos que le queda de patinazo sobre el hielo. */
  sliding: number;
  /** Hasta cuándo dura el derrape en el que no obedece al mando. */
  spinUntil: number;
  /**
   * Carril hacia el que se está corrigiendo para esquivar un bloque. Se guarda
   * porque el trayecto dura varios instantes: recalculándolo cada vez, el
   * tanque se quedaba oscilando sin llegar nunca.
   */
  steer: number | null;
}

export interface Bullet {
  id: number;
  tankId: string;
  x: number;
  y: number;
  dir: Direction;
  damage: number;
  /** Los cargados se pintan distintos y hacen más daño. */
  charged: boolean;
  /** Solo un arma de nivel 4 puede con el acero. */
  piercesSteel: boolean;
}

/**
 * El terreno, celda a celda:
 *  0 vacío
 *  1 ladrillo — se rompe a tiros, por trozos
 *  2 acero    — solo lo revienta un disparo cargado
 *  3 arbusto  — no frena a nadie; tapa a quien se meta
 *  4 agua     — corta el paso a los tanques, pero las balas la cruzan
 *  5 hielo    — se pasa por encima, pero el tanque patina al soltar
 */
export type Cell = 0 | 1 | 2 | 3 | 4 | 5;

/** Impactos que aguanta un bloque de ladrillo antes de caer entero. */
const BRICK_HITS = 4;

const BLOCK_ORIGIN = 2;
const BLOCK_SIZE = 2;
/**
 * Bloque más pasillo. El pasillo mide lo mismo que el bloque y que el tanque,
 * igual que en el Battle City original: el tanque entra justo, sin holgura.
 * Solo funciona porque el movimiento va pegado a la cuadrícula.
 */
const BLOCK_STEP = BLOCK_SIZE * 2;

export const ARENA = {
  /** El campo es cuadrado y se mide en celdas. */
  size: 26,
  /**
   * El tanque mide lo mismo que un bloque y que un pasillo: entra justo, sin
   * holgura, como en el original. Es la cuadrícula la que hace que se pueda.
   */
  tankSize: BLOCK_SIZE,
  tankSpeed: 6, // celdas por segundo
  /** Lo que suma cada cofre de velocidad, y hasta dónde se puede llegar. */
  speedStep: 1.2,
  maxSpeed: 11,
  bulletSpeed: 18,
  /**
   * Recarga entre disparos. El cargado tarda más en volver: si no, saldría a
   * cascoporro y no habría motivo para usar nunca el normal.
   */
  bulletCooldown: 500,
  chargedCooldown: 1100,
  /** Cuánto hay que mantener pulsado para que el disparo salga cargado. */
  chargeMs: 900,
  /** Tras disparar desde un arbusto, el tanque queda a la vista este rato. */
  revealMs: 1500,
  /** Cuánto sigue patinando un tanque al salir del hielo. */
  slideMs: 450,
  /**
   * Sobre hielo el tanque derrapa: cada tanto se va solo hacia donde le da la
   * gana y durante ese rato no obedece al mando.
   */
  spinChance: 12,
  spinMs: 350,
  /** Tras salir de un portal, no vuelve a teletransportarse en este tiempo. */
  teleportCooldownMs: 2000,
  /** Cada cuánto sale un cofre y cuánto aguanta antes de reventar. */
  pickupEveryMs: 9000,
  pickupHp: 3,
  /** Cuántos cofres de cada clase salen si no se dice otra cosa. */
  defaultChests: { life: 2, defense: 2, attack: 2, speed: 2 },
  /** Vida y blindaje con los que empieza el tanque de un jugador. */
  startingHp: 5,
  startingDefense: 2,
  /** Los de la máquina son enemigos simples: aguantan lo mismo que un cofre. */
  cpuHp: 3,
  /** Nivel de arma a partir del cual se puede reventar el acero. */
  steelBreakerAttack: 4,
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

  /**
   * Lo que ha pasado en este paso y merece una animación: disparos, ladrillos
   * reventados, tanques destruidos. El servidor los reparte y los vacía; la app
   * los usa para pintar destellos y explosiones.
   */
  events: ArenaEvent[] = [];

  private inputs = new Map<string, TankInput>();
  private nextBulletId = 1;
  private nextPickupId = 1;
  private sincePickup = 0;
  /** Lo último que soltó un plomo derribado, para poder avisar en pantalla. */
  lastReward: PickupKind | null = null;

  /**
   * Lo que le queda de vida a cada bloque de ladrillo, por esquina del bloque.
   * Aguantan cuatro impactos y entonces caen enteros, en vez de irse
   * desmoronando cuadrante a cuadrante.
   */
  private brickHp = new Map<string, number>();

  /** Cofres que quedan por salir, ya barajados. Los fija quien crea la sala. */
  private chestQueue: PickupKind[] = [];
  /**
   * Reloj propio, en milisegundos de mundo. No se usa `Date.now()` porque el
   * mundo avanza a saltos que no tienen por qué coincidir con el tiempo real:
   * en las pruebas se simula un minuto en milésimas, y con el reloj del sistema
   * la máquina se quedaba con el gatillo apretado sin llegar a soltarlo nunca.
   */
  private clock = 0;
  /** Semilla propia para que una partida se pueda repetir igual en pruebas. */
  private seed: number;

  constructor(
    specs: TankSpec[],
    seed = Date.now(),
    chests: Partial<Record<PickupKind, number>> = {},
    /** Mapa dibujado en el editor. Sin él se genera uno automático. */
    layout?: Cell[][],
  ) {
    this.seed = seed >>> 0;

    // La lista de cofres pendientes se baraja: si salieran todos los de vida
    // primero y luego los de escudo, sería previsible y aburrido.
    for (const kind of ['life', 'defense', 'attack', 'speed'] as const) {
      const count = Math.max(0, Math.round(chests[kind] ?? 0));
      for (let i = 0; i < count; i++) this.chestQueue.push(kind);
    }
    for (let i = this.chestQueue.length - 1; i > 0; i--) {
      const j = this.random(i + 1);
      [this.chestQueue[i], this.chestQueue[j]] = [this.chestQueue[j], this.chestQueue[i]];
    }
    this.walls = layout ? layout.map((row) => [...row]) : this.buildWalls();

    const spots = this.startingSpots(specs.length);
    specs.forEach((spec, i) => {
      const spot = spots[i];
      // Los de la máquina no llevan blindaje ni recogen premios: son enemigos
      // que aguantan unos cuantos tiros, no rivales que mejoran.
      const isCpu = spec.playerId === null;
      const hp = isCpu ? ARENA.cpuHp : ARENA.startingHp;

      this.tanks.push({
        id: spec.id,
        playerId: spec.playerId,
        color: spec.color,
        x: spot.x,
        y: spot.y,
        dir: spot.y < ARENA.size / 2 ? 'down' : 'up',
        hp,
        maxHp: hp,
        attack: 1,
        defense: isCpu ? 0 : ARENA.startingDefense,
        speed: ARENA.tankSpeed,
        alive: true,
        cooldown: 0,
        charging: null,
        teleportCooldown: 0,
        kills: 0,
        pendingUpgrades: 0,
        lastShotAt: -Infinity,
        sliding: 0,
        spinUntil: 0,
        steer: null,
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
    if (!tank || tank.playerId === null || tank.pendingUpgrades <= 0) return false;

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
      case 'speed':
        tank.speed = Math.min(ARENA.maxSpeed, tank.speed + ARENA.speedStep);
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
    this.clock += deltaMs;
    this.events = [];

    for (const tank of this.tanks) {
      if (!tank.alive) continue;
      tank.cooldown = Math.max(0, tank.cooldown - deltaMs);

      const input = tank.playerId
        ? this.inputs.get(tank.id)
        : this.cpuInput(tank);
      if (!input) continue;

      tank.teleportCooldown = Math.max(0, tank.teleportCooldown - deltaMs);

      // El hielo resbala: de vez en cuando el tanque se va hacia donde le da la
      // gana y durante ese rato no hay mando que valga.
      const onIce = this.terrainUnder(tank) === 5;
      if (onIce && tank.spinUntil <= this.clock && this.random(ARENA.spinChance) === 0) {
        // Nunca hacia donde ya iba: si sigue de frente no se nota que ha
        // derrapado, solo parece que el mando ha dejado de responder.
        const otras = DIRECTION_LIST.filter((d) => d !== tank.dir);
        tank.dir = otras[this.random(otras.length)];
        tank.spinUntil = this.clock + ARENA.spinMs;
      }

      if (tank.spinUntil > this.clock) {
        this.moveTank(tank, tank.dir, tank.speed * dt);
        this.maybeTeleport(tank);
      } else if (input.dir) {
        tank.dir = input.dir;
        this.moveTank(tank, input.dir, tank.speed * dt);
        this.maybeTeleport(tank);
        tank.sliding = onIce ? ARENA.slideMs : 0;
      } else if (tank.sliding > 0) {
        tank.sliding = Math.max(0, tank.sliding - deltaMs);
        this.moveTank(tank, tank.dir, tank.speed * dt);
        this.maybeTeleport(tank);
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
    // El cargado solo cuenta si la barra llegó al final; si se suelta antes,
    // sale un disparo normal y la carga se pierde.
    this.fire(tank, charged ? tank.attack + 1 : tank.attack, charged);
  }

  /**
   * Mueve el tanque pegándolo a la cuadrícula.
   *
   * El eje por el que no se avanza se cuadra con las celdas, como en el Battle
   * City original. Eso es lo que hace que los disparos salgan siempre por el
   * mismo sitio y que entrar en un pasillo no dependa de acertar al milímetro:
   * sin esto, el tanque quedaba a medio camino entre dos filas y las balas
   * impactaban de formas distintas según cómo vinieras.
   */
  private moveTank(tank: Tank, dir: Direction, distance: number): void {
    const [dx, dy] = VECTORS[dir];
    const horizontal = dx !== 0;

    // El eje transversal se cuadra de golpe, no poco a poco. Con el pasillo
    // del mismo ancho que el tanque no hay holgura: acercarse por pasitos
    // dejaría posiciones intermedias que no caben y el tanque se atascaría.
    // Mientras se está corrigiendo hacia otro carril no hay que cuadrar nada:
    // el redondeo devolvería el tanque a la fila de la que intenta salir, y se
    // quedarían peleando el uno con el otro.
    const current = horizontal ? tank.y : tank.x;
    if (tank.steer === null && !Number.isInteger(current)) {
      // Se prueba la fila más cercana y, si esa no cabe, la de al lado: al
      // girar en una esquina la más cercana suele estar ocupada.
      for (const candidate of [
        Math.round(current),
        Math.floor(current),
        Math.ceil(current),
      ]) {
        const [tx, ty] = horizontal ? [tank.x, candidate] : [candidate, tank.y];
        if (!this.tankFits(tank, tx, ty)) continue;
        tank.x = tx;
        tank.y = ty;
        break;
      }
    }

    if (this.tankFits(tank, tank.x + dx * distance, tank.y + dy * distance)) {
      tank.x += dx * distance;
      tank.y += dy * distance;
      tank.steer = null;
      return;
    }

    // Ayuda de esquina.
    //
    // Si el camino está cortado pero un poco más allá, a un lado, hay hueco
    // para seguir, el tanque se corrige solo hacia ese carril en vez de
    // quedarse clavado contra el canto del bloque.
    const [px, py] = horizontal ? [0, 1] : [1, 0];
    const across = horizontal ? tank.y : tank.x;

    tank.steer ??= this.findLane(tank, dx, dy, px, py, across);
    if (tank.steer === null) return;

    const gap = tank.steer - across;
    if (Math.abs(gap) < 0.001) {
      tank.steer = null;
      return;
    }

    // Se recorre poco a poco, para que se vea como un deslizamiento y no como
    // un salto.
    const step = Math.min(distance, Math.abs(gap)) * Math.sign(gap);
    const nx = tank.x + px * step;
    const ny = tank.y + py * step;
    if (this.tankFits(tank, nx, ny)) {
      tank.x = nx;
      tank.y = ny;
    } else {
      tank.steer = null; // el carril ya no sirve; se busca otro al siguiente paso
    }
  }

  /** El carril más cercano desde el que sí se puede seguir avanzando. */
  private findLane(
    tank: Tank,
    dx: number,
    dy: number,
    px: number,
    py: number,
    current: number,
  ): number | null {
    for (let reach = 0.25; reach <= 3; reach += 0.25) {
      for (const sign of [1, -1]) {
        const target = current + sign * reach;
        // Solo valen los carriles cuadrados con la retícula: en los de en medio
        // el tanque no cabe en ningún pasillo.
        if (!Number.isInteger(target)) continue;

        const lane = { x: px ? target : tank.x, y: py ? target : tank.y };
        if (!this.tankFits(tank, lane.x, lane.y)) continue;
        if (!this.tankFits(tank, lane.x + dx, lane.y + dy)) continue;
        return target;
      }
    }
    return null;
  }

  /**
   * Los arbustos son portales: meterse en uno deja al tanque en otro punto del
   * campo, al azar. Solo funciona con los tanques de jugadores; si la máquina
   * saltase de un lado a otro, no habría quien la siguiera.
   */
  private maybeTeleport(tank: Tank): void {
    if (tank.playerId === null || tank.teleportCooldown > 0) return;
    if (this.walls[Math.floor(tank.y)]?.[Math.floor(tank.x)] !== 3) return;

    // Se sale por otro arbusto, no en campo abierto: son portales entre
    // matorrales, así que se aparece igual de escondido.
    const destinations: Array<{ x: number; y: number }> = [];
    for (let cy = 0; cy < ARENA.size; cy++) {
      for (let cx = 0; cx < ARENA.size; cx++) {
        if (this.walls[cy][cx] !== 3) continue;
        // Se sale cuadrado a la retícula: si no, el tanque quedaría a medio
        // camino entre dos filas y no cabría en ningún pasillo.
        const x = Math.round(cx);
        const y = Math.round(cy);
        // Ni al mismo matorral del que salgo, ni a uno donde no quepa.
        if (Math.abs(x - tank.x) < 3 && Math.abs(y - tank.y) < 3) continue;
        if (this.tankFits(tank, x, y)) destinations.push({ x, y });
      }
    }
    if (destinations.length === 0) return;

    const spot = destinations[this.random(destinations.length)];
    tank.x = spot.x;
    tank.y = spot.y;
    tank.teleportCooldown = ARENA.teleportCooldownMs;
  }

  /** El terreno que hay bajo el centro del tanque. */
  terrainUnder(tank: Tank): Cell | undefined {
    return this.walls[Math.floor(tank.y)]?.[Math.floor(tank.x)];
  }

  /**
   * ¿Este tanque está oculto para quien mira?
   *
   * Metido en un arbusto no se le ve, salvo que acabe de disparar: así el
   * arbusto sirve para emboscar, pero disparar desde dentro te delata y no se
   * vuelve un escondite impune. El tanque propio siempre se ve.
   */
  isHiddenFrom(tank: Tank, viewerId: string | null): boolean {
    if (tank.id === viewerId) return false;
    if (this.terrainUnder(tank) !== 3) return false;
    return this.clock - tank.lastShotAt > ARENA.revealMs;
  }

  private fire(tank: Tank, damage: number, charged = false): void {
    if (tank.cooldown > 0) return;
    tank.cooldown = charged ? ARENA.chargedCooldown : ARENA.bulletCooldown;
    tank.lastShotAt = this.clock;
    this.events.push({ kind: 'shot', x: tank.x, y: tank.y });

    const [dx, dy] = VECTORS[tank.dir];
    const nose = ARENA.tankSize / 2 + 0.1;
    this.bullets.push({
      id: this.nextBulletId++,
      tankId: tank.id,
      // Sale del centro exacto del cañón. Con el tanque cuadrado a la retícula,
      // eso deja la bala justo sobre la junta entre dos celdas, y por eso al
      // impactar rompe las dos: media pared de un tiro, mires como mires.
      x: tank.x + dx * nose,
      y: tank.y + dy * nose,
      dir: tank.dir,
      damage,
      charged,
      piercesSteel: tank.attack >= ARENA.steelBreakerAttack,
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

    if (this.hitTerrain(bullet)) return false;

    // Los cofres solo los abren los jugadores. Una bala de la máquina les pasa
    // de largo: si los reventara, echaría a perder premios que no puede usar.
    const shooterIsPlayer =
      this.tanks.find((t) => t.id === bullet.tankId)?.playerId != null;

    for (const pickup of shooterIsPlayer ? this.pickups : []) {
      if (Math.abs(bullet.x - pickup.x) > 0.75 || Math.abs(bullet.y - pickup.y) > 0.75) {
        continue;
      }
      pickup.hp -= bullet.damage;
      if (pickup.hp <= 0) {
        this.pickups = this.pickups.filter((p) => p.id !== pickup.id);
        const shooter = this.tanks.find((t) => t.id === bullet.tankId);
        if (shooter) this.grant(shooter, pickup.kind);
      }
      return false;
    }

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

  /**
   * Choque contra el terreno. Devuelve true si la bala se ha consumido.
   *
   * Se miran las dos celdas que la bala tiene a cada lado, no solo la de su
   * punto exacto: con el tanque cuadrado a la retícula la bala viaja justo por
   * la junta, y mirando una sola celda quedaba media pared intacta y había que
   * mover el tanque para rematarla.
   */
  private hitTerrain(bullet: Bullet): boolean {
    const horizontal = bullet.dir === 'left' || bullet.dir === 'right';
    const along = horizontal ? bullet.x : bullet.y;
    const across = horizontal ? bullet.y : bullet.x;

    const alongCell = Math.floor(along);
    // Las dos celdas que la junta separa. Si la bala no va por una junta, las
    // dos cuentas caen en la misma celda y se mira una sola vez.
    const sides = new Set([Math.floor(across - 0.01), Math.floor(across + 0.01)]);

    for (const side of sides) {
      const cx = horizontal ? alongCell : side;
      const cy = horizontal ? side : alongCell;
      const cell = this.walls[cy]?.[cx];

      if (cell === 1) {
        this.damageBrick(cx, cy);
        return true;
      }
      if (cell === 2) {
        // El acero solo cede a un arma muy subida: es la recompensa de haber
        // ido acumulando cofres amarillos durante la partida.
        if (bullet.piercesSteel) {
          this.walls[cy][cx] = 0;
          this.events.push({ kind: 'brick', x: cx + 0.5, y: cy + 0.5 });
        }
        return true;
      }
      // Arbustos (3), agua (4) y hielo (5) los cruza sin enterarse.
    }
    return false;
  }

  /**
   * Un impacto en un bloque de ladrillo.
   *
   * El bloque aguanta cuatro tiros y cae entero. Se lleva la cuenta por bloque
   * y no por celda: así no se va desmoronando a trozos, que quedaba raro.
   */
  private damageBrick(cx: number, cy: number): void {
    const originX =
      BLOCK_ORIGIN + Math.floor((cx - BLOCK_ORIGIN) / BLOCK_STEP) * BLOCK_STEP;
    const originY =
      BLOCK_ORIGIN + Math.floor((cy - BLOCK_ORIGIN) / BLOCK_STEP) * BLOCK_STEP;
    const key = `${originX},${originY}`;

    const left = (this.brickHp.get(key) ?? BRICK_HITS) - 1;
    if (left > 0) {
      this.brickHp.set(key, left);
      this.events.push({ kind: 'crack', x: cx + 0.5, y: cy + 0.5 });
      return;
    }

    this.brickHp.delete(key);
    for (let dy = 0; dy < BLOCK_SIZE; dy++) {
      for (let dx = 0; dx < BLOCK_SIZE; dx++) {
        if (this.walls[originY + dy]?.[originX + dx] === 1) {
          this.walls[originY + dy][originX + dx] = 0;
        }
      }
    }
    this.events.push({
      kind: 'brick',
      x: originX + BLOCK_SIZE / 2,
      y: originY + BLOCK_SIZE / 2,
    });
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
    this.events.push({ kind: 'tank', x: target.x, y: target.y });
    const shooter = this.tanks.find((t) => t.id === bullet.tankId);
    if (!shooter) return;
    shooter.kills++;

    // Derribar da premio al momento y al azar. Antes había que elegir entre tres
    // botones, pero interrumpía la batalla para nada: ahora sale solo.
    if (shooter.playerId !== null) {
      const kinds: PickupKind[] = ['life', 'defense', 'attack', 'speed'];
      this.lastReward = kinds[this.random(kinds.length)];
      this.grant(shooter, this.lastReward);
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
    if (this.chestQueue.length === 0) return;
    this.sincePickup += deltaMs;
    if (this.sincePickup < ARENA.pickupEveryMs) return;
    this.sincePickup = 0;

    // Se buscan unos cuantos sitios y se usa el primero que valga; si el campo
    // está muy lleno, sencillamente no sale cofre esta vez.
    for (let attempt = 0; attempt < 40; attempt++) {
      const x = this.random(ARENA.size - 2) + 1 + 0.5;
      const y = this.random(ARENA.size - 2) + 1 + 0.5;

      // Un cofre solo cae en terreno despejado. Nada de aparecer dentro de un
      // muro, del agua, de un arbusto o encima de otro cofre o de un tanque:
      // habría que dispararle a través de algo, o ni se vería.
      if (this.walls[Math.floor(y)][Math.floor(x)] !== 0) continue;
      if (this.pickups.some((p) => Math.abs(p.x - x) < 2 && Math.abs(p.y - y) < 2)) {
        continue;
      }
      if (this.tanks.some(
        (t) => t.alive && Math.abs(t.x - x) < 2 && Math.abs(t.y - y) < 2,
      )) {
        continue;
      }
      // Y con hueco libre alrededor, para poder rodearlo y apuntarle.
      const clear = [-1, 0, 1].every((dy) =>
        [-1, 0, 1].every(
          (dx) => this.walls[Math.floor(y) + dy]?.[Math.floor(x) + dx] !== 1
            && this.walls[Math.floor(y) + dy]?.[Math.floor(x) + dx] !== 2,
        ),
      );
      if (!clear) continue;

      this.dropChest(x, y, this.chestQueue.shift()!);
      return;
    }
  }

  /** Deja un cofre en un sitio concreto. */
  private dropChest(x: number, y: number, kind: PickupKind): void {
    this.pickups.push({
      id: this.nextPickupId++,
      kind,
      x,
      y,
      hp: ARENA.pickupHp,
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
      case 'speed':
        // Con techo: un tanque demasiado rápido se vuelve incontrolable y
        // atraviesa los pasillos sin darte tiempo a girar.
        tank.speed = Math.min(ARENA.maxSpeed, tank.speed + ARENA.speedStep);
        break;
    }
  }

  // -------------------------------------------------------------------------
  // Los tanques de la máquina
  // -------------------------------------------------------------------------

  private cpuMemory = new Map<
    string,
    { dir: Direction; until: number; fireUntil: number; nextShotAt: number }
  >();

  /**
   * La máquina persigue al jugador vivo más cercano y le dispara cuando lo tiene
   * enfilado. Antes elegía direcciones al azar y se pasaba la partida dando
   * vueltas contra los muros.
   */
  private cpuInput(tank: Tank): TankInput {
    const now = this.clock;
    let plan = this.cpuMemory.get(tank.id);
    if (!plan) {
      plan = { dir: tank.dir, until: 0, fireUntil: 0, nextShotAt: 0 };
      this.cpuMemory.set(tank.id, plan);
    }

    const target = this.nearestPlayer(tank);

    // Se replantea el rumbo cada poco, y de inmediato si se ha quedado trabado.
    if (plan.until < now || this.blocked(tank, plan.dir)) {
      plan.dir = target ? this.chase(tank, target) : this.anyFreeDirection(tank);
      plan.until = now + 250 + this.random(350);
    }

    // Si ya tiene al rival enfilado se planta y dispara, en vez de seguir
    // moviéndose y perder la puntería bailando a su alrededor.
    const aiming = this.hasTargetAhead(tank);
    return {
      dir: aiming ? null : plan.dir,
      firing: this.cpuTrigger(tank, plan, now),
    };
  }

  /** Hacia dónde ir para acercarse al objetivo, esquivando lo que estorbe. */
  private chase(tank: Tank, target: Tank): Direction {
    const dx = target.x - tank.x;
    const dy = target.y - tank.y;

    // Primero el eje en el que está más lejos: así se acerca en diagonal a base
    // de alternar, en vez de recorrer un lado entero y luego el otro.
    const preferred: Direction[] =
      Math.abs(dx) > Math.abs(dy)
        ? [dx > 0 ? 'right' : 'left', dy > 0 ? 'down' : 'up']
        : [dy > 0 ? 'down' : 'up', dx > 0 ? 'right' : 'left'];

    for (const dir of preferred) {
      if (!this.blocked(tank, dir)) return dir;
    }
    return this.anyFreeDirection(tank);
  }

  private anyFreeDirection(tank: Tank): Direction {
    const all: Direction[] = ['up', 'down', 'left', 'right'];
    const start = this.random(4);
    for (let i = 0; i < 4; i++) {
      const dir = all[(start + i) % 4];
      if (!this.blocked(tank, dir)) return dir;
    }
    return tank.dir;
  }

  private blocked(tank: Tank, dir: Direction): boolean {
    const [dx, dy] = VECTORS[dir];
    return !this.tankFits(tank, tank.x + dx * 0.4, tank.y + dy * 0.4);
  }

  private nearestPlayer(tank: Tank): Tank | null {
    let best: Tank | null = null;
    let bestDistance = Infinity;
    for (const other of this.tanks) {
      if (!other.alive || other.playerId === null || other.id === tank.id) continue;
      const distance = Math.abs(other.x - tank.x) + Math.abs(other.y - tank.y);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = other;
      }
    }
    return best;
  }

  /**
   * El gatillo de la máquina.
   *
   * Como ahora el disparo sale al soltar, no vale con tener `firing` siempre a
   * true: se quedaría cargando eternamente sin llegar a disparar. Aquí mantiene
   * el gatillo un rato y lo suelta, y de vez en cuando aguanta lo suficiente
   * para soltar un cargado.
   */
  private cpuTrigger(
    tank: Tank,
    plan: { fireUntil: number; nextShotAt: number },
    now: number,
  ): boolean {
    if (plan.fireUntil > now) return true; // sigue apretando

    // Hay que soltar de verdad antes de volver a apretar. Sin esta pausa, en el
    // mismo instante en que tocaba soltar empezaba otro disparo, y el tanque se
    // pasaba la partida cargando sin llegar a disparar nunca.
    if (now < plan.nextShotAt) return false;
    if (tank.cooldown > 0 || !this.hasTargetAhead(tank)) return false;

    // La máquina no carga el arma: solo disparos normales, para que cargar sea
    // una ventaja de los jugadores.
    plan.fireUntil = now + 150;
    plan.nextShotAt = plan.fireUntil + 250;
    return true;
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
        // Los arbustos no estorban; el agua sí, aunque las balas la crucen.
        const cell = this.walls[cy]?.[cx];
        if (cell === 1 || cell === 2 || cell === 4) return false;
        // Los arbustos (3) y el hielo (5) se pisan sin problema.
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

    for (let y = BLOCK_ORIGIN; y + BLOCK_SIZE <= n - BLOCK_ORIGIN; y += BLOCK_STEP) {
      for (let x = BLOCK_ORIGIN; x + BLOCK_SIZE <= n - BLOCK_ORIGIN; x += BLOCK_STEP) {
        // Se cuenta por posición de bloque y no por coordenada: como los
        // bloques van de tantas en tantas celdas, mirar la coordenada daba
        // siempre el mismo resto y no salía nunca ni uno de acero.
        const block =
          (x - BLOCK_ORIGIN) / BLOCK_STEP + (y - BLOCK_ORIGIN) / BLOCK_STEP;
        // Uno de cada tres bloques es de acero y uno de cada cinco, arbustos:
        // no frenan, pero tapan a quien se meta dentro.
        const cell: Cell =
          block % 11 === 6
            ? 5
            : block % 7 === 4
              ? 4
              : block % 5 === 2
                ? 3
                : block % 3 === 0
                  ? 2
                  : 1;
        for (let dy = 0; dy < BLOCK_SIZE; dy++) {
          for (let dx = 0; dx < BLOCK_SIZE; dx++) {
            walls[y + dy][x + dx] = cell;
          }
        }
      }
    }
    return walls;
  }

  /**
   * Deja despejado el sitio donde aparece un tanque.
   *
   * Se quitan bloques enteros, no celdas sueltas: los bloques son de dos por
   * dos y borrar solo la esquina que estorbaba dejaba muros a medias, con una
   * pinta rarísima.
   */
  private clearAround(x: number, y: number): void {
    for (let cy = Math.floor(y) - 1; cy <= Math.floor(y) + 1; cy++) {
      for (let cx = Math.floor(x) - 1; cx <= Math.floor(x) + 1; cx++) {
        if (this.walls[cy]?.[cx] === undefined) continue;
        if (this.walls[cy][cx] === 0) continue;
        this.clearBlockAt(cx, cy);
      }
    }
  }

  /** Borra el bloque de dos por dos al que pertenece una celda. */
  private clearBlockAt(cx: number, cy: number): void {
    const originX =
      BLOCK_ORIGIN + Math.floor((cx - BLOCK_ORIGIN) / BLOCK_STEP) * BLOCK_STEP;
    const originY =
      BLOCK_ORIGIN + Math.floor((cy - BLOCK_ORIGIN) / BLOCK_STEP) * BLOCK_STEP;
    this.brickHp.delete(`${originX},${originY}`);
    for (let dy = 0; dy < BLOCK_SIZE; dy++) {
      for (let dx = 0; dx < BLOCK_SIZE; dx++) {
        if (this.walls[originY + dy]?.[originX + dx] !== undefined) {
          this.walls[originY + dy][originX + dx] = 0;
        }
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

  /**
   * Números pseudoaleatorios propios, para poder repetir una partida igual.
   *
   * Se usan los bits altos y no el resto de la división: en este tipo de
   * generador los bits bajos se repiten con un ciclo cortísimo, y con `% 12`
   * había valores que no salían nunca. Costó verlo porque parecía que el hielo
   * simplemente no hacía nada.
   */
  private random(max: number): number {
    this.seed = (this.seed * 1664525 + 1013904223) >>> 0;
    return Math.floor((this.seed / 4294967296) * max);
  }
}

/** Algo que acaba de pasar y la app puede animar. */
export interface ArenaEvent {
  kind: 'shot' | 'crack' | 'brick' | 'tank';
  x: number;
  y: number;
}

const DIRECTION_LIST: Direction[] = ['up', 'down', 'left', 'right'];

const VECTORS: Record<Direction, [number, number]> = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
};
