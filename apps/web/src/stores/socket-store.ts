import { create } from 'zustand';
import { type TypedSocket, getSocket, connectSocket, disconnectSocket } from '@/lib/socket';

interface SocketState {
  /** Whether the socket is currently connected. */
  connected: boolean;
  /** The Socket.IO client instance, or null if not initialized. */
  socket: TypedSocket | null;

  /** Connect the socket (injects current auth token). */
  connect: () => void;
  /** Disconnect and tear down the socket. */
  disconnect: () => void;
}

export const useSocketStore = create<SocketState>()((set, get) => ({
  connected: false,
  socket: null,

  connect() {
    // Avoid duplicate connections
    const existing = get().socket;
    if (existing?.connected) return;

    const socket = connectSocket();

    socket.on('connect', () => {
      set({ connected: true });
    });

    socket.on('disconnect', (reason) => {
      set({ connected: false });
      // If the server forcibly closed the connection (e.g. auth failure),
      // redirect to login. "io server disconnect" means the server called
      // socket.disconnect() — typically due to an invalid/expired token.
      if (reason === 'io server disconnect') {
        try {
          localStorage.removeItem('auth-storage');
        } catch {
          /* ignore */
        }
        if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
          window.location.href = '/login';
        }
      }
    });

    socket.on('connect_error', (err) => {
      set({ connected: false });
      // Auth-related connection errors (server rejects the handshake)
      if (
        err.message?.includes('401') ||
        err.message?.includes('unauthorized') ||
        err.message?.includes('jwt')
      ) {
        try {
          localStorage.removeItem('auth-storage');
        } catch {
          /* ignore */
        }
        if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
          window.location.href = '/login';
        }
      }
    });

    set({ socket, connected: socket.connected });
  },

  disconnect() {
    disconnectSocket();
    set({ socket: null, connected: false });
  },
}));
