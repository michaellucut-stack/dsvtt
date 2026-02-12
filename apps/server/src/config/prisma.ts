import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger.js';

const NODE_ENV = process.env['NODE_ENV'] ?? 'development';
const isDev = NODE_ENV === 'development';

/**
 * Global augmentation so the PrismaClient singleton survives hot-reloads in
 * development (tsx watch / nodemon). In production only one instance exists.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Build the datasource URL with connection pool parameters appended.
 * Falls back to the raw DATABASE_URL if not set.
 */
function buildDatasourceUrl(): string | undefined {
  const baseUrl = process.env['DATABASE_URL'];
  if (!baseUrl) return undefined;

  const poolSize = process.env['DB_POOL_SIZE'] ?? '10';
  const poolTimeout = '10'; // seconds

  const separator = baseUrl.includes('?') ? '&' : '?';
  return `${baseUrl}${separator}connection_limit=${poolSize}&pool_timeout=${poolTimeout}`;
}

/**
 * Create a PrismaClient instance with connection pooling and query timing.
 */
function createPrismaClient(): PrismaClient {
  const datasourceUrl = buildDatasourceUrl();

  const base = new PrismaClient({
    log: isDev
      ? ['query', 'warn', 'error']
      : ['warn', 'error'],
    ...(datasourceUrl
      ? { datasources: { db: { url: datasourceUrl } } }
      : {}),
  });

  // Query timing extension — logs slow queries in development
  if (isDev) {
    return base.$extends({
      query: {
        async $allOperations({ model, operation, args, query }) {
          const start = performance.now();
          const result = await query(args);
          const duration = Math.round(performance.now() - start);

          if (duration > 100) {
            logger.warn(`Slow query: ${model}.${operation} took ${duration}ms`, {
              context: 'prisma',
              model,
              action: operation,
              duration,
            });
          } else {
            logger.debug(`Query: ${model}.${operation} (${duration}ms)`, {
              context: 'prisma',
              model,
              action: operation,
              duration,
            });
          }

          return result;
        },
      },
    }) as unknown as PrismaClient;
  }

  return base;
}

/**
 * Singleton PrismaClient instance.
 *
 * In development the instance is cached on `globalThis` to avoid creating
 * multiple connections when the module is re-evaluated by a file watcher.
 * Connection pooling is configured via datasource URL parameters.
 */
export const prisma: PrismaClient =
  globalForPrisma.prisma ?? createPrismaClient();

if (NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

/**
 * Gracefully disconnect the Prisma client.
 * Should be called during server shutdown to release database connections.
 */
export async function disconnectPrisma(): Promise<void> {
  logger.info('Disconnecting Prisma client…', { context: 'prisma' });
  await prisma.$disconnect();
  logger.info('Prisma client disconnected', { context: 'prisma' });
}
