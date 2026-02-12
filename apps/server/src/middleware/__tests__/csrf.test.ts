import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createTestApp, withErrorHandler } from '../../test-utils/setup.js';

// =============================================================================
// App Builder
// =============================================================================

/**
 * Builds a test Express app with CSRF middleware and test endpoints.
 * Uses cookie-parser to handle the double-submit cookie pattern.
 */
async function buildCsrfApp(): Promise<Express> {
  const app = createTestApp();
  const { Router } = await import('express');
  const cookieParser = (await import('cookie-parser')).default;
  const { csrfTokenHandler, csrfProtection } = await import('../csrf.js');

  app.use(cookieParser());

  const router = Router();

  // ── Token generation endpoint ─────────────────────────────────────────
  router.get('/csrf-token', csrfTokenHandler);

  // ── CSRF-protected mutation endpoints ─────────────────────────────────
  router.post('/protected', csrfProtection, (_req, res) => {
    res.json({ ok: true, message: 'Mutation succeeded' });
  });

  router.put('/protected', csrfProtection, (_req, res) => {
    res.json({ ok: true, message: 'PUT succeeded' });
  });

  router.delete('/protected', csrfProtection, (_req, res) => {
    res.json({ ok: true, message: 'DELETE succeeded' });
  });

  // ── Safe method endpoints (should bypass CSRF) ────────────────────────
  router.get('/protected', csrfProtection, (_req, res) => {
    res.json({ ok: true, message: 'GET succeeded' });
  });

  app.use('/test', router);
  return withErrorHandler(app);
}

// =============================================================================
// Test Suite
// =============================================================================

describe('CSRF Middleware', () => {
  let app: Express;

  beforeAll(async () => {
    app = await buildCsrfApp();
  });

  // ─── csrfTokenHandler ───────────────────────────────────────────────────
  describe('csrfTokenHandler', () => {
    it('should generate a CSRF token and return it in the body', async () => {
      const res = await request(app).get('/test/csrf-token');

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.data.token).toBeDefined();
      expect(typeof res.body.data.token).toBe('string');
      // Token should be 64 hex characters (32 bytes)
      expect(res.body.data.token).toMatch(/^[0-9a-f]{64}$/);
    });

    it('should set a csrf-token cookie', async () => {
      const res = await request(app).get('/test/csrf-token');

      expect(res.status).toBe(200);
      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();

      // Find the csrf-token cookie
      const csrfCookie = Array.isArray(cookies)
        ? cookies.find((c: string) => c.startsWith('csrf-token='))
        : typeof cookies === 'string' && cookies.startsWith('csrf-token=')
          ? cookies
          : undefined;
      expect(csrfCookie).toBeDefined();
      expect(csrfCookie).toContain('HttpOnly');
      expect(csrfCookie).toContain('SameSite=Strict');
    });

    it('should return a token matching the cookie value', async () => {
      const res = await request(app).get('/test/csrf-token');

      const token = res.body.data.token;
      const cookies = res.headers['set-cookie'];
      const csrfCookie = Array.isArray(cookies)
        ? cookies.find((c: string) => c.startsWith('csrf-token='))
        : cookies;

      expect(csrfCookie).toContain(`csrf-token=${token}`);
    });
  });

  // ─── csrfProtection ─────────────────────────────────────────────────────
  describe('csrfProtection', () => {
    // ── Safe methods bypass ─────────────────────────────────────────────
    it('should pass GET requests without CSRF token', async () => {
      const res = await request(app).get('/test/protected');

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
    });

    it('should pass HEAD requests without CSRF token', async () => {
      const res = await request(app).head('/test/protected');

      expect(res.status).toBe(200);
    });

    it('should pass OPTIONS requests without CSRF token', async () => {
      const res = await request(app).options('/test/protected');

      // OPTIONS may return 200 or 204 depending on Express config
      expect(res.status).toBeLessThan(400);
    });

    // ── Bearer token exemption ──────────────────────────────────────────
    it('should pass POST requests with Bearer token (no CSRF needed)', async () => {
      const res = await request(app)
        .post('/test/protected')
        .set('Authorization', 'Bearer some.jwt.token');

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
    });

    // ── JSON content-type exemption ─────────────────────────────────────
    it('should pass POST requests with application/json content-type', async () => {
      const res = await request(app)
        .post('/test/protected')
        .set('Content-Type', 'application/json')
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
    });

    // ── WebSocket upgrade exemption ─────────────────────────────────────
    it('should pass requests with WebSocket upgrade header', async () => {
      const res = await request(app)
        .post('/test/protected')
        .set('Upgrade', 'websocket')
        .set('Content-Type', 'text/plain');

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
    });

    // ── Rejection cases ─────────────────────────────────────────────────
    it('should reject POST mutations without CSRF token', async () => {
      const res = await request(app)
        .post('/test/protected')
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .send('data=test');

      expect(res.status).toBe(403);
      expect(res.body.ok).toBe(false);
      expect(res.body.error.code).toBe('CSRF_TOKEN_MISSING');
    });

    it('should reject PUT mutations without CSRF token', async () => {
      const res = await request(app)
        .put('/test/protected')
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .send('data=test');

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('CSRF_TOKEN_MISSING');
    });

    it('should reject DELETE mutations without CSRF token', async () => {
      const res = await request(app)
        .delete('/test/protected')
        .set('Content-Type', 'application/x-www-form-urlencoded');

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('CSRF_TOKEN_MISSING');
    });

    it('should reject when tokens do not match (mismatched double-submit)', async () => {
      // First, get a valid CSRF token
      const tokenRes = await request(app).get('/test/csrf-token');
      const cookies = tokenRes.headers['set-cookie'];

      // Send a request with the cookie from the token endpoint but a
      // different value in the header
      const res = await request(app)
        .post('/test/protected')
        .set('Cookie', Array.isArray(cookies) ? cookies.join('; ') : cookies)
        .set('x-csrf-token', 'wrong-token-value')
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .send('data=test');

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('CSRF_TOKEN_INVALID');
    });

    it('should accept matching double-submit tokens', async () => {
      // Get a valid CSRF token
      const tokenRes = await request(app).get('/test/csrf-token');
      const token = tokenRes.body.data.token;
      const cookies = tokenRes.headers['set-cookie'];

      // Send a request with matching cookie and header tokens
      const res = await request(app)
        .post('/test/protected')
        .set('Cookie', Array.isArray(cookies) ? cookies.join('; ') : cookies)
        .set('x-csrf-token', token)
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .send('data=test');

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
    });

    it('should reject when only the header token is present (no cookie)', async () => {
      const res = await request(app)
        .post('/test/protected')
        .set('x-csrf-token', 'some-token-value')
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .send('data=test');

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('CSRF_TOKEN_MISSING');
    });
  });
});
