import type { Request, Response, NextFunction } from 'express';
import type { Socket } from 'socket.io';
import { randomUUID } from 'node:crypto';
import { logger } from '../utils/logger.js';
import { AppError } from './error-handler.js';

// ── Constants ────────────────────────────────────────────────────────────────

/** Regex for UUID v4 validation (case-insensitive). */
const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Regex to match null bytes in strings. */
const NULL_BYTE_REGEX = /\0/g;

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

// ── Security Audit Log Middleware ────────────────────────────────────────────

/**
 * Security event types that are logged for audit purposes.
 */
export type SecurityEventType =
  | 'auth_failure'
  | 'rate_limit'
  | 'cors_rejection'
  | 'csrf_rejection'
  | 'invalid_input';

/**
 * Express middleware that logs security-relevant events such as failed
 * authentication attempts, rate-limit hits, and CORS rejections.
 *
 * Should be mounted early in the middleware chain so it can capture
 * response status codes via the `finish` event.
 */
export function securityAuditLog(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const statusCode = res.statusCode;
    const requestId = req.requestId ?? 'unknown';

    // Only log security-relevant responses
    let eventType: SecurityEventType | undefined;

    if (statusCode === 401 || statusCode === 403) {
      eventType = 'auth_failure';
    } else if (statusCode === 429) {
      eventType = 'rate_limit';
    }

    if (eventType) {
      logger.warn('Security event detected', {
        context: 'security-audit',
        requestId,
        eventType,
        statusCode,
        method: req.method,
        path: req.originalUrl,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        duration,
      });
    }
  });

  next();
}

/**
 * Logs a security audit event directly (for use outside the request
 * lifecycle, e.g. in custom error handlers or CORS callbacks).
 *
 * @param eventType - The type of security event.
 * @param details - Additional context for the log entry.
 */
export function logSecurityEvent(
  eventType: SecurityEventType,
  details: Record<string, unknown>,
): void {
  logger.warn('Security event', {
    context: 'security-audit',
    eventType,
    ...details,
  });
}

// ── UUID Validation Middleware ────────────────────────────────────────────────

/**
 * Middleware factory that validates one or more route parameters are valid
 * UUID v4 strings. Prevents injection attacks via malformed identifiers.
 *
 * @param paramNames - Route parameter name(s) to validate.
 * @returns Express middleware that rejects requests with invalid UUIDs.
 *
 * @example
 * ```ts
 * router.get('/rooms/:roomId', validateUuid('roomId'), handler);
 * router.get('/sessions/:sessionId/maps/:mapId', validateUuid('sessionId', 'mapId'), handler);
 * ```
 */
export function validateUuid(...paramNames: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    for (const name of paramNames) {
      const value = req.params[name];

      if (value === undefined) {
        // Param not present — let other middleware handle required params
        continue;
      }

      if (typeof value !== 'string' || !UUID_V4_REGEX.test(value)) {
        logger.warn('Invalid UUID in route parameter', {
          context: 'security',
          requestId: req.requestId,
          param: name,
          value,
          method: req.method,
          path: req.originalUrl,
          ip: req.ip,
        });
        next(
          new AppError(
            `Invalid UUID for parameter "${name}"`,
            400,
            'INVALID_UUID',
          ),
        );
        return;
      }
    }

    next();
  };
}

// ── Parameter Pollution Prevention ───────────────────────────────────────────

/**
 * Express middleware that strips duplicate query parameters, keeping only the
 * last value for each key. This prevents HTTP parameter pollution attacks
 * where an attacker supplies the same key multiple times to confuse
 * downstream logic.
 *
 * @example
 * ```ts
 * // ?sort=name&sort=DROP TABLE -- → req.query.sort === "DROP TABLE --"
 * // After middleware: req.query.sort === "DROP TABLE --" (string, not array)
 * app.use(preventParamPollution);
 * ```
 */
export function preventParamPollution(req: Request, _res: Response, next: NextFunction): void {
  if (req.query) {
    for (const key of Object.keys(req.query)) {
      const value = req.query[key];

      if (Array.isArray(value)) {
        // Keep only the last value
        req.query[key] = value[value.length - 1];
      }
    }
  }

  next();
}

// ── Body Sanitization Helper ─────────────────────────────────────────────────

/**
 * Recursively sanitizes a value by trimming strings and removing null bytes.
 * Works on primitives, arrays, and plain objects.
 *
 * @param value - The value to sanitize.
 * @returns The sanitized value with trimmed strings and no null bytes.
 */
function sanitizeValue(value: unknown): unknown {
  if (typeof value === 'string') {
    return value.replace(NULL_BYTE_REGEX, '').trim();
  }

  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }

  if (value !== null && typeof value === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      sanitized[key] = sanitizeValue(val);
    }
    return sanitized;
  }

  // Numbers, booleans, null, undefined — pass through
  return value;
}

/**
 * Express middleware that recursively sanitizes `req.body` by trimming all
 * string values and removing null bytes (`\0`). This prevents null-byte
 * injection attacks and normalizes whitespace in user input.
 *
 * Should be mounted after body parsing middleware (e.g. `express.json()`).
 */
export function sanitizeBody(req: Request, _res: Response, next: NextFunction): void {
  if (req.body !== undefined && req.body !== null) {
    req.body = sanitizeValue(req.body);
  }
  next();
}
