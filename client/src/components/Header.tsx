import { useAuth } from "@/hooks/useAuth";
import { Link } from "wouter";

export default function Header() {
  const { user, isAuthenticated } = useAuth();

  return (
    <header className="flex items-center justify-between px-8 py-5 border-b border-[var(--ink)] animate-fadeDown">
      <Link href="/">
        <span className="font-display text-3xl tracking-widest cursor-pointer">
          PLINKA<span className="text-[var(--rust)]">TRON</span>
        </span>
      </Link>

      <nav className="flex items-center gap-6">
        <Link href="/">
          <span className="text-xs tracking-[0.2em] uppercase text-[var(--muted)] hover:text-[var(--ink)] cursor-pointer">
            Dashboard
          </span>
        </Link>
        <Link href="/library">
          <span className="text-xs tracking-[0.2em] uppercase text-[var(--muted)] hover:text-[var(--ink)] cursor-pointer">
            Library
          </span>
        </Link>

        {isAuthenticated ? (
          <div className="flex items-center gap-3">
            {user?.profileImageUrl && (
              <img
                src={user.profileImageUrl}
                alt=""
                className="w-7 h-7 rounded-full"
              />
            )}
            <span className="text-xs text-[var(--muted)]">
              {user?.firstName || user?.email}
            </span>
            <a
              href="/api/logout"
              className="text-xs tracking-[0.15em] uppercase text-[var(--muted)] hover:text-[var(--rust)]"
            >
              Logout
            </a>
          </div>
        ) : (
          <a
            href="/api/login"
            className="font-display text-base tracking-[0.15em] bg-[var(--ink)] text-[var(--paper)] px-5 py-2 hover:bg-[var(--rust)] transition-colors"
          >
            Sign In
          </a>
        )}
      </nav>
    </header>
  );
}
