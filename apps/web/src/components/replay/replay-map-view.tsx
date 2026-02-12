'use client';

import { useReplayStore } from '@/stores/replay-store';
import type { Token, FogRegion } from '@dsvtt/shared';

/**
 * A simplified, read-only map view for the replay viewer.
 * Renders tokens and fog from the reconstructed game state.
 */
export function ReplayMapView() {
  const gameState = useReplayStore((s) => s.gameState);
  const currentIndex = useReplayStore((s) => s.currentIndex);

  if (!gameState) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-charcoal-950">
        <p className="text-sm text-parchment-500">
          {currentIndex < 0
            ? 'Press play or step forward to start the replay'
            : 'Loading state...'}
        </p>
      </div>
    );
  }

  // Extract tokens and fog from the reconstructed state
  const tokensMap = (gameState['tokens'] ?? {}) as Record<string, Token>;
  const fogMap = (gameState['fogRegions'] ?? {}) as Record<string, FogRegion>;
  const tokens = Object.values(tokensMap);
  const fogRegions = Object.values(fogMap);
  const turnState = gameState['turnState'] as {
    currentPlayerId: string | null;
    roundNumber: number;
    order: string[];
  } | null;

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-charcoal-950">
      {/* Turn state overlay */}
      {turnState && turnState.roundNumber > 0 && (
        <div className="flex shrink-0 items-center gap-3 border-b border-charcoal-800 bg-charcoal-900/80 px-3 py-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-parchment-500">
            Round {turnState.roundNumber}
          </span>
          {turnState.currentPlayerId && (
            <span className="text-xs text-gold-400">
              Current: {turnState.currentPlayerId.slice(0, 8)}...
            </span>
          )}
        </div>
      )}

      {/* Grid + tokens (simplified CSS-based rendering) */}
      <div className="flex-1 overflow-auto p-4">
        <div className="relative mx-auto" style={{ width: 800, height: 600 }}>
          {/* Background grid */}
          <div
            className="absolute inset-0 opacity-10"
            style={{
              backgroundSize: '64px 64px',
              backgroundImage:
                'linear-gradient(to right, #555 1px, transparent 1px), linear-gradient(to bottom, #555 1px, transparent 1px)',
            }}
          />

          {/* Fog regions */}
          {fogRegions.map((fog) => (
            <div
              key={fog.id}
              className={[
                'absolute rounded border',
                fog.revealed
                  ? 'border-emerald-700/30 bg-emerald-900/10'
                  : 'border-charcoal-600/50 bg-charcoal-900/80',
              ].join(' ')}
              style={{ left: 0, top: 0, width: 64, height: 64 }}
              title={fog.revealed ? 'Revealed' : 'Hidden'}
            />
          ))}

          {/* Tokens */}
          {tokens.map((token) => (
            <div
              key={token.id}
              className="absolute flex items-center justify-center rounded border border-gold-700/40 bg-charcoal-800/90 text-[10px] font-bold text-parchment-200 shadow-md"
              style={{
                left: token.x * 64,
                top: token.y * 64,
                width: token.width * 64,
                height: token.height * 64,
              }}
              title={`${token.name} (${token.x}, ${token.y})`}
            >
              {token.name.slice(0, 3).toUpperCase()}
            </div>
          ))}
        </div>
      </div>

      {/* State status */}
      <div className="shrink-0 border-t border-charcoal-800 bg-charcoal-900/60 px-3 py-1">
        <span className="text-[10px] text-parchment-500">
          Seq #{gameState['sequenceNumber'] as number} | Status: {gameState['status'] as string} | Tokens: {tokens.length}
        </span>
      </div>
    </div>
  );
}
