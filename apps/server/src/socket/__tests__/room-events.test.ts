import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';
import http from 'node:http';
import { Server as SocketIOServer } from 'socket.io';
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client';
import jwt from 'jsonwebtoken';
import type { AddressInfo } from 'node:net';
import type { ClientToServerEvents, ServerToClientEvents } from '@dsvtt/events';
import { prismaMock, testAuthConfig } from '../../test-utils/setup.js';

// =============================================================================
// Helpers
// =============================================================================

/** JWT secret used by the Socket.IO auth middleware under test. */
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
// Socket.IO server factory
// =============================================================================

/** Typed server instance for tests. */
type TypedServer = SocketIOServer<ClientToServerEvents, ServerToClientEvents>;

/** Typed socket that carries user data. */
type TypedSocket = Parameters<Parameters<TypedServer['on']>[1]>[0] & {
  data: { user?: { sub: string; email: string; role: string } };
};

/**
 * Creates an in-memory HTTP + Socket.IO server for testing.
 * The server mirrors the auth middleware and room event handlers from
 * `socket/connection.ts`.
 */
function createTestServer() {
  const httpServer = http.createServer();

  const io = new SocketIOServer<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: { origin: '*' },
  });

  // ── Auth middleware ─────────────────────────────────────────────────────
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

  // ── Connection handler with room events ────────────────────────────────
  io.on('connection', (socket: any) => {
    const user = socket.data.user;

    // ROOM_JOIN: join the Socket.IO room and broadcast
    socket.on('ROOM_JOIN', (payload: { roomId: string }, callback?: (ack: { ok: boolean; error?: string }) => void) => {
      const { roomId } = payload;

      socket.join(roomId);

      // Broadcast ROOM_JOINED to all in the room
      io.to(roomId).emit('ROOM_JOINED', {
        roomId,
        userId: user.sub,
        displayName: user.email,
        role: user.role as 'player' | 'director',
      });

      if (typeof callback === 'function') {
        callback({ ok: true });
      }
    });

    // ROOM_LEAVE: leave the Socket.IO room and broadcast
    socket.on('ROOM_LEAVE', (payload: { roomId: string }) => {
      const { roomId } = payload;

      socket.leave(roomId);

      io.to(roomId).emit('ROOM_LEFT', {
        roomId,
        userId: user.sub,
      });
    });

    socket.on('disconnect', () => {
      // Cleanup handled by Socket.IO automatically
    });
  });

  return { httpServer, io };
}

/**
 * Create a connected client socket with optional auth token.
 */
function createClient(
  port: number,
  token?: string,
): ClientSocket {
  return ioClient(`http://localhost:${port}`, {
    autoConnect: false,
    auth: token ? { token } : undefined,
    transports: ['websocket'],
    forceNew: true,
  });
}

/** Wait for a socket event with a timeout. */
function waitForEvent<T>(
  socket: ClientSocket,
  event: string,
  timeoutMs = 3000,
): Promise<T> {
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

/** Wait for socket connection error. */
function waitForConnectError(
  socket: ClientSocket,
  timeoutMs = 3000,
): Promise<Error> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('Timeout waiting for connect_error')),
      timeoutMs,
    );

    socket.once('connect_error', (err: Error) => {
      clearTimeout(timer);
      resolve(err);
    });
  });
}

// =============================================================================
// Test Suite
// =============================================================================

