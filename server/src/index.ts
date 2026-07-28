import express from 'express';
import cors from 'cors';
import { createServer } from 'node:http';
import { Server, type Socket } from 'socket.io';

import { GameManager } from './rooms.js';
import { GAMES, isGameKind, type GameKind } from './rules/registry.js';
import { TankServer } from './tanks/sockets.js';
import { MapStore } from './tanks/maps.js';
import type { Game } from './game.js';
import type {
  CreateRoomPayload,
  ErrorPayload,
  JoinRoomPayload,
  MovePayload,
  QuickMatchPayload,
  ResumePayload,
  TimeControl,
} from './types.js';

const PORT = Number(process.env.PORT ?? 3000);

const app = express();
app.use(cors());
// Los mapas son cadenas de 676 caracteres; con 200 kB va sobrado y evita que
// alguien intente colar algo enorme.
app.use(express.json({ limit: '200kb' }));

/** Dónde se guardan los mapas dibujados en el editor. */
const maps = new MapStore(process.env.MAPS_FILE ?? 'data/maps.json');

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*' },
  // Los móviles cambian de wifi a datos y de vuelta; conviene aguantar un poco
  // antes de dar la conexión por perdida.
  pingTimeout: 25000,
  pingInterval: 10000,
});

const manager = new GameManager();
const tanks = new TankServer(io, maps);
/** En qué partida está cada socket, para no buscarla en cada mensaje. */
const socketGame = new Map<string, string>();

app.get('/health', (_req, res) => {
  // `games` es cuántas partidas hay abiertas; `offers`, a qué se puede jugar.
  res.json({ ok: true, ...manager.stats, ...tanks.stats, offers: [...Object.keys(GAMES), 'tanks'] });
});

// ---------------------------------------------------------------------------
// El editor de mapas
// ---------------------------------------------------------------------------

// La página del editor se sirve tal cual, sin nada que compilar.
app.use('/editor', express.static('public/editor'));

app.get('/api/maps', (_req, res) => {
  res.json(maps.list());
});

app.get('/api/maps/:id', (req, res) => {
  const map = maps.get(req.params.id);
  if (!map) return void res.status(404).json({ error: 'No existe ese mapa.' });
  res.json(map);
});

app.post('/api/maps', (req, res) => {
  const result = maps.save(req.body ?? {});
  if (!result.ok) return void res.status(400).json({ error: result.error });
  res.json(result.map);
});

app.delete('/api/maps/:id', (req, res) => {
  res.json({ removed: maps.remove(req.params.id) });
});

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

function fail(socket: Socket, code: ErrorPayload['code'], message: string): void {
  socket.emit('error_msg', { code, message } satisfies ErrorPayload);
}

/** Manda a cada jugador su propia versión del estado (jugadas legales incluidas). */
function broadcast(game: Game): void {
  for (const color of ['w', 'b'] as const) {
    const player = color === 'w' ? game.white : game.black;
    if (player?.socketId) {
      io.to(player.socketId).emit('state', game.stateFor(color));
    }
  }
}

/** Nunca confiar en lo que manda el cliente. */
function cleanName(raw: unknown): string {
  const name = typeof raw === 'string' ? raw.trim().slice(0, 20) : '';
  return name.length > 0 ? name : 'Invitado';
}

const MIN_INITIAL_MS = 30_000; // 30 segundos
const MAX_INITIAL_MS = 3 * 60 * 60 * 1000; // 3 horas
const MAX_INCREMENT_MS = 60_000; // 1 minuto

/** Si piden un juego que no existe, se juega al ajedrez. */
function cleanGame(raw: unknown): GameKind {
  return isGameKind(raw) ? raw : 'chess';
}

function cleanTimeControl(raw: unknown): TimeControl | null {
  if (raw === null || typeof raw !== 'object') return null;
  const tc = raw as Partial<TimeControl>;
  if (typeof tc.initialMs !== 'number' || !Number.isFinite(tc.initialMs)) return null;
  const increment =
    typeof tc.incrementMs === 'number' && Number.isFinite(tc.incrementMs) ? tc.incrementMs : 0;
  return {
    initialMs: Math.min(MAX_INITIAL_MS, Math.max(MIN_INITIAL_MS, Math.round(tc.initialMs))),
    incrementMs: Math.min(MAX_INCREMENT_MS, Math.max(0, Math.round(increment))),
  };
}

/** La partida en la que está este socket, o null. */
function gameOf(socket: Socket): Game | null {
  const id = socketGame.get(socket.id);
  return (id && manager.get(id)) || null;
}

function attach(socket: Socket, game: Game): void {
  socketGame.set(socket.id, game.id);
}

// ---------------------------------------------------------------------------
// Conexiones
// ---------------------------------------------------------------------------

