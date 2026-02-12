import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createTestApp } from '../../test-utils/setup.js';

// =============================================================================
// App Builder
// =============================================================================

/**
 * Builds a test Express app with routes that throw various error types,
 * plus the global error handler.
 */
async function buildErrorHandlerApp(): Promise<Express> {
  const app = createTestApp();
  const { Router } = await import('express');
  const { AppError, notFound, errorHandler } = await import(
    '../error-handler.js'
  );

  const router = Router();

  // ── Route that throws an AppError (operational) ───────────────────────
  router.get('/app-error', (_req, _res, next) => {
    next(new AppError('Forbidden resource', 403, 'FORBIDDEN'));
  });

  // ── Route that throws a 400 AppError ──────────────────────────────────
  router.get('/bad-request', (_req, _res, next) => {
    next(new AppError('Invalid input', 400, 'BAD_REQUEST'));
  });

  // ── Route that throws a 500 operational AppError ──────────────────────
  router.get('/server-error', (_req, _res, next) => {
    next(
      new AppError('Something went wrong', 500, 'INTERNAL_ERROR', true),
    );
  });

  // ── Route that throws a non-operational AppError ──────────────────────
  router.get('/non-operational', (_req, _res, next) => {
    next(
      new AppError('Bug detected', 500, 'BUG', false),
    );
  });

  // ── Route that throws a generic (unexpected) Error ────────────────────
  router.get('/unexpected', (_req, _res, next) => {
    next(new Error('Unexpected database failure'));
  });

  // ── Route that throws a TypeError ─────────────────────────────────────
  router.get('/type-error', (_req, _res, next) => {
    next(new TypeError('Cannot read properties of undefined'));
  });

  app.use('/test', router);

  // Mount notFound AFTER routes so unmatched paths hit it
  app.use(notFound);

  // Global error handler — must be last
  app.use(errorHandler);

  return app;
}

// =============================================================================
// Test Suite
// =============================================================================

describe('Error Handler Middleware', () => {
  let app: Express;

  beforeAll(async () => {
    app = await buildErrorHandlerApp();
  });

  // ─── AppError class ─────────────────────────────────────────────────────
  describe('AppError', () => {
    it('should set statusCode, code, and isOperational', async () => {
      const { AppError } = await import('../error-handler.js');

      const err = new AppError('Test error', 422, 'UNPROCESSABLE');

      expect(err.message).toBe('Test error');
      expect(err.statusCode).toBe(422);
      expect(err.code).toBe('UNPROCESSABLE');
      expect(err.isOperational).toBe(true);
      expect(err.name).toBe('AppError');
      expect(err).toBeInstanceOf(Error);
      expect(err).toBeInstanceOf(AppError);
    });

    it('should default isOperational to true', async () => {
      const { AppError } = await import('../error-handler.js');

      const err = new AppError('Op error', 400, 'BAD');

      expect(err.isOperational).toBe(true);
    });

    it('should allow isOperational to be set to false', async () => {
      const { AppError } = await import('../error-handler.js');

      const err = new AppError('Bug', 500, 'BUG', false);

      expect(err.isOperational).toBe(false);
    });

    it('should maintain proper prototype chain', async () => {
      const { AppError } = await import('../error-handler.js');

      const err = new AppError('Test', 400, 'TEST');

      expect(err instanceof AppError).toBe(true);
      expect(err instanceof Error).toBe(true);
      expect(err.stack).toBeDefined();
    });
  });

  // ─── notFound middleware ────────────────────────────────────────────────
  describe('notFound', () => {
    it('should create a 404 AppError for unmatched routes', async () => {
      const res = await request(app).get('/nonexistent-route');

      expect(res.status).toBe(404);
      expect(res.body.ok).toBe(false);
      expect(res.body.error.code).toBe('NOT_FOUND');
      expect(res.body.error.message).toBe('Resource not found');
    });

    it('should return JSON for POST to unknown route', async () => {
      const res = await request(app).post('/does-not-exist').send({});

      expect(res.status).toBe(404);
      expect(res.body.ok).toBe(false);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });

  // ─── errorHandler ──────────────────────────────────────────────────────
  describe('errorHandler', () => {
    it('should return structured JSON for operational AppError', async () => {
      const res = await request(app).get('/test/app-error');

      expect(res.status).toBe(403);
      expect(res.body).toEqual({
        ok: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Forbidden resource',
        },
      });
    });

    it('should return the correct status code from AppError', async () => {
      const res = await request(app).get('/test/bad-request');

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('BAD_REQUEST');
      expect(res.body.error.message).toBe('Invalid input');
    });

    it('should return 500 for operational 500 AppError', async () => {
      const res = await request(app).get('/test/server-error');

      expect(res.status).toBe(500);
      expect(res.body.error.code).toBe('INTERNAL_ERROR');
      expect(res.body.error.message).toBe('Something went wrong');
    });

    it('should mask non-operational errors as 500 Internal Server Error', async () => {
      const res = await request(app).get('/test/unexpected');

      expect(res.status).toBe(500);
      expect(res.body.ok).toBe(false);
      expect(res.body.error.code).toBe('INTERNAL_SERVER_ERROR');
      expect(res.body.error.message).toBe('An unexpected error occurred');
    });

    it('should not leak the original error message for unexpected errors', async () => {
      const res = await request(app).get('/test/unexpected');

      expect(res.status).toBe(500);
      // The actual error message "Unexpected database failure" should not
      // appear as the top-level message
      expect(res.body.error.message).not.toBe('Unexpected database failure');
    });

    it('should handle TypeError as an unexpected error', async () => {
      const res = await request(app).get('/test/type-error');

      expect(res.status).toBe(500);
      expect(res.body.error.code).toBe('INTERNAL_SERVER_ERROR');
    });

    it('should not leak stack traces in the error.message field', async () => {
      const res = await request(app).get('/test/unexpected');

      // In test environment (non-production), detail/stack may be present
      // but message itself should be generic
      expect(res.body.error.message).toBe('An unexpected error occurred');
      // The top-level message should never contain a stack trace
      expect(res.body.error.message).not.toContain('at ');
    });

    it('should include consistent ok:false in the envelope', async () => {
      const responses = await Promise.all([
        request(app).get('/test/app-error'),
        request(app).get('/test/bad-request'),
        request(app).get('/test/unexpected'),
        request(app).get('/nonexistent-route'),
      ]);

      for (const res of responses) {
        expect(res.body.ok).toBe(false);
        expect(res.body.error).toBeDefined();
        expect(res.body.error.code).toBeDefined();
        expect(res.body.error.message).toBeDefined();
      }
    });
  });
});
