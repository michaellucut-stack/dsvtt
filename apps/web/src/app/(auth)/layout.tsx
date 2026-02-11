import Link from 'next/link';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      {/* Background accent */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-1/3 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-gold-500/5 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Branding */}
        <div className="mb-8 text-center">
          <Link href="/" className="inline-block">
            <h1 className="text-glow font-heading text-3xl font-bold tracking-wide text-gold-400">
              VTT Forge
            </h1>
          </Link>
          <p className="mt-1 text-sm text-parchment-400">
            Your virtual tabletop awaits
          </p>
        </div>

        {/* Auth card */}
        <div className="rounded-panel border border-charcoal-700/60 bg-charcoal-900/80 p-8 shadow-panel backdrop-blur-sm">
          {children}
        </div>
      </div>
    </div>
  );
}
