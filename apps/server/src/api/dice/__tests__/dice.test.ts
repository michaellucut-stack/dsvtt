import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import {
  createTestApp,
  prismaMock,
  testAuthConfig,
  createMockUser,
} from '../../../test-utils/setup.js';
import { generateTokens } from '@dsvtt/auth/jwt';
import { DICE_FORMULA_MAX_LENGTH } from '@dsvtt/shared';

// =============================================================================
// Helpers
// =============================================================================

/** Generate a valid JWT access token for testing. */
function createAccessToken(overrides: Record<string, unknown> = {}) {
  const user = createMockUser(overrides);
  const tokens = generateTokens(
    { id: user.id, email: user.email, role: user.role as 'player' | 'director' },
    testAuthConfig,
  );
  return { user, tokens };
}

/** Create a mock dice roll record. */
function createMockDiceRoll(overrides: Record<string, unknown> = {}) {
  return {
    id: 'roll-id-1',
    sessionId: 'session-id-1',
    playerId: 'test-user-id-1',
    playerName: 'Test User',
    formula: '2d6+3',
    results: [
      { sides: 6, result: 4, dropped: false, exploded: false },
      { sides: 6, result: 5, dropped: false, exploded: false },
    ],
    total: 12,
    isPrivate: false,
    timestamp: new Date('2025-06-01T00:00:00Z'),
    ...overrides,
  };
}

// =============================================================================
// App builder
// =============================================================================

