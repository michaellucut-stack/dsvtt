import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4">
      {/* Background accent */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-1/4 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-gold-500/5 blur-3xl" />
      </div>

      <div className="relative z-10 flex max-w-2xl flex-col items-center text-center">
        {/* Logo / Title */}
        <h1 className="text-glow font-heading text-5xl font-bold tracking-wide text-gold-400 sm:text-6xl md:text-7xl">
          VTT Forge
        </h1>

        <p className="mt-4 text-lg leading-relaxed text-parchment-300 sm:text-xl">
          Forge epic adventures. A virtual tabletop built for immersive TTRPG
          sessions with real-time maps, dice, and collaboration.
        </p>

        {/* Divider */}
        <div className="my-8 flex items-center gap-4">
          <span className="h-px w-16 bg-gold-700/40" />
          <span className="text-gold-600">&#9670;</span>
          <span className="h-px w-16 bg-gold-700/40" />
        </div>

        {/* CTA buttons */}
        <div className="flex flex-col gap-4 sm:flex-row">
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-card border border-gold-600 bg-gold-600 px-8 py-3 font-heading text-sm font-semibold tracking-wider text-charcoal-950 transition-all hover:bg-gold-500 hover:shadow-glow"
          >
            Sign In
          </Link>
          <Link
            href="/register"
            className="inline-flex items-center justify-center rounded-card border border-gold-700/50 bg-charcoal-800/60 px-8 py-3 font-heading text-sm font-semibold tracking-wider text-parchment-200 transition-all hover:border-gold-600/70 hover:bg-charcoal-700/60 hover:text-gold-300"
          >
            Create Account
          </Link>
        </div>

        {/* Feature hints */}
        <div className="mt-16 grid grid-cols-1 gap-6 sm:grid-cols-3">
          {[
            { title: 'Real-Time Maps', desc: 'Dynamic battlefields with fog of war' },
            { title: 'Dice Engine', desc: 'Roll any combination with physics' },
            { title: 'Live Sessions', desc: 'Play together from anywhere' },
          ].map((feature) => (
            <div
              key={feature.title}
              className="rounded-panel border border-charcoal-700/50 bg-charcoal-900/50 p-5 backdrop-blur-sm"
            >
              <h3 className="font-heading text-sm font-semibold text-gold-400">
                {feature.title}
              </h3>
              <p className="mt-1 text-sm text-parchment-400">{feature.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
