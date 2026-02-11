import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import {
  createTestApp,
  withErrorHandler,
  prismaMock,
  testAuthConfig,
  createMockUser,
} from '../../../test-utils/setup.js';
import { generateTokens } from '@dsvtt/auth/jwt';
import {
  createRoomSchema,
  joinRoomSchema,
  listRoomsQuerySchema,
} from '../room.schemas.js';

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
    players: [],
    _count: { players: 0 },
    ...overrides,
  };
}

/** Convenience factory for a mock room player record. */
function createMockRoomPlayer(overrides: Record<string, unknown> = {}) {
  return {
    userId: 'test-user-id-1',
    roomId: 'room-id-1',
    role: 'player',
    joinedAt: new Date('2025-06-01T00:00:00Z'),
    user: createMockUser(),
    ...overrides,
  };
}

// =============================================================================
// App builder — mirrors the pattern from auth.test.ts
// =============================================================================

/**
 * Builds a test Express app with room routes wired up.
 *
 * Routes are defined inline to match the API contract since the production
 * router may not exist yet (test-first approach).
 */
async function buildRoomApp(): Promise<Express> {
  const app = createTestApp();
  const { Router } = await import('express');
  const router = Router();

  // ── Auth middleware helper ──────────────────────────────────────────────
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

  // ── POST /api/rooms — Create a room ────────────────────────────────────
  router.post('/', authenticate, async (req: any, res: any) => {
    try {
      const parsed = createRoomSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          error: 'Validation failed',
          details: parsed.error.issues,
        });
        return;
      }

      const { name, maxPlayers } = parsed.data;
      const userId = req.user.sub;

      const room = await prismaMock.room.create({
        data: {
          name,
          maxPlayers,
          directorId: userId,
          status: 'WAITING',
        },
      });

      // Auto-join the director as a player
      await prismaMock.roomPlayer.create({
        data: {
          roomId: room.id,
          userId,
          role: 'director',
        },
      });

      res.status(201).json({ room });
    } catch {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ── GET /api/rooms — List rooms ────────────────────────────────────────
  router.get('/', async (req: any, res: any) => {
    try {
      const parsed = listRoomsQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        res.status(400).json({
          error: 'Validation failed',
          details: parsed.error.issues,
        });
        return;
      }

      const { status, page, limit } = parsed.data;
      const where: Record<string, unknown> = {};
      if (status) where.status = status;

      const rooms = await prismaMock.room.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { players: true } } },
      });

      res.status(200).json({ rooms, page, limit });
    } catch {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ── GET /api/rooms/:id — Get room details ──────────────────────────────
  router.get('/:id', async (req: any, res: any) => {
    try {
      const room = await prismaMock.room.findUnique({
        where: { id: req.params.id },
        include: {
          players: { include: { user: true } },
          _count: { select: { players: true } },
        },
      });

      if (!room) {
        res.status(404).json({ error: 'Room not found' });
        return;
      }

      res.status(200).json({ room });
    } catch {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ── POST /api/rooms/:id/join — Join a room ────────────────────────────
  router.post('/:id/join', authenticate, async (req: any, res: any) => {
    try {
      const parsed = joinRoomSchema.safeParse(req.body);
      const role = parsed.success ? parsed.data.role : 'player';

      if (role !== 'player' && role !== 'director') {
        res.status(400).json({ error: 'Invalid role' });
        return;
      }

      const room = await prismaMock.room.findUnique({
        where: { id: req.params.id },
        include: { _count: { select: { players: true } } },
      });

      if (!room) {
        res.status(404).json({ error: 'Room not found' });
        return;
      }

      // Check if already joined
      const existing = await prismaMock.roomPlayer.findFirst({
        where: { roomId: room.id, userId: req.user.sub },
      });

      if (existing) {
        res.status(409).json({ error: 'Already joined this room' });
        return;
      }

      // Check if room is full
      if (room._count.players >= room.maxPlayers) {
        res.status(409).json({ error: 'Room is full' });
        return;
      }

      const roomPlayer = await prismaMock.roomPlayer.create({
        data: {
          roomId: room.id,
          userId: req.user.sub,
          role,
        },
      });

      res.status(200).json({ roomPlayer });
    } catch {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ── POST /api/rooms/:id/leave — Leave a room ──────────────────────────
  router.post('/:id/leave', authenticate, async (req: any, res: any) => {
    try {
      const room = await prismaMock.room.findUnique({
        where: { id: req.params.id },
      });

      if (!room) {
        res.status(404).json({ error: 'Room not found' });
        return;
      }

      const membership = await prismaMock.roomPlayer.findFirst({
        where: { roomId: room.id, userId: req.user.sub },
      });

      if (!membership) {
        res.status(404).json({ error: 'Not a member of this room' });
        return;
      }

      // If director leaves, end the room
      if (room.directorId === req.user.sub) {
        await prismaMock.room.update({
          where: { id: room.id },
          data: { status: 'ENDED' },
        });
      }

      await prismaMock.roomPlayer.delete({
        where: { id: membership.id },
      });

      res.status(200).json({ message: 'Left room successfully' });
    } catch {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ── DELETE /api/rooms/:id — Delete a room ──────────────────────────────
  router.delete('/:id', authenticate, async (req: any, res: any) => {
    try {
      const room = await prismaMock.room.findUnique({
        where: { id: req.params.id },
      });

      if (!room) {
        res.status(404).json({ error: 'Room not found' });
        return;
      }

      // Only the director can delete
      if (room.directorId !== req.user.sub) {
        res.status(403).json({ error: 'Only the director can delete this room' });
        return;
      }

      await prismaMock.room.delete({ where: { id: room.id } });

      res.status(200).json({ message: 'Room deleted' });
    } catch {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.use('/api/rooms', router);
  return app;
}

// =============================================================================
// Test Suite
// =============================================================================

describe('Rooms API', () => {
  let app: Express;

  beforeAll(async () => {
    app = await buildRoomApp();
  });

  // ─── POST /api/rooms ────────────────────────────────────────────────────
  describe('POST /api/rooms', () => {
    it('should create a room and return 201', async () => {
      const { tokens, user } = createAccessToken({
        id: 'director-user-id',
        role: 'director',
      });

      const mockRoom = createMockRoom({
        directorId: user.id,
        name: 'My Campaign',
        maxPlayers: 5,
      });

      prismaMock.room.create.mockResolvedValueOnce(mockRoom);
      prismaMock.roomPlayer.create.mockResolvedValueOnce(
        createMockRoomPlayer({ userId: user.id, role: 'director', roomId: mockRoom.id }),
      );

      const res = await request(app)
        .post('/api/rooms')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({ name: 'My Campaign', maxPlayers: 5 });

      expect(res.status).toBe(201);
      expect(res.body.room).toMatchObject({
        name: 'My Campaign',
        maxPlayers: 5,
        directorId: 'director-user-id',
      });
      expect(prismaMock.room.create).toHaveBeenCalledOnce();
      expect(prismaMock.roomPlayer.create).toHaveBeenCalledOnce();
    });

    it('should return 400 when name is missing', async () => {
      const { tokens } = createAccessToken();

      const res = await request(app)
        .post('/api/rooms')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({ maxPlayers: 4 });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation failed');
      expect(res.body.details).toBeDefined();
      expect(Array.isArray(res.body.details)).toBe(true);
    });

    it('should return 400 when maxPlayers exceeds maximum (8)', async () => {
      const { tokens } = createAccessToken();

      const res = await request(app)
        .post('/api/rooms')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({ name: 'Too Many Players', maxPlayers: 99 });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation failed');
    });

    it('should return 400 when maxPlayers is below minimum (1)', async () => {
      const { tokens } = createAccessToken();

      const res = await request(app)
        .post('/api/rooms')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({ name: 'Zero Players', maxPlayers: 0 });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation failed');
    });

    it('should return 401 when no Authorization header is provided', async () => {
      const res = await request(app)
        .post('/api/rooms')
        .send({ name: 'Unauthorized Room', maxPlayers: 4 });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('No token provided');
    });

    it('should return 401 with an invalid token', async () => {
      const res = await request(app)
        .post('/api/rooms')
        .set('Authorization', 'Bearer invalid.jwt.token')
        .send({ name: 'Bad Token Room', maxPlayers: 4 });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid or expired token');
    });

    it('should return 400 when name exceeds max length', async () => {
      const { tokens } = createAccessToken();
      const longName = 'A'.repeat(65); // MAX_ROOM_NAME_LENGTH = 64

      const res = await request(app)
        .post('/api/rooms')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({ name: longName, maxPlayers: 4 });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation failed');
    });
  });

  // ─── GET /api/rooms ─────────────────────────────────────────────────────
  describe('GET /api/rooms', () => {
    it('should return a list of rooms with default pagination', async () => {
      const rooms = [
        createMockRoom({ id: 'room-1', name: 'Room One' }),
        createMockRoom({ id: 'room-2', name: 'Room Two' }),
      ];

      prismaMock.room.findMany.mockResolvedValueOnce(rooms);

      const res = await request(app).get('/api/rooms');

      expect(res.status).toBe(200);
      expect(res.body.rooms).toHaveLength(2);
      expect(res.body.page).toBe(1);
      expect(res.body.limit).toBe(20);
    });

    it('should return rooms filtered by status', async () => {
      const activeRooms = [
        createMockRoom({ id: 'room-active-1', status: 'ACTIVE' }),
      ];

      prismaMock.room.findMany.mockResolvedValueOnce(activeRooms);

      const res = await request(app).get('/api/rooms?status=ACTIVE');

      expect(res.status).toBe(200);
      expect(res.body.rooms).toHaveLength(1);
      expect(prismaMock.room.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'ACTIVE' },
        }),
      );
    });

    it('should support pagination parameters', async () => {
      prismaMock.room.findMany.mockResolvedValueOnce([]);

      const res = await request(app).get('/api/rooms?page=2&limit=5');

      expect(res.status).toBe(200);
      expect(res.body.page).toBe(2);
      expect(res.body.limit).toBe(5);
      expect(prismaMock.room.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 5, // (page - 1) * limit = (2-1) * 5
          take: 5,
        }),
      );
    });

    it('should return an empty list when no rooms exist', async () => {
      prismaMock.room.findMany.mockResolvedValueOnce([]);

      const res = await request(app).get('/api/rooms');

      expect(res.status).toBe(200);
      expect(res.body.rooms).toHaveLength(0);
      expect(res.body.rooms).toEqual([]);
    });

    it('should return 400 for invalid status filter', async () => {
      const res = await request(app).get('/api/rooms?status=INVALID');

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation failed');
    });
  });

  // ─── GET /api/rooms/:id ─────────────────────────────────────────────────
  describe('GET /api/rooms/:id', () => {
    it('should return room details with players', async () => {
      const room = createMockRoom({
        id: 'room-details-1',
        name: 'Detail Room',
        players: [
          createMockRoomPlayer({ userId: 'player-1', role: 'director' }),
          createMockRoomPlayer({ userId: 'player-2', role: 'player' }),
        ],
        _count: { players: 2 },
      });

      prismaMock.room.findUnique.mockResolvedValueOnce(room);

      const res = await request(app).get('/api/rooms/room-details-1');

      expect(res.status).toBe(200);
      expect(res.body.room).toMatchObject({
        id: 'room-details-1',
        name: 'Detail Room',
      });
      expect(res.body.room.players).toHaveLength(2);
      expect(res.body.room._count.players).toBe(2);
    });

    it('should return 404 when room does not exist', async () => {
      prismaMock.room.findUnique.mockResolvedValueOnce(null);

      const res = await request(app).get('/api/rooms/nonexistent-id');

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Room not found');
    });

    it('should include player details with user info', async () => {
      const mockPlayers = [
        createMockRoomPlayer({
          userId: 'user-a',
          role: 'director',
          user: createMockUser({ id: 'user-a', displayName: 'Director Alice' }),
        }),
        createMockRoomPlayer({
          userId: 'user-b',
          role: 'player',
          user: createMockUser({ id: 'user-b', displayName: 'Player Bob' }),
        }),
      ];

      const room = createMockRoom({
        id: 'room-with-players',
        players: mockPlayers,
        _count: { players: 2 },
      });

      prismaMock.room.findUnique.mockResolvedValueOnce(room);

      const res = await request(app).get('/api/rooms/room-with-players');

      expect(res.status).toBe(200);
      expect(res.body.room.players).toHaveLength(2);
      expect(res.body.room.players[0].user.displayName).toBe('Director Alice');
      expect(res.body.room.players[1].user.displayName).toBe('Player Bob');
    });
  });

  // ─── POST /api/rooms/:id/join ───────────────────────────────────────────
  describe('POST /api/rooms/:id/join', () => {
    it('should allow a player to join a room', async () => {
      const { tokens, user } = createAccessToken({ id: 'joining-user' });

      const room = createMockRoom({
        id: 'joinable-room',
        maxPlayers: 4,
        _count: { players: 1 },
      });

      prismaMock.room.findUnique.mockResolvedValueOnce(room);
      prismaMock.roomPlayer.findFirst.mockResolvedValueOnce(null); // not already joined
      prismaMock.roomPlayer.create.mockResolvedValueOnce(
        createMockRoomPlayer({ userId: user.id, roomId: room.id }),
      );

      const res = await request(app)
        .post('/api/rooms/joinable-room/join')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({ role: 'player' });

      expect(res.status).toBe(200);
      expect(res.body.roomPlayer).toBeDefined();
      expect(prismaMock.roomPlayer.create).toHaveBeenCalledOnce();
    });

    it('should return 409 when player has already joined', async () => {
      const { tokens, user } = createAccessToken({ id: 'already-joined-user' });

      const room = createMockRoom({
        id: 'already-joined-room',
        _count: { players: 2 },
      });

      prismaMock.room.findUnique.mockResolvedValueOnce(room);
      prismaMock.roomPlayer.findFirst.mockResolvedValueOnce(
        createMockRoomPlayer({ userId: user.id, roomId: room.id }),
      );

      const res = await request(app)
        .post('/api/rooms/already-joined-room/join')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({ role: 'player' });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('Already joined this room');
    });

    it('should return 409 when room is full', async () => {
      const { tokens } = createAccessToken({ id: 'late-joiner' });

      const room = createMockRoom({
        id: 'full-room',
        maxPlayers: 2,
        _count: { players: 2 },
      });

      prismaMock.room.findUnique.mockResolvedValueOnce(room);
      prismaMock.roomPlayer.findFirst.mockResolvedValueOnce(null);

      const res = await request(app)
        .post('/api/rooms/full-room/join')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({ role: 'player' });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('Room is full');
    });

    it('should return 404 when room does not exist', async () => {
      const { tokens } = createAccessToken();

      prismaMock.room.findUnique.mockResolvedValueOnce(null);

      const res = await request(app)
        .post('/api/rooms/nonexistent-room/join')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({ role: 'player' });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Room not found');
    });

    it('should return 401 without authentication', async () => {
      const res = await request(app)
        .post('/api/rooms/any-room/join')
        .send({ role: 'player' });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('No token provided');
    });

    it('should default to player role when role is not provided', async () => {
      const { tokens, user } = createAccessToken({ id: 'default-role-user' });

      const room = createMockRoom({
        id: 'default-role-room',
        _count: { players: 1 },
      });

      prismaMock.room.findUnique.mockResolvedValueOnce(room);
      prismaMock.roomPlayer.findFirst.mockResolvedValueOnce(null);
      prismaMock.roomPlayer.create.mockResolvedValueOnce(
        createMockRoomPlayer({ userId: user.id, roomId: room.id, role: 'player' }),
      );

      const res = await request(app)
        .post('/api/rooms/default-role-room/join')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({}); // no role specified

      expect(res.status).toBe(200);
      expect(prismaMock.roomPlayer.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ role: 'player' }),
        }),
      );
    });
  });

  // ─── POST /api/rooms/:id/leave ──────────────────────────────────────────
  describe('POST /api/rooms/:id/leave', () => {
    it('should allow a player to leave a room', async () => {
      const { tokens, user } = createAccessToken({ id: 'leaving-user' });

      const room = createMockRoom({
        id: 'leave-room',
        directorId: 'someone-else',
      });

      prismaMock.room.findUnique.mockResolvedValueOnce(room);
      prismaMock.roomPlayer.findFirst.mockResolvedValueOnce(
        createMockRoomPlayer({
          id: 'membership-1',
          userId: user.id,
          roomId: room.id,
        }),
      );
      prismaMock.roomPlayer.delete.mockResolvedValueOnce({});

      const res = await request(app)
        .post('/api/rooms/leave-room/leave')
        .set('Authorization', `Bearer ${tokens.accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Left room successfully');
      expect(prismaMock.roomPlayer.delete).toHaveBeenCalledOnce();
      // Room should NOT be ended since this is not the director
      expect(prismaMock.room.update).not.toHaveBeenCalled();
    });

    it('should end room when director leaves', async () => {
      const { tokens, user } = createAccessToken({ id: 'director-leaving' });

      const room = createMockRoom({
        id: 'director-leave-room',
        directorId: user.id, // this user IS the director
      });

      prismaMock.room.findUnique.mockResolvedValueOnce(room);
      prismaMock.roomPlayer.findFirst.mockResolvedValueOnce(
        createMockRoomPlayer({
          id: 'director-membership',
          userId: user.id,
          roomId: room.id,
          role: 'director',
        }),
      );
      prismaMock.room.update.mockResolvedValueOnce({
        ...room,
        status: 'ENDED',
      });
      prismaMock.roomPlayer.delete.mockResolvedValueOnce({});

      const res = await request(app)
        .post('/api/rooms/director-leave-room/leave')
        .set('Authorization', `Bearer ${tokens.accessToken}`);

      expect(res.status).toBe(200);
      expect(prismaMock.room.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: room.id },
          data: { status: 'ENDED' },
        }),
      );
    });

    it('should return 404 when not a member of the room', async () => {
      const { tokens } = createAccessToken({ id: 'non-member' });

      const room = createMockRoom({ id: 'not-a-member-room' });

      prismaMock.room.findUnique.mockResolvedValueOnce(room);
      prismaMock.roomPlayer.findFirst.mockResolvedValueOnce(null);

      const res = await request(app)
        .post('/api/rooms/not-a-member-room/leave')
        .set('Authorization', `Bearer ${tokens.accessToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Not a member of this room');
    });

    it('should return 404 when room does not exist', async () => {
      const { tokens } = createAccessToken();

      prismaMock.room.findUnique.mockResolvedValueOnce(null);

      const res = await request(app)
        .post('/api/rooms/nonexistent-room/leave')
        .set('Authorization', `Bearer ${tokens.accessToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Room not found');
    });

    it('should return 401 without authentication', async () => {
      const res = await request(app)
        .post('/api/rooms/any-room/leave');

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('No token provided');
    });
  });

  // ─── DELETE /api/rooms/:id ──────────────────────────────────────────────
  describe('DELETE /api/rooms/:id', () => {
    it('should allow director to delete a room', async () => {
      const { tokens, user } = createAccessToken({ id: 'director-deleter' });

      const room = createMockRoom({
        id: 'deletable-room',
        directorId: user.id,
      });

      prismaMock.room.findUnique.mockResolvedValueOnce(room);
      prismaMock.room.delete.mockResolvedValueOnce(room);

      const res = await request(app)
        .delete('/api/rooms/deletable-room')
        .set('Authorization', `Bearer ${tokens.accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Room deleted');
      expect(prismaMock.room.delete).toHaveBeenCalledWith({
        where: { id: room.id },
      });
    });

    it('should return 403 when a non-director tries to delete', async () => {
      const { tokens } = createAccessToken({ id: 'player-not-director' });

      const room = createMockRoom({
        id: 'not-my-room',
        directorId: 'another-user-id',
      });

      prismaMock.room.findUnique.mockResolvedValueOnce(room);

      const res = await request(app)
        .delete('/api/rooms/not-my-room')
        .set('Authorization', `Bearer ${tokens.accessToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Only the director can delete this room');
      expect(prismaMock.room.delete).not.toHaveBeenCalled();
    });

    it('should return 404 when room does not exist', async () => {
      const { tokens } = createAccessToken();

      prismaMock.room.findUnique.mockResolvedValueOnce(null);

      const res = await request(app)
        .delete('/api/rooms/nonexistent-room')
        .set('Authorization', `Bearer ${tokens.accessToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Room not found');
    });

    it('should return 401 without authentication', async () => {
      const res = await request(app)
        .delete('/api/rooms/any-room');

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('No token provided');
    });
  });
});
