'use client';

import { useEffect, type ReactNode } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { useSocketStore } from '@/stores/socket-store';
import { useRoomStore } from '@/stores/room-store';
import { useMapStore } from '@/stores/map-store';
import { Loading } from '@/components/ui/loading';

interface GameRoomLayoutProps {
  children: ReactNode;
}

/**
 * Game room layout — connects Socket.IO, joins the room, and loads game state.
 * Protected: redirects to login if unauthenticated.
 */
export default function GameRoomLayout({ children }: GameRoomLayoutProps) {
  const params = useParams<{ roomId: string }>();
  const router = useRouter();

  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const connect = useSocketStore((s) => s.connect);
  const disconnect = useSocketStore((s) => s.disconnect);
  const connected = useSocketStore((s) => s.connected);
  const socket = useSocketStore((s) => s.socket);

  const fetchRoom = useRoomStore((s) => s.fetchRoom);
  const currentRoom = useRoomStore((s) => s.currentRoom);
  const roomLoading = useRoomStore((s) => s.loading);
  const roomError = useRoomStore((s) => s.error);
  const subscribeToRoomSocket = useRoomStore((s) => s.subscribeToSocket);
  const subscribeToMapSocket = useMapStore((s) => s.subscribeToSocket);

  // Auth guard
  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace('/login');
    }
  }, [isAuthenticated, router]);

  // Connect socket
  useEffect(() => {
    connect();
    return () => {
      // Don't disconnect on unmount — socket is shared across the app.
      // Only disconnect on explicit logout.
    };
  }, [connect]);

  // Subscribe to room socket events
  useEffect(() => {
    const unsubRoom = subscribeToRoomSocket();
    const unsubMap = subscribeToMapSocket();
    return () => {
      unsubRoom();
      unsubMap();
    };
  }, [subscribeToRoomSocket, subscribeToMapSocket]);

  // Join the socket room and fetch room data
  useEffect(() => {
    if (!connected || !socket || !params.roomId) return;

    // Join the Socket.IO room
    socket.emit('ROOM_JOIN', { roomId: params.roomId }, (ack) => {
      if (!ack.ok) {
        console.error('Failed to join room via socket:', ack.error);
      }
    });

    // Fetch room details via REST
    fetchRoom(params.roomId);

    return () => {
      if (socket.connected && params.roomId) {
        socket.emit('ROOM_LEAVE', { roomId: params.roomId });
      }
    };
  }, [connected, socket, params.roomId, fetchRoom]);

  // Loading states
  if (roomLoading || !currentRoom) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-charcoal-950">
        <div className="flex flex-col items-center gap-4">
          <Loading size={48} />
          <p className="text-parchment-400">
            {roomLoading ? 'Loading game room...' : 'Connecting...'}
          </p>
        </div>
      </div>
    );
  }

  if (roomError) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center gap-4 bg-charcoal-950">
        <p className="text-crimson-400">{roomError}</p>
        <button
          type="button"
          onClick={() => router.push('/lobby')}
          className="rounded-card bg-charcoal-700 px-5 py-2.5 font-heading text-sm font-semibold text-parchment-200 transition-colors hover:bg-charcoal-600"
        >
          Back to Lobby
        </button>
      </div>
    );
  }

  return <>{children}</>;
}
