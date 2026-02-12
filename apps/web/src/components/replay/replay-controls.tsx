'use client';

import { useReplayStore } from '@/stores/replay-store';

const SPEEDS = [1, 2, 4, 8];

export function ReplayControls() {
  const isPlaying = useReplayStore((s) => s.isPlaying);
  const playbackSpeed = useReplayStore((s) => s.playbackSpeed);
  const currentIndex = useReplayStore((s) => s.currentIndex);
  const events = useReplayStore((s) => s.events);
  const play = useReplayStore((s) => s.play);
  const pause = useReplayStore((s) => s.pause);
  const setSpeed = useReplayStore((s) => s.setSpeed);
  const stepForward = useReplayStore((s) => s.stepForward);
  const stepBackward = useReplayStore((s) => s.stepBackward);

  const currentEvent = currentIndex >= 0 ? events[currentIndex] : null;
  const timestamp = currentEvent
    ? new Date(currentEvent.timestamp).toLocaleTimeString()
    : '--:--:--';

  return (
    <div className="flex items-center justify-center gap-3 pt-2">
      {/* Step backward */}
      <button
        type="button"
        onClick={stepBackward}
        disabled={isPlaying || currentIndex <= 0}
        className="rounded p-1.5 text-parchment-400 transition-colors hover:bg-charcoal-800 hover:text-parchment-100 disabled:opacity-30"
        title="Step backward"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M6 6h2v12H6zm3.5 6 8.5 6V6z" />
        </svg>
      </button>

      {/* Play / Pause */}
      <button
        type="button"
        onClick={isPlaying ? pause : play}
        disabled={events.length === 0}
        className="rounded-full border border-gold-700/50 bg-charcoal-800 p-2 text-gold-400 transition-colors hover:bg-charcoal-700 hover:text-gold-300 disabled:opacity-30"
        title={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 4h4v16H6zm8 0h4v16h-4z" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>

      {/* Step forward */}
      <button
        type="button"
        onClick={stepForward}
        disabled={isPlaying || currentIndex >= events.length - 1}
        className="rounded p-1.5 text-parchment-400 transition-colors hover:bg-charcoal-800 hover:text-parchment-100 disabled:opacity-30"
        title="Step forward"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
        </svg>
      </button>

      {/* Divider */}
      <div className="mx-1 h-5 w-px bg-charcoal-700" />

      {/* Speed controls */}
      <div className="flex items-center gap-1">
        {SPEEDS.map((speed) => (
          <button
            key={speed}
            type="button"
            onClick={() => setSpeed(speed)}
            className={[
              'rounded px-1.5 py-0.5 text-[10px] font-bold transition-colors',
              playbackSpeed === speed
                ? 'bg-gold-900/50 text-gold-400'
                : 'text-parchment-500 hover:text-parchment-300',
            ].join(' ')}
          >
            {speed}x
          </button>
        ))}
      </div>

      {/* Divider */}
      <div className="mx-1 h-5 w-px bg-charcoal-700" />

      {/* Timestamp */}
      <span className="font-mono text-xs text-parchment-400">{timestamp}</span>
    </div>
  );
}
