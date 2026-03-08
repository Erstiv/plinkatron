import Header from "@/components/Header";

export default function Library() {
  return (
    <div className="min-h-screen">
      <Header />
      <main className="max-w-4xl mx-auto px-6 py-10">
        <h1 className="font-display text-5xl tracking-tight mb-2 animate-fadeUp">
          Your <span className="text-[var(--rust)]">Library</span>
        </h1>
        <p className="text-[var(--muted)] text-sm mb-8 animate-fadeUp">
          All your generated tracks across all albums.
        </p>

        <div className="text-center py-20 animate-fadeUp">
          <p className="text-[var(--muted)]">
            Library will show all generated tracks with playback.
          </p>
          <p className="text-[var(--muted)] text-xs mt-2">
            Coming in Phase 4 — generate some tracks first!
          </p>
        </div>
      </main>
    </div>
  );
}
