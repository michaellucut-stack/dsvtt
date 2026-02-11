import type { HTMLAttributes } from 'react';

type BadgeVariant = 'success' | 'warning' | 'info' | 'danger' | 'neutral';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  children: React.ReactNode;
}

const variantClasses: Record<BadgeVariant, string> = {
  success:
    'bg-emerald-950/60 text-emerald-300 border-emerald-700/50',
  warning:
    'bg-gold-950/60 text-gold-300 border-gold-700/50',
  info:
    'bg-charcoal-800/60 text-parchment-300 border-charcoal-600/50',
  danger:
    'bg-crimson-950/60 text-crimson-300 border-crimson-700/50',
  neutral:
    'bg-charcoal-800/60 text-parchment-400 border-charcoal-600/50',
};

export function Badge({
  variant = 'neutral',
  className = '',
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={[
        'inline-flex items-center rounded-full border px-2.5 py-0.5',
        'text-xs font-medium leading-tight',
        variantClasses[variant],
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    >
      {children}
    </span>
  );
}