describe('Socket.IO Room Events', () => {
  let httpServer: http.Server;
  let io: TypedServer;
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
    // Disconnect all clients between tests
    for (const client of clients) {
      if (client.connected) {
        client.disconnect();
      }
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

  // ─── Connection Auth ────────────────────────────────────────────────────
  describe('Connection Authentication', () => {
    it('should connect successfully with a valid JWT', async () => {
      const token = signTestToken();
      const client = createClient(port, token);
      clients.push(client);

      const connected = new Promise<void>((resolve) => {
        client.on('connect', () => resolve());
      });

      client.connect();
      await connected;

      expect(client.connected).toBe(true);
    });

    it('should reject connection without a JWT', async () => {
      const client = createClient(port); // no token
      clients.push(client);

      const errorPromise = waitForConnectError(client);
      client.connect();

      const err = await errorPromise;
      expect(err.message).toContain('Authentication required');
      expect(client.connected).toBe(false);
    });

    it('should reject connection with an invalid JWT', async () => {
      const client = createClient(port, 'invalid.token.here');
      clients.push(client);

      const errorPromise = waitForConnectError(client);
      client.connect();

      const err = await errorPromise;
      expect(err.message).toContain('Invalid or expired token');
      expect(client.connected).toBe(false);
    });

    it('should reject connection with an expired JWT', async () => {
      const expiredToken = jwt.sign(
        { sub: 'user-1', email: 'test@example.com', role: 'player' },
        JWT_SECRET,
        { expiresIn: '-1s' }, // already expired
      );

      const client = createClient(port, expiredToken);
      clients.push(client);

      const errorPromise = waitForConnectError(client);
      client.connect();

      const err = await errorPromise;
      expect(err.message).toContain('Invalid or expired token');
    });
  });

  // ─── ROOM_JOIN ──────────────────────────────────────────────────────────
  describe('ROOM_JOIN', () => {
    it('should join a room and receive ROOM_JOINED', async () => {
      const token = signTestToken({ sub: 'user-join-1' });
      const client = createClient(port, token);
      clients.push(client);

      await new Promise<void>((resolve) => {
        client.on('connect', () => resolve());
        client.connect();
      });

      const joinedPromise = waitForEvent<{
        roomId: string;
        userId: string;
        displayName: string;
        role: string;
      }>(client, 'ROOM_JOINED');

      client.emit('ROOM_JOIN', { roomId: 'test-room-1' }, (ack: any) => {
        expect(ack.ok).toBe(true);
      });

      const joined = await joinedPromise;
      expect(joined.roomId).toBe('test-room-1');
      expect(joined.userId).toBe('user-join-1');
    });

    it('should receive callback acknowledgement on join', async () => {
      const token = signTestToken({ sub: 'user-ack-1' });
      const client = createClient(port, token);
      clients.push(client);

      await new Promise<void>((resolve) => {
        client.on('connect', () => resolve());
        client.connect();
      });

      const ack = await new Promise<{ ok: boolean }>((resolve) => {
        client.emit('ROOM_JOIN', { roomId: 'ack-room' }, (response: any) => {
          resolve(response);
        });
      });

      expect(ack.ok).toBe(true);
    });
  });

  // ─── ROOM_LEAVE ─────────────────────────────────────────────────────────
  describe('ROOM_LEAVE', () => {
    it('should leave a room and others receive ROOM_LEFT', async () => {
      // Create two clients in the same room
      const token1 = signTestToken({ sub: 'user-stay', email: 'stay@example.com' });
      const token2 = signTestToken({ sub: 'user-leave', email: 'leave@example.com' });

      const client1 = createClient(port, token1);
      const client2 = createClient(port, token2);
      clients.push(client1, client2);

      // Connect both
      await Promise.all([
        new Promise<void>((resolve) => {
          client1.on('connect', () => resolve());
          client1.connect();
        }),
        new Promise<void>((resolve) => {
          client2.on('connect', () => resolve());
          client2.connect();
        }),
      ]);

      // Both join the same room
      const roomId = 'leave-test-room';

      await new Promise<void>((resolve) => {
        let joined = 0;
        const onJoined = () => { joined++; if (joined >= 2) resolve(); };
        client1.once('ROOM_JOINED', onJoined);
        // We need to listen for the second client's join as well
        // First client joins, then second
        client1.emit('ROOM_JOIN', { roomId }, () => {});
        client2.emit('ROOM_JOIN', { roomId }, () => {});
        // Wait a bit to ensure both joins are processed
        setTimeout(() => resolve(), 500);
      });

      // Client1 should receive ROOM_LEFT when client2 leaves
      const leftPromise = waitForEvent<{ roomId: string; userId: string }>(
        client1,
        'ROOM_LEFT',
      );

      client2.emit('ROOM_LEAVE', { roomId });

      const left = await leftPromise;
      expect(left.roomId).toBe(roomId);
      expect(left.userId).toBe('user-leave');
    });
  });

  // ─── Broadcast to multiple clients ──────────────────────────────────────
  describe('Broadcast', () => {
    it('should broadcast ROOM_JOINED to all clients in the room', async () => {
      const roomId = 'broadcast-room';

      const token1 = signTestToken({ sub: 'user-bc-1', email: 'bc1@example.com' });
      const token2 = signTestToken({ sub: 'user-bc-2', email: 'bc2@example.com' });
      const token3 = signTestToken({ sub: 'user-bc-3', email: 'bc3@example.com' });

      const client1 = createClient(port, token1);
      const client2 = createClient(port, token2);
      const client3 = createClient(port, token3);
      clients.push(client1, client2, client3);

      // Connect all three
      await Promise.all([
        new Promise<void>((r) => { client1.on('connect', r); client1.connect(); }),
        new Promise<void>((r) => { client2.on('connect', r); client2.connect(); }),
        new Promise<void>((r) => { client3.on('connect', r); client3.connect(); }),
      ]);

      // Client1 and Client2 join the room first
      await Promise.all([
        new Promise<void>((r) => { client1.emit('ROOM_JOIN', { roomId }, () => r()); }),
        new Promise<void>((r) => { client2.emit('ROOM_JOIN', { roomId }, () => r()); }),
      ]);

      // Small delay to ensure joins are processed
      await new Promise((r) => setTimeout(r, 100));

      // Now when client3 joins, both client1 and client2 should receive ROOM_JOINED
      const joinedPromise1 = waitForEvent<{ userId: string }>(client1, 'ROOM_JOINED');
      const joinedPromise2 = waitForEvent<{ userId: string }>(client2, 'ROOM_JOINED');

      client3.emit('ROOM_JOIN', { roomId }, () => {});

      const [joined1, joined2] = await Promise.all([joinedPromise1, joinedPromise2]);

      expect(joined1.userId).toBe('user-bc-3');
      expect(joined2.userId).toBe('user-bc-3');
    });

    it('should not receive events from rooms client has not joined', async () => {
      const token1 = signTestToken({ sub: 'user-isolated-1' });
      const token2 = signTestToken({ sub: 'user-isolated-2' });

      const client1 = createClient(port, token1);
      const client2 = createClient(port, token2);
      clients.push(client1, client2);

      await Promise.all([
        new Promise<void>((r) => { client1.on('connect', r); client1.connect(); }),
        new Promise<void>((r) => { client2.on('connect', r); client2.connect(); }),
      ]);

      // Client1 joins room-a, client2 joins room-b
      await new Promise<void>((r) => {
        client1.emit('ROOM_JOIN', { roomId: 'room-a' }, () => r());
      });
      await new Promise<void>((r) => {
        client2.emit('ROOM_JOIN', { roomId: 'room-b' }, () => r());
      });

      // Small delay
      await new Promise((r) => setTimeout(r, 100));

      // Client1 should NOT receive ROOM_JOINED when someone joins room-b
      let client1ReceivedEvent = false;
      client1.on('ROOM_JOINED', () => {
        client1ReceivedEvent = true;
      });

      // A third client joins room-b
      const token3 = signTestToken({ sub: 'user-isolated-3' });
      const client3 = createClient(port, token3);
      clients.push(client3);

      await new Promise<void>((r) => { client3.on('connect', r); client3.connect(); });

      // Wait for client2 to receive the event from client3 joining room-b
      const client2Received = waitForEvent<{ userId: string }>(client2, 'ROOM_JOINED');
      client3.emit('ROOM_JOIN', { roomId: 'room-b' }, () => {});
      await client2Received;

      // Give a short delay to ensure no straggling events
      await new Promise((r) => setTimeout(r, 200));

      expect(client1ReceivedEvent).toBe(false);
    });
  });
});
