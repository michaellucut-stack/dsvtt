import { describe, it, expect, vi, beforeAll } from 'vitest';
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

/** Convenience factory for a mock room record. */
function createMockRoom(overrides: Record<string, unknown> = {}) {
  return {
    id: 'room-id-1',
    name: 'Test Room',
    status: 'WAITING',
    directorId: 'director-user-id',
    maxPlayers: 6,
    createdAt: new Date('2025-06-01T00:00:00Z'),
    updatedAt: new Date('2025-06-01T00:00:00Z'),
    ...overrides,
  };
}

/** Convenience factory for a mock game session record. */
function createMockSession(overrides: Record<string, unknown> = {}) {
  return {
    id: 'session-id-1',
    roomId: 'room-id-1',
    status: 'active',
    startedAt: new Date('2025-06-01T12:00:00Z'),
    endedAt: null,
    eventCount: 0,
    ...overrides,
  };
}

// =============================================================================
// App builder
// =============================================================================

/**
 * Builds a test Express app with session routes wired up.
 *
 * Routes are defined inline to match the API contract (test-first approach).
 */
async function buildSessionApp(): Promise<Express> {
  const app = createTestApp();
  const { Router } = await import('express');
  const router = Router({ mergeParams: true });

  // ── Auth middleware ─────────────────────────────────────────────────────
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

  // ── POST /api/rooms/:roomId/sessions — Create a session ────────────────
  router.post('/:roomId/sessions', authenticate, async (req: any, res: any) => {
    try {
      const { roomId } = req.params;

      // Verify room exists
      const room = await prismaMock.room.findUnique({
        where: { id: roomId },
      });

      if (!room) {
        res.status(404).json({ error: 'Room not found' });
        return;
      }

      // Only the director can create sessions
      if (room.directorId !== req.user.sub) {
        res.status(403).json({ error: 'Only the director can create sessions' });
        return;
      }

      // Check for existing active session
      const existingSession = await prismaMock.gameSession.findFirst({
        where: { roomId, status: { in: ['active', 'paused'] } },
      });

      if (existingSession) {
        res.status(409).json({ error: 'An active session already exists for this room' });
        return;
      }

      const session = await prismaMock.gameSession.create({
        data: {
          roomId,
          status: 'active',
          startedAt: new Date(),
          eventCount: 0,
        },
      });

      // Update room status to active
      await prismaMock.room.update({
        where: { id: roomId },
        data: { status: 'ACTIVE' },
      });

      res.status(201).json({ session });
    } catch {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ── GET /api/rooms/:roomId/sessions — List sessions ────────────────────
  router.get('/:roomId/sessions', async (req: any, res: any) => {
    try {
      const { roomId } = req.params;

      // Verify room exists
      const room = await prismaMock.room.findUnique({
        where: { id: roomId },
      });

      if (!room) {
        res.status(404).json({ error: 'Room not found' });
        return;
      }

      const sessions = await prismaMock.gameSession.findMany({
        where: { roomId },
        orderBy: { startedAt: 'desc' },
      });

      res.status(200).json({ sessions });
    } catch {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ── PATCH /api/sessions/:id/status — Update session status ─────────────
  const sessionRouter = Router();

  sessionRouter.patch('/:id/status', authenticate, async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!status || !['active', 'paused', 'ended'].includes(status)) {
        res.status(400).json({ error: 'Invalid status. Must be one of: active, paused, ended' });
        return;
      }

      const session = await prismaMock.gameSession.findUnique({
        where: { id },
      });

      if (!session) {
        res.status(404).json({ error: 'Session not found' });
        return;
      }

      // Verify the user is the room director
      const room = await prismaMock.room.findUnique({
        where: { id: session.roomId },
      });

      if (!room || room.directorId !== req.user.sub) {
        res.status(403).json({ error: 'Only the director can update session status' });
        return;
      }

      const updated = await prismaMock.gameSession.update({
        where: { id },
        data: {
          status,
          ...(status === 'ended' ? { endedAt: new Date() } : {}),
        },
      });

      res.status(200).json({ session: updated });
    } catch {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.use('/api/rooms', router);
  app.use('/api/sessions', sessionRouter);
  return app;
}

// =============================================================================
// Test Suite
// =============================================================================

describe('Sessions API', () => {
  let app: Express;

  beforeAll(async () => {
    app = await buildSessionApp();
  });

  // ─── POST /api/rooms/:roomId/sessions ───────────────────────────────────
  describe('POST /api/rooms/:roomId/sessions', () => {
    it('should allow director to create a session', async () => {
      const { tokens, user } = createAccessToken({
        id: 'director-user-id',
        role: 'director',
      });

      const room = createMockRoom({ directorId: user.id });
      const session = createMockSession({ roomId: room.id });

      prismaMock.room.findUnique.mockResolvedValueOnce(room);
      prismaMock.gameSession.findFirst.mockResolvedValueOnce(null); // no active session
      prismaMock.gameSession.create.mockResolvedValueOnce(session);
      prismaMock.room.update.mockResolvedValueOnce({ ...room, status: 'ACTIVE' });

      const res = await request(app)
        .post(`/api/rooms/${room.id}/sessions`)
        .set('Authorization', `Bearer ${tokens.accessToken}`);

      expect(res.status).toBe(201);
      expect(res.body.session).toMatchObject({
        id: session.id,
        roomId: room.id,
        status: 'active',
      });
      expect(prismaMock.gameSession.create).toHaveBeenCalledOnce();
      expect(prismaMock.room.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: 'ACTIVE' },
        }),
      );
    });

    it('should return 403 when player tries to create a session', async () => {
      const { tokens } = createAccessToken({
        id: 'player-user-id',
        role: 'player',
      });

      const room = createMockRoom({ directorId: 'someone-else' });

      prismaMock.room.findUnique.mockResolvedValueOnce(room);

      const res = await request(app)
        .post(`/api/rooms/${room.id}/sessions`)
        .set('Authorization', `Bearer ${tokens.accessToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Only the director can create sessions');
      expect(prismaMock.gameSession.create).not.toHaveBeenCalled();
    });

    it('should return 404 when room does not exist', async () => {
      const { tokens } = createAccessToken({ id: 'some-user' });

      prismaMock.room.findUnique.mockResolvedValueOnce(null);

      const res = await request(app)
        .post('/api/rooms/nonexistent-room/sessions')
        .set('Authorization', `Bearer ${tokens.accessToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Room not found');
    });

    it('should return 409 when an active session already exists', async () => {
      const { tokens, user } = createAccessToken({
        id: 'director-user-id',
        role: 'director',
      });

      const room = createMockRoom({ directorId: user.id });
      const existingSession = createMockSession({ status: 'active' });

      prismaMock.room.findUnique.mockResolvedValueOnce(room);
      prismaMock.gameSession.findFirst.mockResolvedValueOnce(existingSession);

      const res = await request(app)
        .post(`/api/rooms/${room.id}/sessions`)
        .set('Authorization', `Bearer ${tokens.accessToken}`);

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('An active session already exists for this room');
    });

    it('should return 401 without authentication', async () => {
      const res = await request(app)
        .post('/api/rooms/room-id-1/sessions');

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('No token provided');
    });
  });

  // ─── GET /api/rooms/:roomId/sessions ────────────────────────────────────
  describe('GET /api/rooms/:roomId/sessions', () => {
    it('should return a list of sessions for a room', async () => {
      const room = createMockRoom();
      const sessions = [
        createMockSession({ id: 'session-1', status: 'ended' }),
        createMockSession({ id: 'session-2', status: 'active' }),
      ];

      prismaMock.room.findUnique.mockResolvedValueOnce(room);
      prismaMock.gameSession.findMany.mockResolvedValueOnce(sessions);

      const res = await request(app)
        .get(`/api/rooms/${room.id}/sessions`);

      expect(res.status).toBe(200);
      expect(res.body.sessions).toHaveLength(2);
      expect(prismaMock.gameSession.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { roomId: room.id },
          orderBy: { startedAt: 'desc' },
        }),
      );
    });

    it('should return empty list when room has no sessions', async () => {
      const room = createMockRoom();

      prismaMock.room.findUnique.mockResolvedValueOnce(room);
      prismaMock.gameSession.findMany.mockResolvedValueOnce([]);

      const res = await request(app)
        .get(`/api/rooms/${room.id}/sessions`);

      expect(res.status).toBe(200);
      expect(res.body.sessions).toEqual([]);
    });

    it('should return 404 when room does not exist', async () => {
      prismaMock.room.findUnique.mockResolvedValueOnce(null);

      const res = await request(app)
        .get('/api/rooms/nonexistent-room/sessions');

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Room not found');
    });
  });

  // ─── PATCH /api/sessions/:id/status ─────────────────────────────────────
  describe('PATCH /api/sessions/:id/status', () => {
    it('should allow director to update session status to paused', async () => {
      const { tokens, user } = createAccessToken({
        id: 'director-user-id',
        role: 'director',
      });

      const session = createMockSession({ id: 'update-session' });
      const room = createMockRoom({ directorId: user.id });
      const updatedSession = { ...session, status: 'paused' };

      prismaMock.gameSession.findUnique.mockResolvedValueOnce(session);
      prismaMock.room.findUnique.mockResolvedValueOnce(room);
      prismaMock.gameSession.update.mockResolvedValueOnce(updatedSession);

      const res = await request(app)
        .patch('/api/sessions/update-session/status')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({ status: 'paused' });

      expect(res.status).toBe(200);
      expect(res.body.session.status).toBe('paused');
    });

    it('should allow director to end a session', async () => {
      const { tokens, user } = createAccessToken({
        id: 'director-user-id',
        role: 'director',
      });

      const session = createMockSession({ id: 'end-session' });
      const room = createMockRoom({ directorId: user.id });
      const updatedSession = {
        ...session,
        status: 'ended',
        endedAt: new Date(),
      };

      prismaMock.gameSession.findUnique.mockResolvedValueOnce(session);
      prismaMock.room.findUnique.mockResolvedValueOnce(room);
      prismaMock.gameSession.update.mockResolvedValueOnce(updatedSession);

      const res = await request(app)
        .patch('/api/sessions/end-session/status')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({ status: 'ended' });

      expect(res.status).toBe(200);
      expect(res.body.session.status).toBe('ended');
      expect(prismaMock.gameSession.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'ended' }),
        }),
      );
    });

    it('should return 403 when player tries to update session status', async () => {
      const { tokens } = createAccessToken({
        id: 'player-user-id',
        role: 'player',
      });

      const session = createMockSession({ id: 'forbidden-session' });
      const room = createMockRoom({ directorId: 'real-director-id' });

      prismaMock.gameSession.findUnique.mockResolvedValueOnce(session);
      prismaMock.room.findUnique.mockResolvedValueOnce(room);

      const res = await request(app)
        .patch('/api/sessions/forbidden-session/status')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({ status: 'paused' });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Only the director can update session status');
    });

    it('should return 404 when session does not exist', async () => {
      const { tokens } = createAccessToken({ id: 'some-user' });

      prismaMock.gameSession.findUnique.mockResolvedValueOnce(null);

      const res = await request(app)
        .patch('/api/sessions/nonexistent-session/status')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({ status: 'paused' });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Session not found');
    });

    it('should return 400 for invalid status value', async () => {
      const { tokens } = createAccessToken({ id: 'some-user' });

      const res = await request(app)
        .patch('/api/sessions/some-session/status')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({ status: 'invalid_status' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Invalid status');
    });

    it('should return 400 when status is missing', async () => {
      const { tokens } = createAccessToken({ id: 'some-user' });

      const res = await request(app)
        .patch('/api/sessions/some-session/status')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Invalid status');
    });

    it('should return 401 without authentication', async () => {
      const res = await request(app)
        .patch('/api/sessions/some-session/status')
        .send({ status: 'paused' });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('No token provided');
    });
  });
});
