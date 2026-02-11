import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@dsvtt/events';

export type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

/** Maximum reconnection delay in ms. */
const MAX_RECONNECT_DELAY = 30_000;

/** Base reconnection delay in ms. */
const BASE_RECONNECT_DELAY = 1_000;

let socketInstance: TypedSocket | null = null;

function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem('auth-storage');
    if (!stored) return null;
    const parsed = JSON.parse(stored) as {
      state?: { accessToken?: string };
    };
    return parsed.state?.accessToken ?? null;
  } catch {
    return null;
  }
}

/**
 * Returns the singleton Socket.IO client, creating it on first call.
 * Attaches the current auth token for handshake authentication.
 * Auto-reconnects with exponential backoff.
 */
export function getSocket(): TypedSocket {
  if (socketInstance) return socketInstance;

  const token = getAuthToken();

  socketInstance = io(SOCKET_URL, {
    autoConnect: false,
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: BASE_RECONNECT_DELAY,
    reconnectionDelayMax: MAX_RECONNECT_DELAY,
  });

  return socketInstance;
}

/**
 * Connect the socket with a fresh auth token.
 * Useful after login when the token wasn't available at creation time.
 */
export function connectSocket(): TypedSocket {
  const socket = getSocket();
  const token = getAuthToken();

  // Update auth token before connecting
  socket.auth = { token };

  if (!socket.connected) {
    socket.connect();
  }

  return socket;
}

/**
 * Disconnect and destroy the socket singleton.
 * Call on logout.
 */
export function disconnectSocket(): void {
  if (socketInstance) {
    socketInstance.removeAllListeners();
    socketInstance.disconnect();
    socketInstance = null;
  }
}
