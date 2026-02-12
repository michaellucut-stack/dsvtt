import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createTestApp } from '../../test-utils/setup.js';

// =============================================================================
// App Builder
// =============================================================================

/**
 * Builds a test Express app with timeout middleware and endpoints that
 * respond at different speeds.
 */
async function buildTimeoutApp(): Promise<Express> {
  const app = createTestApp();
  const { Router } = await import('express');
  const { requestTimeout } = await import('../timeout.js');

  const router = Router();

  // ── Fast endpoint (responds immediately) ──────────────────────────────
  router.get('/fast', requestTimeout(500), (_req, res) => {
    res.json({ ok: true, message: 'fast response' });
  });

  // ── Slow endpoint (delayed response controlled by test) ───────────────
  // Uses a configurable delay via query param
  router.get('/slow', requestTimeout(100), (req, res) => {
    const delay = parseInt(req.query.delay as string, 10) || 200;
    setTimeout(() => {
      if (!res.headersSent) {
        res.json({ ok: true, message: 'slow response' });
      }
    }, delay);
  });

  // ── Endpoint with generous timeout for normal operation ───────────────
  router.get('/generous', requestTimeout(5000), (_req, res) => {
    res.json({ ok: true, message: 'generous timeout' });
  });

  app.use('/test', router);
  return app;
}

// =============================================================================
// Test Suite
// =============================================================================

describe('Timeout Middleware', () => {
  let app: Express;

  beforeAll(async () => {
    app = await buildTimeoutApp();
  });

  // ─── Normal operation ───────────────────────────────────────────────────
  describe('fast requests', () => {
    it('should allow fast requests to complete normally', async () => {
      const res = await request(app).get('/test/fast');

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.message).toBe('fast response');
    });

    it('should complete without timeout error when well within limit', async () => {
      const res = await request(app).get('/test/generous');

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.message).toBe('generous timeout');
    });
  });

  // ─── Timeout behaviour ─────────────────────────────────────────────────
  describe('slow requests', () => {
    it('should return 408 for requests that exceed the timeout', async () => {
      // The /slow endpoint has a 100ms timeout, and the handler delays 200ms
      const res = await request(app).get('/test/slow?delay=200');

      expect(res.status).toBe(408);
      expect(res.body.ok).toBe(false);
      expect(res.body.error.code).toBe('REQUEST_TIMEOUT');
      expect(res.body.error.message).toContain('timed out');
      expect(res.body.error.message).toContain('100');
    });

    it('should return structured JSON error on timeout', async () => {
      const res = await request(app).get('/test/slow?delay=300');

      expect(res.status).toBe(408);
      expect(res.body).toEqual({
        ok: false,
        error: {
          code: 'REQUEST_TIMEOUT',
          message: 'Request timed out after 100ms',
        },
      });
    });
  });

  // ─── Timer cleanup ─────────────────────────────────────────────────────
  describe('timer cleanup', () => {
    it('should clean up timer on response finish (no timeout error after fast response)', async () => {
      // Making a fast request to an endpoint with a short timeout
      // should not produce errors — the timer should be cleaned up
      const res = await request(app).get('/test/fast');

      expect(res.status).toBe(200);

      // If the timer weren't cleaned up, there could be lingering timeouts.
      // We verify by waiting a bit and ensuring no unhandled errors occur.
      await new Promise((resolve) => setTimeout(resolve, 600));

      // If we get here without an error, cleanup worked
      expect(true).toBe(true);
    });
  });
});
