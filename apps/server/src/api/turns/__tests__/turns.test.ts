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

/** Create a mock turn/initiative state. */
function createMockTurnState(overrides: Record<string, unknown> = {}) {
  return {
    sessionId: 'session-id-1',
    order: [
      { userId: 'player-1', initiative: 18 },
      { userId: 'player-2', initiative: 14 },
      { userId: 'player-3', initiative: 7 },
    ],
    currentIndex: 0,
    roundNumber: 1,
    ...overrides,
  };
}

// =============================================================================
// In-memory turn state store (simulates server-side state)
// =============================================================================

const turnStates = new Map<string, ReturnType<typeof createMockTurnState>>();

// =============================================================================
// App builder
// =============================================================================

async function buildTurnsApp(): Promise<Express> {
  const app = createTestApp();
  const { Router } = await import('express');
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

  // ── Role-check middleware ───────────────────────────────────────────────
  function requireDirector(req: any, res: any, next: any) {
    if (req.user.role !== 'director') {
      res.status(403).json({ error: 'Only the director can perform this action' });
      return;
    }
    next();
  }

  // ── POST /api/turns/set-order ───────────────────────────────────────────
  router.post('/set-order', authenticate, requireDirector, async (req: any, res: any) => {
    try {
      const { sessionId, order } = req.body;

      if (!sessionId || !Array.isArray(order) || order.length === 0) {
        res.status(400).json({ error: 'sessionId and non-empty order array are required' });
        return;
      }

      // Validate each entry
      for (const entry of order) {
        if (!entry.userId || typeof entry.initiative !== 'number') {
          res.status(400).json({ error: 'Each order entry must have userId and initiative' });
          return;
        }
      }

      // Sort by initiative descending
      const sorted = [...order].sort(
        (a: any, b: any) => b.initiative - a.initiative,
      );

      const state = {
        sessionId,
        order: sorted,
        currentIndex: 0,
        roundNumber: 1,
      };

      turnStates.set(sessionId, state);

      res.status(200).json({
        turnState: state,
        currentPlayerId: sorted[0].userId,
      });
    } catch {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ── POST /api/turns/next-turn ───────────────────────────────────────────
  router.post('/next-turn', authenticate, async (req: any, res: any) => {
    try {
      const { sessionId } = req.body;

      if (!sessionId) {
        res.status(400).json({ error: 'sessionId is required' });
        return;
      }

      const state = turnStates.get(sessionId);
      if (!state) {
        res.status(404).json({ error: 'No turn order set for this session' });
        return;
      }

      if (state.order.length === 0) {
        res.status(400).json({ error: 'Turn order is empty' });
        return;
      }

      // Advance to next turn
      state.currentIndex += 1;

      // Wrap around to new round
      if (state.currentIndex >= state.order.length) {
        state.currentIndex = 0;
        state.roundNumber += 1;
      }

      const currentPlayer = state.order[state.currentIndex]!;

      res.status(200).json({
        currentPlayerId: currentPlayer.userId,
        roundNumber: state.roundNumber,
        currentIndex: state.currentIndex,
      });
    } catch {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ── POST /api/turns/skip-turn ───────────────────────────────────────────
  router.post('/skip-turn', authenticate, async (req: any, res: any) => {
    try {
      const { sessionId } = req.body;

      if (!sessionId) {
        res.status(400).json({ error: 'sessionId is required' });
        return;
      }

      const state = turnStates.get(sessionId);
      if (!state) {
        res.status(404).json({ error: 'No turn order set for this session' });
        return;
      }

      if (state.order.length === 0) {
        res.status(400).json({ error: 'Turn order is empty' });
        return;
      }

      const skippedPlayerId = state.order[state.currentIndex]!.userId;

      // Skip = advance without doing anything for the current player
      state.currentIndex += 1;
      if (state.currentIndex >= state.order.length) {
        state.currentIndex = 0;
        state.roundNumber += 1;
      }

      const nextPlayer = state.order[state.currentIndex]!;

      res.status(200).json({
        skippedPlayerId,
        currentPlayerId: nextPlayer.userId,
        roundNumber: state.roundNumber,
        currentIndex: state.currentIndex,
      });
    } catch {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ── GET /api/turns ──────────────────────────────────────────────────────
  router.get('/', authenticate, async (req: any, res: any) => {
    try {
      const sessionId = req.query.sessionId as string;

      if (!sessionId) {
        res.status(400).json({ error: 'sessionId is required' });
        return;
      }

      const state = turnStates.get(sessionId);
      if (!state) {
        res.status(404).json({ error: 'No turn order set for this session' });
        return;
      }

      const currentPlayer = state.order[state.currentIndex];

      res.status(200).json({
        turnState: state,
        currentPlayerId: currentPlayer?.userId ?? null,
      });
    } catch {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.use('/api/turns', router);
  return app;
}

// =============================================================================
// Test Suite
// =============================================================================

describe('Turns API', () => {
  let app: Express;

  beforeAll(async () => {
    app = await buildTurnsApp();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    turnStates.clear();
  });

  // ─── POST /api/turns/set-order ────────────────────────────────────────────

  describe('POST /api/turns/set-order', () => {
    it('should allow director to set initiative order', async () => {
      const { tokens } = createAccessToken({ id: 'director-1', role: 'director' });

      const res = await request(app)
        .post('/api/turns/set-order')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({
          sessionId: 'session-1',
          order: [
            { userId: 'player-1', initiative: 14 },
            { userId: 'player-2', initiative: 18 },
            { userId: 'player-3', initiative: 7 },
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body.turnState).toBeDefined();
      // Should be sorted by initiative descending
      expect(res.body.turnState.order[0].userId).toBe('player-2');
      expect(res.body.turnState.order[0].initiative).toBe(18);
      expect(res.body.turnState.order[1].userId).toBe('player-1');
      expect(res.body.turnState.order[2].userId).toBe('player-3');
      expect(res.body.turnState.roundNumber).toBe(1);
      expect(res.body.currentPlayerId).toBe('player-2');
    });

    it('should forbid a player from setting initiative', async () => {
      const { tokens } = createAccessToken({ id: 'player-1', role: 'player' });

      const res = await request(app)
        .post('/api/turns/set-order')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({
          sessionId: 'session-1',
          order: [
            { userId: 'player-1', initiative: 10 },
          ],
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Only the director can perform this action');
    });

    it('should return 400 when order is empty', async () => {
      const { tokens } = createAccessToken({ id: 'director-1', role: 'director' });

      const res = await request(app)
        .post('/api/turns/set-order')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({
          sessionId: 'session-1',
          order: [],
        });

      expect(res.status).toBe(400);
    });

    it('should return 400 when sessionId is missing', async () => {
      const { tokens } = createAccessToken({ id: 'director-1', role: 'director' });

      const res = await request(app)
        .post('/api/turns/set-order')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({
          order: [{ userId: 'player-1', initiative: 10 }],
        });

      expect(res.status).toBe(400);
    });

    it('should return 400 when order entries are invalid', async () => {
      const { tokens } = createAccessToken({ id: 'director-1', role: 'director' });

      const res = await request(app)
        .post('/api/turns/set-order')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({
          sessionId: 'session-1',
          order: [{ userId: 'player-1' }], // missing initiative
        });

      expect(res.status).toBe(400);
    });

    it('should return 401 without authentication', async () => {
      const res = await request(app)
        .post('/api/turns/set-order')
        .send({
          sessionId: 'session-1',
          order: [{ userId: 'player-1', initiative: 10 }],
        });

      expect(res.status).toBe(401);
    });
  });

  // ─── POST /api/turns/next-turn ────────────────────────────────────────────

  describe('POST /api/turns/next-turn', () => {
    it('should advance to the next player in order', async () => {
      const { tokens: directorTokens } = createAccessToken({
        id: 'director-1',
        role: 'director',
      });
      const { tokens: playerTokens } = createAccessToken({
        id: 'player-1',
        role: 'player',
      });

      // Set up turn order first
      await request(app)
        .post('/api/turns/set-order')
        .set('Authorization', `Bearer ${directorTokens.accessToken}`)
        .send({
          sessionId: 'session-advance',
          order: [
            { userId: 'player-a', initiative: 20 },
            { userId: 'player-b', initiative: 15 },
            { userId: 'player-c', initiative: 10 },
          ],
        });

      // Advance turn
      const res = await request(app)
        .post('/api/turns/next-turn')
        .set('Authorization', `Bearer ${playerTokens.accessToken}`)
        .send({ sessionId: 'session-advance' });

      expect(res.status).toBe(200);
      expect(res.body.currentPlayerId).toBe('player-b');
      expect(res.body.roundNumber).toBe(1);
    });

    it('should wrap around to round+1 when reaching the end', async () => {
      const { tokens: directorTokens } = createAccessToken({
        id: 'director-1',
        role: 'director',
      });
      const { tokens } = createAccessToken({ id: 'any-user', role: 'player' });

      // Set up order with 2 players
      await request(app)
        .post('/api/turns/set-order')
        .set('Authorization', `Bearer ${directorTokens.accessToken}`)
        .send({
          sessionId: 'session-wrap',
          order: [
            { userId: 'player-a', initiative: 20 },
            { userId: 'player-b', initiative: 10 },
          ],
        });

      // Advance once (player-a -> player-b)
      await request(app)
        .post('/api/turns/next-turn')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({ sessionId: 'session-wrap' });

      // Advance again (player-b -> wrap to player-a, round 2)
      const res = await request(app)
        .post('/api/turns/next-turn')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({ sessionId: 'session-wrap' });

      expect(res.status).toBe(200);
      expect(res.body.currentPlayerId).toBe('player-a');
      expect(res.body.roundNumber).toBe(2);
    });

    it('should return 404 when no turn order exists', async () => {
      const { tokens } = createAccessToken();

      const res = await request(app)
        .post('/api/turns/next-turn')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({ sessionId: 'nonexistent-session' });

      expect(res.status).toBe(404);
    });

    it('should return 400 when sessionId is missing', async () => {
      const { tokens } = createAccessToken();

      const res = await request(app)
        .post('/api/turns/next-turn')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({});

      expect(res.status).toBe(400);
    });
  });

  // ─── POST /api/turns/skip-turn ────────────────────────────────────────────

  describe('POST /api/turns/skip-turn', () => {
    it('should skip the current player and advance', async () => {
      const { tokens: directorTokens } = createAccessToken({
        id: 'director-1',
        role: 'director',
      });
      const { tokens } = createAccessToken({ id: 'any-user', role: 'player' });

      // Set up order
      await request(app)
        .post('/api/turns/set-order')
        .set('Authorization', `Bearer ${directorTokens.accessToken}`)
        .send({
          sessionId: 'session-skip',
          order: [
            { userId: 'player-a', initiative: 20 },
            { userId: 'player-b', initiative: 15 },
            { userId: 'player-c', initiative: 10 },
          ],
        });

      // Skip current turn (player-a)
      const res = await request(app)
        .post('/api/turns/skip-turn')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({ sessionId: 'session-skip' });

      expect(res.status).toBe(200);
      expect(res.body.skippedPlayerId).toBe('player-a');
      expect(res.body.currentPlayerId).toBe('player-b');
    });

    it('should wrap around when skipping last player', async () => {
      const { tokens: directorTokens } = createAccessToken({
        id: 'director-1',
        role: 'director',
      });
      const { tokens } = createAccessToken({ id: 'any-user', role: 'player' });

      // Set up order with 2 players
      await request(app)
        .post('/api/turns/set-order')
        .set('Authorization', `Bearer ${directorTokens.accessToken}`)
        .send({
          sessionId: 'session-skip-wrap',
          order: [
            { userId: 'player-a', initiative: 20 },
            { userId: 'player-b', initiative: 10 },
          ],
        });

      // Advance to player-b
      await request(app)
        .post('/api/turns/next-turn')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({ sessionId: 'session-skip-wrap' });

      // Skip player-b -> wraps to player-a, round 2
      const res = await request(app)
        .post('/api/turns/skip-turn')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({ sessionId: 'session-skip-wrap' });

      expect(res.status).toBe(200);
      expect(res.body.skippedPlayerId).toBe('player-b');
      expect(res.body.currentPlayerId).toBe('player-a');
      expect(res.body.roundNumber).toBe(2);
    });

    it('should return 404 when no turn order exists', async () => {
      const { tokens } = createAccessToken();

      const res = await request(app)
        .post('/api/turns/skip-turn')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({ sessionId: 'nonexistent-session' });

      expect(res.status).toBe(404);
    });
  });

  // ─── GET /api/turns ───────────────────────────────────────────────────────

  describe('GET /api/turns', () => {
    it('should return the current turn state', async () => {
      const { tokens: directorTokens } = createAccessToken({
        id: 'director-1',
        role: 'director',
      });
      const { tokens } = createAccessToken({ id: 'any-user', role: 'player' });

      // Set up order
      await request(app)
        .post('/api/turns/set-order')
        .set('Authorization', `Bearer ${directorTokens.accessToken}`)
        .send({
          sessionId: 'session-get',
          order: [
            { userId: 'player-a', initiative: 20 },
            { userId: 'player-b', initiative: 10 },
          ],
        });

      const res = await request(app)
        .get('/api/turns')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .query({ sessionId: 'session-get' });

      expect(res.status).toBe(200);
      expect(res.body.turnState).toBeDefined();
      expect(res.body.turnState.order).toHaveLength(2);
      expect(res.body.turnState.roundNumber).toBe(1);
      expect(res.body.currentPlayerId).toBe('player-a');
    });

    it('should reflect updated state after next-turn', async () => {
      const { tokens: directorTokens } = createAccessToken({
        id: 'director-1',
        role: 'director',
      });
      const { tokens } = createAccessToken({ id: 'any-user', role: 'player' });

      // Set up and advance
      await request(app)
        .post('/api/turns/set-order')
        .set('Authorization', `Bearer ${directorTokens.accessToken}`)
        .send({
          sessionId: 'session-get-advanced',
          order: [
            { userId: 'player-a', initiative: 20 },
            { userId: 'player-b', initiative: 10 },
          ],
        });

      await request(app)
        .post('/api/turns/next-turn')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({ sessionId: 'session-get-advanced' });

      const res = await request(app)
        .get('/api/turns')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .query({ sessionId: 'session-get-advanced' });

      expect(res.status).toBe(200);
      expect(res.body.currentPlayerId).toBe('player-b');
    });

    it('should return 404 when no turn order is set', async () => {
      const { tokens } = createAccessToken();

      const res = await request(app)
        .get('/api/turns')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .query({ sessionId: 'nonexistent-session' });

      expect(res.status).toBe(404);
    });

    it('should return 400 when sessionId is missing', async () => {
      const { tokens } = createAccessToken();

      const res = await request(app)
        .get('/api/turns')
        .set('Authorization', `Bearer ${tokens.accessToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('sessionId is required');
    });

    it('should return 401 without authentication', async () => {
      const res = await request(app)
        .get('/api/turns')
        .query({ sessionId: 'session-1' });

      expect(res.status).toBe(401);
    });
  });
});
