'use client';

import { useSearchStore } from '@/stores/search-store';

const TYPE_STYLES: Record<string, { icon: string; label: string; color: string }> = {
  chat: { icon: '💬', label: 'Chat', color: 'bg-blue-900/30 text-blue-400' },
  note: { icon: '📋', label: 'Note', color: 'bg-emerald-900/30 text-emerald-400' },
  character: { icon: '🧙', label: 'Character', color: 'bg-purple-900/30 text-purple-400' },
};

export function SearchResults() {
  const results = useSearchStore((s) => s.results);
  const total = useSearchStore((s) => s.total);
  const loading = useSearchStore((s) => s.loading);
  const error = useSearchStore((s) => s.error);
  const filters = useSearchStore((s) => s.filters);
  const setFilters = useSearchStore((s) => s.setFilters);

  const toggleType = (type: 'chat' | 'note' | 'character') => {
    const current = filters.types;
    if (current.includes(type)) {
      if (current.length === 1) return; // Keep at least one
      setFilters(current.filter((t) => t !== type));
    } else {
      setFilters([...current, type]);
    }
  };

  return (
    <div className="absolute right-0 top-full z-50 mt-1 w-80 rounded-lg border border-charcoal-700 bg-charcoal-900 shadow-xl">
      {/* Filter chips */}
      <div className="flex gap-1 border-b border-charcoal-800 px-3 py-2">
        {(['chat', 'note', 'character'] as const).map((type) => {
          const active = filters.types.includes(type);
          const meta = TYPE_STYLES[type]!;
          return (
            <button
              key={type}
              type="button"
              onClick={() => toggleType(type)}
              className={[
                'rounded-full px-2 py-0.5 text-[10px] font-semibold transition-colors',
                active ? meta.color : 'bg-charcoal-800 text-parchment-600',
              ].join(' ')}
            >
              {meta.icon} {meta.label}
            </button>
          );
        })}
      </div>

      {/* Results */}
      <div className="max-h-72 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-6">
            <span className="text-xs text-parchment-500">Searching...</span>
          </div>
        ) : error ? (
          <div className="px-3 py-4 text-xs text-crimson-400">{error}</div>
        ) : results.length === 0 ? (
          <div className="px-3 py-4 text-center text-xs text-parchment-600">No results found</div>
        ) : (
          results.map((result) => {
            const meta = TYPE_STYLES[result.type] ?? TYPE_STYLES['chat']!;
            return (
              <div
                key={`${result.type}-${result.id}`}
                className="border-b border-charcoal-800/50 px-3 py-2 transition-colors hover:bg-charcoal-800/50"
              >
                <div className="flex items-center gap-2">
                  <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${meta.color}`}>
                    {meta.icon} {meta.label}
                  </span>
                  <span className="text-[11px] font-semibold text-parchment-200">{result.title}</span>
                </div>
                <p className="mt-0.5 truncate text-[11px] text-parchment-400">{result.excerpt}</p>
                {result.timestamp && (
                  <span className="text-[9px] text-parchment-600">
                    {new Date(result.timestamp).toLocaleString()}
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      {total > 0 && (
        <div className="border-t border-charcoal-800 px-3 py-1.5">
          <span className="text-[10px] text-parchment-500">{total} results</span>
        </div>
      )}
    </div>
  );
}
