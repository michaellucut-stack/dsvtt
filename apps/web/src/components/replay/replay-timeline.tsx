'use client';

import { useCallback } from 'react';
import { useReplayStore } from '@/stores/replay-store';

/** Colour mapping for event types on the timeline. */
const EVENT_COLORS: Record<string, string> = {
  GAME_STARTED: 'bg-emerald-500',
  GAME_PAUSED: 'bg-gold-500',
  GAME_ENDED: 'bg-crimson-500',
  TOKEN_MOVED: 'bg-blue-400',
  TOKEN_ADDED: 'bg-blue-500',
  TOKEN_REMOVED: 'bg-blue-300',
  CHAT_MESSAGE: 'bg-parchment-400',
  CHAT_WHISPER: 'bg-purple-400',
  DICE_ROLL: 'bg-gold-400',
  DICE_ROLL_PRIVATE: 'bg-gold-600',
  TURN_ADVANCED: 'bg-orange-400',
  FOG_UPDATED: 'bg-slate-400',
};

export function ReplayTimeline() {
  const events = useReplayStore((s) => s.events);
  const currentIndex = useReplayStore((s) => s.currentIndex);
  const totalEvents = useReplayStore((s) => s.totalEvents);
  const seekTo = useReplayStore((s) => s.seekTo);

  const handleSliderChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const index = parseInt(e.target.value, 10);
      seekTo(index);
    },
    [seekTo],
  );

  const progressPercent = events.length > 0 ? ((currentIndex + 1) / events.length) * 100 : 0;

  return (
    <div className="flex flex-col gap-1.5">
      {/* Event counter */}
      <div className="flex items-center justify-between text-[10px] text-parchment-500">
        <span>
          Event {currentIndex + 1} / {totalEvents}
        </span>
        {currentIndex >= 0 && events[currentIndex] && (
          <span className="rounded bg-charcoal-800 px-1.5 py-0.5 font-mono text-parchment-300">
            {events[currentIndex]!.eventType}
          </span>
        )}
      </div>

      {/* Slider */}
      <div className="relative">
        <input
          type="range"
          min={0}
          max={Math.max(0, events.length - 1)}
          value={Math.max(0, currentIndex)}
          onChange={handleSliderChange}
          className="w-full cursor-pointer appearance-none bg-transparent [&::-webkit-slider-runnable-track]:h-2 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-charcoal-800 [&::-webkit-slider-thumb]:mt-[-2px] [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-gold-400 [&::-webkit-slider-thumb]:shadow-[0_0_4px_rgba(202,163,69,0.5)]"
          disabled={events.length === 0}
        />
        {/* Progress fill overlay */}
        <div
          className="pointer-events-none absolute left-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-gold-700/40"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Mini event markers */}
      <div className="flex h-3 items-center gap-px overflow-hidden">
        {events.slice(0, 200).map((event, i) => (
          <div
            key={event.id}
            className={[
              'h-full min-w-[2px] flex-1 rounded-sm transition-opacity',
              EVENT_COLORS[event.eventType] ?? 'bg-charcoal-600',
              i <= currentIndex ? 'opacity-100' : 'opacity-30',
            ].join(' ')}
            title={`#${event.sequenceNumber} ${event.eventType}`}
          />
        ))}
      </div>
    </div>
  );
}
