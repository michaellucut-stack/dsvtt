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

/** Create a mock SharedNote record matching the Prisma model. */
function createMockNote(overrides: Record<string, unknown> = {}) {
  return {
    id: 'note-id-1',
    sessionId: 'session-id-1',
    title: 'Session Summary',
    content: 'The party ventured into the Whispering Caverns.',
    updatedBy: null,
    updatedAt: new Date('2025-06-01T12:00:00Z'),
    ...overrides,
  };
}

// =============================================================================
// Prisma mock extensions for SharedNote model
// =============================================================================

(prismaMock as any).sharedNote = {
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

async function buildNotesApp(): Promise<Express> {
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

  // ── POST /api/notes — Create note ──────────────────────────────────────
  router.post('/', authenticate, async (req: any, res: any) => {
    try {
      const { sessionId, title, content } = req.body;

      if (!title || typeof title !== 'string' || title.trim().length === 0) {
        res.status(400).json({ error: 'title is required' });
        return;
      }

      if (!sessionId) {
        res.status(400).json({ error: 'sessionId is required' });
        return;
      }

      const note = await (prismaMock as any).sharedNote.create({
        data: {
          sessionId,
          title: title.trim(),
          content: content ?? '',
          updatedBy: req.user.sub,
        },
      });

      res.status(201).json({ note });
    } catch {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ── GET /api/notes — List notes ────────────────────────────────────────
  router.get('/', authenticate, async (req: any, res: any) => {
    try {
      const sessionId = req.query.sessionId as string;

      if (!sessionId) {
        res.status(400).json({ error: 'sessionId is required' });
        return;
      }

      const notes = await (prismaMock as any).sharedNote.findMany({
        where: { sessionId },
        orderBy: { updatedAt: 'desc' },
      });

      res.status(200).json({ notes });
    } catch {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ── PUT /api/notes/:id — Update note ───────────────────────────────────
  router.put('/:id', authenticate, async (req: any, res: any) => {
    try {
      const existing = await (prismaMock as any).sharedNote.findUnique({
        where: { id: req.params.id },
      });

      if (!existing) {
        res.status(404).json({ error: 'Note not found' });
        return;
      }

      const { title, content } = req.body;
      const data: Record<string, unknown> = {
        updatedBy: req.user.sub,
      };
      if (title !== undefined) data.title = title;
      if (content !== undefined) data.content = content;

      const note = await (prismaMock as any).sharedNote.update({
        where: { id: req.params.id },
        data,
      });

      res.status(200).json({ note });
    } catch {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ── DELETE /api/notes/:id — Delete note (director only) ────────────────
  router.delete('/:id', authenticate, requireDirector, async (req: any, res: any) => {
    try {
      const existing = await (prismaMock as any).sharedNote.findUnique({
        where: { id: req.params.id },
      });

      if (!existing) {
        res.status(404).json({ error: 'Note not found' });
        return;
      }

      await (prismaMock as any).sharedNote.delete({ where: { id: req.params.id } });

      res.status(200).json({ message: 'Note deleted' });
    } catch {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.use('/api/notes', router);
  return app;
}

// =============================================================================
// Test Suite
// =============================================================================

describe('Notes API', () => {
  let app: Express;

  beforeAll(async () => {
    app = await buildNotesApp();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── POST /api/notes ───────────────────────────────────────────────────

  describe('POST /api/notes', () => {
    it('should create a shared note successfully', async () => {
      const { tokens } = createAccessToken({ id: 'player-1', role: 'player' });

      const mockNote = createMockNote({
        id: 'new-note-1',
        title: 'Quest Log',
        content: 'Retrieve the stolen artifact from the goblin camp.',
        updatedBy: 'player-1',
      });

      (prismaMock as any).sharedNote.create.mockResolvedValueOnce(mockNote);

      const res = await request(app)
        .post('/api/notes')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({
          sessionId: 'session-id-1',
          title: 'Quest Log',
          content: 'Retrieve the stolen artifact from the goblin camp.',
        });

      expect(res.status).toBe(201);
      expect(res.body.note).toBeDefined();
      expect(res.body.note.title).toBe('Quest Log');
      expect(res.body.note.content).toContain('stolen artifact');
      expect((prismaMock as any).sharedNote.create).toHaveBeenCalledOnce();
      expect((prismaMock as any).sharedNote.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            updatedBy: 'player-1',
          }),
        }),
      );
    });

    it('should return 400 when title is missing', async () => {
      const { tokens } = createAccessToken();

      const res = await request(app)
        .post('/api/notes')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({
          sessionId: 'session-id-1',
          content: 'Content without a title.',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('title is required');
    });

    it('should return 400 when sessionId is missing', async () => {
      const { tokens } = createAccessToken();

      const res = await request(app)
        .post('/api/notes')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({
          title: 'Orphaned Note',
          content: 'No session.',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('sessionId is required');
    });

    it('should allow a director to create a note', async () => {
      const { tokens } = createAccessToken({ id: 'director-1', role: 'director' });

      const mockNote = createMockNote({
        id: 'director-note-1',
        title: 'Director Notes',
        updatedBy: 'director-1',
      });

      (prismaMock as any).sharedNote.create.mockResolvedValueOnce(mockNote);

      const res = await request(app)
        .post('/api/notes')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({
          sessionId: 'session-id-1',
          title: 'Director Notes',
          content: 'Secret plot hooks.',
        });

      expect(res.status).toBe(201);
      expect(res.body.note.title).toBe('Director Notes');
    });

    it('should return 401 without authentication', async () => {
      const res = await request(app)
        .post('/api/notes')
        .send({
          sessionId: 'session-id-1',
          title: 'Unauthed Note',
        });

      expect(res.status).toBe(401);
    });
  });

  // ─── GET /api/notes ────────────────────────────────────────────────────

  describe('GET /api/notes', () => {
    it('should return notes for a session', async () => {
      const { tokens } = createAccessToken();

      const mockNotes = [
        createMockNote({ id: 'note-1', title: 'Session 1 Summary' }),
        createMockNote({ id: 'note-2', title: 'Quest Objectives' }),
      ];

      (prismaMock as any).sharedNote.findMany.mockResolvedValueOnce(mockNotes);

      const res = await request(app)
        .get('/api/notes')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .query({ sessionId: 'session-id-1' });

      expect(res.status).toBe(200);
      expect(res.body.notes).toHaveLength(2);
      expect(res.body.notes[0].title).toBe('Session 1 Summary');
    });

    it('should return empty array when no notes exist', async () => {
      const { tokens } = createAccessToken();

      (prismaMock as any).sharedNote.findMany.mockResolvedValueOnce([]);

      const res = await request(app)
        .get('/api/notes')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .query({ sessionId: 'session-id-1' });

      expect(res.status).toBe(200);
      expect(res.body.notes).toEqual([]);
    });

    it('should return 400 when sessionId is missing', async () => {
      const { tokens } = createAccessToken();

      const res = await request(app)
        .get('/api/notes')
        .set('Authorization', `Bearer ${tokens.accessToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('sessionId is required');
    });

    it('should return 401 without authentication', async () => {
      const res = await request(app)
        .get('/api/notes')
        .query({ sessionId: 'session-id-1' });

      expect(res.status).toBe(401);
    });
  });

  // ─── PUT /api/notes/:id ────────────────────────────────────────────────

  describe('PUT /api/notes/:id', () => {
    it('should update a note successfully', async () => {
      const { tokens } = createAccessToken({ id: 'player-1', role: 'player' });

      const existingNote = createMockNote({ id: 'note-update-1' });
      const updatedNote = createMockNote({
        id: 'note-update-1',
        title: 'Updated Summary',
        content: 'The party defeated the dragon!',
        updatedBy: 'player-1',
      });

      (prismaMock as any).sharedNote.findUnique.mockResolvedValueOnce(existingNote);
      (prismaMock as any).sharedNote.update.mockResolvedValueOnce(updatedNote);

      const res = await request(app)
        .put('/api/notes/note-update-1')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({
          title: 'Updated Summary',
          content: 'The party defeated the dragon!',
        });

      expect(res.status).toBe(200);
      expect(res.body.note.title).toBe('Updated Summary');
      expect(res.body.note.content).toContain('defeated the dragon');
    });

    it('should set updatedBy to the current user', async () => {
      const { tokens } = createAccessToken({ id: 'player-2', role: 'player' });

      const existingNote = createMockNote({ id: 'note-updatedby-1', updatedBy: 'player-1' });
      const updatedNote = createMockNote({
        id: 'note-updatedby-1',
        updatedBy: 'player-2',
      });

      (prismaMock as any).sharedNote.findUnique.mockResolvedValueOnce(existingNote);
      (prismaMock as any).sharedNote.update.mockResolvedValueOnce(updatedNote);

      const res = await request(app)
        .put('/api/notes/note-updatedby-1')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({ content: 'Minor edit.' });

      expect(res.status).toBe(200);
      expect((prismaMock as any).sharedNote.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            updatedBy: 'player-2',
          }),
        }),
      );
    });

    it('should return 404 when note does not exist', async () => {
      const { tokens } = createAccessToken();

      (prismaMock as any).sharedNote.findUnique.mockResolvedValueOnce(null);

      const res = await request(app)
        .put('/api/notes/nonexistent-note')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({ title: 'Ghost Note' });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Note not found');
    });

    it('should return 401 without authentication', async () => {
      const res = await request(app)
        .put('/api/notes/note-update-1')
        .send({ title: 'Hacked Note' });

      expect(res.status).toBe(401);
    });
  });

  // ─── DELETE /api/notes/:id ─────────────────────────────────────────────

  describe('DELETE /api/notes/:id', () => {
    it('should allow director to delete a note', async () => {
      const { tokens } = createAccessToken({ id: 'director-1', role: 'director' });

      const existingNote = createMockNote({ id: 'note-delete-1' });

      (prismaMock as any).sharedNote.findUnique.mockResolvedValueOnce(existingNote);
      (prismaMock as any).sharedNote.delete.mockResolvedValueOnce(existingNote);

      const res = await request(app)
        .delete('/api/notes/note-delete-1')
        .set('Authorization', `Bearer ${tokens.accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Note deleted');
      expect((prismaMock as any).sharedNote.delete).toHaveBeenCalledWith({
        where: { id: 'note-delete-1' },
      });
    });

    it('should return 403 when a player tries to delete a note', async () => {
      const { tokens } = createAccessToken({ id: 'player-1', role: 'player' });

      const res = await request(app)
        .delete('/api/notes/note-delete-1')
        .set('Authorization', `Bearer ${tokens.accessToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Only the director can perform this action');
      expect((prismaMock as any).sharedNote.delete).not.toHaveBeenCalled();
    });

    it('should return 404 when note does not exist', async () => {
      const { tokens } = createAccessToken({ id: 'director-1', role: 'director' });

      (prismaMock as any).sharedNote.findUnique.mockResolvedValueOnce(null);

      const res = await request(app)
        .delete('/api/notes/nonexistent-note')
        .set('Authorization', `Bearer ${tokens.accessToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Note not found');
    });

    it('should return 401 without authentication', async () => {
      const res = await request(app)
        .delete('/api/notes/note-delete-1');

      expect(res.status).toBe(401);
    });
  });
});
