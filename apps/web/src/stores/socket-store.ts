import { create } from 'zustand';
import {
  type TypedSocket,
  getSocket,
  connectSocket,
  disconnectSocket,
} from '@/lib/socket';

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

    socket.on('disconnect', () => {
      set({ connected: false });
    });

    socket.on('connect_error', () => {
      set({ connected: false });
    });

    set({ socket, connected: socket.connected });
  },

  disconnect() {
    disconnectSocket();
    set({ socket: null, connected: false });
  },
}));
