import { PrismaClient } from '@prisma/client';

/**
 * Global augmentation so the PrismaClient singleton survives hot-reloads in
 * development (tsx watch / nodemon). In production only one instance exists.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Singleton PrismaClient instance.
 *
 * In development the instance is cached on `globalThis` to avoid creating
 * multiple connections when the module is re-evaluated by a file watcher.
 */
export const prisma: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env['NODE_ENV'] === 'development'
        ? ['query', 'warn', 'error']
        : ['warn', 'error'],
  });

if (process.env['NODE_ENV'] !== 'production') {
  globalForPrisma.prisma = prisma;
}
