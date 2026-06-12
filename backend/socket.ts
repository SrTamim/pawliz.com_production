import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import type { Server as HttpServer } from 'http';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
} from './types/socket';

type PawlizServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

let io: PawlizServer | undefined;

/**
 * Initialise Socket.IO on the HTTP server.
 *
 * Capacity decisions (no Redis, single process):
 *  - WebSocket-only transport: eliminates HTTP long-poll fallback which doubles
 *    connection overhead. Every modern browser supports WebSocket.
 *  - pingInterval 30 s / pingTimeout 20 s: keeps the heartbeat lean.
 *  - maxHttpBufferSize 64 KB: notifications are tiny; no need for the 1 MB default.
 *  - No DB query on connect: the JWT is signed HS256 and expires in 15 min.
 *    Verifying the signature is sufficient for socket auth. The is_active DB check
 *    on every connection costs one query per user per page load and becomes a
 *    meaningful bottleneck at scale. Banned/inactive users are blocked at the HTTP
 *    API layer (authenticate middleware) and their JWTs expire naturally in 15 min.
 */
export function init(httpServer: HttpServer, corsOrigins: string[]): PawlizServer {
  io = new Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(httpServer, {
    // WebSocket only — no long-poll fallback.
    // Halves memory per connection and eliminates HTTP handshake overhead.
    transports: ['websocket'],

    cors: {
      origin: corsOrigins,
      credentials: true,
    },

    // Heartbeat: server pings every 30 s, client must respond within 20 s.
    pingInterval: 30000,
    pingTimeout: 20000,

    // Reject payloads over 64 KB — notifications never approach this.
    maxHttpBufferSize: 64 * 1024,

    serveClient: false,
  });

  // Auth middleware — JWT verify only, no DB round-trip.
  io.use((socket, next) => {
    try {
      const cookieHeader = socket.handshake.headers.cookie || '';
      const match = cookieHeader.match(/(?:^|;\s*)pawliz_access=([^;]+)/);
      const token = match ? match[1] : null;
      if (!token) return next(new Error('Unauthorized'));

      const payload = jwt.verify(token, process.env.JWT_SECRET as string, {
        algorithms: ['HS256'],
      }) as jwt.JwtPayload;
      // Kept on the socket instance (legacy pattern predating SocketData).
      (socket as any).userId = payload.userId;
      next();
    } catch {
      next(new Error('Unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    socket.join(`user:${(socket as any).userId}`);

    // Clients are receive-only — disconnect if they try to push arbitrary data.
    socket.on('message', () => socket.disconnect(true));
  });

  return io;
}

export function getIO(): PawlizServer | undefined {
  return io;
}
