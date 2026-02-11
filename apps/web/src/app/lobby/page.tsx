'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useRoomStore } from '@/stores/room-store';
import { RoomCard } from '@/components/lobby/room-card';
import { CreateRoomModal } from '@/components/lobby/create-room-modal';
import { Button } from '@/components/ui/button';
import { Loading } from '@/components/ui/loading';

export default function LobbyPage() {
  const router = useRouter();
  const rooms = useRoomStore((s) => s.rooms);
  const loading = useRoomStore((s) => s.loading);
  const error = useRoomStore((s) => s.error);
  const fetchRooms = useRoomStore((s) => s.fetchRooms);
  const clearError = useRoomStore((s) => s.clearError);

  const [modalOpen, setModalOpen] = useState(false);

  // Fetch rooms on mount
  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  function handleRoomClick(roomId: string) {
    router.push(`/lobby/rooms/${roomId}`);
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-heading text-2xl font-bold text-parchment-100">
            Game Lobby
          </h2>
          <p className="mt-1 text-sm text-parchment-400">
            Join an existing room or create your own adventure.
          </p>
        </div>

        <Button variant="primary" onClick={() => setModalOpen(true)}>
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
            className="mr-2"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Create Room
        </Button>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 flex items-center justify-between rounded-card border border-crimson-700/50 bg-crimson-950/30 px-4 py-3 text-sm text-crimson-300">
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

      {/* Loading */}
      {loading && rooms.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20">
          <Loading size={40} />
          <p className="mt-4 text-sm text-parchment-400">Loading rooms...</p>
        </div>
      )}

      {/* Empty state */}
      {!loading && rooms.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-panel border border-charcoal-700/40 bg-charcoal-900/50 py-20">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-charcoal-500"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <line x1="9" y1="3" x2="9" y2="21" />
          </svg>
          <h3 className="mt-4 font-heading text-lg font-semibold text-parchment-300">
            No rooms yet
          </h3>
          <p className="mt-1 text-sm text-parchment-400">
            Be the first to forge an adventure!
          </p>
          <Button
            variant="primary"
            onClick={() => setModalOpen(true)}
            className="mt-6"
          >
            Create the First Room
          </Button>
        </div>
      )}

      {/* Room grid */}
      {rooms.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rooms.map((room) => (
            <RoomCard
              key={room.id}
              room={room}
              onClick={() => handleRoomClick(room.id)}
            />
          ))}
        </div>
      )}

      {/* Create room modal */}
      <CreateRoomModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}
