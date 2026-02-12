'use client';

import { memo } from 'react';
import { Group, Line } from 'react-konva';
import 'konva/lib/shapes/Line';

interface GridLayerProps {
  gridWidth: number;
  gridHeight: number;
  gridSize: number;
  visible: boolean;
  color?: string;
  opacity?: number;
}

/**
 * Renders a grid overlay as Konva Lines.
 * Each line spans the full width/height of the map grid.
 */
function GridLayerInner({
  gridWidth,
  gridHeight,
  gridSize,
  visible,
  color = '#ffffff',
  opacity = 0.15,
}: GridLayerProps) {
  if (!visible) return null;

  const totalWidth = gridWidth * gridSize;
  const totalHeight = gridHeight * gridSize;

  const verticalLines: JSX.Element[] = [];
  const horizontalLines: JSX.Element[] = [];

  // Vertical lines (columns)
  for (let col = 0; col <= gridWidth; col++) {
    const x = col * gridSize;
    verticalLines.push(
      <Line
        key={`v-${col}`}
        points={[x, 0, x, totalHeight]}
        stroke={color}
        strokeWidth={1}
        opacity={opacity}
        listening={false}
        perfectDrawEnabled={false}
      />,
    );
  }

  // Horizontal lines (rows)
  for (let row = 0; row <= gridHeight; row++) {
    const y = row * gridSize;
    horizontalLines.push(
      <Line
        key={`h-${row}`}
        points={[0, y, totalWidth, y]}
        stroke={color}
        strokeWidth={1}
        opacity={opacity}
        listening={false}
        perfectDrawEnabled={false}
      />,
    );
  }

  return (
    <Group listening={false}>
      {verticalLines}
      {horizontalLines}
    </Group>
  );
}

export const GridLayer = memo(GridLayerInner);
