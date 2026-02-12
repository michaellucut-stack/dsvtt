'use client';

import { memo, useEffect, useRef, useState } from 'react';
import 'konva/lib/shapes/Image';
import 'konva/lib/shapes/Rect';
import { Image as KonvaImage, Rect } from 'react-konva';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

/** Resolve a potentially relative URL against the API server origin. */
function resolveAssetUrl(url: string): string {
  if (url.startsWith('/')) return `${API_BASE_URL}${url}`;
  return url;
}

interface MapBackgroundProps {
  backgroundUrl: string | null;
  width: number;
  height: number;
  /** Called once the background image loads with its natural pixel dimensions. */
  onImageLoaded?: (naturalWidth: number, naturalHeight: number) => void;
}

/**
 * Loads and renders the map background image using Konva.Image.
 * The image is rendered at its natural aspect ratio — never stretched.
 * It is displayed at the provided width/height (which should already
 * account for the image's native dimensions).
 */
function MapBackgroundInner({ backgroundUrl, width, height, onImageLoaded }: MapBackgroundProps) {
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
        onImageLoaded?.(img.naturalWidth, img.naturalHeight);
      }
    };

    img.onerror = () => {
      if (mountedRef.current) {
        setImage(null);
        setLoading(false);
      }
    };

    img.src = resolveAssetUrl(backgroundUrl);

    return () => {
      img.onload = null;
      img.onerror = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
