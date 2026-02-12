import http from 'node:http';
import path from 'node:path';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { Server as SocketIOServer } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '@dsvtt/events';
import { config } from './config/index.js';
import { disconnectPrisma } from './config/prisma.js';
import { requestTimeout } from './middleware/timeout.js';
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
import {
  requestId,
  wsOriginValidation,
  securityAuditLog,
  preventParamPollution,
  sanitizeBody,
} from './middleware/security.js';
import { csrfTokenHandler, csrfProtection } from './middleware/csrf.js';
import { registerConnectionHandler } from './socket/connection.js';
import { setIO } from './config/socket-io.js';
import { logger } from './utils/logger.js';
import { ensureUploadDir } from './utils/upload.js';

// ── Register event reducers for replay/snapshot system ──────────────

registerAllReducers();

// ── Express application ──────────────────────────────────────────────

const app = express();

// Request ID — must be first so all downstream middleware/logs can use it
app.use(requestId);

// Security audit logging — captures auth failures, rate limits, CORS rejections
app.use(securityAuditLog);

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

// Request timeout — abort requests exceeding the configured limit
app.use(requestTimeout(config.requestTimeout));

// Body parsing
app.use(express.json({ limit: config.maxBodySize }));
app.use(express.urlencoded({ extended: false, limit: config.maxBodySize }));
app.use(cookieParser());

// Global API rate limiter (moderate — tighter limits on auth routes)
app.use(apiRateLimit);

// Sanitize request bodies — trim strings, remove null bytes
app.use(sanitizeBody);

// Prevent HTTP parameter pollution — deduplicate query params
app.use(preventParamPollution);

// CSRF protection — double-submit cookie (skips Bearer token & WebSocket requests)
app.use(csrfProtection);

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

// Make the io instance available to REST route handlers via singleton
setIO(io);

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
 * Gracefully close the HTTP server, Socket.IO connections, and Prisma client,
 * then exit. Shutdown order: HTTP server → Socket.IO → Prisma.
 */
function shutdown(signal: string): void {
  logger.info(`${signal} received — shutting down gracefully`, { context: 'server' });

  // Force exit after 10 seconds if graceful shutdown stalls
  setTimeout(() => {
    logger.error('Forced exit after timeout', { context: 'server' });
    process.exit(1);
  }, 10_000).unref();

  // 1. Stop accepting new HTTP connections
  server.close(() => {
    logger.info('HTTP server closed', { context: 'server' });

    // 2. Close all Socket.IO connections
    io.close(() => {
      logger.info('Socket.IO closed', { context: 'server' });

      // 3. Disconnect Prisma with its own timeout guard
      const prismaTimeout = setTimeout(() => {
        logger.error('Prisma disconnect timed out — forcing exit', { context: 'server' });
        process.exit(1);
      }, 5_000);
      prismaTimeout.unref();

      disconnectPrisma()
        .then(() => {
          clearTimeout(prismaTimeout);
          process.exit(0);
        })
        .catch((err: unknown) => {
          clearTimeout(prismaTimeout);
          logger.error('Error disconnecting Prisma', {
            context: 'server',
            error: err instanceof Error ? err.message : String(err),
          });
          process.exit(1);
        });
    });
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Export for testing
export { app, server, io };
