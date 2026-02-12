'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// ─── useDebounce ─────────────────────────────────────────────────────────────

/**
 * Debounces a value by the specified delay.
 *
 * The returned value only updates after `delay` ms of inactivity.
 * Useful for search inputs, filter text, or any rapidly-changing value
 * that should only trigger effects once the user stops typing.
 *
 * @example
 * const [query, setQuery] = useState('');
 * const debouncedQuery = useDebounce(query, 300);
 *
 * useEffect(() => {
 *   // Only fires 300ms after the user stops typing
 *   search(debouncedQuery);
 * }, [debouncedQuery]);
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

// ─── useDebouncedCallback ────────────────────────────────────────────────────

/**
 * Returns a debounced version of the given callback.
 *
 * The callback is only invoked after `delay` ms of inactivity.
 * The returned function is stable (same reference across renders)
 * and always calls the latest version of the callback.
 *
 * Timers are automatically cleaned up on unmount.
 *
 * @example
 * const saveNotes = useDebouncedCallback((text: string) => {
 *   api.saveNotes(roomId, text);
 * }, 500);
 *
 * <textarea onChange={(e) => saveNotes(e.target.value)} />
 */
export function useDebouncedCallback<T extends (...args: unknown[]) => unknown>(
  callback: T,
  delay: number,
): (...args: Parameters<T>) => void {
  const callbackRef = useRef<T>(callback);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Always point to the latest callback without re-creating the debounced fn.
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  return useCallback(
    (...args: Parameters<T>) => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }

      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        callbackRef.current(...args);
      }, delay);
    },
    [delay],
  );
}
