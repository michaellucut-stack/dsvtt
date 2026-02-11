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
import { MAX_CHAT_MESSAGE_LENGTH } from '@dsvtt/shared';

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

/** Create a mock chat message record. */
function createMockChatMessage(overrides: Record<string, unknown> = {}) {
  return {
    id: 'msg-id-1',
    sessionId: 'session-id-1',
    senderId: 'test-user-id-1',
    senderName: 'Test User',
    channel: 'ooc',
    content: 'Hello, world!',
    recipientId: null,
    timestamp: new Date('2025-06-01T12:00:00Z'),
    ...overrides,
  };
}

// =============================================================================
// App builder
// =============================================================================

async function buildChatApp(): Promise<Express> {
  const app = createTestApp();
  const { Router } = await import('express');
  const { chatMessageSchema, chatWhisperSchema } = await import('@dsvtt/events');
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

  // ── POST /api/chat/message ──────────────────────────────────────────────
  router.post('/message', authenticate, async (req: any, res: any) => {
    try {
      const { channel } = req.body;

      // If whisper, validate differently
      if (channel === 'whisper') {
        const parsed = chatWhisperSchema.safeParse({
          sessionId: req.body.sessionId,
          recipientId: req.body.recipientId,
          content: req.body.content,
        });

        if (!parsed.success) {
          // Check specifically for missing recipientId
          const recipientIssue = parsed.error.issues.find(
            (i: any) => i.path.includes('recipientId'),
          );
          if (recipientIssue || !req.body.recipientId) {
            res.status(400).json({ error: 'recipientId is required for whisper messages' });
            return;
          }
          res.status(400).json({
            error: 'Validation failed',
            details: parsed.error.issues,
          });
          return;
        }

        const message = {
          id: `msg-${Date.now()}`,
          sessionId: parsed.data.sessionId,
          senderId: req.user.sub,
          senderName: req.user.email,
          channel: 'whisper',
          content: parsed.data.content,
          recipientId: parsed.data.recipientId,
          timestamp: new Date(),
        };

        if ((prismaMock as any).chatMessage) {
          await (prismaMock as any).chatMessage.create({ data: message });
        }

        res.status(200).json({ message });
        return;
      }

      // Regular IC/OOC/system message
      const parsed = chatMessageSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          error: 'Validation failed',
          details: parsed.error.issues,
        });
        return;
      }

      const message = {
        id: `msg-${Date.now()}`,
        sessionId: parsed.data.sessionId,
        senderId: req.user.sub,
        senderName: req.user.email,
        channel: parsed.data.channel,
        content: parsed.data.content,
        recipientId: null,
        timestamp: new Date(),
      };

      if ((prismaMock as any).chatMessage) {
        await (prismaMock as any).chatMessage.create({ data: message });
      }

      res.status(200).json({ message });
    } catch {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ── GET /api/chat/history ───────────────────────────────────────────────
  router.get('/history', authenticate, async (req: any, res: any) => {
    try {
      const sessionId = req.query.sessionId as string;
      const channel = req.query.channel as string | undefined;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;

      if (!sessionId) {
        res.status(400).json({ error: 'sessionId is required' });
        return;
      }

      const where: Record<string, unknown> = { sessionId };
      if (channel) {
        where.channel = channel;
      }

      const messages = (prismaMock as any).chatMessage
        ? await (prismaMock as any).chatMessage.findMany({
            where,
            skip: (page - 1) * limit,
            take: limit,
            orderBy: { timestamp: 'desc' },
          })
        : [];

      res.status(200).json({ messages, page, limit });
    } catch {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.use('/api/chat', router);
  return app;
}

// =============================================================================
// Mock for chatMessage model
// =============================================================================

(prismaMock as any).chatMessage = {
  findMany: vi.fn(),
  create: vi.fn(),
  count: vi.fn(),
};

// =============================================================================
// Test Suite
// =============================================================================

describe('Chat API', () => {
  let app: Express;

  beforeAll(async () => {
    app = await buildChatApp();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── POST /api/chat/message ───────────────────────────────────────────────

  describe('POST /api/chat/message', () => {
    it('should send an in-character (IC) message successfully', async () => {
      const { tokens } = createAccessToken();
      (prismaMock as any).chatMessage.create.mockResolvedValueOnce({});

      const res = await request(app)
        .post('/api/chat/message')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({
          sessionId: '550e8400-e29b-41d4-a716-446655440000',
          channel: 'ic',
          content: 'I draw my sword!',
        });

      expect(res.status).toBe(200);
      expect(res.body.message).toBeDefined();
      expect(res.body.message.channel).toBe('ic');
      expect(res.body.message.content).toBe('I draw my sword!');
    });

    it('should send an out-of-character (OOC) message successfully', async () => {
      const { tokens } = createAccessToken();
      (prismaMock as any).chatMessage.create.mockResolvedValueOnce({});

      const res = await request(app)
        .post('/api/chat/message')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({
          sessionId: '550e8400-e29b-41d4-a716-446655440000',
          channel: 'ooc',
          content: 'brb getting snacks',
        });

      expect(res.status).toBe(200);
      expect(res.body.message.channel).toBe('ooc');
      expect(res.body.message.content).toBe('brb getting snacks');
    });

    it('should send a whisper with a valid recipientId', async () => {
      const { tokens } = createAccessToken();
      (prismaMock as any).chatMessage.create.mockResolvedValueOnce({});

      const res = await request(app)
        .post('/api/chat/message')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({
          sessionId: '550e8400-e29b-41d4-a716-446655440000',
          channel: 'whisper',
          recipientId: '660e8400-e29b-41d4-a716-446655440001',
          content: 'Secret message',
        });

      expect(res.status).toBe(200);
      expect(res.body.message.channel).toBe('whisper');
      expect(res.body.message.recipientId).toBe('660e8400-e29b-41d4-a716-446655440001');
      expect(res.body.message.content).toBe('Secret message');
    });

    it('should return 400 for whisper without recipientId', async () => {
      const { tokens } = createAccessToken();

      const res = await request(app)
        .post('/api/chat/message')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({
          sessionId: '550e8400-e29b-41d4-a716-446655440000',
          channel: 'whisper',
          content: 'Secret without recipient',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('recipientId');
    });

    it('should return 400 for a message that is too long', async () => {
      const { tokens } = createAccessToken();
      const longContent = 'A'.repeat(MAX_CHAT_MESSAGE_LENGTH + 1);

      const res = await request(app)
        .post('/api/chat/message')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({
          sessionId: '550e8400-e29b-41d4-a716-446655440000',
          channel: 'ooc',
          content: longContent,
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation failed');
    });

    it('should return 400 for an empty message', async () => {
      const { tokens } = createAccessToken();

      const res = await request(app)
        .post('/api/chat/message')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({
          sessionId: '550e8400-e29b-41d4-a716-446655440000',
          channel: 'ooc',
          content: '',
        });

      expect(res.status).toBe(400);
    });

    it('should return 400 when sessionId is missing', async () => {
      const { tokens } = createAccessToken();

      const res = await request(app)
        .post('/api/chat/message')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({
          channel: 'ooc',
          content: 'No session',
        });

      expect(res.status).toBe(400);
    });

    it('should return 400 for invalid channel', async () => {
      const { tokens } = createAccessToken();

      const res = await request(app)
        .post('/api/chat/message')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({
          sessionId: '550e8400-e29b-41d4-a716-446655440000',
          channel: 'invalid_channel',
          content: 'Bad channel',
        });

      expect(res.status).toBe(400);
    });

    it('should return 401 without authentication', async () => {
      const res = await request(app)
        .post('/api/chat/message')
        .send({
          sessionId: '550e8400-e29b-41d4-a716-446655440000',
          channel: 'ooc',
          content: 'Unauthenticated message',
        });

      expect(res.status).toBe(401);
    });

    it('should include senderId from auth token', async () => {
      const { tokens, user } = createAccessToken({ id: 'sender-user-42' });
      (prismaMock as any).chatMessage.create.mockResolvedValueOnce({});

      const res = await request(app)
        .post('/api/chat/message')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({
          sessionId: '550e8400-e29b-41d4-a716-446655440000',
          channel: 'ooc',
          content: 'Check sender ID',
        });

      expect(res.status).toBe(200);
      expect(res.body.message.senderId).toBe('sender-user-42');
    });
  });

  // ─── GET /api/chat/history ────────────────────────────────────────────────

  describe('GET /api/chat/history', () => {
    it('should return chat messages for a session', async () => {
      const { tokens } = createAccessToken();
      const mockMessages = [
        createMockChatMessage({ id: 'msg-1', content: 'Hello', channel: 'ooc' }),
        createMockChatMessage({ id: 'msg-2', content: 'Hi there', channel: 'ic' }),
      ];

      (prismaMock as any).chatMessage.findMany.mockResolvedValueOnce(mockMessages);

      const res = await request(app)
        .get('/api/chat/history')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .query({ sessionId: 'session-id-1' });

      expect(res.status).toBe(200);
      expect(res.body.messages).toHaveLength(2);
      expect(res.body.page).toBe(1);
      expect(res.body.limit).toBe(50);
    });

    it('should filter messages by channel', async () => {
      const { tokens } = createAccessToken();
      const icMessages = [
        createMockChatMessage({ id: 'msg-ic-1', channel: 'ic', content: 'In character!' }),
      ];

      (prismaMock as any).chatMessage.findMany.mockResolvedValueOnce(icMessages);

      const res = await request(app)
        .get('/api/chat/history')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .query({ sessionId: 'session-id-1', channel: 'ic' });

      expect(res.status).toBe(200);
      expect(res.body.messages).toHaveLength(1);
      expect((prismaMock as any).chatMessage.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { sessionId: 'session-id-1', channel: 'ic' },
        }),
      );
    });

    it('should support pagination', async () => {
      const { tokens } = createAccessToken();
      (prismaMock as any).chatMessage.findMany.mockResolvedValueOnce([]);

      const res = await request(app)
        .get('/api/chat/history')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .query({ sessionId: 'session-id-1', page: '3', limit: '10' });

      expect(res.status).toBe(200);
      expect(res.body.page).toBe(3);
      expect(res.body.limit).toBe(10);
      expect((prismaMock as any).chatMessage.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 20, // (3-1) * 10
          take: 10,
        }),
      );
    });

    it('should return empty array when no messages exist', async () => {
      const { tokens } = createAccessToken();
      (prismaMock as any).chatMessage.findMany.mockResolvedValueOnce([]);

      const res = await request(app)
        .get('/api/chat/history')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .query({ sessionId: 'session-id-1' });

      expect(res.status).toBe(200);
      expect(res.body.messages).toEqual([]);
    });

    it('should return 400 when sessionId is missing', async () => {
      const { tokens } = createAccessToken();

      const res = await request(app)
        .get('/api/chat/history')
        .set('Authorization', `Bearer ${tokens.accessToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('sessionId is required');
    });

    it('should return 401 without authentication', async () => {
      const res = await request(app)
        .get('/api/chat/history')
        .query({ sessionId: 'session-id-1' });

      expect(res.status).toBe(401);
    });
  });
});
