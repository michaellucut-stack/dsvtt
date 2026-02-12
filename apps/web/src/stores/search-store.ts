import { create } from 'zustand';
import { apiClient } from '@/lib/api';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface SearchResultItem {
  type: 'chat' | 'note' | 'character';
  id: string;
  sessionId: string;
  title: string;
  excerpt: string;
  timestamp: string;
  metadata: Record<string, unknown>;
}

interface SearchState {
  query: string;
  results: SearchResultItem[];
  total: number;
  loading: boolean;
  error: string | null;
  isOpen: boolean;
  filters: {
    types: ('chat' | 'note' | 'character')[];
  };

  setQuery: (query: string) => void;
  search: (sessionId: string) => Promise<void>;
  setFilters: (types: ('chat' | 'note' | 'character')[]) => void;
  toggleOpen: () => void;
  close: () => void;
  clear: () => void;
}

// ─── API response shape ─────────────────────────────────────────────────────

interface SearchResponse {
  ok: boolean;
  data: {
    results: SearchResultItem[];
    total: number;
    page: number;
    limit: number;
  };
}

// ─── Debounce timer ─────────────────────────────────────────────────────────

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

// ─── Store ──────────────────────────────────────────────────────────────────

export const useSearchStore = create<SearchState>()((set, get) => ({
  query: '',
  results: [],
  total: 0,
  loading: false,
  error: null,
  isOpen: false,
  filters: {
    types: ['chat', 'note', 'character'],
  },

  setQuery(query: string) {
    set({ query });
  },

  async search(sessionId: string) {
    const { query, filters } = get();
    if (!query.trim()) {
      set({ results: [], total: 0, error: null });
      return;
    }

    set({ loading: true, error: null });

    try {
      const typesParam = filters.types.join(',');
      const res = await apiClient.get<SearchResponse>(
        `/api/sessions/${sessionId}/search?q=${encodeURIComponent(query)}&types=${typesParam}`,
      );
      set({
        results: res.data.results,
        total: res.data.total,
        loading: false,
      });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Search failed',
        loading: false,
      });
    }
  },

  setFilters(types: ('chat' | 'note' | 'character')[]) {
    set({ filters: { types } });
  },

  toggleOpen() {
    set((state) => ({ isOpen: !state.isOpen }));
  },

  close() {
    set({ isOpen: false });
  },

  clear() {
    if (debounceTimer) clearTimeout(debounceTimer);
    set({ query: '', results: [], total: 0, error: null, isOpen: false });
  },
}));

/**
 * Debounced search helper. Call from the search bar input handler.
 */
export function debouncedSearch(sessionId: string, query: string, delay = 300) {
  if (debounceTimer) clearTimeout(debounceTimer);

  useSearchStore.getState().setQuery(query);

  if (!query.trim()) {
    useSearchStore.setState({ results: [], total: 0 });
    return;
  }

  debounceTimer = setTimeout(() => {
    useSearchStore.getState().search(sessionId);
  }, delay);
}
