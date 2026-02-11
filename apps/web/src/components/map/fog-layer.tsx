'use client';

import { memo, useCallback } from 'react';
import { Group, Shape } from 'react-konva';
import type { Context } from 'konva/lib/Context';
import type Konva from 'konva';
import type { FogRegion } from '@dsvtt/shared';
import { useMapStore } from '@/stores/map-store';

interface FogLayerProps {
  fogRegions: FogRegion[];
  gridSize: number;
  isDirector: boolean;
}

interface FogRegionShapeProps {
  region: FogRegion;
  gridSize: number;
  isDirector: boolean;
}

// ─── Individual Fog Region ──────────────────────────────────────────────────

function FogRegionShapeInner({
  region,
  gridSize,
  isDirector,
}: FogRegionShapeProps) {
  const updateFog = useMapStore((s) => s.updateFog);

  // Convert grid coordinates to pixel coordinates for the polygon
  const pixelPoints = region.points.map((p) => ({
    x: p.x * gridSize,
    y: p.y * gridSize,
  }));

  const handleClick = useCallback(() => {
    if (isDirector) {
      updateFog(region.id, !region.revealed);
    }
  }, [isDirector, updateFog, region.id, region.revealed]);

  // Players: only render unrevealed fog as solid black
  if (!isDirector && region.revealed) return null;

  // Director: show all regions. Revealed = semi-transparent outline; unrevealed = semi-transparent fill
  const fillColor = isDirector
    ? region.revealed
      ? 'rgba(23, 177, 100, 0.1)' // Revealed: faint green tint
      : 'rgba(0, 0, 0, 0.6)' // Unrevealed: dark overlay
    : 'rgba(0, 0, 0, 1)'; // Player unrevealed: solid black

  const strokeColor = isDirector
    ? region.revealed
      ? 'rgba(23, 177, 100, 0.5)'
      : 'rgba(200, 50, 50, 0.6)'
    : 'transparent';

  const sceneFunc = useCallback(
    (context: Context, shape: Konva.Shape) => {
      if (pixelPoints.length < 3) return;
      const first = pixelPoints[0]!;
      context.beginPath();
      context.moveTo(first.x, first.y);
      for (let i = 1; i < pixelPoints.length; i++) {
        const pt = pixelPoints[i]!;
        context.lineTo(pt.x, pt.y);
      }
      context.closePath();
      context.fillStrokeShape(shape);
    },
    [pixelPoints],
  );

  return (
    <Shape
      sceneFunc={sceneFunc}
      fill={fillColor}
      stroke={strokeColor}
      strokeWidth={isDirector ? 2 : 0}
      onClick={handleClick}
      onTap={handleClick}
      listening={isDirector}
      hitFunc={
        isDirector
          ? (context: Context, shape: Konva.Shape) => {
              if (pixelPoints.length < 3) return;
              const f = pixelPoints[0]!;
              context.beginPath();
              context.moveTo(f.x, f.y);
              for (let i = 1; i < pixelPoints.length; i++) {
                const pt = pixelPoints[i]!;
                context.lineTo(pt.x, pt.y);
              }
              context.closePath();
              context.fillStrokeShape(shape);
            }
          : undefined
      }
    />
  );
}

const FogRegionShape = memo(FogRegionShapeInner);

// ─── Fog Layer ──────────────────────────────────────────────────────────────

function FogLayerInner({
  fogRegions,
  gridSize,
  isDirector,
}: FogLayerProps) {
  return (
    <Group>
      {fogRegions.map((region) => (
        <FogRegionShape
          key={region.id}
          region={region}
          gridSize={gridSize}
          isDirector={isDirector}
        />
      ))}
    </Group>
  );
}

export const FogLayer = memo(FogLayerInner);
