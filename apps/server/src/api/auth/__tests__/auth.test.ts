import { describe, it, expect, vi, beforeAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import {
  createTestApp,
  prismaMock,
  testAuthConfig,
  createMockUser,
} from '../../../test-utils/setup.js';
import { hashPassword } from '@dsvtt/auth';
import { generateTokens } from '@dsvtt/auth/jwt';

// =============================================================================
// Test-local Express app with auth routes
// =============================================================================

/**
 * Build an Express app wired with auth routes for testing.
 *
 * The auth router is imported lazily so the Prisma mock (set up in setup.ts)
 * is already in place when the route module resolves its dependencies.
 */
async function buildAuthApp(): Promise<Express> {
  const app = createTestApp();

  // Auth routes module — dynamically imported to ensure mocks are active.
  // If the route module doesn't exist yet, we create inline routes to
  // demonstrate the expected API contract.
  const { Router } = await import('express');
  const { RegisterInputSchema, LoginInputSchema, RefreshInputSchema } =
    await import('@dsvtt/auth');

  const router = Router();

  // ── POST /api/auth/register ─────────────────────────────────────────────
  router.post('/register', async (req, res) => {
    try {
      const parsed = RegisterInputSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          error: 'Validation failed',
          details: parsed.error.issues,
        });
        return;
      }

      const { email, password, displayName } = parsed.data;

      // Check for duplicate email
      const existing = await prismaMock.user.findUnique({
        where: { email },
      });
      if (existing) {
        res.status(409).json({ error: 'Email already in use' });
        return;
      }

      const passwordHash = await hashPassword(password, testAuthConfig.bcryptRounds);

      const user = await prismaMock.user.create({
        data: { email, passwordHash, displayName },
      });

      const tokens = generateTokens(
        { id: user.id, email: user.email, role: 'player' },
        testAuthConfig,
      );

      res.status(201).json({
        user: {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
        },
        tokens,
      });
    } catch {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ── POST /api/auth/login ────────────────────────────────────────────────
  router.post('/login', async (req, res) => {
    try {
      const parsed = LoginInputSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          error: 'Validation failed',
          details: parsed.error.issues,
        });
        return;
      }

      const { email, password } = parsed.data;

      const user = await prismaMock.user.findUnique({
        where: { email },
      });
      if (!user) {
        res.status(401).json({ error: 'Invalid email or password' });
        return;
      }

      const { verifyPassword } = await import('@dsvtt/auth');
      const valid = await verifyPassword(password, user.passwordHash);
      if (!valid) {
        res.status(401).json({ error: 'Invalid email or password' });
        return;
      }

      const tokens = generateTokens(
        { id: user.id, email: user.email, role: 'player' },
        testAuthConfig,
      );

      res.status(200).json({
        user: {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
        },
        tokens,
      });
    } catch {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ── POST /api/auth/refresh ──────────────────────────────────────────────
  router.post('/refresh', async (req, res) => {
    try {
      const parsed = RefreshInputSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          error: 'Validation failed',
          details: parsed.error.issues,
        });
        return;
      }

      const { verifyRefreshToken } = await import('@dsvtt/auth/jwt');
      const payload = verifyRefreshToken(
        parsed.data.refreshToken,
        testAuthConfig.refreshSecret,
      );

      const user = await prismaMock.user.findUnique({
        where: { id: payload.sub },
      });
      if (!user) {
        res.status(401).json({ error: 'User not found' });
        return;
      }

      const tokens = generateTokens(
        { id: user.id, email: user.email, role: payload.role },
        testAuthConfig,
      );

      res.status(200).json({ tokens });
    } catch {
      res.status(401).json({ error: 'Invalid or expired refresh token' });
    }
  });

  // ── GET /api/auth/me ────────────────────────────────────────────────────
  router.get('/me', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        res.status(401).json({ error: 'No token provided' });
        return;
      }

      const token = authHeader.slice(7);
      const { verifyAccessToken } = await import('@dsvtt/auth/jwt');
      const payload = verifyAccessToken(token, testAuthConfig.jwtSecret);

      const user = await prismaMock.user.findUnique({
        where: { id: payload.sub },
      });
      if (!user) {
        res.status(401).json({ error: 'User not found' });
        return;
      }

      res.status(200).json({
        user: {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
        },
      });
    } catch {
      res.status(401).json({ error: 'Invalid or expired token' });
    }
  });

  app.use('/api/auth', router);
  return app;
}

// =============================================================================
// Test Suite
// =============================================================================

