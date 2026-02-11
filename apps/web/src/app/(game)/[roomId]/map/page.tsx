'use client';

import { useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useMapStore } from '@/stores/map-store';
import { MapCanvas } from '@/components/map/map-canvas';
import { Loading } from '@/components/ui/loading';

/**
 * Map page — renders the full-screen map canvas for a game room.
 * Fetches the map state on mount and subscribes to Socket.IO updates.
 */
export default function MapPage() {
  const params = useParams<{ roomId: string }>();
  const loading = useMapStore((s) => s.loading);
  const error = useMapStore((s) => s.error);
  const currentMap = useMapStore((s) => s.currentMap);
  const fetchMapState = useMapStore((s) => s.fetchMapState);
  const subscribeToSocket = useMapStore((s) => s.subscribeToSocket);
  const clearMap = useMapStore((s) => s.clearMap);

  // Subscribe to socket events
  useEffect(() => {
    const unsubscribe = subscribeToSocket();
    return unsubscribe;
  }, [subscribeToSocket]);

  // Fetch map state — use roomId as a proxy for map lookup
  // In production, the server resolves the active map for the room's session
  useEffect(() => {
    if (params.roomId) {
      fetchMapState(params.roomId);
    }
    return () => {
      clearMap();
    };
  }, [params.roomId, fetchMapState, clearMap]);

  if (loading) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-charcoal-950">
        <Loading size={48} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-charcoal-950">
        <p className="text-crimson-400">{error}</p>
        <button
          type="button"
          onClick={() => params.roomId && fetchMapState(params.roomId)}
          className="rounded-card bg-charcoal-700 px-4 py-2 text-sm text-parchment-200 transition-colors hover:bg-charcoal-600"
        >
          Retry
        </button>
      </div>
    );
  }

  return <MapCanvas />;
}
