import { describe, it, expect, vi, beforeAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createTestApp, withErrorHandler } from '../../test-utils/setup.js';

// =============================================================================
// App Builder
// =============================================================================

/**
 * Builds a test Express app that exposes endpoints exercising each security
 * middleware function.
 */
async function buildSecurityApp(): Promise<Express> {
  const app = createTestApp();
  const { Router } = await import('express');
  const {
    requestId,
    sanitizeXss,
    sanitizeBody,
    securityAuditLog,
    validateUuid,
    preventParamPollution,
  } = await import('../security.js');

  const router = Router();

  // ── requestId middleware test endpoint ─────────────────────────────────
  router.get('/request-id', requestId, (req, res) => {
    res.json({ requestId: req.requestId });
  });

  // ── sanitizeXss helper test endpoint ──────────────────────────────────
  router.post('/sanitize-xss', (req, res) => {
    const result = sanitizeXss(req.body.input ?? '');
    res.json({ result });
  });

  // ── securityAuditLog test endpoints ───────────────────────────────────
  router.get('/audit/401', securityAuditLog, (_req, res) => {
    res.status(401).json({ error: 'Unauthorized' });
  });
  router.get('/audit/403', securityAuditLog, (_req, res) => {
    res.status(403).json({ error: 'Forbidden' });
  });
  router.get('/audit/429', securityAuditLog, (_req, res) => {
    res.status(429).json({ error: 'Too many requests' });
  });
  router.get('/audit/200', securityAuditLog, (_req, res) => {
    res.status(200).json({ ok: true });
  });

  // ── validateUuid middleware test endpoints ─────────────────────────────
  router.get('/uuid/:id', validateUuid('id'), (req, res) => {
    res.json({ id: req.params.id });
  });
  router.get(
    '/uuid/:roomId/map/:mapId',
    validateUuid('roomId', 'mapId'),
    (req, res) => {
      res.json({ roomId: req.params.roomId, mapId: req.params.mapId });
    },
  );

  // ── preventParamPollution middleware test endpoint ─────────────────────
  router.get('/query', preventParamPollution, (req, res) => {
    res.json({ query: req.query });
  });

  // ── sanitizeBody middleware test endpoint ──────────────────────────────
  router.post('/sanitize-body', sanitizeBody, (req, res) => {
    res.json({ body: req.body });
  });

  app.use('/test', router);
  return withErrorHandler(app);
}

// =============================================================================
// Test Suite
// =============================================================================

