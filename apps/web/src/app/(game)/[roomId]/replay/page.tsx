'use client';

import { useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useReplayStore } from '@/stores/replay-store';
import { ReplayTimeline } from '@/components/replay/replay-timeline';
import { ReplayControls } from '@/components/replay/replay-controls';
import { ReplayMapView } from '@/components/replay/replay-map-view';
import { ReplayEventLog } from '@/components/replay/replay-event-log';
import { ResizablePanels } from '@/components/layout/resizable-panels';
import { Loading } from '@/components/ui/loading';

export default function ReplayPage() {
  const params = useParams<{ roomId: string }>();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('sessionId');

  const loadSession = useReplayStore((s) => s.loadSession);
  const reset = useReplayStore((s) => s.reset);
  const loading = useReplayStore((s) => s.loading);
  const error = useReplayStore((s) => s.error);
  const totalEvents = useReplayStore((s) => s.totalEvents);

  useEffect(() => {
    if (sessionId) {
      loadSession(sessionId);
    }
    return () => reset();
  }, [sessionId, loadSession, reset]);

  if (!sessionId) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-charcoal-950">
        <p className="text-sm text-parchment-400">No session ID provided. Add ?sessionId=... to the URL.</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen flex-col bg-charcoal-950">
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-charcoal-800 bg-charcoal-900/95 px-4 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <a
            href={`/${params.roomId}`}
            className="text-parchment-400 transition-colors hover:text-parchment-100"
            title="Back to game room"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </a>
          <h1 className="font-heading text-sm font-semibold tracking-wide text-parchment-100">
            Session Replay
          </h1>
          <span className="rounded-full bg-gold-900/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-gold-400">
            REPLAY
          </span>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-xs text-parchment-500">
            {totalEvents} events
          </span>
        </div>
      </header>

      {/* ── Main Content ─────────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex flex-1 items-center justify-center">
          <Loading size={48} />
        </div>
      ) : error ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-crimson-400">{error}</p>
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-hidden">
            <ResizablePanels
              storageKey="dsvtt-replay-panels"
              panels={[
                {
                  id: 'map',
                  flex: true,
                  children: <ReplayMapView />,
                },
                {
                  id: 'eventlog',
                  defaultWidth: 400,
                  minWidth: 300,
                  maxWidth: 600,
                  children: (
                    <aside className="h-full border-l border-charcoal-800 bg-charcoal-900/60">
                      <ReplayEventLog />
                    </aside>
                  ),
                },
              ]}
            />
          </div>

          {/* ── Timeline + Controls ──────────────────────────────────────── */}
          <div className="shrink-0 border-t border-charcoal-800 bg-charcoal-900/95 px-4 py-3 backdrop-blur-sm">
            <ReplayTimeline />
            <ReplayControls />
          </div>
        </>
      )}
    </div>
  );
}
