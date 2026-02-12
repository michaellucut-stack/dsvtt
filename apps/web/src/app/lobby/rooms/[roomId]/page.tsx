'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { useRoomStore } from '@/stores/room-store';
import { PlayerList } from '@/components/lobby/player-list';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loading } from '@/components/ui/loading';
import type { RoomStatus } from '@dsvtt/shared';

const statusConfig: Record<
  string,
  { label: string; variant: 'success' | 'warning' | 'info' | 'danger' | 'neutral' }
> = {
  WAITING: { label: 'Waiting for Players', variant: 'warning' },
  ACTIVE: { label: 'Game in Progress', variant: 'success' },
  PAUSED: { label: 'Paused', variant: 'info' },
  ENDED: { label: 'Ended', variant: 'neutral' },
};

export default function RoomDetailPage() {
  const params = useParams<{ roomId: string }>();
  const router = useRouter();
  const roomId = params.roomId;

  const user = useAuthStore((s) => s.user);
  const currentRoom = useRoomStore((s) => s.currentRoom);
  const loading = useRoomStore((s) => s.loading);
  const error = useRoomStore((s) => s.error);
  const fetchRoom = useRoomStore((s) => s.fetchRoom);
  const joinRoom = useRoomStore((s) => s.joinRoom);
  const leaveRoom = useRoomStore((s) => s.leaveRoom);
  const startGame = useRoomStore((s) => s.startGame);
  const clearCurrentRoom = useRoomStore((s) => s.clearCurrentRoom);
  const clearError = useRoomStore((s) => s.clearError);

  // Fetch room on mount
  useEffect(() => {
    if (roomId) {
      fetchRoom(roomId);
    }
    return () => {
      clearCurrentRoom();
    };
  }, [roomId, fetchRoom, clearCurrentRoom]);

  if (loading && !currentRoom) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loading size={40} />
        <p className="mt-4 text-sm text-parchment-400">Loading room...</p>
      </div>
    );
  }

  if (!currentRoom) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <h3 className="font-heading text-lg font-semibold text-parchment-300">
          Room not found
        </h3>
        <p className="mt-1 text-sm text-parchment-400">
          This room may no longer exist.
        </p>
        <Button
          variant="secondary"
          onClick={() => router.push('/lobby')}
          className="mt-4"
        >
          Back to Lobby
        </Button>
      </div>
    );
  }

  const players = currentRoom.players ?? [];
  const isDirector = user?.id === currentRoom.directorId;
  const isJoined = players.some((p) => p.userId === user?.id);
  const canJoin =
    !isJoined &&
    (currentRoom.status as string) === 'WAITING' &&
    players.length < currentRoom.maxPlayers;
  const canStart =
    isDirector && (currentRoom.status as string) === 'WAITING' && players.length >= 1;

  const { label: statusLabel, variant: statusVariant } =
    statusConfig[currentRoom.status] ?? { label: currentRoom.status, variant: 'neutral' as const };

  async function handleJoin() {
    try {
      await joinRoom(roomId);
    } catch {
      // Error is set in the store
    }
  }

  async function handleLeave() {
    try {
      await leaveRoom(roomId);
      router.push('/lobby');
    } catch {
      // Error is set in the store
    }
  }

  async function handleStart() {
    try {
      await startGame(roomId);
    } catch {
      // Error is set in the store
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      {/* Back link */}
      <button
        type="button"
        onClick={() => router.push('/lobby')}
        className="mb-6 flex items-center gap-1.5 text-sm text-parchment-400 transition-colors hover:text-gold-400"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="15 18 9 12 15 6" />
        </svg>
        Back to Lobby
      </button>

      {/* Room header */}
      <div className="rounded-panel border border-charcoal-700/60 bg-charcoal-900/80 p-6 shadow-card backdrop-blur-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="font-heading text-2xl font-bold text-parchment-100">
              {currentRoom.name}
            </h2>
            <div className="mt-2 flex items-center gap-3">
              <Badge variant={statusVariant}>{statusLabel}</Badge>
              <span className="text-sm text-parchment-400">
                {players.length}/{currentRoom.maxPlayers} players
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            {canJoin && (
              <Button variant="primary" onClick={handleJoin}>
                Join as Player
              </Button>
            )}
            {canStart && (
              <Button variant="primary" onClick={handleStart}>
                Start Game
              </Button>
            )}
            {isJoined && (
              <Button variant="danger" onClick={handleLeave}>
                Leave Room
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mt-4 flex items-center justify-between rounded-card border border-crimson-700/50 bg-crimson-950/30 px-4 py-3 text-sm text-crimson-300">
          <span>{error}</span>
          <button
            onClick={clearError}
            className="ml-2 text-crimson-400 hover:text-crimson-200"
            type="button"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Player list */}
      <div className="mt-6 rounded-panel border border-charcoal-700/60 bg-charcoal-900/80 p-6 shadow-card backdrop-blur-sm">
        <h3 className="mb-4 font-heading text-base font-semibold text-parchment-100">
          Players
        </h3>
        <PlayerList players={players} directorId={currentRoom.directorId} />
      </div>
    </div>
  );
}
