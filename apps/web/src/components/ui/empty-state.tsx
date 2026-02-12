import type { ReactNode } from 'react';

interface EmptyStateAction {
  label: string;
  onClick: () => void;
}

interface EmptyStateProps {
  /** Optional icon to display above the title. */
  icon?: ReactNode;
  /** Primary heading text. */
  title: string;
  /** Secondary description text. */
  description: string;
  /** Optional call-to-action button. */
  action?: EmptyStateAction;
  /** Additional CSS classes for the container. */
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className = '',
}: EmptyStateProps) {
  return (
    <div
      className={[
        'flex flex-col items-center justify-center rounded-panel border border-charcoal-700/40 bg-charcoal-900/50 px-6 py-16 text-center',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {/* Icon */}
      {icon && (
        <div className="mb-4 text-charcoal-500">{icon}</div>
      )}

      {/* Title */}
      <h3 className="font-heading text-lg font-semibold text-parchment-300">
        {title}
      </h3>

      {/* Description */}
      <p className="mt-2 max-w-sm text-sm text-parchment-400">
        {description}
      </p>

      {/* Action button */}
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className={[
            'mt-6 rounded-card border border-gold-600 bg-gold-600 px-5 py-2',
            'font-heading text-xs font-bold uppercase tracking-wider text-charcoal-950',
            'transition-all duration-150',
            'hover:bg-gold-500 hover:shadow-glow',
            'active:scale-95',
          ].join(' ')}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
