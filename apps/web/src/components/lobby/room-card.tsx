'use client';

import type { Room } from '@/stores/room-store';
import type { RoomStatus } from '@dsvtt/shared';
import { Badge } from '@/components/ui/badge';

interface RoomCardProps {
  room: Room;
  onClick: () => void;
}

const statusConfig: Record<
  string,
  { label: string; variant: 'success' | 'warning' | 'info' | 'danger' | 'neutral' }
> = {
  WAITING: { label: 'Waiting', variant: 'warning' },
  ACTIVE: { label: 'In Progress', variant: 'success' },
  PAUSED: { label: 'Paused', variant: 'info' },
  ENDED: { label: 'Ended', variant: 'neutral' },
};

export function RoomCard({ room, onClick }: RoomCardProps) {
  const { label, variant } = statusConfig[room.status] ?? { label: room.status, variant: 'neutral' as const };
  const playerCount = room.playerCount ?? room.players?.length ?? 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'w-full rounded-panel border border-charcoal-700/60 bg-charcoal-900/80 p-5',
        'text-left shadow-card backdrop-blur-sm',
        'transition-all duration-150',
        'hover:border-gold-700/50 hover:shadow-glow',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-charcoal-950',
      ].join(' ')}
    >
      {/* Header: name + status badge */}
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-heading text-base font-semibold text-parchment-100 line-clamp-1">
          {room.name}
        </h3>
        <Badge variant={variant}>{label}</Badge>
      </div>

      {/* Meta row */}
      <div className="mt-3 flex items-center gap-4 text-sm text-parchment-400">
        {/* Player count */}
        <span className="flex items-center gap-1.5">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          {playerCount}/{room.maxPlayers}
        </span>

        {/* Director */}
        {room.directorName && (
          <span className="flex items-center gap-1.5">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 2 L15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2z" />
            </svg>
            {room.directorName}
          </span>
        )}
      </div>
    </button>
  );
}
