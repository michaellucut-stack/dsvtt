import http from 'node:http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { Server as SocketIOServer } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '@dsvtt/events';
import { config } from './config/index.js';
import { authRouter } from './api/auth/auth.router.js';
import { notFound, errorHandler } from './middleware/error-handler.js';
import { rateLimit } from './middleware/rate-limit.js';
import { registerConnectionHandler } from './socket/connection.js';

// ── Express application ──────────────────────────────────────────────

const app = express();

// Security headers
app.use(helmet());

// CORS
app.use(
  cors({
    origin: config.corsOrigin,
    credentials: true,
  }),
);

// Body parsing
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// Global rate limiter (relaxed — tighter limits on auth routes)
app.use(rateLimit({ windowMs: 60_000, maxRequests: 120 }));

// ── Health check ─────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json({ ok: true, uptime: process.uptime() });
});

// ── API routes ───────────────────────────────────────────────────────

app.use('/api/auth', authRouter);

// ── Fallback handlers ────────────────────────────────────────────────

app.use(notFound);
app.use(errorHandler);

// ── HTTP + Socket.IO server ──────────────────────────────────────────

const server = http.createServer(app);

const io = new SocketIOServer<ClientToServerEvents, ServerToClientEvents>(server, {
  cors: {
    origin: config.corsOrigin,
    credentials: true,
  },
  pingInterval: 25_000,
  pingTimeout: 20_000,
});

registerConnectionHandler(io);

// ── Start listening ──────────────────────────────────────────────────

server.listen(config.port, () => {
  console.log(
    `[Server] Listening on port ${config.port} (env=${config.nodeEnv})`,
  );
});

// ── Graceful shutdown ────────────────────────────────────────────────

/**
 * Gracefully close the HTTP server and Socket.IO connections, then exit.
 */
function shutdown(signal: string): void {
  console.log(`\n[Server] ${signal} received — shutting down gracefully…`);

  io.close(() => {
    console.log('[Server] Socket.IO closed');
  });

  server.close(() => {
    console.log('[Server] HTTP server closed');
    process.exit(0);
  });

  // Force exit after 10 seconds if graceful shutdown stalls
  setTimeout(() => {
    console.error('[Server] Forced exit after timeout');
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Export for testing
export { app, server, io };
