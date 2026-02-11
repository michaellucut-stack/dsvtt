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

/** Create a mock NPC record matching the Prisma Npc model. */
function createMockNpc(overrides: Record<string, unknown> = {}) {
  return {
    id: 'npc-id-1',
    sessionId: 'session-id-1',
    name: 'Goblin Scout',
    stats: { hp: 12, ac: 13, str: 10, dex: 14 },
    notes: 'Lurking in the forest.',
    tokenId: null,
    ...overrides,
  };
}

// =============================================================================
// Prisma mock extensions for Npc model
// =============================================================================

(prismaMock as any).npc = {
  findUnique: vi.fn(),
  findFirst: vi.fn(),
  findMany: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  count: vi.fn(),
};

(prismaMock as any).token = {
  findUnique: vi.fn(),
};

// =============================================================================
// App builder
// =============================================================================

async function buildNpcsApp(): Promise<Express> {
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

  // ── POST /api/npcs — Create NPC ────────────────────────────────────────
  router.post('/', authenticate, requireDirector, async (req: any, res: any) => {
    try {
      const { sessionId, name, stats, notes } = req.body;

      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        res.status(400).json({ error: 'name is required' });
        return;
      }

      if (!sessionId) {
        res.status(400).json({ error: 'sessionId is required' });
        return;
      }

      const npc = await (prismaMock as any).npc.create({
        data: {
          sessionId,
          name: name.trim(),
          stats: stats ?? {},
          notes: notes ?? null,
        },
      });

      res.status(201).json({ npc });
    } catch {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ── GET /api/npcs — List NPCs ──────────────────────────────────────────
  router.get('/', authenticate, async (req: any, res: any) => {
    try {
      const sessionId = req.query.sessionId as string;

      if (!sessionId) {
        res.status(400).json({ error: 'sessionId is required' });
        return;
      }

      const npcs = await (prismaMock as any).npc.findMany({
        where: { sessionId },
        orderBy: { name: 'asc' },
      });

      res.status(200).json({ npcs });
    } catch {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ── GET /api/npcs/:id — NPC detail ─────────────────────────────────────
  router.get('/:id', authenticate, async (req: any, res: any) => {
    try {
      const npc = await (prismaMock as any).npc.findUnique({
        where: { id: req.params.id },
        include: { token: true },
      });

      if (!npc) {
        res.status(404).json({ error: 'NPC not found' });
        return;
      }

      res.status(200).json({ npc });
    } catch {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ── PUT /api/npcs/:id — Update NPC ─────────────────────────────────────
  router.put('/:id', authenticate, requireDirector, async (req: any, res: any) => {
    try {
      const existing = await (prismaMock as any).npc.findUnique({
        where: { id: req.params.id },
      });

      if (!existing) {
        res.status(404).json({ error: 'NPC not found' });
        return;
      }

      const { name, stats, notes } = req.body;
      const data: Record<string, unknown> = {};
      if (name !== undefined) data.name = name;
      if (stats !== undefined) data.stats = stats;
      if (notes !== undefined) data.notes = notes;

      const npc = await (prismaMock as any).npc.update({
        where: { id: req.params.id },
        data,
      });

      res.status(200).json({ npc });
    } catch {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ── DELETE /api/npcs/:id — Delete NPC ──────────────────────────────────
  router.delete('/:id', authenticate, requireDirector, async (req: any, res: any) => {
    try {
      const existing = await (prismaMock as any).npc.findUnique({
        where: { id: req.params.id },
      });

      if (!existing) {
        res.status(404).json({ error: 'NPC not found' });
        return;
      }

      await (prismaMock as any).npc.delete({ where: { id: req.params.id } });

      res.status(200).json({ message: 'NPC deleted' });
    } catch {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ── POST /api/npcs/:id/assign-token — Assign token to NPC ─────────────
  router.post('/:id/assign-token', authenticate, requireDirector, async (req: any, res: any) => {
    try {
      const { tokenId } = req.body;

      if (!tokenId) {
        res.status(400).json({ error: 'tokenId is required' });
        return;
      }

      const existing = await (prismaMock as any).npc.findUnique({
        where: { id: req.params.id },
      });

      if (!existing) {
        res.status(404).json({ error: 'NPC not found' });
        return;
      }

      // Verify the token exists
      const token = await (prismaMock as any).token.findUnique({
        where: { id: tokenId },
      });

      if (!token) {
        res.status(400).json({ error: 'Token not found' });
        return;
      }

      const npc = await (prismaMock as any).npc.update({
        where: { id: req.params.id },
        data: { tokenId },
        include: { token: true },
      });

      res.status(200).json({ npc });
    } catch {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.use('/api/npcs', router);
  return app;
}

// =============================================================================
// Test Suite
// =============================================================================

describe('NPCs API', () => {
  let app: Express;

  beforeAll(async () => {
    app = await buildNpcsApp();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── POST /api/npcs ─────────────────────────────────────────────────────

  describe('POST /api/npcs', () => {
    it('should create an NPC when called by a director', async () => {
      const { tokens } = createAccessToken({ id: 'director-1', role: 'director' });

      const mockNpc = createMockNpc({
        id: 'new-npc-1',
        sessionId: 'session-1',
        name: 'Goblin Chief',
      });

      (prismaMock as any).npc.create.mockResolvedValueOnce(mockNpc);

      const res = await request(app)
        .post('/api/npcs')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({
          sessionId: 'session-1',
          name: 'Goblin Chief',
          stats: { hp: 30, ac: 15 },
          notes: 'Leader of the goblin war band.',
        });

      expect(res.status).toBe(201);
      expect(res.body.npc).toBeDefined();
      expect(res.body.npc.name).toBe('Goblin Chief');
      expect((prismaMock as any).npc.create).toHaveBeenCalledOnce();
    });

    it('should return 400 when name is missing', async () => {
      const { tokens } = createAccessToken({ id: 'director-1', role: 'director' });

      const res = await request(app)
        .post('/api/npcs')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({
          sessionId: 'session-1',
          stats: { hp: 10 },
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('name is required');
    });

    it('should return 400 when name is empty string', async () => {
      const { tokens } = createAccessToken({ id: 'director-1', role: 'director' });

      const res = await request(app)
        .post('/api/npcs')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({
          sessionId: 'session-1',
          name: '   ',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('name is required');
    });

    it('should return 403 when called by a player', async () => {
      const { tokens } = createAccessToken({ id: 'player-1', role: 'player' });

      const res = await request(app)
        .post('/api/npcs')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({
          sessionId: 'session-1',
          name: 'Sneaky NPC',
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Only the director can perform this action');
      expect((prismaMock as any).npc.create).not.toHaveBeenCalled();
    });

    it('should return 401 without authentication', async () => {
      const res = await request(app)
        .post('/api/npcs')
        .send({
          sessionId: 'session-1',
          name: 'Unauthenticated NPC',
        });

      expect(res.status).toBe(401);
    });
  });

  // ─── GET /api/npcs ──────────────────────────────────────────────────────

  describe('GET /api/npcs', () => {
    it('should return a list of NPCs for a session', async () => {
      const { tokens } = createAccessToken();

      const mockNpcs = [
        createMockNpc({ id: 'npc-1', name: 'Goblin Archer' }),
        createMockNpc({ id: 'npc-2', name: 'Goblin Scout' }),
      ];

      (prismaMock as any).npc.findMany.mockResolvedValueOnce(mockNpcs);

      const res = await request(app)
        .get('/api/npcs')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .query({ sessionId: 'session-id-1' });

      expect(res.status).toBe(200);
      expect(res.body.npcs).toHaveLength(2);
      expect(res.body.npcs[0].name).toBe('Goblin Archer');
    });

    it('should return an empty list when no NPCs exist', async () => {
      const { tokens } = createAccessToken();

      (prismaMock as any).npc.findMany.mockResolvedValueOnce([]);

      const res = await request(app)
        .get('/api/npcs')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .query({ sessionId: 'session-id-1' });

      expect(res.status).toBe(200);
      expect(res.body.npcs).toEqual([]);
    });

    it('should return 400 when sessionId is missing', async () => {
      const { tokens } = createAccessToken();

      const res = await request(app)
        .get('/api/npcs')
        .set('Authorization', `Bearer ${tokens.accessToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('sessionId is required');
    });

    it('should return 401 without authentication', async () => {
      const res = await request(app)
        .get('/api/npcs')
        .query({ sessionId: 'session-id-1' });

      expect(res.status).toBe(401);
    });
  });

  // ─── GET /api/npcs/:id ─────────────────────────────────────────────────

  describe('GET /api/npcs/:id', () => {
    it('should return NPC details', async () => {
      const { tokens } = createAccessToken();

      const mockNpc = createMockNpc({
        id: 'npc-detail-1',
        name: 'Ancient Dragon',
        stats: { hp: 350, ac: 22 },
        token: { id: 'token-1', name: 'Dragon Token', x: 5, y: 5 },
      });

      (prismaMock as any).npc.findUnique.mockResolvedValueOnce(mockNpc);

      const res = await request(app)
        .get('/api/npcs/npc-detail-1')
        .set('Authorization', `Bearer ${tokens.accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.npc).toMatchObject({
        id: 'npc-detail-1',
        name: 'Ancient Dragon',
      });
      expect(res.body.npc.stats).toEqual({ hp: 350, ac: 22 });
    });

    it('should return 404 when NPC does not exist', async () => {
      const { tokens } = createAccessToken();

      (prismaMock as any).npc.findUnique.mockResolvedValueOnce(null);

      const res = await request(app)
        .get('/api/npcs/nonexistent-npc')
        .set('Authorization', `Bearer ${tokens.accessToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('NPC not found');
    });
  });

  // ─── PUT /api/npcs/:id ─────────────────────────────────────────────────

  describe('PUT /api/npcs/:id', () => {
    it('should update NPC when called by a director', async () => {
      const { tokens } = createAccessToken({ id: 'director-1', role: 'director' });

      const existingNpc = createMockNpc({ id: 'npc-update-1' });
      const updatedNpc = createMockNpc({
        id: 'npc-update-1',
        name: 'Goblin Warlord',
        stats: { hp: 50, ac: 16 },
      });

      (prismaMock as any).npc.findUnique.mockResolvedValueOnce(existingNpc);
      (prismaMock as any).npc.update.mockResolvedValueOnce(updatedNpc);

      const res = await request(app)
        .put('/api/npcs/npc-update-1')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({
          name: 'Goblin Warlord',
          stats: { hp: 50, ac: 16 },
        });

      expect(res.status).toBe(200);
      expect(res.body.npc.name).toBe('Goblin Warlord');
      expect((prismaMock as any).npc.update).toHaveBeenCalledOnce();
    });

    it('should return 403 when called by a player', async () => {
      const { tokens } = createAccessToken({ id: 'player-1', role: 'player' });

      const res = await request(app)
        .put('/api/npcs/npc-update-1')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({ name: 'Renamed NPC' });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Only the director can perform this action');
      expect((prismaMock as any).npc.update).not.toHaveBeenCalled();
    });

    it('should return 404 when NPC does not exist', async () => {
      const { tokens } = createAccessToken({ id: 'director-1', role: 'director' });

      (prismaMock as any).npc.findUnique.mockResolvedValueOnce(null);

      const res = await request(app)
        .put('/api/npcs/nonexistent-npc')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({ name: 'Ghost NPC' });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('NPC not found');
    });
  });

  // ─── DELETE /api/npcs/:id ──────────────────────────────────────────────

  describe('DELETE /api/npcs/:id', () => {
    it('should delete NPC when called by a director', async () => {
      const { tokens } = createAccessToken({ id: 'director-1', role: 'director' });

      const existingNpc = createMockNpc({ id: 'npc-delete-1' });

      (prismaMock as any).npc.findUnique.mockResolvedValueOnce(existingNpc);
      (prismaMock as any).npc.delete.mockResolvedValueOnce(existingNpc);

      const res = await request(app)
        .delete('/api/npcs/npc-delete-1')
        .set('Authorization', `Bearer ${tokens.accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('NPC deleted');
      expect((prismaMock as any).npc.delete).toHaveBeenCalledWith({
        where: { id: 'npc-delete-1' },
      });
    });

    it('should return 403 when called by a player', async () => {
      const { tokens } = createAccessToken({ id: 'player-1', role: 'player' });

      const res = await request(app)
        .delete('/api/npcs/npc-delete-1')
        .set('Authorization', `Bearer ${tokens.accessToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Only the director can perform this action');
      expect((prismaMock as any).npc.delete).not.toHaveBeenCalled();
    });

    it('should return 404 when NPC does not exist', async () => {
      const { tokens } = createAccessToken({ id: 'director-1', role: 'director' });

      (prismaMock as any).npc.findUnique.mockResolvedValueOnce(null);

      const res = await request(app)
        .delete('/api/npcs/nonexistent-npc')
        .set('Authorization', `Bearer ${tokens.accessToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('NPC not found');
    });

    it('should return 401 without authentication', async () => {
      const res = await request(app)
        .delete('/api/npcs/npc-delete-1');

      expect(res.status).toBe(401);
    });
  });

  // ─── POST /api/npcs/:id/assign-token ───────────────────────────────────

  describe('POST /api/npcs/:id/assign-token', () => {
    it('should assign a token to an NPC', async () => {
      const { tokens } = createAccessToken({ id: 'director-1', role: 'director' });

      const existingNpc = createMockNpc({ id: 'npc-assign-1' });
      const mockToken = { id: 'token-abc', name: 'Goblin Token', mapId: 'map-1', x: 3, y: 4 };
      const updatedNpc = createMockNpc({
        id: 'npc-assign-1',
        tokenId: 'token-abc',
        token: mockToken,
      });

      (prismaMock as any).npc.findUnique.mockResolvedValueOnce(existingNpc);
      (prismaMock as any).token.findUnique.mockResolvedValueOnce(mockToken);
      (prismaMock as any).npc.update.mockResolvedValueOnce(updatedNpc);

      const res = await request(app)
        .post('/api/npcs/npc-assign-1/assign-token')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({ tokenId: 'token-abc' });

      expect(res.status).toBe(200);
      expect(res.body.npc.tokenId).toBe('token-abc');
      expect((prismaMock as any).npc.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { tokenId: 'token-abc' },
        }),
      );
    });

    it('should return 400 when tokenId refers to a non-existent token', async () => {
      const { tokens } = createAccessToken({ id: 'director-1', role: 'director' });

      const existingNpc = createMockNpc({ id: 'npc-assign-2' });

      (prismaMock as any).npc.findUnique.mockResolvedValueOnce(existingNpc);
      (prismaMock as any).token.findUnique.mockResolvedValueOnce(null);

      const res = await request(app)
        .post('/api/npcs/npc-assign-2/assign-token')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({ tokenId: 'nonexistent-token' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Token not found');
      expect((prismaMock as any).npc.update).not.toHaveBeenCalled();
    });

    it('should return 400 when tokenId is missing', async () => {
      const { tokens } = createAccessToken({ id: 'director-1', role: 'director' });

      const res = await request(app)
        .post('/api/npcs/npc-assign-1/assign-token')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('tokenId is required');
    });

    it('should return 403 when called by a player', async () => {
      const { tokens } = createAccessToken({ id: 'player-1', role: 'player' });

      const res = await request(app)
        .post('/api/npcs/npc-assign-1/assign-token')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({ tokenId: 'token-abc' });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Only the director can perform this action');
    });
  });
});
