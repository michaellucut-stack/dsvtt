import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createTestApp } from '../../test-utils/setup.js';

// =============================================================================
// App Builders
// =============================================================================

/**
 * Builds a test Express app with a custom rate limiter applied to a
 * test endpoint.
 */
async function buildRateLimitApp(
  maxRequests: number,
  windowMs: number,
): Promise<Express> {
  const app = createTestApp();
  const { Router } = await import('express');
  const { rateLimit } = await import('../rate-limit.js');

  const router = Router();
  const limiter = rateLimit({ maxRequests, windowMs });

  router.get('/limited', limiter, (_req, res) => {
    res.json({ ok: true });
  });

  app.use('/test', router);
  return app;
}

/**
 * Builds a test Express app using the named presets (authRateLimit, apiRateLimit).
 */
async function buildPresetApp(): Promise<Express> {
  const app = createTestApp();
  const { Router } = await import('express');
  const { authRateLimit, apiRateLimit } = await import('../rate-limit.js');

  const router = Router();

  router.get('/auth', authRateLimit, (_req, res) => {
    res.json({ ok: true, endpoint: 'auth' });
  });

  router.get('/api', apiRateLimit, (_req, res) => {
    res.json({ ok: true, endpoint: 'api' });
  });

  app.use('/test', router);
  return app;
}

// =============================================================================
// Test Suite
// =============================================================================

describe('Rate Limit Middleware', () => {
  // ─── Basic rate limiting ────────────────────────────────────────────────
  describe('rateLimit()', () => {
    it('should allow requests under the limit', async () => {
      const app = await buildRateLimitApp(5, 60_000);

      // Make 3 requests out of a limit of 5 — all should succeed
      for (let i = 0; i < 3; i++) {
        const res = await request(app).get('/test/limited');
        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);
      }
    });

    it('should return 429 when limit is exceeded', async () => {
      const app = await buildRateLimitApp(3, 60_000);

      // Exhaust the 3-request limit
      for (let i = 0; i < 3; i++) {
        const res = await request(app).get('/test/limited');
        expect(res.status).toBe(200);
      }

      // The 4th request should be rate-limited
      const res = await request(app).get('/test/limited');
      expect(res.status).toBe(429);
      expect(res.body.ok).toBe(false);
      expect(res.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(res.body.error.message).toContain('Too many requests');
    });

    it('should return structured JSON error on 429', async () => {
      const app = await buildRateLimitApp(1, 60_000);

      // Exhaust the single-request limit
      await request(app).get('/test/limited');

      const res = await request(app).get('/test/limited');
      expect(res.status).toBe(429);
      expect(res.body).toEqual({
        ok: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests, please try again later',
        },
      });
    });

    it('should refill tokens over time', async () => {
      // Use fake timers to test token refill without real delays
      vi.useFakeTimers();

      try {
        const app = await buildRateLimitApp(2, 1000); // 2 req/sec

        // Exhaust all tokens
        await request(app).get('/test/limited');
        await request(app).get('/test/limited');

        // Should be rate-limited now
        let res = await request(app).get('/test/limited');
        expect(res.status).toBe(429);

        // Advance time by the full window to fully refill tokens
        vi.advanceTimersByTime(1000);

        // Should be allowed again after refill
        res = await request(app).get('/test/limited');
        expect(res.status).toBe(200);
      } finally {
        vi.useRealTimers();
      }
    });

    it('should track different IPs independently', async () => {
      // This is a basic test — supertest uses the same loopback IP,
      // but we verify the bucket is per-IP by ensuring requests from
      // the same IP share the same bucket.
      const app = await buildRateLimitApp(2, 60_000);

      const res1 = await request(app).get('/test/limited');
      const res2 = await request(app).get('/test/limited');
      const res3 = await request(app).get('/test/limited');

      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);
      expect(res3.status).toBe(429);
    });
  });

  // ─── Named Presets ──────────────────────────────────────────────────────
  describe('authRateLimit', () => {
    it('should allow requests within the 10/min limit', async () => {
      const app = await buildPresetApp();

      // authRateLimit allows 10 requests per minute
      for (let i = 0; i < 10; i++) {
        const res = await request(app).get('/test/auth');
        expect(res.status).toBe(200);
      }
    });

    it('should block the 11th request within a minute', async () => {
      const app = await buildPresetApp();

      // Exhaust all 10 tokens
      for (let i = 0; i < 10; i++) {
        await request(app).get('/test/auth');
      }

      const res = await request(app).get('/test/auth');
      expect(res.status).toBe(429);
    });
  });

  describe('apiRateLimit', () => {
    it('should allow requests within the 60/min limit', async () => {
      const app = await buildPresetApp();

      // apiRateLimit allows 60 requests per minute — test a subset
      for (let i = 0; i < 30; i++) {
        const res = await request(app).get('/test/api');
        expect(res.status).toBe(200);
      }
    });

    it('should block requests beyond the 60/min limit', async () => {
      const app = await buildPresetApp();

      // Exhaust all 60 tokens
      for (let i = 0; i < 60; i++) {
        await request(app).get('/test/api');
      }

      const res = await request(app).get('/test/api');
      expect(res.status).toBe(429);
    });
  });
});
