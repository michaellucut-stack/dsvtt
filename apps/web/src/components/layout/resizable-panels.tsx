'use client';

import {
  useState,
  useRef,
  useCallback,
  useEffect,
  type ReactNode,
  type MouseEvent as ReactMouseEvent,
} from 'react';

// ─── Types ──────────────────────────────────────────────────────────────────

interface PanelConfig {
  /** Unique key for localStorage persistence. */
  id: string;
  /** Content to render inside the panel. */
  children: ReactNode;
  /** Minimum width in pixels. */
  minWidth?: number;
  /** Maximum width in pixels. */
  maxWidth?: number;
  /** Default width in pixels (used when no persisted value exists). */
  defaultWidth?: number;
  /** Whether this panel flexes to fill remaining space. */
  flex?: boolean;
}

interface ResizablePanelsProps {
  /** Panel configurations (left to right). */
  panels: PanelConfig[];
  /** localStorage key prefix for persisting sizes. */
  storageKey?: string;
  /** CSS class for the container. */
  className?: string;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const DEFAULT_MIN_WIDTH = 200;
const DEFAULT_MAX_WIDTH = 800;
const HANDLE_WIDTH = 6;

// ─── Persistence helpers ────────────────────────────────────────────────────

function loadPersistedWidths(storageKey: string): Record<string, number> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, number>;
  } catch {
    return {};
  }
}

function persistWidths(
  storageKey: string,
  widths: Record<string, number>,
): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(storageKey, JSON.stringify(widths));
  } catch {
    // localStorage quota exceeded — ignore silently
  }
}

// ─── Drag Handle ────────────────────────────────────────────────────────────

interface DragHandleProps {
  onMouseDown: (e: ReactMouseEvent) => void;
  isDragging: boolean;
}

function DragHandle({ onMouseDown, isDragging }: DragHandleProps) {
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      onMouseDown={onMouseDown}
      className={[
        'group relative z-10 flex shrink-0 cursor-col-resize items-center justify-center',
        'transition-colors duration-100',
        isDragging
          ? 'bg-gold-600/30'
          : 'bg-transparent hover:bg-charcoal-700/60',
      ].join(' ')}
      style={{ width: HANDLE_WIDTH }}
    >
      {/* Visual indicator line */}
      <div
        className={[
          'h-8 w-0.5 rounded-full transition-colors duration-100',
          isDragging
            ? 'bg-gold-500'
            : 'bg-charcoal-600 group-hover:bg-parchment-500',
        ].join(' ')}
      />
    </div>
  );
}

// ─── ResizablePanels ────────────────────────────────────────────────────────

export function ResizablePanels({
  panels,
  storageKey = 'dsvtt-panel-sizes',
  className = '',
}: ResizablePanelsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragStateRef = useRef<{
    panelIndex: number;
    startX: number;
    startWidth: number;
  } | null>(null);

  const [activeDragIndex, setActiveDragIndex] = useState<number | null>(null);

  // Initialize widths from localStorage or defaults
  const [panelWidths, setPanelWidths] = useState<Record<string, number>>(
    () => {
      const persisted = loadPersistedWidths(storageKey);
      const initial: Record<string, number> = {};

      for (const panel of panels) {
        if (panel.flex) continue;
        initial[panel.id] =
          persisted[panel.id] ?? panel.defaultWidth ?? 320;
      }

      return initial;
    },
  );

  // Persist widths on change
  useEffect(() => {
    persistWidths(storageKey, panelWidths);
  }, [storageKey, panelWidths]);

  const handleMouseDown = useCallback(
    (panelIndex: number) => (e: ReactMouseEvent) => {
      e.preventDefault();
      const panel = panels[panelIndex];
      if (!panel || panel.flex) return;

      dragStateRef.current = {
        panelIndex,
        startX: e.clientX,
        startWidth: panelWidths[panel.id] ?? panel.defaultWidth ?? 320,
      };
      setActiveDragIndex(panelIndex);
    },
    [panels, panelWidths],
  );

  // Global mouse move/up handlers during drag
  useEffect(() => {
    if (activeDragIndex === null) return;

    const handleMouseMove = (e: globalThis.MouseEvent) => {
      const state = dragStateRef.current;
      if (!state) return;

      const panel = panels[state.panelIndex];
      if (!panel) return;

      // Determine drag direction: if the flex panel is to the left,
      // dragging right should shrink the non-flex panel
      const isBeforeFlex = panels
        .slice(state.panelIndex + 1)
        .some((p) => p.flex);

      const delta = e.clientX - state.startX;
      const newWidth = isBeforeFlex
        ? state.startWidth + delta
        : state.startWidth - delta;

      const min = panel.minWidth ?? DEFAULT_MIN_WIDTH;
      const max = panel.maxWidth ?? DEFAULT_MAX_WIDTH;
      const clamped = Math.max(min, Math.min(max, newWidth));

      setPanelWidths((prev) => ({ ...prev, [panel.id]: clamped }));
    };

    const handleMouseUp = () => {
      dragStateRef.current = null;
      setActiveDragIndex(null);
    };

    // Set cursor on body during drag
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [activeDragIndex, panels]);

  return (
    <div
      ref={containerRef}
      className={['flex h-full w-full overflow-hidden', className]
        .filter(Boolean)
        .join(' ')}
    >
      {panels.map((panel, index) => {
        const isLast = index === panels.length - 1;
        const showHandle = !isLast;

        // Find the adjacent non-flex panel for the drag handle
        // The handle resizes the non-flex panel on either side
        const handlePanelIndex = panel.flex
          ? // If current panel is flex, handle resizes the next panel
            index + 1 < panels.length && !panels[index + 1]!.flex
            ? index + 1
            : null
          : index;

        return (
          <div key={panel.id} className="contents">
            {/* Panel */}
            <div
              className={[
                'overflow-hidden',
                panel.flex ? 'flex-1 min-w-0' : 'shrink-0',
              ].join(' ')}
              style={
                panel.flex
                  ? undefined
                  : { width: panelWidths[panel.id] ?? panel.defaultWidth ?? 320 }
              }
            >
              {panel.children}
            </div>

            {/* Drag handle between panels */}
            {showHandle && handlePanelIndex !== null && (
              <DragHandle
                onMouseDown={handleMouseDown(handlePanelIndex)}
                isDragging={activeDragIndex === handlePanelIndex}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
