'use client';

import { type InputHTMLAttributes, forwardRef, useId } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  function Input({ label, error, className = '', id: providedId, ...props }, ref) {
    const generatedId = useId();
    const id = providedId ?? generatedId;

    return (
      <div className="space-y-1.5">
        {label && (
          <label
            htmlFor={id}
            className="block text-sm font-medium text-parchment-300"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={id}
          className={[
            'block w-full rounded-card border bg-charcoal-800/80 px-3.5 py-2.5',
            'text-sm text-parchment-100 placeholder:text-charcoal-400',
            'transition-colors duration-150',
            'focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-offset-charcoal-900',
            error
              ? 'border-crimson-600 focus:border-crimson-500 focus:ring-crimson-500/40'
              : 'border-charcoal-600 focus:border-gold-600 focus:ring-gold-500/40',
            className,
          ]
            .filter(Boolean)
            .join(' ')}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          {...props}
        />
        {error && (
          <p id={`${id}-error`} className="text-xs text-crimson-400" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  },
);
