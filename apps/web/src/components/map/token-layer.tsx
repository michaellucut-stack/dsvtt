'use client';

import { memo, useCallback, useMemo, useRef } from 'react';
import 'konva/lib/shapes/Circle';
import 'konva/lib/shapes/Text';
import { Group, Circle, Text } from 'react-konva';
import type Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type { Token } from '@dsvtt/shared';
import { useMapStore } from '@/stores/map-store';
import { useAuthStore } from '@/stores/auth-store';

interface TokenLayerProps {
  tokens: Token[];
  gridSize: number;
  selectedTokenId: string | null;
  /** Whether the current user is the director. */
  isDirector: boolean;
}

interface TokenShapeProps {
  token: Token;
  gridSize: number;
  isSelected: boolean;
  isDraggable: boolean;
  isMoving: boolean;
  isDirector: boolean;
}

// ─── Token color from name (deterministic) ─────────────────────────────────

const TOKEN_PALETTE = [
  '#c0392b',
  '#e74c3c',
  '#9b59b6',
  '#8e44ad',
  '#2980b9',
  '#3498db',
  '#1abc9c',
  '#16a085',
  '#27ae60',
  '#2ecc71',
  '#f39c12',
  '#e67e22',
  '#d35400',
  '#e84393',
  '#6c5ce7',
  '#00b894',
  '#fdcb6e',
  '#e17055',
  '#0984e3',
  '#6ab04c',
];

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function getTokenColor(name: string): string {
  const idx = hashString(name) % TOKEN_PALETTE.length;
  return TOKEN_PALETTE[idx] ?? '#a87348';
}

/** Extract up to 2 initials from a name. E.g. "Goblin Scout" → "GS", "Orc" → "O" */
function getInitials(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) {
    return ((words[0]?.[0] ?? '') + (words[1]?.[0] ?? '')).toUpperCase();
  }
  return name.trim().slice(0, 2).toUpperCase();
}

// ─── Individual Token Component ─────────────────────────────────────────────

function TokenShapeInner({
  token,
  gridSize,
  isSelected,
  isDraggable,
  isMoving,
  isDirector,
}: TokenShapeProps) {
  const moveToken = useMapStore((s) => s.moveToken);
  const setSelectedToken = useMapStore((s) => s.setSelectedToken);
  const openContextMenu = useMapStore((s) => s.openContextMenu);
  const groupRef = useRef<Konva.Group>(null);

  const radius = gridSize / 2;
  // Position the group at the center of the grid cell
  const centerX = token.x * gridSize + radius;
  const centerY = token.y * gridSize + radius;

  const fillColor = useMemo(
    () => (token.imageUrl?.startsWith('#') ? token.imageUrl : getTokenColor(token.name)),
    [token.name, token.imageUrl],
  );
  const initials = useMemo(() => getInitials(token.name), [token.name]);

  const handleDragEnd = useCallback(
    (e: KonvaEventObject<DragEvent>) => {
      const node = e.target;
      // node.x()/y() is the center of the circle after dragging.
      // Convert back to grid cell (top-left corner).
      const snappedX = Math.round((node.x() - radius) / gridSize);
      const snappedY = Math.round((node.y() - radius) / gridSize);

      const clampedX = Math.max(0, snappedX);
      const clampedY = Math.max(0, snappedY);

      // Snap visual back to cell center
      node.position({
        x: clampedX * gridSize + radius,
        y: clampedY * gridSize + radius,
      });

      if (clampedX !== token.x || clampedY !== token.y) {
        moveToken(token.id, clampedX, clampedY);
      }
    },
    [gridSize, radius, moveToken, token.id, token.x, token.y],
  );

  const handleClick = useCallback(() => {
    setSelectedToken(token.id);
  }, [setSelectedToken, token.id]);

  const handleContextMenu = useCallback(
    (e: KonvaEventObject<PointerEvent>) => {
      if (!isDirector) return;
      e.evt.preventDefault();
      // Get screen-space position from the browser event
      openContextMenu(token.id, e.evt.clientX, e.evt.clientY);
    },
    [isDirector, openContextMenu, token.id],
  );

  const borderColor = isMoving ? '#22d3ee' : isSelected ? '#ffcc20' : 'rgba(0,0,0,0.4)';
  const borderWidth = isMoving ? 3 : isSelected ? 3 : 2;

  // Font size scales with grid, capped for readability
  const fontSize = Math.max(10, Math.min(radius * 0.7, 28));

  return (
    <Group
      ref={groupRef}
      x={centerX}
      y={centerY}
      draggable={isDraggable}
      onDragEnd={handleDragEnd}
      onClick={handleClick}
      onTap={handleClick}
      onContextMenu={handleContextMenu}
    >
      {/* Token circle — diameter equals one grid square */}
      <Circle
        radius={radius - borderWidth / 2}
        fill={fillColor}
        stroke={borderColor}
        strokeWidth={borderWidth}
        shadowColor="rgba(0,0,0,0.5)"
        shadowBlur={isSelected ? 10 : 4}
        shadowOffsetY={2}
      />

      {/* Initials rendered on top of the circle */}
      <Text
        text={initials}
        x={-radius}
        y={-radius}
        width={radius * 2}
        height={radius * 2}
        align="center"
        verticalAlign="middle"
        fontSize={fontSize}
        fontStyle="bold"
        fontFamily="Inter, system-ui, sans-serif"
        fill="#ffffff"
        listening={false}
      />

      {/* Visibility indicator for hidden tokens (director view) */}
      {!token.visible && (
        <Text
          text="H"
          x={radius - 12}
          y={-radius + 2}
          fontSize={10}
          fontFamily="Inter, system-ui, sans-serif"
          fill="#ff5f66"
          fontStyle="bold"
          listening={false}
        />
      )}
    </Group>
  );
}

const TokenShape = memo(TokenShapeInner);

// ─── Token Layer ────────────────────────────────────────────────────────────

function TokenLayerInner({ tokens, gridSize, selectedTokenId, isDirector }: TokenLayerProps) {
  const userId = useAuthStore((s) => s.user?.id);
  const movingToken = useMapStore((s) => s.movingToken);

  // Filter visible tokens for players; directors see all
  const visibleTokens = isDirector ? tokens : tokens.filter((t) => t.visible);

  return (
    <Group>
      {visibleTokens.map((token) => {
        const isDraggable = isDirector || token.ownerId === userId;
        return (
          <TokenShape
            key={token.id}
            token={token}
            gridSize={gridSize}
            isSelected={token.id === selectedTokenId}
            isDraggable={isDraggable}
            isMoving={movingToken?.tokenId === token.id}
            isDirector={isDirector}
          />
        );
      })}
    </Group>
  );
}

export const TokenLayer = memo(TokenLayerInner);
