import { vi, beforeEach } from 'vitest';
import express, { type Express } from 'express';
import { errorHandler } from '../middleware/error-handler.js';

// =============================================================================
// Mock Prisma Client
// =============================================================================

/**
 * Deep-mocked PrismaClient for use in unit / integration tests.
 * Every model property exposes vitest mock functions for standard CRUD methods.
 */
export const prismaMock = {
  user: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  room: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  roomPlayer: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
  },
  gameSession: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  character: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  npc: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  sharedNote: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  chatMessage: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  diceRoll: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  gameEventLog: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  stateSnapshot: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  gameMap: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  token: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  fogRegion: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  $connect: vi.fn(),
  $disconnect: vi.fn(),
  $transaction: vi.fn(),
};

// Intercept the real prisma import so every consumer gets the mock
vi.mock('../config/prisma.js', () => ({
  prisma: prismaMock,
}));

// =============================================================================
// Reset mocks between tests
// =============================================================================

beforeEach(() => {
  vi.clearAllMocks();
});

// =============================================================================
// Test App Factory
// =============================================================================

/**
 * Creates a minimal Express application wired with JSON body parsing.
 * Test suites can mount specific routers on this app before making requests
 * via supertest.
 *
 * @example
 * ```ts
 * import { createTestApp } from '../../test-utils/setup.js';
 * import authRouter from '../auth/routes.js';
 *
 * const app = createTestApp();
 * app.use('/api/auth', authRouter);
 * ```
 */
export function createTestApp(): Express {
  const app = express();
  app.use(express.json());

  // Defer error handler registration — callers mount routers first, then call
  // `app.use(errorHandler)` or use `createTestAppWithErrorHandler()`.
  return app;
}

/**
 * Creates a test Express app with the global error handler already mounted.
 * Useful when you want full error-handling behaviour in integration tests.
 *
 * Mount your routers **before** calling this if you need them — or use
 * `createTestApp()` and append `errorHandler` yourself after mounting routers.
 */
export function withErrorHandler(app: Express): Express {
  app.use(errorHandler);
  return app;
}

// =============================================================================
// Test helpers
// =============================================================================

/** Default auth config used across test suites. */
export const testAuthConfig = {
  jwtSecret: 'test-jwt-secret',
  jwtExpiresIn: '15m',
  refreshSecret: 'test-refresh-secret',
  refreshExpiresIn: '7d',
  bcryptRounds: 4, // Low rounds for fast tests
} as const;

/**
 * Generates a fake user record matching the Prisma `User` model shape.
 * Useful for seeding mock return values.
 */
export function createMockUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'test-user-id-1',
    email: 'test@example.com',
    passwordHash: '$2a$04$hashedpassword',
    displayName: 'Test User',
    role: 'player',
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-01T00:00:00Z'),
    ...overrides,
  };
}
