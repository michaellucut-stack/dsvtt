'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { useRoomStore } from '@/stores/room-store';
import { PlayerList } from '@/components/lobby/player-list';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loading } from '@/components/ui/loading';
import type { RoomStatus } from '@dsvtt/shared';

const ACCEPTED_MAP_TYPES = ['image/jpeg', 'image/jpg', 'image/png'];

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

  const [mapFile, setMapFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch room on mount
  useEffect(() => {
    if (roomId) {
      fetchRoom(roomId);
    }
    return () => {
      clearCurrentRoom();
    };
  }, [roomId, fetchRoom, clearCurrentRoom]);

  // Redirect all joined players to the game room when the session goes active
  useEffect(() => {
    if (
      currentRoom &&
      (currentRoom.status as string) === 'ACTIVE' &&
      currentRoom.players?.some((p) => p.userId === user?.id)
    ) {
      router.push(`/${roomId}`);
    }
  }, [currentRoom, currentRoom?.status, user?.id, roomId, router]);

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
        <h3 className="font-heading text-lg font-semibold text-parchment-300">Room not found</h3>
        <p className="mt-1 text-sm text-parchment-400">This room may no longer exist.</p>
        <Button variant="secondary" onClick={() => router.push('/lobby')} className="mt-4">
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

  const { label: statusLabel, variant: statusVariant } = statusConfig[currentRoom.status] ?? {
    label: currentRoom.status,
    variant: 'neutral' as const,
  };

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

  function handleMapFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    if (file && !ACCEPTED_MAP_TYPES.includes(file.type)) {
      setMapFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    setMapFile(file);
  }

  async function handleStart() {
    try {
      await startGame(roomId, mapFile ?? undefined);
      router.push(`/${roomId}`);
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
              <Button variant="primary" onClick={handleStart} disabled={loading}>
                {loading ? 'Starting...' : 'Start Game'}
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

      {/* Map upload — director only, before game starts */}
      {isDirector && (currentRoom.status as string) === 'WAITING' && (
        <div className="mt-6 rounded-panel border border-charcoal-700/60 bg-charcoal-900/80 p-6 shadow-card backdrop-blur-sm">
          <h3 className="mb-3 font-heading text-base font-semibold text-parchment-100">
            Battle Map
          </h3>
          <p className="mb-3 text-xs text-parchment-400">
            Upload a map image (JPG or PNG) for this session.
          </p>
          <label
            className={[
              'flex cursor-pointer items-center gap-3 rounded-card border border-dashed px-4 py-3 transition-colors',
              mapFile
                ? 'border-gold-600/60 bg-gold-950/20 text-gold-400'
                : 'border-charcoal-600 bg-charcoal-800/40 text-parchment-400 hover:border-charcoal-500 hover:text-parchment-300',
            ].join(' ')}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <span className="text-sm font-medium">
              {mapFile ? mapFile.name : 'Choose map image...'}
            </span>
            <input
              ref={fileInputRef}
              type="file"
              accept=".jpg,.jpeg,.png"
              onChange={handleMapFileChange}
              className="sr-only"
            />
          </label>
          {mapFile && (
            <button
              type="button"
              onClick={() => {
                setMapFile(null);
                if (fileInputRef.current) fileInputRef.current.value = '';
              }}
              className="mt-2 text-xs text-crimson-400 hover:text-crimson-300"
            >
              Remove
            </button>
          )}
        </div>
      )}

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
        <h3 className="mb-4 font-heading text-base font-semibold text-parchment-100">Players</h3>
        <PlayerList players={players} directorId={currentRoom.directorId} />
      </div>
    </div>
  );
}
