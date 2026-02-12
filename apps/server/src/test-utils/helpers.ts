import { generateTokens } from '@dsvtt/auth/jwt';
import type { TokenUser } from '@dsvtt/auth/jwt';
import { testAuthConfig, createMockUser } from './setup.js';

// =============================================================================
// Token Factory
// =============================================================================

/**
 * Generate a valid JWT access/refresh token pair for testing.
 *
 * @param overrides - Fields to override on the default mock user used for
 *   token generation (e.g. `{ id: 'custom-id', role: 'director' }`).
 * @returns An object containing the mock user and the generated tokens.
 */
export function createAccessToken(overrides: Record<string, unknown> = {}) {
  const user = createMockUser(overrides);
  const tokens = generateTokens(
    { id: user.id, email: user.email, role: user.role as TokenUser['role'] },
    testAuthConfig,
  );
  return { user, tokens };
}

// =============================================================================
// Auth Header Helper
// =============================================================================

/**
 * Returns an object suitable for passing to supertest's `.set()` that
 * contains an `Authorization: Bearer <token>` header.
 *
 * @param userId   - User ID to encode in the JWT. Defaults to `'test-user-id-1'`.
 * @param email    - Email to encode. Defaults to `'test@example.com'`.
 * @param role     - Role to encode. Defaults to `'player'`.
 * @returns `{ Authorization: 'Bearer <jwt>' }`
 */
export function authHeader(
  userId = 'test-user-id-1',
  email = 'test@example.com',
  role: 'player' | 'director' = 'player',
): { Authorization: string } {
  const tokens = generateTokens({ id: userId, email, role }, testAuthConfig);
  return { Authorization: `Bearer ${tokens.accessToken}` };
}

// =============================================================================
// Mock Data Factories
// =============================================================================

/** Creates a mock room record matching the Prisma `Room` model shape. */
export function createMockRoom(overrides: Record<string, unknown> = {}) {
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

/** Creates a mock game session record. */
export function createMockSession(overrides: Record<string, unknown> = {}) {
  return {
    id: 'session-id-1',
    roomId: 'room-id-1',
    status: 'active',
    startedAt: new Date('2025-06-01T00:00:00Z'),
    endedAt: null,
    eventCount: 0,
    ...overrides,
  };
}

/** Creates a mock character record. */
export function createMockCharacter(overrides: Record<string, unknown> = {}) {
  return {
    id: 'character-id-1',
    sessionId: 'session-id-1',
    userId: 'test-user-id-1',
    name: 'Test Character',
    class: 'Fighter',
    level: 1,
    hitPoints: 10,
    maxHitPoints: 10,
    stats: {},
    createdAt: new Date('2025-06-01T00:00:00Z'),
    updatedAt: new Date('2025-06-01T00:00:00Z'),
    ...overrides,
  };
}

/** Creates a mock NPC record. */
export function createMockNpc(overrides: Record<string, unknown> = {}) {
  return {
    id: 'npc-id-1',
    sessionId: 'session-id-1',
    name: 'Test NPC',
    description: 'A test NPC',
    hitPoints: 20,
    maxHitPoints: 20,
    stats: {},
    visible: true,
    createdAt: new Date('2025-06-01T00:00:00Z'),
    updatedAt: new Date('2025-06-01T00:00:00Z'),
    ...overrides,
  };
}

/** Creates a mock shared note record. */
export function createMockNote(overrides: Record<string, unknown> = {}) {
  return {
    id: 'note-id-1',
    sessionId: 'session-id-1',
    authorId: 'test-user-id-1',
    title: 'Test Note',
    content: 'Some note content',
    isPublic: true,
    createdAt: new Date('2025-06-01T00:00:00Z'),
    updatedAt: new Date('2025-06-01T00:00:00Z'),
    ...overrides,
  };
}

/** Creates a mock chat message record. */
export function createMockChatMessage(overrides: Record<string, unknown> = {}) {
  return {
    id: 'chat-msg-id-1',
    sessionId: 'session-id-1',
    senderId: 'test-user-id-1',
    senderName: 'Test User',
    channel: 'ooc' as const,
    content: 'Hello, world!',
    recipientId: null,
    timestamp: new Date('2025-06-01T00:00:00Z'),
    ...overrides,
  };
}

/** Creates a mock dice roll record. */
export function createMockDiceRoll(overrides: Record<string, unknown> = {}) {
  return {
    id: 'dice-roll-id-1',
    sessionId: 'session-id-1',
    playerId: 'test-user-id-1',
    formula: '2d6+3',
    results: [
      { sides: 6, result: 4, dropped: false, exploded: false },
      { sides: 6, result: 3, dropped: false, exploded: false },
    ],
    total: 10,
    isPrivate: false,
    timestamp: new Date('2025-06-01T00:00:00Z'),
    ...overrides,
  };
}
