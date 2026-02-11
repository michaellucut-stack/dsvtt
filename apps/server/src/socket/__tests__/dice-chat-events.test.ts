import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';
import http from 'node:http';
import { Server as SocketIOServer } from 'socket.io';
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client';
import jwt from 'jsonwebtoken';
import type { AddressInfo } from 'node:net';
import { testAuthConfig } from '../../test-utils/setup.js';

// =============================================================================
// Helpers
// =============================================================================

const JWT_SECRET = testAuthConfig.jwtSecret;

/** Generate a signed JWT for socket auth. */
function signTestToken(payload: Record<string, unknown> = {}) {
  return jwt.sign(
    {
      sub: 'test-user-id',
      email: 'test@example.com',
      role: 'player',
      ...payload,
    },
    JWT_SECRET,
    { expiresIn: '15m' },
  );
}

// =============================================================================
// Socket.IO server factory with dice/chat/turn events
// =============================================================================

function createTestServer() {
  const httpServer = http.createServer();

  const io = new SocketIOServer(httpServer, {
    cors: { origin: '*' },
  });

  // ── Auth middleware ────────────────────────────────────────────────────
  io.use((socket: any, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) {
      next(new Error('Authentication required'));
      return;
    }
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as Record<string, unknown>;
      socket.data.user = decoded;
      next();
    } catch {
      next(new Error('Invalid or expired token'));
    }
  });

  // In-memory turn state for testing
  const turnStates = new Map<
    string,
    {
      order: { userId: string; initiative: number }[];
      currentIndex: number;
      roundNumber: number;
    }
  >();

  // ── Connection handler ────────────────────────────────────────────────
  io.on('connection', (socket: any) => {
    const user = socket.data.user;

    // ROOM_JOIN
    socket.on('ROOM_JOIN', (payload: { roomId: string }, callback?: (ack: any) => void) => {
      socket.join(payload.roomId);
      if (typeof callback === 'function') callback({ ok: true });
    });

    // DICE_ROLL — broadcast to room
    socket.on('DICE_ROLL', (payload: { sessionId: string; formula: string }) => {
      const { evaluateDice } = require('@dsvtt/dice-engine');
      let result;
      try {
        result = evaluateDice(payload.formula);
      } catch {
        socket.emit('ERROR', { message: 'Invalid dice formula' });
        return;
      }

      const diceResult = {
        rollId: `roll-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        sessionId: payload.sessionId,
        playerId: user.sub,
        playerName: user.email,
        formula: result.formula,
        results: result.rolls.map((r: any) => ({
          sides: r.sides,
          result: r.result,
          dropped: r.dropped,
          exploded: r.exploded,
        })),
        total: result.total,
      };

      // Broadcast to all rooms the user is in (sessionId as room)
      io.to(payload.sessionId).emit('DICE_RESULT', diceResult);
    });

    // DICE_ROLL_PRIVATE — only to roller + director
    socket.on('DICE_ROLL_PRIVATE', (payload: { sessionId: string; formula: string }) => {
      const { evaluateDice } = require('@dsvtt/dice-engine');
      let result;
      try {
        result = evaluateDice(payload.formula);
      } catch {
        socket.emit('ERROR', { message: 'Invalid dice formula' });
        return;
      }

      const diceResult = {
        rollId: `roll-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        sessionId: payload.sessionId,
        playerId: user.sub,
        playerName: user.email,
        formula: result.formula,
        results: result.rolls.map((r: any) => ({
          sides: r.sides,
          result: r.result,
          dropped: r.dropped,
          exploded: r.exploded,
        })),
        total: result.total,
      };

      // Only send to roller (this socket) — directors would also get it
      // via a separate mechanism, but for testing we emit to the roller
      socket.emit('DICE_RESULT_PRIVATE', diceResult);

      // Also emit to all sockets in the room that are directors
      const room = io.sockets.adapter.rooms.get(payload.sessionId);
      if (room) {
        for (const socketId of room) {
          const memberSocket = io.sockets.sockets.get(socketId) as any;
          if (memberSocket && memberSocket.data.user?.role === 'director' && memberSocket.id !== socket.id) {
            memberSocket.emit('DICE_RESULT_PRIVATE', diceResult);
          }
        }
      }
    });

    // CHAT_MESSAGE — broadcast to room
    socket.on('CHAT_MESSAGE', (payload: { sessionId: string; channel: string; content: string }) => {
      const chatMessage = {
        messageId: `msg-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        sessionId: payload.sessionId,
        senderId: user.sub,
        senderName: user.email,
        channel: payload.channel,
        content: payload.content,
        timestamp: new Date().toISOString(),
      };

      io.to(payload.sessionId).emit('CHAT_MESSAGE_BROADCAST', chatMessage);
    });

    // CHAT_WHISPER — only to sender + recipient + directors
    socket.on('CHAT_WHISPER', (payload: { sessionId: string; recipientId: string; content: string }) => {
      const whisperMessage = {
        messageId: `msg-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        sessionId: payload.sessionId,
        senderId: user.sub,
        senderName: user.email,
        content: payload.content,
        timestamp: new Date().toISOString(),
      };

      // Send to sender
      socket.emit('CHAT_WHISPER_RECEIVED', whisperMessage);

      // Send to recipient and directors in the room
      const room = io.sockets.adapter.rooms.get(payload.sessionId);
      if (room) {
        for (const socketId of room) {
          const memberSocket = io.sockets.sockets.get(socketId) as any;
          if (memberSocket && memberSocket.id !== socket.id) {
            const memberUser = memberSocket.data.user;
            if (
              memberUser?.sub === payload.recipientId ||
              memberUser?.role === 'director'
            ) {
              memberSocket.emit('CHAT_WHISPER_RECEIVED', whisperMessage);
            }
          }
        }
      }
    });

    // TURN_SET_ORDER (via socket) — broadcast to room
    socket.on('TURN_SET_ORDER', (payload: {
      sessionId: string;
      order: { userId: string; initiative: number }[];
    }) => {
      const sorted = [...payload.order].sort((a, b) => b.initiative - a.initiative);
      const state = {
        order: sorted,
        currentIndex: 0,
        roundNumber: 1,
      };
      turnStates.set(payload.sessionId, state);

      io.to(payload.sessionId).emit('TURN_ORDER_UPDATED', {
        sessionId: payload.sessionId,
        order: sorted,
        roundNumber: 1,
      });
    });

    // TURN_END — advance and broadcast
    socket.on('TURN_END', (payload: { sessionId: string }) => {
      const state = turnStates.get(payload.sessionId);
      if (!state) return;

      state.currentIndex += 1;
      if (state.currentIndex >= state.order.length) {
        state.currentIndex = 0;
        state.roundNumber += 1;
      }

      io.to(payload.sessionId).emit('TURN_CHANGED', {
        sessionId: payload.sessionId,
        currentPlayerId: state.order[state.currentIndex]!.userId,
        roundNumber: state.roundNumber,
      });
    });

    socket.on('disconnect', () => {});
  });

  return { httpServer, io };
}

