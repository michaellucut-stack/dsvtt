'use client';

import dynamic from 'next/dynamic';
import type { ComponentType } from 'react';

// ─── Loading fallbacks ───────────────────────────────────────────────────────

/** Full-area spinner for the map canvas chunk. */
function MapLoadingSkeleton() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-charcoal-950">
      <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-gold-500 border-t-transparent" />
    </div>
  );
}

/** Compact spinner for sidebar panel chunks. */
function PanelLoadingSkeleton() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-charcoal-900/40">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-gold-500 border-t-transparent" />
    </div>
  );
}

// ─── Map ─────────────────────────────────────────────────────────────────────

/**
 * Lazy-loaded MapCanvas — the heaviest component (Konva + react-konva).
 * SSR disabled because Konva requires a browser canvas context.
 */
export const LazyMapCanvas = dynamic(
  () =>
    import('@/components/map/map-canvas').then((mod) => ({
      default: mod.MapCanvas as ComponentType,
    })),
  {
    ssr: false,
    loading: () => <MapLoadingSkeleton />,
  },
);

// ─── Game panels ─────────────────────────────────────────────────────────────

/** Lazy-loaded DiceRoller panel. */
export const LazyDiceRoller = dynamic(
  () =>
    import('@/components/game/dice-roller').then((mod) => ({
      default: mod.DiceRoller as ComponentType<{ sessionId: string }>,
    })),
  {
    ssr: false,
    loading: () => <PanelLoadingSkeleton />,
  },
);

/** Lazy-loaded ChatPanel. */
export const LazyChatPanel = dynamic(
  () =>
    import('@/components/game/chat-panel').then((mod) => ({
      default: mod.ChatPanel as ComponentType<{ sessionId: string }>,
    })),
  {
    ssr: false,
    loading: () => <PanelLoadingSkeleton />,
  },
);

/** Lazy-loaded DirectorPanel (DM-only). */
export const LazyDirectorPanel = dynamic(
  () =>
    import('@/components/game/director-panel').then((mod) => ({
      default: mod.DirectorPanel as ComponentType<{ sessionId: string }>,
    })),
  {
    ssr: false,
    loading: () => <PanelLoadingSkeleton />,
  },
);

/** Lazy-loaded CharacterSheet. */
export const LazyCharacterSheet = dynamic(
  () =>
    import('@/components/game/character-sheet').then((mod) => ({
      default: mod.CharacterSheet as ComponentType<{ sessionId: string }>,
    })),
  {
    ssr: false,
    loading: () => <PanelLoadingSkeleton />,
  },
);

// ─── Replay ──────────────────────────────────────────────────────────────────

/** Lazy-loaded ReplayControls (play/pause/seek bar). */
export const LazyReplayControls = dynamic(
  () =>
    import('@/components/replay/replay-controls').then((mod) => ({
      default: mod.ReplayControls as ComponentType,
    })),
  {
    ssr: false,
    loading: () => <PanelLoadingSkeleton />,
  },
);

/** Lazy-loaded ReplayTimeline (event timeline visualization). */
export const LazyReplayTimeline = dynamic(
  () =>
    import('@/components/replay/replay-timeline').then((mod) => ({
      default: mod.ReplayTimeline as ComponentType,
    })),
  {
    ssr: false,
    loading: () => <PanelLoadingSkeleton />,
  },
);
