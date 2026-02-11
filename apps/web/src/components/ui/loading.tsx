interface LoadingProps {
  /** Size in pixels. Defaults to 32. */
  size?: number;
  /** Additional CSS classes. */
  className?: string;
}

export function Loading({ size = 32, className = '' }: LoadingProps) {
  return (
    <div
      className={['flex items-center justify-center', className]
        .filter(Boolean)
        .join(' ')}
      role="status"
      aria-label="Loading"
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="animate-spin text-gold-500"
      >
        <circle
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          className="opacity-20"
        />
        <path
          d="M12 2a10 10 0 0 1 10 10"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
      <span className="sr-only">Loading...</span>
    </div>
  );
}
