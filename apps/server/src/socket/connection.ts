import type { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import type { JwtPayload } from '@dsvtt/shared';
import type { ClientToServerEvents, ServerToClientEvents } from '@dsvtt/events';
import { config } from '../config/index.js';

/** Typed Socket.IO server instance. */
type TypedServer = Server<ClientToServerEvents, ServerToClientEvents>;

/** Typed Socket.IO socket with auth data attached. */
type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents> & {
  data: { user?: JwtPayload };
};

/**
 * Register the Socket.IO connection handler with JWT authentication on the
 * handshake.
 *
 * Clients must supply a valid access token via `socket.auth.token` when
 * connecting. Unauthenticated connections are rejected.
 *
 * @param io - The Socket.IO server instance.
 */
export function registerConnectionHandler(io: TypedServer): void {
  // ── Auth middleware — runs once per connection attempt ──────────────
  io.use((socket: TypedSocket, next) => {
    const token =
      (socket.handshake.auth as Record<string, unknown>)['token'] as
        | string
        | undefined;

    if (!token) {
      next(new Error('Authentication required'));
      return;
    }

    try {
      const decoded = jwt.verify(token, config.jwtSecret) as JwtPayload;
      socket.data.user = decoded;
      next();
    } catch {
      next(new Error('Invalid or expired token'));
    }
  });

  // ── Connection handler ─────────────────────────────────────────────
  io.on('connection', (socket: TypedSocket) => {
    const user = socket.data.user;
    console.log(
      `[Socket] Connected: ${socket.id} (user=${user?.sub ?? 'unknown'})`,
    );

    socket.on('disconnect', (reason) => {
      console.log(
        `[Socket] Disconnected: ${socket.id} (user=${user?.sub ?? 'unknown'}, reason=${reason})`,
      );
    });

    socket.on('error', (err) => {
      console.error(`[Socket] Error on ${socket.id}:`, err.message);
    });
  });
}
