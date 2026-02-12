interface SkeletonProps {
  /** Visual shape variant. Defaults to 'text'. */
  variant?: 'text' | 'rectangular' | 'circular';
  /** Additional CSS classes (use for width/height overrides). */
  className?: string;
}

const variantClasses: Record<string, string> = {
  text: 'h-4 w-full rounded',
  rectangular: 'h-24 w-full rounded-card',
  circular: 'h-10 w-10 rounded-full',
};

export function Skeleton({ variant = 'text', className = '' }: SkeletonProps) {
  return (
    <div
      className={[
        'animate-pulse bg-charcoal-700/50',
        variantClasses[variant],
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      aria-hidden="true"
    />
  );
}

// ─── Composite: Skeleton card matching RoomCard layout ─────────────────────

interface SkeletonCardProps {
  /** Additional CSS classes for the outer container. */
  className?: string;
}

export function SkeletonCard({ className = '' }: SkeletonCardProps) {
  return (
    <div
      className={[
        'w-full rounded-panel border border-charcoal-700/60 bg-charcoal-900/80 p-5',
        'shadow-card backdrop-blur-sm',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      aria-hidden="true"
    >
      {/* Header: title + badge */}
      <div className="flex items-start justify-between gap-3">
        <Skeleton variant="text" className="h-5 w-3/5" />
        <Skeleton variant="text" className="h-5 w-16 rounded-full" />
      </div>

      {/* Meta row */}
      <div className="mt-3 flex items-center gap-4">
        <Skeleton variant="text" className="h-4 w-16" />
        <Skeleton variant="text" className="h-4 w-24" />
      </div>
    </div>
  );
}
