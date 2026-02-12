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
import { TokenContextMenu } from './token-context-menu';
import { TokenDetailPanel } from './token-detail-panel';

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
  const setImageNaturalSize = useMapStore((s) => s.setImageNaturalSize);
  const movingToken = useMapStore((s) => s.movingToken);
  const moveToken = useMapStore((s) => s.moveToken);
  const cancelMovingToken = useMapStore((s) => s.cancelMovingToken);
  const closeContextMenu = useMapStore((s) => s.closeContextMenu);

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

  // ── Background image loaded callback ─────────────────────────────────

  const handleImageLoaded = useCallback(
    (naturalWidth: number, naturalHeight: number) => {
      setImageNaturalSize(naturalWidth, naturalHeight);
    },
    [setImageNaturalSize],
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

  // ── Click on empty space: deselect or click-to-move ──────────────────
  // effectiveGridSize is computed below after early return; use a ref to
  // avoid "used before declaration" in the callback.
  const effectiveGridSizeRef = useRef(64);

  const handleStageClick = useCallback(
    (e: KonvaEventObject<MouseEvent>) => {
      // Close context menu on any click
      closeContextMenu();

      // Only process clicks on the stage background (not on tokens)
      if (e.target !== stageRef.current) return;

      // If we're in click-to-move mode, move the token to the clicked cell
      if (movingToken) {
        const stage = stageRef.current;
        if (!stage) return;
        const pointer = stage.getPointerPosition();
        if (!pointer) return;

        const gs = effectiveGridSizeRef.current;
        const scale = viewport.scale;
        const gridX = Math.floor((pointer.x - viewport.x) / scale / gs);
        const gridY = Math.floor((pointer.y - viewport.y) / scale / gs);
        const clampedX = Math.max(0, gridX);
        const clampedY = Math.max(0, gridY);

        moveToken(movingToken.tokenId, clampedX, clampedY);
        cancelMovingToken();
        return;
      }

      // Default: deselect
      setSelectedToken(null);
    },
    [setSelectedToken, closeContextMenu, movingToken, moveToken, cancelMovingToken, viewport],
  );

  // ── Stage draggable based on tool ─────────────────────────────────────

  // Disable drag when in click-to-move mode so the click lands on the stage
  const isDraggable = !movingToken && (tool === 'move' || tool === 'select');

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

  // When the background image is loaded, use its natural size as the canvas size.
  // The grid cell size is derived so the grid fits exactly over the image.
  // When no image is loaded, fall back to gridWidth * gridSize.
  const imgW = currentMap.imageNaturalWidth;
  const imgH = currentMap.imageNaturalHeight;
  const totalWidth = imgW ?? currentMap.gridWidth * currentMap.gridSize;
  const totalHeight = imgH ?? currentMap.gridHeight * currentMap.gridSize;

  // Derive grid cell size from image dimensions so the grid fits the image exactly.
  // Use the smaller of width-derived and height-derived cell sizes so cells are square.
  const effectiveGridSize =
    imgW && imgH
      ? Math.min(imgW / currentMap.gridWidth, imgH / currentMap.gridHeight)
      : currentMap.gridSize;

  // Keep the ref in sync for the click handler
  effectiveGridSizeRef.current = effectiveGridSize;

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden bg-charcoal-950"
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Toolbar overlay */}
      <MapToolbar isDirector={isDirector} />

      {/* Director-only overlays */}
      {isDirector && <TokenContextMenu />}
      {isDirector && <TokenDetailPanel />}

      {/* Click-to-move indicator */}
      {movingToken && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-30 rounded-panel border border-cyan-500/40 bg-charcoal-900/90 px-4 py-2 text-xs text-cyan-300 shadow-panel backdrop-blur-sm">
          Click a cell to move token &mdash;{' '}
          <button
            type="button"
            onClick={cancelMovingToken}
            className="underline text-parchment-300 hover:text-parchment-100"
          >
            Cancel
          </button>
        </div>
      )}

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
          style={{ cursor: movingToken ? 'crosshair' : tool === 'move' ? 'grab' : 'default' }}
        >
          {/* Layer 1: Background */}
          <Layer listening={false}>
            <MapBackground
              backgroundUrl={currentMap.backgroundUrl}
              width={totalWidth}
              height={totalHeight}
              onImageLoaded={handleImageLoaded}
            />
          </Layer>

          {/* Layer 2: Grid */}
          <Layer listening={false}>
            <GridLayer
              gridWidth={currentMap.gridWidth}
              gridHeight={currentMap.gridHeight}
              gridSize={effectiveGridSize}
              visible={gridVisible}
            />
          </Layer>

          {/* Layer 3: Tokens */}
          <Layer>
            <TokenLayer
              tokens={tokens}
              gridSize={effectiveGridSize}
              selectedTokenId={selectedTokenId}
              isDirector={isDirector}
            />
          </Layer>

          {/* Layer 4: Fog of War */}
          <Layer>
            <FogLayer
              fogRegions={fogRegions}
              gridSize={effectiveGridSize}
              isDirector={isDirector}
            />
          </Layer>

          {/* Layer 5: GM overlay — only visible to director */}
          {isDirector && (
            <Layer listening={false}>{/* GM-only annotations / indicators can go here */}</Layer>
          )}
        </Stage>
      )}
    </div>
  );
}