io.on('connection', (socket) => {
  // Los tanques van por su cuenta: es un juego en tiempo real y no encaja en
  // la maquinaria por turnos del ajedrez y las damas.
  tanks.register(socket);

  socket.on('create_room', (payload: CreateRoomPayload) => {
    manager.leaveQueue(socket.id);
    const game = manager.create(
      cleanGame(payload?.game),
      cleanTimeControl(payload?.timeControl),
    );
    const seat = game.addPlayer(cleanName(payload?.name), socket.id);
    if (!seat) return fail(socket, 'room_full', 'No se pudo crear la sala.');

    attach(socket, game);
    socket.emit('joined', { gameId: game.id, token: seat.token, color: seat.color, code: game.id });
    broadcast(game);
  });

  socket.on('join_room', (payload: JoinRoomPayload) => {
    const code = typeof payload?.code === 'string' ? payload.code : '';
    const game = manager.get(code);
    if (!game) return fail(socket, 'room_not_found', 'No existe ninguna sala con ese código.');
    if (game.playerBySocket(socket.id)) {
      return fail(socket, 'bad_request', 'Ya estás en esa partida.');
    }
    if (game.isFull) return fail(socket, 'room_full', 'Esa sala ya tiene dos jugadores.');

    manager.leaveQueue(socket.id);
    const seat = game.addPlayer(cleanName(payload?.name), socket.id);
    if (!seat) return fail(socket, 'room_full', 'Esa sala ya tiene dos jugadores.');

    attach(socket, game);
    socket.emit('joined', { gameId: game.id, token: seat.token, color: seat.color, code: game.id });
    broadcast(game);
  });

  socket.on('quick_match', (payload: QuickMatchPayload) => {
    const name = cleanName(payload?.name);
    const kind = cleanGame(payload?.game);
    const timeControl = cleanTimeControl(payload?.timeControl);
    const game = manager.enqueue({ socketId: socket.id, name, game: kind, timeControl });

    if (!game) {
      socket.emit('queued');
      return;
    }

    // Había alguien esperando: ya está sentado de blancas, nosotros de negras.
    const seat = game.addPlayer(name, socket.id);
    if (!seat) return fail(socket, 'room_full', 'No se pudo emparejar. Inténtalo otra vez.');

    attach(socket, game);
    socket.emit('joined', { gameId: game.id, token: seat.token, color: seat.color, code: game.id });

    const opponent = game.white!;
    if (opponent.socketId) {
      const opponentSocket = io.sockets.sockets.get(opponent.socketId);
      if (opponentSocket) attach(opponentSocket, game);
      io.to(opponent.socketId).emit('joined', {
        gameId: game.id,
        token: opponent.token,
        color: 'w',
        code: game.id,
      });
    }
    broadcast(game);
  });

  socket.on('cancel_queue', () => {
    manager.leaveQueue(socket.id);
    socket.emit('queue_cancelled');
  });

  /** Volver a una partida tras cerrar la app o quedarse sin cobertura. */
  socket.on('resume', (payload: ResumePayload) => {
    const game = manager.get(payload?.gameId ?? '');
    if (!game) return fail(socket, 'no_game', 'Esa partida ya no está disponible.');

    const seat = game.playerByToken(payload?.token ?? '');
    if (!seat) return fail(socket, 'no_game', 'No eres jugador de esa partida.');

    // Si el jugador tenía otra pestaña o sesión abierta, esta la sustituye.
    if (seat.player.socketId && seat.player.socketId !== socket.id) {
      socketGame.delete(seat.player.socketId);
    }
    seat.player.socketId = socket.id;
    attach(socket, game);
    socket.emit('joined', {
      gameId: game.id,
      token: seat.player.token,
      color: seat.color,
      code: game.id,
    });
    broadcast(game);
  });

  socket.on('move', (payload: MovePayload) => {
    const game = gameOf(socket);
    if (!game) return fail(socket, 'no_game', 'No estás en ninguna partida.');
    const seat = game.playerBySocket(socket.id);
    if (!seat) return fail(socket, 'no_game', 'No estás en ninguna partida.');

    const error = game.move(seat.color, payload?.from, payload?.to, payload?.promotion);
    if (error) {
      fail(socket, 'bad_move', error);
      // Reenviar el estado real: el tablero del cliente puede haberse adelantado.
      socket.emit('state', game.stateFor(seat.color));
      return;
    }
    broadcast(game);
  });

  socket.on('resign', () => {
    const game = gameOf(socket);
    const seat = game?.playerBySocket(socket.id);
    if (!game || !seat) return;
    game.resign(seat.color);
    broadcast(game);
  });

  socket.on('offer_draw', () => {
    const game = gameOf(socket);
    const seat = game?.playerBySocket(socket.id);
    if (!game || !seat) return;
    game.offerDraw(seat.color);
    broadcast(game);
  });

  socket.on('accept_draw', () => {
    const game = gameOf(socket);
    const seat = game?.playerBySocket(socket.id);
    if (!game || !seat) return;
    if (game.acceptDraw(seat.color)) broadcast(game);
  });

  socket.on('decline_draw', () => {
    const game = gameOf(socket);
    const seat = game?.playerBySocket(socket.id);
    if (!game || !seat) return;
    game.declineDraw(seat.color);
    broadcast(game);
  });

  socket.on('disconnect', () => {
    manager.leaveQueue(socket.id);
    const game = gameOf(socket);
    socketGame.delete(socket.id);
    if (!game) return;

    const seat = game.playerBySocket(socket.id);
    if (!seat) return;

    // No se cancela la partida: el jugador conserva su token y puede volver.
    // Mientras tanto su reloj sigue corriendo, así que perderá por tiempo si
    // no regresa.
    seat.player.socketId = null;
    broadcast(game);
  });
});

// ---------------------------------------------------------------------------
// Tareas periódicas
// ---------------------------------------------------------------------------

/** Comprueba una vez por segundo si a alguien se le ha agotado el tiempo. */
setInterval(() => {
  for (const game of manager.activeTimedGames()) {
    if (game.checkFlag()) broadcast(game);
  }
}, 1000);

setInterval(() => manager.sweep(), 5 * 60 * 1000);

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`PessChess escuchando en http://0.0.0.0:${PORT}`);
});

// Los servicios de alojamiento avisan con SIGTERM antes de parar el contenedor.
// Cerrar ordenadamente da tiempo a que los clientes vean la desconexión y
// entren en su ciclo de reconexión en vez de quedarse colgados.
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    console.log(`Recibido ${signal}, cerrando…`);
    io.close(() => {
      httpServer.close(() => process.exit(0));
    });
    // Si algo se atasca, no quedarse colgado para siempre.
    setTimeout(() => process.exit(0), 5000).unref();
  });
}
