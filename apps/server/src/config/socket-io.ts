import type { Server } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '@dsvtt/events';

/** Typed Socket.IO server type used throughout the application. */
export type TypedIOServer = Server<ClientToServerEvents, ServerToClientEvents>;

/**
 * Singleton holder for the Socket.IO server instance.
 *
 * The `io` instance is created in `index.ts` and registered here via
 * `setIO()` so that REST route handlers (which cannot import from `index.ts`
 * without circular dependencies) can broadcast events to connected clients.
 *
 * This mirrors the singleton pattern used by `prisma.ts`.
 */
let ioInstance: TypedIOServer | null = null;

/**
 * Register the Socket.IO server instance. Must be called once during server
 * startup, after the `Server` is constructed.
 *
 * @param io - The Socket.IO server instance.
 */
export function setIO(io: TypedIOServer): void {
  ioInstance = io;
}

/**
 * Retrieve the Socket.IO server instance.
 *
 * @returns The Socket.IO server instance.
 * @throws {Error} If called before `setIO()` has been invoked.
 */
export function getIO(): TypedIOServer {
  if (!ioInstance) {
    throw new Error('Socket.IO instance not initialised — call setIO() first');
  }
  return ioInstance;
}
