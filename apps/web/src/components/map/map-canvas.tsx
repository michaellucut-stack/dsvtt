'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type WheelEvent as ReactWheelEvent,
} from 'react';
import { Stage, Layer } from 'react-konva';
import type Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import { useMapStore } from '@/stores/map-store';
import { useAuthStore } from '@/stores/auth-store';
import { useRoomStore } from '@/stores/room-store';
import { GridLayer } from './grid-layer';
import { TokenLayer } from './token-layer';
import { FogLayer } from './fog-layer';
import { MapBackground } from './map-background';
import { MapToolbar } from './map-toolbar';

// ─── Constants ──────────────────────────────────────────────────────────────

const MIN_SCALE = 0.1;
const MAX_SCALE = 5;
const ZOOM_SPEED = 1.08;

// ─── Component ──────────────────────────────────────────────────────────────

export function MapCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);

  // Container dimensions
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // Map store state
  const currentMap = useMapStore((s) => s.currentMap);
  const tokens = useMapStore((s) => s.tokens);
  const fogRegions = useMapStore((s) => s.fogRegions);
  const selectedTokenId = useMapStore((s) => s.selectedTokenId);
  const tool = useMapStore((s) => s.tool);
  const viewport = useMapStore((s) => s.viewport);
  const gridVisible = useMapStore((s) => s.gridVisible);
  const setViewport = useMapStore((s) => s.setViewport);
  const setSelectedToken = useMapStore((s) => s.setSelectedToken);

  // Auth/room state for role determination
  const userId = useAuthStore((s) => s.user?.id);
  const currentRoom = useRoomStore((s) => s.currentRoom);
  const isDirector = currentRoom?.directorId === userId;

  // ── Responsive sizing ──────────────────────────────────────────────────

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateSize = () => {
      setDimensions({
        width: container.clientWidth,
        height: container.clientHeight,
      });
    };

    updateSize();

    const observer = new ResizeObserver(updateSize);
    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, []);

  // ── Mouse wheel zoom ──────────────────────────────────────────────────

  const handleWheel = useCallback(
    (e: KonvaEventObject<WheelEvent>) => {
      e.evt.preventDefault();

      const stage = stageRef.current;
      if (!stage) return;

      const oldScale = viewport.scale;
      const pointer = stage.getPointerPosition();
      if (!pointer) return;

      // Determine zoom direction
      const direction = e.evt.deltaY < 0 ? 1 : -1;
      const newScale = Math.min(
        MAX_SCALE,
        Math.max(MIN_SCALE, direction > 0 ? oldScale * ZOOM_SPEED : oldScale / ZOOM_SPEED),
      );

      // Zoom toward the pointer position
      const mousePointTo = {
        x: (pointer.x - viewport.x) / oldScale,
        y: (pointer.y - viewport.y) / oldScale,
      };

      const newX = pointer.x - mousePointTo.x * newScale;
      const newY = pointer.y - mousePointTo.y * newScale;

      setViewport({ x: newX, y: newY, scale: newScale });
    },
    [viewport, setViewport],
  );

  // ── Stage drag (pan) ──────────────────────────────────────────────────

  const handleDragEnd = useCallback(
    (e: KonvaEventObject<DragEvent>) => {
      // Only pan when dragging the stage itself
      if (e.target !== stageRef.current) return;
      setViewport({
        x: e.target.x(),
        y: e.target.y(),
      });
    },
    [setViewport],
  );

  // ── Click on empty space to deselect ──────────────────────────────────

  const handleStageClick = useCallback(
    (e: KonvaEventObject<MouseEvent>) => {
      // Only if clicking the stage background (not a token)
      if (e.target === stageRef.current) {
        setSelectedToken(null);
      }
    },
    [setSelectedToken],
  );

  // ── Stage draggable based on tool ─────────────────────────────────────

  const isDraggable = tool === 'move' || tool === 'select';

  if (!currentMap) {
    return (
      <div
        ref={containerRef}
        className="relative flex h-full w-full items-center justify-center bg-charcoal-950"
      >
        <p className="text-parchment-400">No map loaded</p>
      </div>
    );
  }

  const totalWidth = currentMap.gridWidth * currentMap.gridSize;
  const totalHeight = currentMap.gridHeight * currentMap.gridSize;

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden bg-charcoal-950">
      {/* Toolbar overlay */}
      <MapToolbar isDirector={isDirector} />

      {/* Konva Stage */}
      {dimensions.width > 0 && dimensions.height > 0 && (
        <Stage
          ref={stageRef}
          width={dimensions.width}
          height={dimensions.height}
          x={viewport.x}
          y={viewport.y}
          scaleX={viewport.scale}
          scaleY={viewport.scale}
          draggable={isDraggable}
          onWheel={handleWheel}
          onDragEnd={handleDragEnd}
          onClick={handleStageClick}
          onTap={handleStageClick}
          style={{ cursor: tool === 'move' ? 'grab' : 'default' }}
        >
          {/* Layer 1: Background */}
          <Layer listening={false}>
            <MapBackground
              backgroundUrl={currentMap.backgroundUrl}
              width={totalWidth}
              height={totalHeight}
            />
          </Layer>

          {/* Layer 2: Grid */}
          <Layer listening={false}>
            <GridLayer
              gridWidth={currentMap.gridWidth}
              gridHeight={currentMap.gridHeight}
              gridSize={currentMap.gridSize}
              visible={gridVisible}
            />
          </Layer>

          {/* Layer 3: Tokens */}
          <Layer>
            <TokenLayer
              tokens={tokens}
              gridSize={currentMap.gridSize}
              selectedTokenId={selectedTokenId}
              isDirector={isDirector}
            />
          </Layer>

          {/* Layer 4: Fog of War */}
          <Layer>
            <FogLayer
              fogRegions={fogRegions}
              gridSize={currentMap.gridSize}
              isDirector={isDirector}
            />
          </Layer>

          {/* Layer 5: GM overlay — only visible to director */}
          {isDirector && (
            <Layer listening={false}>
              {/* GM-only annotations / indicators can go here */}
            </Layer>
          )}
        </Stage>
      )}
    </div>
  );
}
