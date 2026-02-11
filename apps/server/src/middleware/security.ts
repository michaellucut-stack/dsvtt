import type { Request, Response, NextFunction } from 'express';
import type { Socket } from 'socket.io';
import { randomUUID } from 'node:crypto';
import { logger } from '../utils/logger.js';

// ── Request ID Middleware ────────────────────────────────────────────────────

/** Augment Express Request with requestId. */
declare global {
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}

/**
 * Generates a unique request ID (UUID v4) for each incoming request.
 * Attaches it to `req.requestId` and sends it back via `X-Request-Id` header.
 */
export function requestId(req: Request, res: Response, next: NextFunction): void {
  const id = (req.headers['x-request-id'] as string) ?? randomUUID();
  req.requestId = id;
  res.setHeader('X-Request-Id', id);
  next();
}

// ── WebSocket Origin Validation ──────────────────────────────────────────────

/**
 * Creates a Socket.IO middleware that validates the WebSocket handshake origin
 * against an allow-list.
 *
 * @param allowedOrigins - Comma-separated string or array of allowed origins.
 */
export function wsOriginValidation(allowedOrigins: string | string[]) {
  const origins = Array.isArray(allowedOrigins)
    ? allowedOrigins
    : allowedOrigins.split(',').map((o) => o.trim());

  return (socket: Socket, next: (err?: Error) => void): void => {
    const origin = socket.handshake.headers.origin;

    if (!origin) {
      logger.warn('WebSocket connection rejected: no origin header', {
        context: 'security',
        socketId: socket.id,
        ip: socket.handshake.address,
      });
      next(new Error('Origin header required'));
      return;
    }

    if (!origins.includes(origin)) {
      logger.warn('WebSocket connection rejected: invalid origin', {
        context: 'security',
        socketId: socket.id,
        origin,
        ip: socket.handshake.address,
      });
      next(new Error('Origin not allowed'));
      return;
    }

    next();
  };
}

// ── XSS Sanitization Helper ─────────────────────────────────────────────────

/** Characters that must be escaped in user-supplied strings. */
const XSS_CHARS: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
};

const XSS_REGEX = /[&<>"'/]/g;

/**
 * Escapes HTML-significant characters to prevent XSS when user input is
 * reflected in responses.
 *
 * @param input - The untrusted string to sanitize.
 * @returns The escaped string, safe for inclusion in HTML contexts.
 */
export function sanitizeXss(input: string): string {
  return input.replace(XSS_REGEX, (char) => XSS_CHARS[char] ?? char);
}
