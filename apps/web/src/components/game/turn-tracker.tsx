'use client';

import { useTurnStore, type TurnEntry } from '@/stores/turn-store';
import { useAuthStore } from '@/stores/auth-store';
import { useRoomStore } from '@/stores/room-store';

// ─── Turn Chip ──────────────────────────────────────────────────────────────

function TurnChip({
  entry,
  isCurrent,
  index,
}: {
  entry: TurnEntry;
  isCurrent: boolean;
  index: number;
}) {
  return (
    <div
      className={[
        'flex shrink-0 items-center gap-2 rounded-card border px-3 py-1.5 transition-all duration-200',
        isCurrent
          ? 'border-gold-500 bg-gold-900/30 shadow-[0_0_10px_rgba(240,170,7,0.25)]'
          : entry.isNpc
            ? 'border-crimson-800/40 bg-crimson-950/20'
            : 'border-charcoal-700 bg-charcoal-800/50',
      ].join(' ')}
    >
      {/* Initiative number */}
      <span
        className={[
          'flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold',
          isCurrent
            ? 'bg-gold-600 text-charcoal-950'
            : entry.isNpc
              ? 'bg-crimson-900/50 text-crimson-300'
              : 'bg-charcoal-700 text-parchment-300',
        ].join(' ')}
      >
        {entry.initiative}
      </span>

      {/* Name */}
      <span
        className={[
          'text-xs font-semibold whitespace-nowrap',
          isCurrent
            ? 'text-gold-300'
            : entry.isNpc
              ? 'text-crimson-300'
              : 'text-parchment-300',
        ].join(' ')}
      >
        {entry.name}
      </span>

      {/* NPC indicator */}
      {entry.isNpc && (
        <span className="text-[9px] font-bold uppercase tracking-wider text-crimson-500">
          NPC
        </span>
      )}

      {/* Current turn indicator arrow */}
      {isCurrent && (
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="text-gold-400"
        >
          <polygon points="5,3 19,12 5,21" />
        </svg>
      )}
    </div>
  );
}

// ─── Main Turn Tracker ──────────────────────────────────────────────────────

interface TurnTrackerProps {
  sessionId: string;
}

export function TurnTracker({ sessionId }: TurnTrackerProps) {
  const turnOrder = useTurnStore((s) => s.turnOrder);
  const currentTurnIndex = useTurnStore((s) => s.currentTurnIndex);
  const roundNumber = useTurnStore((s) => s.roundNumber);
  const isActive = useTurnStore((s) => s.isActive);
  const nextTurn = useTurnStore((s) => s.nextTurn);
  const skipTurn = useTurnStore((s) => s.skipTurn);

  const userId = useAuthStore((s) => s.user?.id);
  const currentRoom = useRoomStore((s) => s.currentRoom);
  const isDirector = currentRoom?.directorId === userId;

  const currentEntry = turnOrder[currentTurnIndex] ?? null;

  // Don't render if turn tracking isn't active
  if (!isActive || turnOrder.length === 0) {
    return null;
  }

  return (
    <div className="shrink-0 border-b border-charcoal-800 bg-charcoal-900/80 backdrop-blur-sm">
      <div className="flex items-center gap-3 px-4 py-2">
        {/* Round counter */}
        <div className="flex shrink-0 flex-col items-center">
          <span className="text-[9px] font-bold uppercase tracking-widest text-charcoal-400">
            Round
          </span>
          <span className="font-heading text-lg font-bold text-gold-400">
            {roundNumber}
          </span>
        </div>

        {/* Divider */}
        <div className="h-8 w-px shrink-0 bg-charcoal-700" />

        {/* Active player name */}
        {currentEntry && (
          <div className="shrink-0">
            <span className="text-[9px] font-bold uppercase tracking-widest text-charcoal-400">
              Active
            </span>
            <p
              className={[
                'font-heading text-sm font-semibold',
                currentEntry.isNpc ? 'text-crimson-300' : 'text-gold-300',
              ].join(' ')}
            >
              {currentEntry.name}
            </p>
          </div>
        )}

        {/* Divider */}
        <div className="h-8 w-px shrink-0 bg-charcoal-700" />

        {/* Turn order chips — horizontally scrollable */}
        <div className="flex flex-1 items-center gap-1.5 overflow-x-auto py-1 scrollbar-thin">
          {turnOrder.map((entry, idx) => (
            <TurnChip
              key={entry.id}
              entry={entry}
              isCurrent={idx === currentTurnIndex}
              index={idx}
            />
          ))}
        </div>

        {/* Director controls */}
        {isDirector && (
          <>
            <div className="h-8 w-px shrink-0 bg-charcoal-700" />
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  if (currentEntry) {
                    skipTurn(sessionId, currentEntry.id);
                  }
                }}
                className={[
                  'rounded-card border border-charcoal-600 bg-charcoal-800 px-3 py-1.5',
                  'text-[10px] font-bold uppercase tracking-wider text-parchment-400',
                  'transition-colors hover:border-charcoal-500 hover:bg-charcoal-700 hover:text-parchment-200',
                ].join(' ')}
              >
                Skip
              </button>
              <button
                type="button"
                onClick={() => nextTurn(sessionId)}
                className={[
                  'rounded-card border border-gold-700 bg-gold-700/20 px-3 py-1.5',
                  'text-[10px] font-bold uppercase tracking-wider text-gold-400',
                  'transition-colors hover:bg-gold-700/40 hover:text-gold-300',
                ].join(' ')}
              >
                Next Turn
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
