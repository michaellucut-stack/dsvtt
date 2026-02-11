import { type ButtonHTMLAttributes, forwardRef } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  fullWidth?: boolean;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-gold-600 text-charcoal-950 border-gold-600 hover:bg-gold-500 hover:shadow-glow focus-visible:ring-gold-400',
  secondary:
    'bg-charcoal-700 text-parchment-200 border-charcoal-600 hover:bg-charcoal-600 hover:text-parchment-100 focus-visible:ring-charcoal-400',
  danger:
    'bg-crimson-700 text-parchment-100 border-crimson-700 hover:bg-crimson-600 focus-visible:ring-crimson-400',
  ghost:
    'bg-transparent text-parchment-300 border-transparent hover:bg-charcoal-800 hover:text-parchment-100 focus-visible:ring-charcoal-400',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    { variant = 'primary', fullWidth = false, className = '', disabled, children, ...props },
    ref,
  ) {
    return (
      <button
        ref={ref}
        disabled={disabled}
        className={[
          'inline-flex items-center justify-center rounded-card border px-5 py-2.5',
          'font-heading text-sm font-semibold tracking-wider',
          'transition-all duration-150',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-charcoal-900',
          'disabled:cursor-not-allowed disabled:opacity-50',
          variantClasses[variant],
          fullWidth ? 'w-full' : '',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
        {...props}
      >
        {children}
      </button>
    );
  },
);
