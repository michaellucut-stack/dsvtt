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

/** Create a mock Character record matching the Prisma Character model. */
function createMockCharacter(overrides: Record<string, unknown> = {}) {
  return {
    id: 'char-id-1',
    sessionId: 'session-id-1',
    userId: 'test-user-id-1',
    name: 'Thorin Ironforge',
    stats: { str: 18, dex: 12, con: 16, int: 10, wis: 14, cha: 8 },
    notes: 'A dwarven fighter seeking the lost mines.',
    inventory: ['Battleaxe', 'Shield', 'Healing Potion'],
    ...overrides,
  };
}

// =============================================================================
// Prisma mock extensions for Character model
// =============================================================================

(prismaMock as any).character = {
  findUnique: vi.fn(),
  findFirst: vi.fn(),
  findMany: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  count: vi.fn(),
};

// =============================================================================
// App builder
// =============================================================================

async function buildCharactersApp(): Promise<Express> {
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

  // ── POST /api/characters — Create character ────────────────────────────
  router.post('/', authenticate, async (req: any, res: any) => {
    try {
      const { sessionId, name, stats, notes, inventory } = req.body;

      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        res.status(400).json({ error: 'name is required' });
        return;
      }

      if (!sessionId) {
        res.status(400).json({ error: 'sessionId is required' });
        return;
      }

      const character = await (prismaMock as any).character.create({
        data: {
          sessionId,
          userId: req.user.sub,
          name: name.trim(),
          stats: stats ?? {},
          notes: notes ?? null,
          inventory: inventory ?? [],
        },
      });

      res.status(201).json({ character });
    } catch {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ── GET /api/characters — List characters ──────────────────────────────
  router.get('/', authenticate, async (req: any, res: any) => {
    try {
      const sessionId = req.query.sessionId as string;

      if (!sessionId) {
        res.status(400).json({ error: 'sessionId is required' });
        return;
      }

      const isDirector = req.user.role === 'director';

      const where: Record<string, unknown> = { sessionId };
      // Players can only see their own characters; directors see all
      if (!isDirector) {
        where.userId = req.user.sub;
      }

      const characters = await (prismaMock as any).character.findMany({
        where,
        orderBy: { name: 'asc' },
      });

      res.status(200).json({ characters });
    } catch {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ── GET /api/characters/:id — Character detail ─────────────────────────
  router.get('/:id', authenticate, async (req: any, res: any) => {
    try {
      const character = await (prismaMock as any).character.findUnique({
        where: { id: req.params.id },
      });

      if (!character) {
        res.status(404).json({ error: 'Character not found' });
        return;
      }

      const isDirector = req.user.role === 'director';
      const isOwner = character.userId === req.user.sub;

      if (!isDirector && !isOwner) {
        res.status(403).json({ error: 'You do not have access to this character' });
        return;
      }

      res.status(200).json({ character });
    } catch {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ── PUT /api/characters/:id — Update character ─────────────────────────
  router.put('/:id', authenticate, async (req: any, res: any) => {
    try {
      const existing = await (prismaMock as any).character.findUnique({
        where: { id: req.params.id },
      });

      if (!existing) {
        res.status(404).json({ error: 'Character not found' });
        return;
      }

      const isDirector = req.user.role === 'director';
      const isOwner = existing.userId === req.user.sub;

      if (!isDirector && !isOwner) {
        res.status(403).json({ error: 'You do not have permission to update this character' });
        return;
      }

      const { name, stats, notes, inventory } = req.body;
      const data: Record<string, unknown> = {};
      if (name !== undefined) data.name = name;
      if (stats !== undefined) data.stats = stats;
      if (notes !== undefined) data.notes = notes;
      if (inventory !== undefined) data.inventory = inventory;

      const character = await (prismaMock as any).character.update({
        where: { id: req.params.id },
        data,
      });

      res.status(200).json({ character });
    } catch {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ── DELETE /api/characters/:id — Delete character ──────────────────────
  router.delete('/:id', authenticate, async (req: any, res: any) => {
    try {
      const existing = await (prismaMock as any).character.findUnique({
        where: { id: req.params.id },
      });

      if (!existing) {
        res.status(404).json({ error: 'Character not found' });
        return;
      }

      const isDirector = req.user.role === 'director';
      const isOwner = existing.userId === req.user.sub;

      if (!isDirector && !isOwner) {
        res.status(403).json({ error: 'You do not have permission to delete this character' });
        return;
      }

      await (prismaMock as any).character.delete({ where: { id: req.params.id } });

      res.status(200).json({ message: 'Character deleted' });
    } catch {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.use('/api/characters', router);
  return app;
}

// =============================================================================
// Test Suite
// =============================================================================

describe('Characters API', () => {
  let app: Express;

  beforeAll(async () => {
    app = await buildCharactersApp();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── POST /api/characters ──────────────────────────────────────────────

  describe('POST /api/characters', () => {
    it('should create a character successfully', async () => {
      const { tokens } = createAccessToken({ id: 'player-1', role: 'player' });

      const mockChar = createMockCharacter({
        id: 'new-char-1',
        userId: 'player-1',
        name: 'Elara Nightwind',
      });

      (prismaMock as any).character.create.mockResolvedValueOnce(mockChar);

      const res = await request(app)
        .post('/api/characters')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({
          sessionId: 'session-id-1',
          name: 'Elara Nightwind',
          stats: { str: 10, dex: 18, con: 12, int: 14, wis: 13, cha: 16 },
          notes: 'An elven rogue from the Silver Marches.',
          inventory: ['Shortsword', 'Thieves Tools'],
        });

      expect(res.status).toBe(201);
      expect(res.body.character).toBeDefined();
      expect(res.body.character.name).toBe('Elara Nightwind');
      expect((prismaMock as any).character.create).toHaveBeenCalledOnce();
      expect((prismaMock as any).character.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'player-1',
            name: 'Elara Nightwind',
          }),
        }),
      );
    });

    it('should return 400 when name is missing', async () => {
      const { tokens } = createAccessToken({ id: 'player-1', role: 'player' });

      const res = await request(app)
        .post('/api/characters')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({
          sessionId: 'session-id-1',
          stats: { str: 10 },
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('name is required');
    });

    it('should return 400 when name is empty string', async () => {
      const { tokens } = createAccessToken({ id: 'player-1', role: 'player' });

      const res = await request(app)
        .post('/api/characters')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({
          sessionId: 'session-id-1',
          name: '',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('name is required');
    });

    it('should return 401 without authentication', async () => {
      const res = await request(app)
        .post('/api/characters')
        .send({
          sessionId: 'session-id-1',
          name: 'Unauthenticated Char',
        });

      expect(res.status).toBe(401);
    });
  });

  // ─── GET /api/characters ───────────────────────────────────────────────

  describe('GET /api/characters', () => {
    it('should return all characters for a director', async () => {
      const { tokens } = createAccessToken({ id: 'director-1', role: 'director' });

      const mockChars = [
        createMockCharacter({ id: 'char-1', userId: 'player-1', name: 'Fighter' }),
        createMockCharacter({ id: 'char-2', userId: 'player-2', name: 'Wizard' }),
        createMockCharacter({ id: 'char-3', userId: 'player-3', name: 'Cleric' }),
      ];

      (prismaMock as any).character.findMany.mockResolvedValueOnce(mockChars);

      const res = await request(app)
        .get('/api/characters')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .query({ sessionId: 'session-id-1' });

      expect(res.status).toBe(200);
      expect(res.body.characters).toHaveLength(3);
      // Director query should NOT filter by userId
      expect((prismaMock as any).character.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { sessionId: 'session-id-1' },
        }),
      );
    });

    it('should return only own characters for a player', async () => {
      const { tokens } = createAccessToken({ id: 'player-1', role: 'player' });

      const ownChars = [
        createMockCharacter({ id: 'char-1', userId: 'player-1', name: 'Fighter' }),
      ];

      (prismaMock as any).character.findMany.mockResolvedValueOnce(ownChars);

      const res = await request(app)
        .get('/api/characters')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .query({ sessionId: 'session-id-1' });

      expect(res.status).toBe(200);
      expect(res.body.characters).toHaveLength(1);
      // Player query should filter by userId
      expect((prismaMock as any).character.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { sessionId: 'session-id-1', userId: 'player-1' },
        }),
      );
    });

    it('should return 400 when sessionId is missing', async () => {
      const { tokens } = createAccessToken();

      const res = await request(app)
        .get('/api/characters')
        .set('Authorization', `Bearer ${tokens.accessToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('sessionId is required');
    });
  });

  // ─── GET /api/characters/:id ───────────────────────────────────────────

  describe('GET /api/characters/:id', () => {
    it('should allow owner to see their own character', async () => {
      const { tokens } = createAccessToken({ id: 'player-1', role: 'player' });

      const mockChar = createMockCharacter({
        id: 'char-own-1',
        userId: 'player-1',
        name: 'My Fighter',
      });

      (prismaMock as any).character.findUnique.mockResolvedValueOnce(mockChar);

      const res = await request(app)
        .get('/api/characters/char-own-1')
        .set('Authorization', `Bearer ${tokens.accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.character.name).toBe('My Fighter');
    });

    it('should allow director to see any character', async () => {
      const { tokens } = createAccessToken({ id: 'director-1', role: 'director' });

      const mockChar = createMockCharacter({
        id: 'char-other-1',
        userId: 'player-2',
        name: 'Player Two Wizard',
      });

      (prismaMock as any).character.findUnique.mockResolvedValueOnce(mockChar);

      const res = await request(app)
        .get('/api/characters/char-other-1')
        .set('Authorization', `Bearer ${tokens.accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.character.name).toBe('Player Two Wizard');
    });

    it('should return 403 when another player tries to view a character they do not own', async () => {
      const { tokens } = createAccessToken({ id: 'player-3', role: 'player' });

      const mockChar = createMockCharacter({
        id: 'char-forbidden-1',
        userId: 'player-1',
        name: 'Somebody Else Fighter',
      });

      (prismaMock as any).character.findUnique.mockResolvedValueOnce(mockChar);

      const res = await request(app)
        .get('/api/characters/char-forbidden-1')
        .set('Authorization', `Bearer ${tokens.accessToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('You do not have access to this character');
    });

    it('should return 404 when character does not exist', async () => {
      const { tokens } = createAccessToken();

      (prismaMock as any).character.findUnique.mockResolvedValueOnce(null);

      const res = await request(app)
        .get('/api/characters/nonexistent-char')
        .set('Authorization', `Bearer ${tokens.accessToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Character not found');
    });
  });

  // ─── PUT /api/characters/:id ───────────────────────────────────────────

  describe('PUT /api/characters/:id', () => {
    it('should allow owner to update their own character', async () => {
      const { tokens } = createAccessToken({ id: 'player-1', role: 'player' });

      const existingChar = createMockCharacter({
        id: 'char-update-1',
        userId: 'player-1',
      });
      const updatedChar = createMockCharacter({
        id: 'char-update-1',
        userId: 'player-1',
        name: 'Thorin the Bold',
        stats: { str: 20, dex: 12, con: 16, int: 10, wis: 14, cha: 8 },
      });

      (prismaMock as any).character.findUnique.mockResolvedValueOnce(existingChar);
      (prismaMock as any).character.update.mockResolvedValueOnce(updatedChar);

      const res = await request(app)
        .put('/api/characters/char-update-1')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({
          name: 'Thorin the Bold',
          stats: { str: 20, dex: 12, con: 16, int: 10, wis: 14, cha: 8 },
        });

      expect(res.status).toBe(200);
      expect(res.body.character.name).toBe('Thorin the Bold');
      expect((prismaMock as any).character.update).toHaveBeenCalledOnce();
    });

    it('should allow director to update any character', async () => {
      const { tokens } = createAccessToken({ id: 'director-1', role: 'director' });

      const existingChar = createMockCharacter({
        id: 'char-update-2',
        userId: 'player-2',
      });
      const updatedChar = createMockCharacter({
        id: 'char-update-2',
        userId: 'player-2',
        notes: 'Director updated notes.',
      });

      (prismaMock as any).character.findUnique.mockResolvedValueOnce(existingChar);
      (prismaMock as any).character.update.mockResolvedValueOnce(updatedChar);

      const res = await request(app)
        .put('/api/characters/char-update-2')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({ notes: 'Director updated notes.' });

      expect(res.status).toBe(200);
      expect(res.body.character.notes).toBe('Director updated notes.');
    });

    it('should return 403 when another player tries to update a character they do not own', async () => {
      const { tokens } = createAccessToken({ id: 'player-3', role: 'player' });

      const existingChar = createMockCharacter({
        id: 'char-forbidden-update',
        userId: 'player-1',
      });

      (prismaMock as any).character.findUnique.mockResolvedValueOnce(existingChar);

      const res = await request(app)
        .put('/api/characters/char-forbidden-update')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({ name: 'Stolen Character' });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('You do not have permission to update this character');
      expect((prismaMock as any).character.update).not.toHaveBeenCalled();
    });

    it('should return 404 when character does not exist', async () => {
      const { tokens } = createAccessToken({ id: 'player-1', role: 'player' });

      (prismaMock as any).character.findUnique.mockResolvedValueOnce(null);

      const res = await request(app)
        .put('/api/characters/nonexistent-char')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({ name: 'Ghost' });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Character not found');
    });
  });

  // ─── DELETE /api/characters/:id ────────────────────────────────────────

  describe('DELETE /api/characters/:id', () => {
    it('should allow owner to delete their own character', async () => {
      const { tokens } = createAccessToken({ id: 'player-1', role: 'player' });

      const existingChar = createMockCharacter({
        id: 'char-delete-1',
        userId: 'player-1',
      });

      (prismaMock as any).character.findUnique.mockResolvedValueOnce(existingChar);
      (prismaMock as any).character.delete.mockResolvedValueOnce(existingChar);

      const res = await request(app)
        .delete('/api/characters/char-delete-1')
        .set('Authorization', `Bearer ${tokens.accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Character deleted');
      expect((prismaMock as any).character.delete).toHaveBeenCalledWith({
        where: { id: 'char-delete-1' },
      });
    });

    it('should allow director to delete any character', async () => {
      const { tokens } = createAccessToken({ id: 'director-1', role: 'director' });

      const existingChar = createMockCharacter({
        id: 'char-delete-2',
        userId: 'player-2',
      });

      (prismaMock as any).character.findUnique.mockResolvedValueOnce(existingChar);
      (prismaMock as any).character.delete.mockResolvedValueOnce(existingChar);

      const res = await request(app)
        .delete('/api/characters/char-delete-2')
        .set('Authorization', `Bearer ${tokens.accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Character deleted');
    });

    it('should return 403 when another player tries to delete a character they do not own', async () => {
      const { tokens } = createAccessToken({ id: 'player-3', role: 'player' });

      const existingChar = createMockCharacter({
        id: 'char-forbidden-delete',
        userId: 'player-1',
      });

      (prismaMock as any).character.findUnique.mockResolvedValueOnce(existingChar);

      const res = await request(app)
        .delete('/api/characters/char-forbidden-delete')
        .set('Authorization', `Bearer ${tokens.accessToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('You do not have permission to delete this character');
      expect((prismaMock as any).character.delete).not.toHaveBeenCalled();
    });

    it('should return 404 when character does not exist', async () => {
      const { tokens } = createAccessToken({ id: 'player-1', role: 'player' });

      (prismaMock as any).character.findUnique.mockResolvedValueOnce(null);

      const res = await request(app)
        .delete('/api/characters/nonexistent-char')
        .set('Authorization', `Bearer ${tokens.accessToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Character not found');
    });
  });
});
