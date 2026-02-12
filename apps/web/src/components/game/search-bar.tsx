'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useSearchStore, debouncedSearch } from '@/stores/search-store';
import { SearchResults } from './search-results';

interface SearchBarProps {
  sessionId: string;
}

export function SearchBar({ sessionId }: SearchBarProps) {
  const query = useSearchStore((s) => s.query);
  const isOpen = useSearchStore((s) => s.isOpen);
  const toggleOpen = useSearchStore((s) => s.toggleOpen);
  const close = useSearchStore((s) => s.close);
  const clear = useSearchStore((s) => s.clear);

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      debouncedSearch(sessionId, e.target.value);
    },
    [sessionId],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        close();
      }
    },
    [close],
  );

  // Keyboard shortcut: Ctrl+K / Cmd+K
  useEffect(() => {
    function handleGlobalKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        toggleOpen();
        setTimeout(() => inputRef.current?.focus(), 50);
      }
    }
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [toggleOpen]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        close();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, close]);

  return (
    <div ref={containerRef} className="relative">
      {/* Search trigger / input */}
      {isOpen ? (
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder="Search chat, notes, characters..."
            className="w-48 rounded border border-charcoal-700 bg-charcoal-800 px-2 py-1 text-xs text-parchment-200 placeholder-parchment-600 outline-none focus:border-gold-700"
            autoFocus
          />
          <button
            type="button"
            onClick={clear}
            className="text-parchment-500 hover:text-parchment-200"
            title="Close search"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            toggleOpen();
            setTimeout(() => inputRef.current?.focus(), 50);
          }}
          className="flex items-center gap-1.5 rounded px-2 py-1 text-parchment-400 transition-colors hover:bg-charcoal-800 hover:text-parchment-200"
          title="Search (Ctrl+K)"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <span className="text-[10px]">Ctrl+K</span>
        </button>
      )}

      {/* Results dropdown */}
      {isOpen && query.trim() && <SearchResults />}
    </div>
  );
}
