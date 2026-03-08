export default function Login() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <h1 className="font-display text-7xl tracking-tight mb-2">
        PLINKA<span className="text-[var(--rust)]">TRON</span>
      </h1>
      <p className="text-[var(--muted)] text-sm tracking-[0.15em] mb-10">
        AI MUSIC PRODUCTION STUDIO
      </p>

      <a
        href="/api/login"
        className="font-display text-xl tracking-[0.15em] bg-[var(--ink)] text-[var(--paper)] px-8 py-4 hover:bg-[var(--rust)] transition-all hover:-translate-y-0.5"
      >
        Sign In with Google
      </a>

      <p className="text-[var(--muted)] text-xs mt-6 max-w-sm text-center">
        Create albums from concept to distribution.
        Powered by Suno AI, Gemini, and your imagination.
      </p>
    </div>
  );
}