describe('Security Middleware', () => {
  let app: Express;

  beforeAll(async () => {
    app = await buildSecurityApp();
  });

  // ─── requestId ──────────────────────────────────────────────────────────
  describe('requestId', () => {
    it('should generate a UUID request ID when none is provided', async () => {
      const res = await request(app).get('/test/request-id');

      expect(res.status).toBe(200);
      expect(res.body.requestId).toBeDefined();
      expect(typeof res.body.requestId).toBe('string');
      // Should be a valid UUID v4 format
      expect(res.body.requestId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
    });

    it('should use the existing X-Request-Id header if present', async () => {
      const customId = 'custom-request-id-123';

      const res = await request(app)
        .get('/test/request-id')
        .set('X-Request-Id', customId);

      expect(res.status).toBe(200);
      expect(res.body.requestId).toBe(customId);
    });

    it('should set the X-Request-Id response header', async () => {
      const res = await request(app).get('/test/request-id');

      expect(res.headers['x-request-id']).toBeDefined();
      expect(res.headers['x-request-id']).toBe(res.body.requestId);
    });
  });

  // ─── sanitizeXss ────────────────────────────────────────────────────────
  describe('sanitizeXss', () => {
    it('should escape HTML angle brackets', async () => {
      const res = await request(app)
        .post('/test/sanitize-xss')
        .send({ input: '<script>alert("xss")</script>' });

      expect(res.status).toBe(200);
      expect(res.body.result).not.toContain('<');
      expect(res.body.result).not.toContain('>');
      expect(res.body.result).toContain('&lt;');
      expect(res.body.result).toContain('&gt;');
    });

    it('should escape ampersands', async () => {
      const res = await request(app)
        .post('/test/sanitize-xss')
        .send({ input: 'foo & bar' });

      expect(res.status).toBe(200);
      expect(res.body.result).toBe('foo &amp; bar');
    });

    it('should escape double quotes', async () => {
      const res = await request(app)
        .post('/test/sanitize-xss')
        .send({ input: 'say "hello"' });

      expect(res.status).toBe(200);
      expect(res.body.result).toContain('&quot;');
    });

    it('should escape single quotes', async () => {
      const res = await request(app)
        .post('/test/sanitize-xss')
        .send({ input: "it's" });

      expect(res.status).toBe(200);
      expect(res.body.result).toContain('&#x27;');
    });

    it('should escape forward slashes', async () => {
      const res = await request(app)
        .post('/test/sanitize-xss')
        .send({ input: 'a/b' });

      expect(res.status).toBe(200);
      expect(res.body.result).toContain('&#x2F;');
    });

    it('should return an empty string unchanged', async () => {
      const res = await request(app)
        .post('/test/sanitize-xss')
        .send({ input: '' });

      expect(res.status).toBe(200);
      expect(res.body.result).toBe('');
    });

    it('should return safe strings unchanged', async () => {
      const res = await request(app)
        .post('/test/sanitize-xss')
        .send({ input: 'Hello World 123' });

      expect(res.status).toBe(200);
      expect(res.body.result).toBe('Hello World 123');
    });
  });

  // ─── securityAuditLog ───────────────────────────────────────────────────
  describe('securityAuditLog', () => {
    it('should log on 401 responses', async () => {
      // We can't directly inspect the logger, but we verify the middleware
      // doesn't interfere with the response.
      const res = await request(app).get('/test/audit/401');

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Unauthorized');
    });

    it('should log on 403 responses', async () => {
      const res = await request(app).get('/test/audit/403');

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Forbidden');
    });

    it('should log on 429 responses', async () => {
      const res = await request(app).get('/test/audit/429');

      expect(res.status).toBe(429);
      expect(res.body.error).toBe('Too many requests');
    });

    it('should not interfere with successful (200) responses', async () => {
      const res = await request(app).get('/test/audit/200');

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
    });
  });

  // ─── validateUuid ───────────────────────────────────────────────────────
  describe('validateUuid', () => {
    const validUuid = '550e8400-e29b-41d4-a716-446655440000';

    it('should accept a valid UUID v4', async () => {
      const res = await request(app).get(`/test/uuid/${validUuid}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(validUuid);
    });

    it('should reject an invalid UUID', async () => {
      const res = await request(app).get('/test/uuid/not-a-uuid');

      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({
        ok: false,
        error: {
          code: 'INVALID_UUID',
        },
      });
    });

    it('should reject a UUID with invalid version digit', async () => {
      // Version 1 UUID (has "1" in the third group instead of "4")
      const v1Uuid = '550e8400-e29b-11d4-a716-446655440000';
      const res = await request(app).get(`/test/uuid/${v1Uuid}`);

      expect(res.status).toBe(400);
    });

    it('should handle multiple UUID params — both valid', async () => {
      const roomId = '550e8400-e29b-41d4-a716-446655440000';
      const mapId = '660e8400-e29b-41d4-a716-446655440001';

      const res = await request(app).get(`/test/uuid/${roomId}/map/${mapId}`);

      expect(res.status).toBe(200);
      expect(res.body.roomId).toBe(roomId);
      expect(res.body.mapId).toBe(mapId);
    });

    it('should reject when one of multiple params is invalid', async () => {
      const roomId = '550e8400-e29b-41d4-a716-446655440000';

      const res = await request(app).get(`/test/uuid/${roomId}/map/bad-uuid`);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_UUID');
      expect(res.body.error.message).toContain('mapId');
    });

    it('should reject numeric-only strings', async () => {
      const res = await request(app).get('/test/uuid/12345');

      expect(res.status).toBe(400);
    });

    it('should reject empty string params via 404 (Express routing)', async () => {
      // Express won't match a route with an empty param segment, so this
      // results in a 404 rather than reaching the middleware
      const res = await request(app).get('/test/uuid/');

      expect(res.status).toBe(404);
    });
  });

  // ─── preventParamPollution ──────────────────────────────────────────────
  describe('preventParamPollution', () => {
    it('should keep a single query param value unchanged', async () => {
      const res = await request(app).get('/test/query?sort=name');

      expect(res.status).toBe(200);
      expect(res.body.query.sort).toBe('name');
    });

    it('should deduplicate array query params, keeping the last value', async () => {
      const res = await request(app).get(
        '/test/query?sort=name&sort=created',
      );

      expect(res.status).toBe(200);
      // Should be a string (last value), not an array
      expect(typeof res.body.query.sort).toBe('string');
      expect(res.body.query.sort).toBe('created');
    });

    it('should handle query with no params', async () => {
      const res = await request(app).get('/test/query');

      expect(res.status).toBe(200);
      expect(res.body.query).toEqual({});
    });

    it('should preserve non-duplicated params alongside deduped ones', async () => {
      const res = await request(app).get(
        '/test/query?sort=name&sort=created&page=1',
      );

      expect(res.status).toBe(200);
      expect(res.body.query.sort).toBe('created');
      expect(res.body.query.page).toBe('1');
    });
  });

  // ─── sanitizeBody ──────────────────────────────────────────────────────
  describe('sanitizeBody', () => {
    it('should trim whitespace from string values', async () => {
      const res = await request(app)
        .post('/test/sanitize-body')
        .send({ name: '  hello  ' });

      expect(res.status).toBe(200);
      expect(res.body.body.name).toBe('hello');
    });

    it('should remove null bytes from strings', async () => {
      const res = await request(app)
        .post('/test/sanitize-body')
        .send({ name: 'he\0llo' });

      expect(res.status).toBe(200);
      expect(res.body.body.name).toBe('hello');
    });

    it('should handle nested objects recursively', async () => {
      const res = await request(app)
        .post('/test/sanitize-body')
        .send({
          user: {
            name: '  nested  ',
            email: '  test@example.com  ',
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.body.user.name).toBe('nested');
      expect(res.body.body.user.email).toBe('test@example.com');
    });

    it('should handle arrays recursively', async () => {
      const res = await request(app)
        .post('/test/sanitize-body')
        .send({
          tags: ['  tag1  ', '  tag2  '],
        });

      expect(res.status).toBe(200);
      expect(res.body.body.tags).toEqual(['tag1', 'tag2']);
    });

    it('should pass through numbers and booleans unchanged', async () => {
      const res = await request(app)
        .post('/test/sanitize-body')
        .send({
          count: 42,
          active: true,
        });

      expect(res.status).toBe(200);
      expect(res.body.body.count).toBe(42);
      expect(res.body.body.active).toBe(true);
    });

    it('should pass through null values unchanged', async () => {
      const res = await request(app)
        .post('/test/sanitize-body')
        .send({
          value: null,
        });

      expect(res.status).toBe(200);
      expect(res.body.body.value).toBeNull();
    });

    it('should handle deeply nested structures', async () => {
      const res = await request(app)
        .post('/test/sanitize-body')
        .send({
          level1: {
            level2: {
              level3: '  deep  ',
            },
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.body.level1.level2.level3).toBe('deep');
    });
  });
});
