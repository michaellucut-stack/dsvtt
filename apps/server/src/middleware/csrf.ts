import type { Request, Response, NextFunction } from 'express';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { logger } from '../utils/logger.js';
import { AppError } from './error-handler.js';

// ── Constants ────────────────────────────────────────────────────────────────

/** CSRF token length in bytes (32 bytes = 64 hex characters). */
const TOKEN_BYTE_LENGTH = 32;

/** Name of the CSRF cookie. */
const CSRF_COOKIE_NAME = 'csrf-token';

/** Name of the header that must carry the CSRF token on mutation requests. */
const CSRF_HEADER_NAME = 'x-csrf-token';

/** HTTP methods that are safe (read-only) and exempt from CSRF checks. */
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

const NODE_ENV = process.env['NODE_ENV'] ?? 'development';

// ── Token Generation ─────────────────────────────────────────────────────────

/**
 * Generates a cryptographically random CSRF token.
 *
 * @returns A hex-encoded random token string.
 */
function generateCsrfToken(): string {
  return randomBytes(TOKEN_BYTE_LENGTH).toString('hex');
}

// ── CSRF Token Endpoint Handler ──────────────────────────────────────────────

/**
 * Express route handler that generates a new CSRF token, sets it as an
 * HTTP-only cookie, and returns it in the response body.
 *
 * Mount on `GET /api/auth/csrf-token`.
 *
 * @example
 * ```ts
 * router.get('/csrf-token', csrfTokenHandler);
 * ```
 */
export function csrfTokenHandler(_req: Request, res: Response): void {
  const token = generateCsrfToken();

  res.cookie(CSRF_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: NODE_ENV === 'production',
    path: '/',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  });

  res.json({ ok: true, data: { token } });
}

// ── CSRF Validation Middleware ────────────────────────────────────────────────

/**
 * Performs a constant-time comparison of two token strings to prevent
 * timing attacks.
 *
 * @param a - First token.
 * @param b - Second token.
 * @returns `true` if the tokens are equal.
 */
function tokensMatch(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  const bufA = Buffer.from(a, 'utf-8');
  const bufB = Buffer.from(b, 'utf-8');

  return timingSafeEqual(bufA, bufB);
}

/**
 * Checks whether a request carries a Bearer token in the Authorization header.
 * Requests authenticated via Bearer tokens are inherently CSRF-safe because
 * the custom `Authorization` header cannot be set by cross-origin forms.
 */
function hasBearerToken(req: Request): boolean {
  const authHeader = req.headers.authorization;
  return typeof authHeader === 'string' && authHeader.startsWith('Bearer ');
}

/**
 * Checks whether the request is a WebSocket upgrade handshake.
 */
function isWebSocketUpgrade(req: Request): boolean {
  const upgrade = req.headers.upgrade;
  return typeof upgrade === 'string' && upgrade.toLowerCase() === 'websocket';
}

/**
 * Checks whether the request sends a JSON content type. JSON requests
 * trigger a CORS preflight (`Content-Type: application/json` is not a
 * "simple" header), so they cannot be forged by a plain HTML form.
 */
function isJsonContentType(req: Request): boolean {
  const ct = req.headers['content-type'];
  return typeof ct === 'string' && ct.toLowerCase().includes('application/json');
}

/**
 * Express middleware implementing double-submit cookie CSRF protection.
 *
 * For non-safe HTTP methods (POST, PUT, PATCH, DELETE), the middleware
 * validates that the `X-CSRF-Token` header matches the `csrf-token` cookie.
 *
 * Requests are exempt from CSRF validation when:
 * - The HTTP method is GET, HEAD, or OPTIONS (safe/read-only).
 * - The request carries a Bearer token (custom header = CSRF-proof).
 * - The request sends `Content-Type: application/json` (triggers CORS preflight).
 * - The request is a WebSocket upgrade handshake.
 *
 * @example
 * ```ts
 * // Apply after cookie-parser
 * app.use(csrfProtection);
 * ```
 */
export function csrfProtection(req: Request, _res: Response, next: NextFunction): void {
  // Safe methods are exempt
  if (SAFE_METHODS.has(req.method)) {
    next();
    return;
  }

  // WebSocket upgrades are exempt
  if (isWebSocketUpgrade(req)) {
    next();
    return;
  }

  // Bearer token requests are already CSRF-safe via custom header
  if (hasBearerToken(req)) {
    next();
    return;
  }

  // JSON content-type requests trigger a CORS preflight and cannot be
  // sent by a plain HTML form, so they are inherently CSRF-safe
  if (isJsonContentType(req)) {
    next();
    return;
  }

  // Extract the cookie token and the header token
  const cookieToken = req.cookies?.[CSRF_COOKIE_NAME] as string | undefined;
  const headerToken = req.headers[CSRF_HEADER_NAME] as string | undefined;

  if (!cookieToken || !headerToken) {
    logger.warn('CSRF validation failed: missing token', {
      context: 'security-audit',
      eventType: 'csrf_rejection',
      requestId: req.requestId,
      method: req.method,
      path: req.originalUrl,
      ip: req.ip,
      hasCookie: !!cookieToken,
      hasHeader: !!headerToken,
    });
    next(new AppError('CSRF token missing', 403, 'CSRF_TOKEN_MISSING'));
    return;
  }

  if (!tokensMatch(cookieToken, headerToken)) {
    logger.warn('CSRF validation failed: token mismatch', {
      context: 'security-audit',
      eventType: 'csrf_rejection',
      requestId: req.requestId,
      method: req.method,
      path: req.originalUrl,
      ip: req.ip,
    });
    next(new AppError('CSRF token invalid', 403, 'CSRF_TOKEN_INVALID'));
    return;
  }

  next();
}
