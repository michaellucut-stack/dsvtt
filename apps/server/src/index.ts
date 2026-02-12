import http from 'node:http';
import path from 'node:path';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { Server as SocketIOServer } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '@dsvtt/events';
import { config } from './config/index.js';
import { authRouter } from './api/auth/auth.router.js';
import { roomRouter } from './api/rooms/room.router.js';
import { sessionRouter } from './api/sessions/session.router.js';
import { mapRouter, mapDetailRouter } from './api/maps/map.router.js';
import { diceRouter } from './api/dice/dice.router.js';
import { chatRouter } from './api/chat/chat.router.js';
import { turnRouter } from './api/turns/turn.router.js';
import { npcRouter, npcDetailRouter } from './api/npcs/npc.router.js';
import { characterRouter, characterDetailRouter } from './api/characters/character.router.js';
import { notesRouter, notesDetailRouter } from './api/notes/notes.router.js';
import { replayRouter } from './api/replay/replay.router.js';
import { searchRouter } from './api/search/search.router.js';
import { registerAllReducers } from '@dsvtt/game-engine';
import { notFound, errorHandler } from './middleware/error-handler.js';
import { apiRateLimit, authRateLimit } from './middleware/rate-limit.js';
import { requestId, wsOriginValidation } from './middleware/security.js';
import { registerConnectionHandler } from './socket/connection.js';
import { logger } from './utils/logger.js';
import { ensureUploadDir } from './utils/upload.js';

// ── Register event reducers for replay/snapshot system ──────────────

registerAllReducers();

// ── Express application ──────────────────────────────────────────────

const app = express();

// Request ID — must be first so all downstream middleware/logs can use it
app.use(requestId);

// Enhanced security headers
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        connectSrc: ["'self'", 'ws:', 'wss:'],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
    hsts: {
      maxAge: 31_536_000, // 1 year
      includeSubDomains: true,
      preload: true,
    },
    frameguard: { action: 'deny' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  }),
);

// CORS — validate origin against whitelist
const allowedOrigins = config.corsOrigin.split(',').map((o) => o.trim());
app.use(
  cors({
    origin(origin, callback) {
      // Allow requests with no origin (server-to-server, curl, health checks)
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        logger.warn('CORS request rejected', { origin, context: 'security' });
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  }),
);

// Body parsing
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// Global API rate limiter (moderate — tighter limits on auth routes)
app.use(apiRateLimit);

// ── Static file serving (uploaded map backgrounds) ───────────────────

ensureUploadDir();
app.use('/uploads', express.static(path.resolve(process.cwd(), 'uploads')));

// ── Health check ─────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json({ ok: true, uptime: process.uptime() });
});

// ── API routes ───────────────────────────────────────────────────────

app.use('/api/auth', authRateLimit, authRouter);
app.use('/api/rooms', roomRouter);
app.use('/api', sessionRouter);
app.use('/api/sessions/:sessionId/maps', mapRouter);
app.use('/api/maps', mapDetailRouter);
app.use('/api/sessions/:sessionId/dice', diceRouter);
app.use('/api/sessions/:sessionId/chat', chatRouter);
app.use('/api/sessions/:sessionId/turns', turnRouter);
app.use('/api/sessions/:sessionId/npcs', npcRouter);
app.use('/api/npcs', npcDetailRouter);
app.use('/api/sessions/:sessionId/characters', characterRouter);
app.use('/api/characters', characterDetailRouter);
app.use('/api/sessions/:sessionId/notes', notesRouter);
app.use('/api/notes', notesDetailRouter);
app.use('/api/sessions/:sessionId/replay', replayRouter);
app.use('/api/sessions/:sessionId/search', searchRouter);

// ── Fallback handlers ────────────────────────────────────────────────

app.use(notFound);
app.use(errorHandler);

// ── HTTP + Socket.IO server ──────────────────────────────────────────

const server = http.createServer(app);

const io = new SocketIOServer<ClientToServerEvents, ServerToClientEvents>(server, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
  },
  pingInterval: 25_000,
  pingTimeout: 20_000,
});

// WebSocket origin validation — runs before auth middleware
io.use(wsOriginValidation(allowedOrigins));

registerConnectionHandler(io);

// ── Start listening ──────────────────────────────────────────────────

server.listen(config.port, () => {
  logger.info(`Server listening on port ${config.port}`, {
    port: config.port,
    env: config.nodeEnv,
    context: 'server',
  });
});

// ── Graceful shutdown ────────────────────────────────────────────────

/**
 * Gracefully close the HTTP server and Socket.IO connections, then exit.
 */
function shutdown(signal: string): void {
  logger.info(`${signal} received — shutting down gracefully`, { context: 'server' });

  io.close(() => {
    logger.info('Socket.IO closed', { context: 'server' });
  });

  server.close(() => {
    logger.info('HTTP server closed', { context: 'server' });
    process.exit(0);
  });

  // Force exit after 10 seconds if graceful shutdown stalls
  setTimeout(() => {
    logger.error('Forced exit after timeout', { context: 'server' });
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Export for testing
export { app, server, io };
