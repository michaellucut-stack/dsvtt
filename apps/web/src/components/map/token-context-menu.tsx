'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useMapStore } from '@/stores/map-store';

/**
 * Director-only right-click context menu for tokens.
 * Rendered as an HTML overlay positioned at screen coordinates.
 */
export function TokenContextMenu() {
  const contextMenu = useMapStore((s) => s.contextMenu);
  const tokens = useMapStore((s) => s.tokens);
  const closeContextMenu = useMapStore((s) => s.closeContextMenu);
  const startMovingToken = useMapStore((s) => s.startMovingToken);
  const setEditingToken = useMapStore((s) => s.setEditingToken);
  const removeToken = useMapStore((s) => s.removeToken);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on click outside or Escape
  useEffect(() => {
    if (!contextMenu) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        closeContextMenu();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeContextMenu();
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [contextMenu, closeContextMenu]);

  if (!contextMenu) return null;

  const token = tokens.find((t) => t.id === contextMenu.tokenId);
  if (!token) return null;

  const items: { label: string; action: () => void; variant?: 'danger' }[] = [
    {
      label: 'View Details',
      action: () => setEditingToken(contextMenu.tokenId),
    },
    {
      label: 'Edit',
      action: () => setEditingToken(contextMenu.tokenId),
    },
    {
      label: 'Move',
      action: () => startMovingToken(contextMenu.tokenId),
    },
    {
      label: 'Delete',
      action: () => {
        removeToken(contextMenu.tokenId);
        closeContextMenu();
      },
      variant: 'danger',
    },
  ];

  return (
    <div
      ref={menuRef}
      className="fixed z-50 min-w-[160px] rounded-panel border border-charcoal-700/60 bg-charcoal-900/95 py-1 shadow-panel backdrop-blur-sm"
      style={{ left: contextMenu.x, top: contextMenu.y }}
    >
      {/* Token name header */}
      <div className="px-3 py-1.5 text-xs font-semibold text-parchment-200 border-b border-charcoal-700/40 mb-0.5">
        {token.name}
        <span className="ml-1.5 text-[10px] font-normal text-parchment-500">({token.layer})</span>
      </div>

      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          onClick={item.action}
          className={[
            'flex w-full items-center px-3 py-1.5 text-xs transition-colors',
            item.variant === 'danger'
              ? 'text-red-400 hover:bg-red-900/30 hover:text-red-300'
              : 'text-parchment-300 hover:bg-charcoal-700/60 hover:text-parchment-100',
          ].join(' ')}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
