'use client';

import { memo, useEffect, useRef, useState } from 'react';
import { Image as KonvaImage, Rect } from 'react-konva';

interface MapBackgroundProps {
  backgroundUrl: string | null;
  width: number;
  height: number;
}

/**
 * Loads and renders the map background image using Konva.Image.
 * Falls back to a dark rectangle if no image is provided or while loading.
 */
function MapBackgroundInner({
  backgroundUrl,
  width,
  height,
}: MapBackgroundProps) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [loading, setLoading] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!backgroundUrl) {
      setImage(null);
      return;
    }

    setLoading(true);
    const img = new window.Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      if (mountedRef.current) {
        setImage(img);
        setLoading(false);
      }
    };

    img.onerror = () => {
      if (mountedRef.current) {
        setImage(null);
        setLoading(false);
      }
    };

    img.src = backgroundUrl;

    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [backgroundUrl]);

  // Fallback dark background
  if (!image || loading) {
    return (
      <Rect
        x={0}
        y={0}
        width={width}
        height={height}
        fill="#1a1b1e"
        listening={false}
        perfectDrawEnabled={false}
      />
    );
  }

  return (
    <KonvaImage
      image={image}
      x={0}
      y={0}
      width={width}
      height={height}
      listening={false}
      perfectDrawEnabled={false}
    />
  );
}

export const MapBackground = memo(MapBackgroundInner);
