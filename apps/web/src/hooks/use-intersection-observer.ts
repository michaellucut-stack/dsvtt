'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface UseIntersectionObserverOptions {
  /**
   * The element used as the viewport for checking visibility.
   * Defaults to the browser viewport when `null`.
   */
  root?: Element | null;

  /**
   * Margin around the root (CSS margin syntax, e.g. "100px 0px").
   * Positive values grow the detection area so elements are "visible" earlier.
   */
  rootMargin?: string;

  /**
   * A number between 0 and 1 indicating what percentage of the target
   * must be visible to count as intersecting.
   * @default 0
   */
  threshold?: number | number[];

  /**
   * If true, stop observing once the element becomes visible.
   * Useful for one-time lazy-load triggers.
   * @default false
   */
  triggerOnce?: boolean;
}

interface UseIntersectionObserverReturn<T extends HTMLElement> {
  /** Callback ref — attach to the element you want to observe. */
  ref: (node: T | null) => void;
  /** Whether the observed element is currently in the viewport. */
  isVisible: boolean;
  /** The raw IntersectionObserverEntry, if available. */
  entry: IntersectionObserverEntry | undefined;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

/**
 * Detects whether an element is visible within its scroll container.
 *
 * Uses the native IntersectionObserver API for zero-cost idle detection.
 * Ideal for:
 *  - Lazy-rendering offscreen chat messages
 *  - Deferring heavy components until they scroll into view
 *  - Infinite scroll / virtualized list triggers
 *
 * @example
 * function ChatMessage({ message }: { message: Message }) {
 *   const { ref, isVisible } = useIntersectionObserver<HTMLDivElement>({
 *     rootMargin: '200px',
 *     triggerOnce: true,
 *   });
 *
 *   return (
 *     <div ref={ref}>
 *       {isVisible ? <RichContent message={message} /> : <Placeholder />}
 *     </div>
 *   );
 * }
 */
export function useIntersectionObserver<T extends HTMLElement = HTMLDivElement>(
  options: UseIntersectionObserverOptions = {},
): UseIntersectionObserverReturn<T> {
  const {
    root = null,
    rootMargin = '0px',
    threshold = 0,
    triggerOnce = false,
  } = options;

  const [isVisible, setIsVisible] = useState(false);
  const [entry, setEntry] = useState<IntersectionObserverEntry | undefined>();

  const nodeRef = useRef<T | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const frozenRef = useRef(false);

  // Cleanup helper
  const disconnectObserver = useCallback(() => {
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnectObserver();
    };
  }, [disconnectObserver]);

  // Callback ref — re-creates the observer whenever the node changes
  const ref = useCallback(
    (node: T | null) => {
      // If triggerOnce already fired, don't re-observe
      if (frozenRef.current) {
        nodeRef.current = node;
        return;
      }

      // Disconnect previous observer
      disconnectObserver();

      nodeRef.current = node;

      if (!node) return;

      // Guard: IntersectionObserver not available (e.g. very old browser / test env)
      if (typeof IntersectionObserver === 'undefined') {
        setIsVisible(true);
        return;
      }

      const observer = new IntersectionObserver(
        ([observerEntry]) => {
          if (!observerEntry) return;

          const visible = observerEntry.isIntersecting;
          setIsVisible(visible);
          setEntry(observerEntry);

          if (visible && triggerOnce) {
            frozenRef.current = true;
            observer.disconnect();
            observerRef.current = null;
          }
        },
        { root, rootMargin, threshold },
      );

      observer.observe(node);
      observerRef.current = observer;
    },
    [root, rootMargin, threshold, triggerOnce, disconnectObserver],
  );

  return { ref, isVisible, entry };
}
