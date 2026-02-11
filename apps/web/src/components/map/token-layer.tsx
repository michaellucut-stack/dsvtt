'use client';

import { memo, useCallback, useRef } from 'react';
import { Group, Rect, Text } from 'react-konva';
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
}

// ─── Derived token colors ───────────────────────────────────────────────────

const TOKEN_COLORS: Record<string, string> = {
  background: '#6e5130',
  token: '#a87348',
  effect: '#0b8f50',
  gm: '#c70d17',
};

function getTokenColor(layer: Token['layer']): string {
  return TOKEN_COLORS[layer] ?? '#a87348';
}

// ─── Individual Token Component ─────────────────────────────────────────────

function TokenShapeInner({
  token,
  gridSize,
  isSelected,
  isDraggable,
}: TokenShapeProps) {
  const moveToken = useMapStore((s) => s.moveToken);
  const setSelectedToken = useMapStore((s) => s.setSelectedToken);
  const groupRef = useRef<Konva.Group>(null);

  const pixelX = token.x * gridSize;
  const pixelY = token.y * gridSize;
  const pixelW = token.width * gridSize;
  const pixelH = token.height * gridSize;

  const handleDragEnd = useCallback(
    (e: KonvaEventObject<DragEvent>) => {
      const node = e.target;
      // Snap to nearest grid cell
      const snappedX = Math.round(node.x() / gridSize);
      const snappedY = Math.round(node.y() / gridSize);

      // Clamp to non-negative
      const clampedX = Math.max(0, snappedX);
      const clampedY = Math.max(0, snappedY);

      // Snap the visual position
      node.position({
        x: clampedX * gridSize,
        y: clampedY * gridSize,
      });

      // Emit movement if position changed
      if (clampedX !== token.x || clampedY !== token.y) {
        moveToken(token.id, clampedX, clampedY);
      }
    },
    [gridSize, moveToken, token.id, token.x, token.y],
  );

  const handleClick = useCallback(() => {
    setSelectedToken(token.id);
  }, [setSelectedToken, token.id]);

  const fillColor = getTokenColor(token.layer);
  const borderColor = isSelected ? '#ffcc20' : '#2c2d31';
  const borderWidth = isSelected ? 3 : 1;

  return (
    <Group
      ref={groupRef}
      x={pixelX}
      y={pixelY}
      draggable={isDraggable}
      onDragEnd={handleDragEnd}
      onClick={handleClick}
      onTap={handleClick}
    >
      {/* Token background */}
      <Rect
        width={pixelW}
        height={pixelH}
        fill={fillColor}
        stroke={borderColor}
        strokeWidth={borderWidth}
        cornerRadius={4}
        shadowColor="rgba(0,0,0,0.5)"
        shadowBlur={isSelected ? 8 : 4}
        shadowOffsetY={2}
      />

      {/* Token label */}
      <Text
        text={token.name}
        width={pixelW}
        height={pixelH}
        align="center"
        verticalAlign="middle"
        fontSize={Math.min(14, gridSize * 0.3)}
        fontFamily="Inter, system-ui, sans-serif"
        fill="#fdf9f0"
        listening={false}
        ellipsis
        wrap="none"
        padding={4}
      />

      {/* Visibility indicator for hidden tokens (director view) */}
      {!token.visible && (
        <Text
          text="H"
          x={pixelW - 16}
          y={2}
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

function TokenLayerInner({
  tokens,
  gridSize,
  selectedTokenId,
  isDirector,
}: TokenLayerProps) {
  const userId = useAuthStore((s) => s.user?.id);

  // Filter visible tokens for players; directors see all
  const visibleTokens = isDirector
    ? tokens
    : tokens.filter((t) => t.visible);

  return (
    <Group>
      {visibleTokens.map((token) => {
        const isDraggable =
          isDirector || token.ownerId === userId;
        return (
          <TokenShape
            key={token.id}
            token={token}
            gridSize={gridSize}
            isSelected={token.id === selectedTokenId}
            isDraggable={isDraggable}
          />
        );
      })}
    </Group>
  );
}

export const TokenLayer = memo(TokenLayerInner);