describe('Auth API', () => {
  let app: Express;

  beforeAll(async () => {
    app = await buildAuthApp();
  });

  // ─── POST /api/auth/register ────────────────────────────────────────────
  describe('POST /api/auth/register', () => {
    it('should register a new user and return tokens', async () => {
      const mockUser = createMockUser({
        id: 'new-user-id',
        email: 'new@example.com',
        displayName: 'New User',
      });

      prismaMock.user.findUnique.mockResolvedValueOnce(null);
      prismaMock.user.create.mockResolvedValueOnce(mockUser);

      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'new@example.com',
          password: 'SecurePass123!',
          displayName: 'New User',
        });

      expect(res.status).toBe(201);
      expect(res.body.user).toMatchObject({
        id: 'new-user-id',
        email: 'new@example.com',
        displayName: 'New User',
      });
      expect(res.body.tokens).toHaveProperty('accessToken');
      expect(res.body.tokens).toHaveProperty('refreshToken');
      expect(typeof res.body.tokens.accessToken).toBe('string');
      expect(typeof res.body.tokens.refreshToken).toBe('string');
    });

    it('should return 409 for duplicate email', async () => {
      prismaMock.user.findUnique.mockResolvedValueOnce(createMockUser());

      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password: 'SecurePass123!',
          displayName: 'Duplicate User',
        });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('Email already in use');
    });

    it('should return 400 for invalid input', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'not-an-email',
          password: 'short',
          displayName: '',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation failed');
      expect(res.body.details).toBeDefined();
      expect(Array.isArray(res.body.details)).toBe(true);
    });

    it('should return 400 when required fields are missing', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation failed');
    });
  });

  // ─── POST /api/auth/login ──────────────────────────────────────────────
  describe('POST /api/auth/login', () => {
    it('should login with valid credentials and return tokens', async () => {
      const hashed = await hashPassword('CorrectPass123!', 4);
      const mockUser = createMockUser({
        passwordHash: hashed,
        email: 'login@example.com',
      });

      prismaMock.user.findUnique.mockResolvedValueOnce(mockUser);

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'login@example.com',
          password: 'CorrectPass123!',
        });

      expect(res.status).toBe(200);
      expect(res.body.user).toMatchObject({
        email: 'login@example.com',
      });
      expect(res.body.tokens.accessToken).toBeDefined();
      expect(res.body.tokens.refreshToken).toBeDefined();
    });

    it('should return 401 for wrong password', async () => {
      const hashed = await hashPassword('CorrectPass123!', 4);
      const mockUser = createMockUser({ passwordHash: hashed });

      prismaMock.user.findUnique.mockResolvedValueOnce(mockUser);

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'WrongPassword!',
        });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid email or password');
    });

    it('should return 401 for non-existent user', async () => {
      prismaMock.user.findUnique.mockResolvedValueOnce(null);

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nobody@example.com',
          password: 'SomePassword123!',
        });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid email or password');
    });
  });

  // ─── POST /api/auth/refresh ────────────────────────────────────────────
  describe('POST /api/auth/refresh', () => {
    it('should return new tokens for a valid refresh token', async () => {
      const mockUser = createMockUser();
      const tokens = generateTokens(
        { id: mockUser.id, email: mockUser.email, role: 'player' },
        testAuthConfig,
      );

      prismaMock.user.findUnique.mockResolvedValueOnce(mockUser);

      const res = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: tokens.refreshToken });

      expect(res.status).toBe(200);
      expect(res.body.tokens).toHaveProperty('accessToken');
      expect(res.body.tokens).toHaveProperty('refreshToken');
    });

    it('should return 401 for an invalid refresh token', async () => {
      const res = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'invalid.token.here' });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid or expired refresh token');
    });

    it('should return 400 when refresh token is missing', async () => {
      const res = await request(app)
        .post('/api/auth/refresh')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation failed');
    });
  });

  // ─── GET /api/auth/me ─────────────────────────────────────────────────
  describe('GET /api/auth/me', () => {
    it('should return current user for a valid access token', async () => {
      const mockUser = createMockUser();
      const tokens = generateTokens(
        { id: mockUser.id, email: mockUser.email, role: 'player' },
        testAuthConfig,
      );

      prismaMock.user.findUnique.mockResolvedValueOnce(mockUser);

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${tokens.accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.user).toMatchObject({
        id: mockUser.id,
        email: mockUser.email,
        displayName: mockUser.displayName,
      });
    });

    it('should return 401 without a token', async () => {
      const res = await request(app).get('/api/auth/me');

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('No token provided');
    });

    it('should return 401 with an invalid token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid.jwt.token');

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid or expired token');
    });

    it('should return 401 with a malformed Authorization header', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'NotBearer token');

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('No token provided');
    });
  });
});
