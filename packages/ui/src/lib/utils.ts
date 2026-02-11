import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge class names with Tailwind CSS conflict resolution.
 *
 * Combines `clsx` for conditional class building with `tailwind-merge`
 * to intelligently resolve conflicting Tailwind utility classes.
 *
 * @example
 * ```ts
 * cn('px-4 py-2', isActive && 'bg-blue-500', 'px-6')
 * // => 'py-2 bg-blue-500 px-6'  (px-4 overridden by px-6)
 * ```
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