async function buildDiceApp(): Promise<Express> {
  const app = createTestApp();
  const { Router } = await import('express');
  const { diceRollSchema } = await import('@dsvtt/events');
  const { evaluateDice } = await import('@dsvtt/dice-engine');
  const router = Router();

  // ── Auth middleware ──────────────────────────────────────────────────────
  async function authenticate(req: any, res: any, next: any) {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'No token provided' });
      return;
    }
    try {
      const token = authHeader.slice(7);
      const { verifyAccessToken } = await import('@dsvtt/auth/jwt');
      const payload = verifyAccessToken(token, testAuthConfig.jwtSecret);
      req.user = payload;
      next();
    } catch {
      res.status(401).json({ error: 'Invalid or expired token' });
    }
  }

  // ── POST /api/dice/roll ─────────────────────────────────────────────────
  router.post('/roll', authenticate, async (req: any, res: any) => {
    try {
      const parsed = diceRollSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          error: 'Validation failed',
          details: parsed.error.issues,
        });
        return;
      }

      const { formula, sessionId } = parsed.data;
      const isPrivate = req.body.isPrivate === true;

      let result;
      try {
        result = evaluateDice(formula);
      } catch (e: any) {
        res.status(400).json({ error: `Invalid dice formula: ${e.message}` });
        return;
      }

      const roll = {
        id: `roll-${Date.now()}`,
        sessionId,
        playerId: req.user.sub,
        playerName: req.user.email,
        formula: result.formula,
        results: result.rolls.map((r: any) => ({
          sides: r.sides,
          result: r.result,
          dropped: r.dropped,
          exploded: r.exploded,
        })),
        total: result.total,
        isPrivate,
        timestamp: new Date(),
      };

      // Store roll
      if (prismaMock.diceRoll) {
        await prismaMock.diceRoll.create({ data: roll });
      }

      res.status(200).json({ roll });
    } catch {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ── GET /api/dice/history ───────────────────────────────────────────────
  router.get('/history', authenticate, async (req: any, res: any) => {
    try {
      const sessionId = req.query.sessionId as string;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      if (!sessionId) {
        res.status(400).json({ error: 'sessionId is required' });
        return;
      }

      const rolls = prismaMock.diceRoll
        ? await prismaMock.diceRoll.findMany({
            where: { sessionId },
            skip: (page - 1) * limit,
            take: limit,
            orderBy: { timestamp: 'desc' },
          })
        : [];

      res.status(200).json({ rolls, page, limit });
    } catch {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.use('/api/dice', router);
  return app;
}

// =============================================================================
// Mock for diceRoll model
// =============================================================================

// Add diceRoll mock to prismaMock
(prismaMock as any).diceRoll = {
  findMany: vi.fn(),
  create: vi.fn(),
  count: vi.fn(),
};

// =============================================================================
// Test Suite
// =============================================================================

describe('Dice API', () => {
  let app: Express;

  beforeAll(async () => {
    app = await buildDiceApp();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── POST /api/dice/roll ──────────────────────────────────────────────────

  describe('POST /api/dice/roll', () => {
    it('should roll a valid formula and return result', async () => {
      const { tokens } = createAccessToken();
      (prismaMock as any).diceRoll.create.mockResolvedValueOnce({});

      const res = await request(app)
        .post('/api/dice/roll')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({
          sessionId: '550e8400-e29b-41d4-a716-446655440000',
          formula: '2d6+3',
        });

      expect(res.status).toBe(200);
      expect(res.body.roll).toBeDefined();
      expect(res.body.roll.formula).toBe('2d6+3');
      expect(typeof res.body.roll.total).toBe('number');
      expect(res.body.roll.total).toBeGreaterThanOrEqual(5); // 2+3
      expect(res.body.roll.total).toBeLessThanOrEqual(15); // 12+3
      expect(Array.isArray(res.body.roll.results)).toBe(true);
      expect(res.body.roll.results).toHaveLength(2);
    });

    it('should return 400 for invalid formula', async () => {
      const { tokens } = createAccessToken();

      const res = await request(app)
        .post('/api/dice/roll')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({
          sessionId: '550e8400-e29b-41d4-a716-446655440000',
          formula: 'abc',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Invalid dice formula');
    });

    it('should return 400 for empty formula', async () => {
      const { tokens } = createAccessToken();

      const res = await request(app)
        .post('/api/dice/roll')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({
          sessionId: '550e8400-e29b-41d4-a716-446655440000',
          formula: '',
        });

      expect(res.status).toBe(400);
    });

    it('should return 400 for formula exceeding max length', async () => {
      const { tokens } = createAccessToken();
      const longFormula = '1d6+'.repeat(30) + '1d6'; // Very long formula

      const res = await request(app)
        .post('/api/dice/roll')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({
          sessionId: '550e8400-e29b-41d4-a716-446655440000',
          formula: longFormula,
        });

      expect(res.status).toBe(400);
    });

    it('should support private rolls', async () => {
      const { tokens } = createAccessToken();
      (prismaMock as any).diceRoll.create.mockResolvedValueOnce({});

      const res = await request(app)
        .post('/api/dice/roll')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({
          sessionId: '550e8400-e29b-41d4-a716-446655440000',
          formula: '1d20',
          isPrivate: true,
        });

      expect(res.status).toBe(200);
      expect(res.body.roll.isPrivate).toBe(true);
    });

    it('should return 400 when sessionId is missing', async () => {
      const { tokens } = createAccessToken();

      const res = await request(app)
        .post('/api/dice/roll')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({
          formula: '1d20',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation failed');
    });

    it('should return 401 without authentication', async () => {
      const res = await request(app)
        .post('/api/dice/roll')
        .send({
          sessionId: '550e8400-e29b-41d4-a716-446655440000',
          formula: '1d20',
        });

      expect(res.status).toBe(401);
    });

    it('should handle complex formulas like "4d6kh3"', async () => {
      const { tokens } = createAccessToken();
      (prismaMock as any).diceRoll.create.mockResolvedValueOnce({});

      const res = await request(app)
        .post('/api/dice/roll')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({
          sessionId: '550e8400-e29b-41d4-a716-446655440000',
          formula: '4d6kh3',
        });

      expect(res.status).toBe(200);
      expect(res.body.roll.results).toHaveLength(4);
      expect(res.body.roll.total).toBeGreaterThanOrEqual(3);
      expect(res.body.roll.total).toBeLessThanOrEqual(18);
    });

    it('should handle exploding dice "2d6!"', async () => {
      const { tokens } = createAccessToken();
      (prismaMock as any).diceRoll.create.mockResolvedValueOnce({});

      const res = await request(app)
        .post('/api/dice/roll')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({
          sessionId: '550e8400-e29b-41d4-a716-446655440000',
          formula: '2d6!',
        });

      expect(res.status).toBe(200);
      expect(res.body.roll.results.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ─── GET /api/dice/history ────────────────────────────────────────────────

  describe('GET /api/dice/history', () => {
    it('should return dice roll history for a session', async () => {
      const { tokens } = createAccessToken();
      const mockRolls = [
        createMockDiceRoll({ id: 'roll-1', formula: '1d20+5', total: 15 }),
        createMockDiceRoll({ id: 'roll-2', formula: '2d6+3', total: 12 }),
      ];

      (prismaMock as any).diceRoll.findMany.mockResolvedValueOnce(mockRolls);

      const res = await request(app)
        .get('/api/dice/history')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .query({ sessionId: 'session-id-1' });

      expect(res.status).toBe(200);
      expect(res.body.rolls).toHaveLength(2);
      expect(res.body.page).toBe(1);
      expect(res.body.limit).toBe(20);
    });

    it('should support pagination', async () => {
      const { tokens } = createAccessToken();
      (prismaMock as any).diceRoll.findMany.mockResolvedValueOnce([]);

      const res = await request(app)
        .get('/api/dice/history')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .query({ sessionId: 'session-id-1', page: '2', limit: '5' });

      expect(res.status).toBe(200);
      expect(res.body.page).toBe(2);
      expect(res.body.limit).toBe(5);
      expect((prismaMock as any).diceRoll.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 5,
          take: 5,
        }),
      );
    });

    it('should return empty array when no rolls exist', async () => {
      const { tokens } = createAccessToken();
      (prismaMock as any).diceRoll.findMany.mockResolvedValueOnce([]);

      const res = await request(app)
        .get('/api/dice/history')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .query({ sessionId: 'session-id-1' });

      expect(res.status).toBe(200);
      expect(res.body.rolls).toEqual([]);
    });

    it('should return 400 when sessionId is missing', async () => {
      const { tokens } = createAccessToken();

      const res = await request(app)
        .get('/api/dice/history')
        .set('Authorization', `Bearer ${tokens.accessToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('sessionId is required');
    });

    it('should return 401 without authentication', async () => {
      const res = await request(app)
        .get('/api/dice/history')
        .query({ sessionId: 'session-id-1' });

      expect(res.status).toBe(401);
    });
  });
});
