import type { Request, Response, NextFunction } from 'express';

/** Configuration options for the in-memory rate limiter. */
export interface RateLimitOptions {
  /** Time window in milliseconds. Defaults to 60 000 (1 minute). */
  windowMs?: number;
  /** Maximum number of requests allowed within the window. Defaults to 60. */
  maxRequests?: number;
}

interface TokenBucket {
  tokens: number;
  lastRefill: number;
}

/**
 * Simple in-memory token-bucket rate limiter keyed by client IP.
 *
 * **Not suitable for multi-process / clustered deployments** — use Redis-backed
 * rate limiting in production at scale.
 *
 * @param options - Rate limit configuration.
 * @returns Express middleware that responds with 429 when the limit is exceeded.
 */
export function rateLimit(options: RateLimitOptions = {}) {
  const { windowMs = 60_000, maxRequests = 60 } = options;
  const buckets = new Map<string, TokenBucket>();

  // Periodically evict stale entries to prevent unbounded memory growth
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of buckets) {
      if (now - bucket.lastRefill > windowMs * 2) {
        buckets.delete(key);
      }
    }
  }, windowMs * 2);

  // Allow the Node process to exit without waiting for the timer
  if (cleanupInterval.unref) {
    cleanupInterval.unref();
  }

  return (req: Request, res: Response, next: NextFunction): void => {
    const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';
    const now = Date.now();

    let bucket = buckets.get(ip);

    if (!bucket) {
      bucket = { tokens: maxRequests, lastRefill: now };
      buckets.set(ip, bucket);
    }

    // Refill tokens proportionally to elapsed time
    const elapsed = now - bucket.lastRefill;
    const refill = (elapsed / windowMs) * maxRequests;
    bucket.tokens = Math.min(maxRequests, bucket.tokens + refill);
    bucket.lastRefill = now;

    if (bucket.tokens < 1) {
      res.status(429).json({
        ok: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests, please try again later',
        },
      });
      return;
    }

    bucket.tokens -= 1;
    next();
  };
}

// ── Named Rate-Limit Presets ─────────────────────────────────────────────────

/** Strict rate limit for auth routes: 10 requests per minute. */
export const authRateLimit = rateLimit({ windowMs: 60_000, maxRequests: 10 });

/** Moderate rate limit for general API routes: 60 requests per minute. */
export const apiRateLimit = rateLimit({ windowMs: 60_000, maxRequests: 60 });

/** Relaxed rate limit for WebSocket / high-frequency routes: 120 requests per minute. */
export const wsRateLimit = rateLimit({ windowMs: 60_000, maxRequests: 120 });
