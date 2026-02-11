'use client';

import type { RoomPlayer } from '@/stores/room-store';
import { Badge } from '@/components/ui/badge';

interface PlayerListProps {
  players: RoomPlayer[];
  directorId: string;
}

export function PlayerList({ players, directorId }: PlayerListProps) {
  if (players.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-parchment-400">
        No players have joined yet.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-charcoal-700/40">
      {players.map((player) => {
        const isDirector = player.userId === directorId;
        return (
          <li
            key={player.userId}
            className="flex items-center justify-between py-3"
          >
            <div className="flex items-center gap-3">
              {/* Online indicator */}
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
              </span>

              {/* Display name */}
              <span className="text-sm font-medium text-parchment-200">
                {player.displayName}
              </span>
            </div>

            {/* Role badge */}
            <Badge variant={isDirector ? 'warning' : 'info'}>
              {isDirector ? 'Director' : 'Player'}
            </Badge>
          </li>
        );
      })}
    </ul>
  );
}
