'use client';

import { useSocketStore } from '@/stores/socket-store';

type ConnectionState = 'connected' | 'reconnecting' | 'disconnected';

function useConnectionState(): ConnectionState {
  const connected = useSocketStore((s) => s.connected);
  const socket = useSocketStore((s) => s.socket);

  if (connected) return 'connected';
  // If we have a socket instance but are not connected, we're reconnecting
  if (socket && !connected) return 'reconnecting';
  return 'disconnected';
}

const stateConfig: Record<
  ConnectionState,
  { dot: string; label: string; pulse: boolean }
> = {
  connected: {
    dot: 'bg-emerald-400',
    label: 'Connected',
    pulse: false,
  },
  reconnecting: {
    dot: 'bg-gold-400',
    label: 'Reconnecting...',
    pulse: true,
  },
  disconnected: {
    dot: 'bg-crimson-400',
    label: 'Disconnected',
    pulse: false,
  },
};

interface ConnectionStatusProps {
  /** Additional CSS classes. */
  className?: string;
}

export function ConnectionStatus({ className = '' }: ConnectionStatusProps) {
  const state = useConnectionState();
  const { dot, label, pulse } = stateConfig[state];

  return (
    <div
      className={[
        'inline-flex items-center gap-1.5',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      role="status"
      aria-label={`Connection status: ${label}`}
    >
      {/* Status dot */}
      <span className="relative flex h-2 w-2">
        {pulse && (
          <span
            className={[
              'absolute inset-0 rounded-full opacity-75',
              dot,
              'animate-ping',
            ].join(' ')}
          />
        )}
        <span
          className={['relative inline-flex h-2 w-2 rounded-full', dot].join(
            ' ',
          )}
        />
      </span>

      {/* Label — only show text for non-connected states to keep it minimal */}
      {state !== 'connected' && (
        <span className="text-[11px] font-medium text-parchment-400">
          {label}
        </span>
      )}
    </div>
  );
}
