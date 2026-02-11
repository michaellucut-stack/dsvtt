import type { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import type { JwtPayload } from '@dsvtt/shared';
import type { ClientToServerEvents, ServerToClientEvents } from '@dsvtt/events';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { registerRoomEvents } from './room-events.js';
import { registerGameEvents } from './game-events.js';

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
 * After authentication, room-events and game-events handlers are registered
 * on the socket.
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
      logger.warn('Socket connection rejected: no token', {
        context: 'socket',
        socketId: socket.id,
        ip: socket.handshake.address,
      });
      next(new Error('Authentication required'));
      return;
    }

    try {
      const decoded = jwt.verify(token, config.jwtSecret) as JwtPayload;
      socket.data.user = decoded;
      next();
    } catch {
      logger.warn('Socket connection rejected: invalid token', {
        context: 'socket',
        socketId: socket.id,
        ip: socket.handshake.address,
      });
      next(new Error('Invalid or expired token'));
    }
  });

  // ── Connection handler ─────────────────────────────────────────────
  io.on('connection', (socket: TypedSocket) => {
    const user = socket.data.user;
    logger.info('Socket connected', {
      context: 'socket',
      socketId: socket.id,
      userId: user?.sub ?? 'unknown',
    });

    // Register domain-specific event handlers
    registerRoomEvents(io, socket);
    registerGameEvents(io, socket);

    socket.on('disconnect', (reason) => {
      logger.info('Socket disconnected', {
        context: 'socket',
        socketId: socket.id,
        userId: user?.sub ?? 'unknown',
        reason,
      });
    });

    socket.on('error', (err) => {
      logger.error('Socket error', {
        context: 'socket',
        socketId: socket.id,
        userId: user?.sub ?? 'unknown',
        error: err.message,
      });
    });
  });
}
