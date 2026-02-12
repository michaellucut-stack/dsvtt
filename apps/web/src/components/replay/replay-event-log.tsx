'use client';

import { useRef, useEffect } from 'react';
import { useReplayStore } from '@/stores/replay-store';

/** Icon + label mapping for event types. */
const EVENT_META: Record<string, { icon: string; label: string; color: string }> = {
  GAME_STARTED: { icon: '▶', label: 'Game Started', color: 'text-emerald-400' },
  GAME_PAUSED: { icon: '⏸', label: 'Game Paused', color: 'text-gold-400' },
  GAME_ENDED: { icon: '⏹', label: 'Game Ended', color: 'text-crimson-400' },
  CHAT_MESSAGE: { icon: '💬', label: 'Chat', color: 'text-parchment-300' },
  CHAT_WHISPER: { icon: '🤫', label: 'Whisper', color: 'text-purple-400' },
  DICE_ROLL: { icon: '🎲', label: 'Dice Roll', color: 'text-gold-400' },
  DICE_ROLL_PRIVATE: { icon: '🎲', label: 'Private Roll', color: 'text-gold-600' },
  TOKEN_MOVED: { icon: '↗', label: 'Token Moved', color: 'text-blue-400' },
  TOKEN_ADDED: { icon: '+', label: 'Token Added', color: 'text-blue-500' },
  TOKEN_REMOVED: { icon: '×', label: 'Token Removed', color: 'text-blue-300' },
  FOG_UPDATED: { icon: '☁', label: 'Fog Updated', color: 'text-slate-400' },
  TURN_ADVANCED: { icon: '→', label: 'Next Turn', color: 'text-orange-400' },
  TURN_SKIPPED: { icon: '⏭', label: 'Turn Skipped', color: 'text-orange-300' },
  NPC_ACTION: { icon: '🗡', label: 'NPC Action', color: 'text-crimson-300' },
  CHARACTER_UPDATED: { icon: '📝', label: 'Character Updated', color: 'text-parchment-300' },
  NOTE_UPDATED: { icon: '📋', label: 'Note Updated', color: 'text-parchment-400' },
};

function getEventSummary(eventType: string, payload: Record<string, unknown>): string {
  switch (eventType) {
    case 'CHAT_MESSAGE':
      return `${payload['senderName'] ?? 'Unknown'}: ${(payload['content'] as string)?.slice(0, 80) ?? ''}`;
    case 'CHAT_WHISPER':
      return `Whisper: ${(payload['content'] as string)?.slice(0, 60) ?? ''}`;
    case 'DICE_ROLL':
    case 'DICE_ROLL_PRIVATE':
      return `${payload['playerName'] ?? 'Unknown'} rolled ${payload['formula']} → ${payload['total']}`;
    case 'TOKEN_MOVED':
      return `Token moved to (${payload['x']}, ${payload['y']})`;
    case 'TOKEN_ADDED':
      return `Added: ${payload['name'] ?? 'token'}`;
    case 'TOKEN_REMOVED':
      return `Removed token`;
    case 'NPC_ACTION':
      return `${payload['npcName'] ?? 'NPC'}: ${payload['actionType'] ?? ''}`;
    case 'TURN_ADVANCED':
    case 'TURN_SKIPPED':
      return `Round ${payload['roundNumber'] ?? '?'}`;
    default:
      return eventType;
  }
}

export function ReplayEventLog() {
  const events = useReplayStore((s) => s.events);
  const currentIndex = useReplayStore((s) => s.currentIndex);
  const seekTo = useReplayStore((s) => s.seekTo);
  const isPlaying = useReplayStore((s) => s.isPlaying);

  const listRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  // Auto-scroll to the active event
  useEffect(() => {
    if (activeRef.current) {
      activeRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [currentIndex]);

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 border-b border-charcoal-800 px-3 py-2">
        <h2 className="text-[10px] font-semibold uppercase tracking-widest text-parchment-500">
          Event Log
        </h2>
      </div>

      <div ref={listRef} className="flex-1 overflow-y-auto">
        {events.length === 0 ? (
          <div className="flex h-full items-center justify-center p-4">
            <p className="text-xs text-parchment-600">No events to display</p>
          </div>
        ) : (
          events.map((event, index) => {
            const meta = EVENT_META[event.eventType] ?? {
              icon: '•',
              label: event.eventType,
              color: 'text-parchment-500',
            };
            const isActive = index === currentIndex;
            const isPast = index < currentIndex;

            return (
              <button
                key={event.id}
                ref={isActive ? activeRef : undefined}
                type="button"
                onClick={() => !isPlaying && seekTo(index)}
                disabled={isPlaying}
                className={[
                  'flex w-full items-start gap-2 border-b border-charcoal-800/50 px-3 py-2 text-left transition-colors',
                  isActive
                    ? 'bg-gold-900/20 border-l-2 border-l-gold-500'
                    : isPast
                      ? 'opacity-60'
                      : 'opacity-40',
                  !isPlaying && 'hover:bg-charcoal-800/50',
                ].join(' ')}
              >
                <span className={`shrink-0 text-sm ${meta.color}`}>{meta.icon}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-semibold ${meta.color}`}>{meta.label}</span>
                    <span className="text-[9px] text-parchment-600">
                      #{event.sequenceNumber}
                    </span>
                  </div>
                  <p className="truncate text-[11px] text-parchment-400">
                    {getEventSummary(event.eventType, event.payload)}
                  </p>
                  <span className="text-[9px] text-parchment-600">
                    {new Date(event.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
