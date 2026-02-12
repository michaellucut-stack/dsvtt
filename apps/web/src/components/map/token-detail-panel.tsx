'use client';

import { useCallback, useEffect, useState } from 'react';
import type { TokenLayer } from '@dsvtt/shared';
import { useMapStore } from '@/stores/map-store';

const LAYER_OPTIONS: { value: TokenLayer; label: string }[] = [
  { value: 'token', label: 'Token' },
  { value: 'background', label: 'Background' },
  { value: 'effect', label: 'Effect' },
  { value: 'gm', label: 'GM Only' },
];

/**
 * Director-only panel for viewing and editing token properties.
 * Slides in from the right side of the map.
 */
export function TokenDetailPanel() {
  const editingTokenId = useMapStore((s) => s.editingTokenId);
  const tokens = useMapStore((s) => s.tokens);
  const setEditingToken = useMapStore((s) => s.setEditingToken);
  const removeToken = useMapStore((s) => s.removeToken);
  const startMovingToken = useMapStore((s) => s.startMovingToken);

  const token = tokens.find((t) => t.id === editingTokenId);

  const [name, setName] = useState('');
  const [layer, setLayer] = useState<TokenLayer>('token');
  const [visible, setVisible] = useState(true);

  // Sync form state when token changes
  useEffect(() => {
    if (token) {
      setName(token.name);
      setLayer(token.layer);
      setVisible(token.visible);
    }
  }, [token]);

  const handleSave = useCallback(() => {
    if (!token || !editingTokenId) return;

    // Optimistic local update
    // TODO: emit TOKEN_UPDATE socket event when backend supports it
    useMapStore.setState((state) => ({
      tokens: state.tokens.map((t) =>
        t.id === editingTokenId ? { ...t, name: name.trim() || t.name, layer, visible } : t,
      ),
    }));

    setEditingToken(null);
  }, [token, editingTokenId, name, layer, visible, setEditingToken]);

  const handleDelete = useCallback(() => {
    if (editingTokenId) {
      removeToken(editingTokenId);
      setEditingToken(null);
    }
  }, [editingTokenId, removeToken, setEditingToken]);

  const handleMove = useCallback(() => {
    if (editingTokenId) {
      startMovingToken(editingTokenId);
      setEditingToken(null);
    }
  }, [editingTokenId, startMovingToken, setEditingToken]);

  const handleClose = useCallback(() => {
    setEditingToken(null);
  }, [setEditingToken]);

  // Close on Escape
  useEffect(() => {
    if (!editingTokenId) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [editingTokenId, handleClose]);

  if (!editingTokenId || !token) return null;

  return (
    <div className="absolute right-3 top-3 z-30 w-64 rounded-panel border border-charcoal-700/60 bg-charcoal-900/95 shadow-panel backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-charcoal-700/40 px-3 py-2">
        <h3 className="text-sm font-semibold text-parchment-100">Token Details</h3>
        <button
          type="button"
          onClick={handleClose}
          className="text-parchment-500 hover:text-parchment-200 transition-colors"
          title="Close"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Form */}
      <div className="p-3 space-y-3">
        {/* Name */}
        <div>
          <label className="block text-[10px] font-medium text-parchment-400 mb-0.5">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="block w-full rounded-card border border-charcoal-600 bg-charcoal-800/80 px-2 py-1 text-sm text-parchment-100 focus:border-gold-600 focus:outline-none focus:ring-1 focus:ring-gold-500/40"
          />
        </div>

        {/* Position (read-only) */}
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="block text-[10px] font-medium text-parchment-400 mb-0.5">Col</label>
            <div className="rounded-card border border-charcoal-700 bg-charcoal-800/50 px-2 py-1 text-sm text-parchment-300">
              {token.x}
            </div>
          </div>
          <div className="flex-1">
            <label className="block text-[10px] font-medium text-parchment-400 mb-0.5">Row</label>
            <div className="rounded-card border border-charcoal-700 bg-charcoal-800/50 px-2 py-1 text-sm text-parchment-300">
              {token.y}
            </div>
          </div>
        </div>

        {/* Layer */}
        <div>
          <label className="block text-[10px] font-medium text-parchment-400 mb-0.5">Layer</label>
          <select
            value={layer}
            onChange={(e) => setLayer(e.target.value as TokenLayer)}
            className="block w-full rounded-card border border-charcoal-600 bg-charcoal-800/80 px-2 py-1 text-sm text-parchment-100 focus:border-gold-600 focus:outline-none focus:ring-1 focus:ring-gold-500/40"
          >
            {LAYER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Visible */}
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={visible}
            onChange={(e) => setVisible(e.target.checked)}
            className="rounded border-charcoal-600 bg-charcoal-800 text-gold-600 focus:ring-gold-500/40"
          />
          <span className="text-xs text-parchment-300">Visible to players</span>
        </label>
      </div>

      {/* Actions */}
      <div className="flex gap-1.5 border-t border-charcoal-700/40 px-3 py-2">
        <button
          type="button"
          onClick={handleSave}
          className="flex-1 rounded-card bg-gold-600 px-2 py-1 text-xs font-semibold text-charcoal-950 transition-colors hover:bg-gold-500"
        >
          Save
        </button>
        <button
          type="button"
          onClick={handleMove}
          className="rounded-card bg-charcoal-700 px-2 py-1 text-xs font-semibold text-parchment-300 transition-colors hover:bg-charcoal-600"
        >
          Move
        </button>
        <button
          type="button"
          onClick={handleDelete}
          className="rounded-card bg-red-800/80 px-2 py-1 text-xs font-semibold text-parchment-300 transition-colors hover:bg-red-700/80"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
