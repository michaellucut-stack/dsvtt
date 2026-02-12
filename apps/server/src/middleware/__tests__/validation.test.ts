import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createTestApp } from '../../test-utils/setup.js';

// =============================================================================
// App Builder
// =============================================================================

/**
 * Builds a test Express app with routes that exercise the validate,
 * validateParams, and validateQuery middleware factories.
 */
async function buildValidationApp(): Promise<Express> {
  const app = createTestApp();
  const { Router } = await import('express');
  const { z } = await import('zod');
  const { validate, validateParams, validateQuery } = await import(
    '../validation.js'
  );

  const router = Router();

  // ── Body validation schemas ───────────────────────────────────────────
  const createUserSchema = z.object({
    email: z.string().email(),
    name: z.string().min(1).max(64),
    age: z.number().int().positive().optional(),
  });

  router.post('/users', validate(createUserSchema), (req, res) => {
    res.status(201).json({ ok: true, data: req.body });
  });

  // ── Params validation schema ──────────────────────────────────────────
  const paramsSchema = z.object({
    id: z.string().uuid(),
  });

  router.get('/users/:id', validateParams(paramsSchema), (req, res) => {
    res.json({ ok: true, data: { id: req.params.id } });
  });

  // ── Query validation schema ───────────────────────────────────────────
  const querySchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    sort: z.enum(['name', 'created', 'updated']).default('created'),
  });

  router.get('/items', validateQuery(querySchema), (req, res) => {
    res.json({ ok: true, query: req.query });
  });

  app.use('/test', router);
  return app;
}

// =============================================================================
// Test Suite
// =============================================================================

describe('Validation Middleware', () => {
  let app: Express;

  beforeAll(async () => {
    app = await buildValidationApp();
  });

  // ─── validate(schema) — body validation ─────────────────────────────────
  describe('validate(schema)', () => {
    it('should pass valid body and return parsed data', async () => {
      const res = await request(app)
        .post('/test/users')
        .send({ email: 'alice@example.com', name: 'Alice', age: 30 });

      expect(res.status).toBe(201);
      expect(res.body.ok).toBe(true);
      expect(res.body.data).toMatchObject({
        email: 'alice@example.com',
        name: 'Alice',
        age: 30,
      });
    });

    it('should pass valid body with optional fields omitted', async () => {
      const res = await request(app)
        .post('/test/users')
        .send({ email: 'bob@example.com', name: 'Bob' });

      expect(res.status).toBe(201);
      expect(res.body.data.email).toBe('bob@example.com');
      expect(res.body.data.name).toBe('Bob');
    });

    it('should reject invalid body with 400', async () => {
      const res = await request(app)
        .post('/test/users')
        .send({ email: 'not-an-email', name: '' });

      expect(res.status).toBe(400);
      expect(res.body.ok).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.message).toBe('Request body validation failed');
      expect(res.body.error.details).toBeDefined();
      expect(Array.isArray(res.body.error.details)).toBe(true);
    });

    it('should return error details with path and message', async () => {
      const res = await request(app)
        .post('/test/users')
        .send({ email: 'invalid', name: 'Valid Name' });

      expect(res.status).toBe(400);
      const detail = res.body.error.details.find(
        (d: { path: string }) => d.path === 'email',
      );
      expect(detail).toBeDefined();
      expect(detail.message).toBeDefined();
      expect(typeof detail.message).toBe('string');
    });

    it('should reject missing required fields', async () => {
      const res = await request(app)
        .post('/test/users')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.details.length).toBeGreaterThanOrEqual(2);
    });

    it('should reject wrong types', async () => {
      const res = await request(app)
        .post('/test/users')
        .send({ email: 'alice@example.com', name: 'Alice', age: 'not-a-number' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should strip unknown fields from parsed body', async () => {
      const res = await request(app)
        .post('/test/users')
        .send({
          email: 'alice@example.com',
          name: 'Alice',
          unknownField: 'should be stripped',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.unknownField).toBeUndefined();
    });
  });

  // ─── validateParams(schema) ─────────────────────────────────────────────
  describe('validateParams(schema)', () => {
    it('should pass valid UUID params', async () => {
      const validUuid = '550e8400-e29b-41d4-a716-446655440000';

      const res = await request(app).get(`/test/users/${validUuid}`);

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.data.id).toBe(validUuid);
    });

    it('should reject invalid params with 400', async () => {
      const res = await request(app).get('/test/users/not-a-uuid');

      expect(res.status).toBe(400);
      expect(res.body.ok).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.message).toBe('URL parameter validation failed');
    });

    it('should include path details in param validation errors', async () => {
      const res = await request(app).get('/test/users/123');

      expect(res.status).toBe(400);
      expect(res.body.error.details).toBeDefined();
      const detail = res.body.error.details.find(
        (d: { path: string }) => d.path === 'id',
      );
      expect(detail).toBeDefined();
    });
  });

  // ─── validateQuery(schema) ──────────────────────────────────────────────
  describe('validateQuery(schema)', () => {
    it('should pass valid query params with defaults', async () => {
      const res = await request(app).get('/test/items');

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      // Should have defaults applied
      expect(res.body.query.page).toBe(1);
      expect(res.body.query.limit).toBe(20);
      expect(res.body.query.sort).toBe('created');
    });

    it('should pass valid query params with custom values', async () => {
      const res = await request(app).get(
        '/test/items?page=3&limit=50&sort=name',
      );

      expect(res.status).toBe(200);
      expect(res.body.query.page).toBe(3);
      expect(res.body.query.limit).toBe(50);
      expect(res.body.query.sort).toBe('name');
    });

    it('should reject invalid query with 400', async () => {
      const res = await request(app).get('/test/items?page=-1');

      expect(res.status).toBe(400);
      expect(res.body.ok).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.message).toBe('Query parameter validation failed');
    });

    it('should reject invalid sort enum value', async () => {
      const res = await request(app).get('/test/items?sort=invalid');

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject limit above maximum', async () => {
      const res = await request(app).get('/test/items?limit=200');

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should coerce string numbers to numbers', async () => {
      const res = await request(app).get('/test/items?page=2&limit=10');

      expect(res.status).toBe(200);
      expect(typeof res.body.query.page).toBe('number');
      expect(typeof res.body.query.limit).toBe('number');
    });
  });
});
