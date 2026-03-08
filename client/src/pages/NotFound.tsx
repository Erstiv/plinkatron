import { Link } from "wouter";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center">
      <h1 className="font-display text-6xl text-[var(--muted)]">404</h1>
      <p className="text-[var(--muted)] mt-2 mb-6">Page not found</p>
      <Link href="/">
        <span className="text-xs tracking-[0.15em] uppercase text-[var(--rust)] hover:underline cursor-pointer">
          Back to Dashboard
        </span>
      </Link>
    </div>
  );
}