/** Create a connected client socket. */
function createClient(port: number, token?: string): ClientSocket {
  return ioClient(`http://localhost:${port}`, {
    autoConnect: false,
    auth: token ? { token } : undefined,
    transports: ['websocket'],
    forceNew: true,
  });
}

/** Wait for a socket event with timeout. */
function waitForEvent<T>(socket: ClientSocket, event: string, timeoutMs = 3000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Timeout waiting for event "${event}"`)),
      timeoutMs,
    );
    socket.once(event as any, (data: T) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

/** Connect a client and wait for the 'connect' event. */
async function connectClient(client: ClientSocket): Promise<void> {
  return new Promise<void>((resolve) => {
    client.on('connect', () => resolve());
    client.connect();
  });
}

// =============================================================================
// Test Suite
// =============================================================================

describe('Socket.IO Dice/Chat/Turn Events', () => {
  let httpServer: http.Server;
  let io: SocketIOServer;
  let port: number;
  const clients: ClientSocket[] = [];

  beforeAll(
    () =>
      new Promise<void>((resolve) => {
        const server = createTestServer();
        httpServer = server.httpServer;
        io = server.io;
        httpServer.listen(0, () => {
          port = (httpServer.address() as AddressInfo).port;
          resolve();
        });
      }),
  );

  afterEach(() => {
    for (const client of clients) {
      if (client.connected) client.disconnect();
    }
    clients.length = 0;
  });

  afterAll(
    () =>
      new Promise<void>((resolve) => {
        io.close(() => {
          httpServer.close(() => resolve());
        });
      }),
  );

  // ─── DICE_ROLL ────────────────────────────────────────────────────────────

  describe('DICE_ROLL', () => {
    it('should broadcast dice result to all clients in the room', async () => {
      const roomId = 'dice-room-1';
      const token1 = signTestToken({ sub: 'roller-1', email: 'roller@example.com' });
      const token2 = signTestToken({ sub: 'observer-1', email: 'observer@example.com' });

      const client1 = createClient(port, token1);
      const client2 = createClient(port, token2);
      clients.push(client1, client2);

      await Promise.all([connectClient(client1), connectClient(client2)]);

      // Both join the same room
      await Promise.all([
        new Promise<void>((r) => client1.emit('ROOM_JOIN', { roomId }, () => r())),
        new Promise<void>((r) => client2.emit('ROOM_JOIN', { roomId }, () => r())),
      ]);
      await new Promise((r) => setTimeout(r, 100));

      // Set up listeners
      const result1Promise = waitForEvent<any>(client1, 'DICE_RESULT');
      const result2Promise = waitForEvent<any>(client2, 'DICE_RESULT');

      // Client1 rolls dice
      client1.emit('DICE_ROLL', { sessionId: roomId, formula: '2d6+3' });

      const [result1, result2] = await Promise.all([result1Promise, result2Promise]);

      // Both should receive the result
      expect(result1.formula).toBe('2d6+3');
      expect(result1.playerId).toBe('roller-1');
      expect(typeof result1.total).toBe('number');
      expect(Array.isArray(result1.results)).toBe(true);

      expect(result2.formula).toBe('2d6+3');
      expect(result2.playerId).toBe('roller-1');
      expect(result2.total).toBe(result1.total);
    });

    it('should not broadcast to clients in other rooms', async () => {
      const token1 = signTestToken({ sub: 'roller-2' });
      const token2 = signTestToken({ sub: 'other-room-user' });

      const client1 = createClient(port, token1);
      const client2 = createClient(port, token2);
      clients.push(client1, client2);

      await Promise.all([connectClient(client1), connectClient(client2)]);

      // Join different rooms
      await new Promise<void>((r) => client1.emit('ROOM_JOIN', { roomId: 'room-a' }, () => r()));
      await new Promise<void>((r) => client2.emit('ROOM_JOIN', { roomId: 'room-b' }, () => r()));
      await new Promise((r) => setTimeout(r, 100));

      let client2Received = false;
      client2.on('DICE_RESULT', () => {
        client2Received = true;
      });

      const result1Promise = waitForEvent<any>(client1, 'DICE_RESULT');
      client1.emit('DICE_ROLL', { sessionId: 'room-a', formula: '1d20' });
      await result1Promise;

      await new Promise((r) => setTimeout(r, 200));
      expect(client2Received).toBe(false);
    });
  });

  // ─── DICE_ROLL_PRIVATE ───────────────────────────────────────────────────

  describe('DICE_ROLL_PRIVATE', () => {
    it('should send private roll only to roller and director', async () => {
      const roomId = 'private-dice-room';
      const tokenRoller = signTestToken({ sub: 'roller-priv', role: 'player', email: 'roller@test.com' });
      const tokenDirector = signTestToken({ sub: 'director-priv', role: 'director', email: 'dir@test.com' });
      const tokenObserver = signTestToken({ sub: 'observer-priv', role: 'player', email: 'obs@test.com' });

      const roller = createClient(port, tokenRoller);
      const director = createClient(port, tokenDirector);
      const observer = createClient(port, tokenObserver);
      clients.push(roller, director, observer);

      await Promise.all([
        connectClient(roller),
        connectClient(director),
        connectClient(observer),
      ]);

      // All join the same room
      await Promise.all([
        new Promise<void>((r) => roller.emit('ROOM_JOIN', { roomId }, () => r())),
        new Promise<void>((r) => director.emit('ROOM_JOIN', { roomId }, () => r())),
        new Promise<void>((r) => observer.emit('ROOM_JOIN', { roomId }, () => r())),
      ]);
      await new Promise((r) => setTimeout(r, 100));

      // Track who receives the event
      let observerReceived = false;
      observer.on('DICE_RESULT_PRIVATE', () => {
        observerReceived = true;
      });

      const rollerResult = waitForEvent<any>(roller, 'DICE_RESULT_PRIVATE');
      const directorResult = waitForEvent<any>(director, 'DICE_RESULT_PRIVATE');

      // Roller makes a private roll
      roller.emit('DICE_ROLL_PRIVATE', { sessionId: roomId, formula: '1d20' });

      const [rollerData, directorData] = await Promise.all([rollerResult, directorResult]);

      // Roller and director should receive it
      expect(rollerData.playerId).toBe('roller-priv');
      expect(typeof rollerData.total).toBe('number');
      expect(directorData.playerId).toBe('roller-priv');
      expect(directorData.total).toBe(rollerData.total);

      // Observer should NOT receive it
      await new Promise((r) => setTimeout(r, 300));
      expect(observerReceived).toBe(false);
    });
  });

  // ─── CHAT_MESSAGE ─────────────────────────────────────────────────────────

  describe('CHAT_MESSAGE', () => {
    it('should broadcast chat message to all clients in the room', async () => {
      const roomId = 'chat-room-1';
      const token1 = signTestToken({ sub: 'sender-1', email: 'sender@test.com' });
      const token2 = signTestToken({ sub: 'receiver-1', email: 'receiver@test.com' });

      const client1 = createClient(port, token1);
      const client2 = createClient(port, token2);
      clients.push(client1, client2);

      await Promise.all([connectClient(client1), connectClient(client2)]);

      await Promise.all([
        new Promise<void>((r) => client1.emit('ROOM_JOIN', { roomId }, () => r())),
        new Promise<void>((r) => client2.emit('ROOM_JOIN', { roomId }, () => r())),
      ]);
      await new Promise((r) => setTimeout(r, 100));

      const msg1Promise = waitForEvent<any>(client1, 'CHAT_MESSAGE_BROADCAST');
      const msg2Promise = waitForEvent<any>(client2, 'CHAT_MESSAGE_BROADCAST');

      client1.emit('CHAT_MESSAGE', {
        sessionId: roomId,
        channel: 'ooc',
        content: 'Hello everyone!',
      });

      const [msg1, msg2] = await Promise.all([msg1Promise, msg2Promise]);

      expect(msg1.content).toBe('Hello everyone!');
      expect(msg1.channel).toBe('ooc');
      expect(msg1.senderId).toBe('sender-1');

      expect(msg2.content).toBe('Hello everyone!');
      expect(msg2.senderId).toBe('sender-1');
    });
  });

  // ─── CHAT_WHISPER ─────────────────────────────────────────────────────────

  describe('CHAT_WHISPER', () => {
    it('should send whisper only to sender, recipient, and director', async () => {
      const roomId = 'whisper-room';
      const tokenSender = signTestToken({ sub: 'whisper-sender', role: 'player', email: 's@test.com' });
      const tokenRecipient = signTestToken({ sub: 'whisper-recipient', role: 'player', email: 'r@test.com' });
      const tokenDirector = signTestToken({ sub: 'whisper-director', role: 'director', email: 'd@test.com' });
      const tokenBystander = signTestToken({ sub: 'whisper-bystander', role: 'player', email: 'b@test.com' });

      const sender = createClient(port, tokenSender);
      const recipient = createClient(port, tokenRecipient);
      const director = createClient(port, tokenDirector);
      const bystander = createClient(port, tokenBystander);
      clients.push(sender, recipient, director, bystander);

      await Promise.all([
        connectClient(sender),
        connectClient(recipient),
        connectClient(director),
        connectClient(bystander),
      ]);

      await Promise.all([
        new Promise<void>((r) => sender.emit('ROOM_JOIN', { roomId }, () => r())),
        new Promise<void>((r) => recipient.emit('ROOM_JOIN', { roomId }, () => r())),
        new Promise<void>((r) => director.emit('ROOM_JOIN', { roomId }, () => r())),
        new Promise<void>((r) => bystander.emit('ROOM_JOIN', { roomId }, () => r())),
      ]);
      await new Promise((r) => setTimeout(r, 100));

      let bystanderReceived = false;
      bystander.on('CHAT_WHISPER_RECEIVED', () => {
        bystanderReceived = true;
      });

      const senderResult = waitForEvent<any>(sender, 'CHAT_WHISPER_RECEIVED');
      const recipientResult = waitForEvent<any>(recipient, 'CHAT_WHISPER_RECEIVED');
      const directorResult = waitForEvent<any>(director, 'CHAT_WHISPER_RECEIVED');

      sender.emit('CHAT_WHISPER', {
        sessionId: roomId,
        recipientId: 'whisper-recipient',
        content: 'Psst, secret message',
      });

      const [senderData, recipientData, directorData] = await Promise.all([
        senderResult,
        recipientResult,
        directorResult,
      ]);

      // Sender, recipient, and director should receive it
      expect(senderData.content).toBe('Psst, secret message');
      expect(senderData.senderId).toBe('whisper-sender');

      expect(recipientData.content).toBe('Psst, secret message');
      expect(directorData.content).toBe('Psst, secret message');

      // Bystander should NOT receive it
      await new Promise((r) => setTimeout(r, 300));
      expect(bystanderReceived).toBe(false);
    });
  });

  // ─── TURN_SET_ORDER ───────────────────────────────────────────────────────

  describe('TURN_SET_ORDER', () => {
    it('should broadcast turn order to all clients in the room', async () => {
      const roomId = 'turn-room-1';
      const token1 = signTestToken({ sub: 'director-turn', role: 'director' });
      const token2 = signTestToken({ sub: 'player-turn', role: 'player' });

      const client1 = createClient(port, token1);
      const client2 = createClient(port, token2);
      clients.push(client1, client2);

      await Promise.all([connectClient(client1), connectClient(client2)]);

      await Promise.all([
        new Promise<void>((r) => client1.emit('ROOM_JOIN', { roomId }, () => r())),
        new Promise<void>((r) => client2.emit('ROOM_JOIN', { roomId }, () => r())),
      ]);
      await new Promise((r) => setTimeout(r, 100));

      const order1Promise = waitForEvent<any>(client1, 'TURN_ORDER_UPDATED');
      const order2Promise = waitForEvent<any>(client2, 'TURN_ORDER_UPDATED');

      client1.emit('TURN_SET_ORDER', {
        sessionId: roomId,
        order: [
          { userId: 'player-a', initiative: 18 },
          { userId: 'player-b', initiative: 12 },
        ],
      });

      const [order1, order2] = await Promise.all([order1Promise, order2Promise]);

      expect(order1.sessionId).toBe(roomId);
      expect(order1.order).toHaveLength(2);
      expect(order1.order[0].userId).toBe('player-a'); // highest initiative first
      expect(order1.roundNumber).toBe(1);

      expect(order2.order).toHaveLength(2);
      expect(order2.order[0].userId).toBe('player-a');
    });
  });

  // ─── TURN_END → TURN_CHANGED ─────────────────────────────────────────────

  describe('TURN_END -> TURN_CHANGED', () => {
    it('should broadcast TURN_CHANGED when turn ends', async () => {
      const roomId = 'turn-change-room';
      const token1 = signTestToken({ sub: 'director-tc', role: 'director' });
      const token2 = signTestToken({ sub: 'player-tc', role: 'player' });

      const client1 = createClient(port, token1);
      const client2 = createClient(port, token2);
      clients.push(client1, client2);

      await Promise.all([connectClient(client1), connectClient(client2)]);

      await Promise.all([
        new Promise<void>((r) => client1.emit('ROOM_JOIN', { roomId }, () => r())),
        new Promise<void>((r) => client2.emit('ROOM_JOIN', { roomId }, () => r())),
      ]);
      await new Promise((r) => setTimeout(r, 100));

      // First set the turn order
      const orderPromise = waitForEvent<any>(client1, 'TURN_ORDER_UPDATED');
      client1.emit('TURN_SET_ORDER', {
        sessionId: roomId,
        order: [
          { userId: 'player-x', initiative: 20 },
          { userId: 'player-y', initiative: 10 },
        ],
      });
      await orderPromise;

      // Now end the turn
      const changed1Promise = waitForEvent<any>(client1, 'TURN_CHANGED');
      const changed2Promise = waitForEvent<any>(client2, 'TURN_CHANGED');

      client1.emit('TURN_END', { sessionId: roomId });

      const [changed1, changed2] = await Promise.all([changed1Promise, changed2Promise]);

      expect(changed1.sessionId).toBe(roomId);
      expect(changed1.currentPlayerId).toBe('player-y');
      expect(changed1.roundNumber).toBe(1);

      expect(changed2.currentPlayerId).toBe('player-y');
    });
  });
});
