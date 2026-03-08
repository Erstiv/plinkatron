import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { queryClient, apiFetch } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import Header from "@/components/Header";
import type { AlbumSession } from "@shared/schema";

export default function Dashboard() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const [showCreate, setShowCreate] = useState(false);

  const { data: sessions = [], isLoading } = useQuery<AlbumSession[]>({
    queryKey: ["sessions"],
    queryFn: () => apiFetch("/api/sessions"),
    enabled: isAuthenticated,
  });

  const createSession = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      apiFetch("/api/sessions", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: (session: AlbumSession) => {
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
      navigate(`/session/${session.id}`);
    },
  });

  if (authLoading) return <LoadingScreen />;
  if (!isAuthenticated) {
    window.location.href = "/login";
    return null;
  }

  return (
    <div className="min-h-screen">
      <Header />

      <main className="max-w-4xl mx-auto px-6 py-10">
        <div className="flex items-end justify-between mb-8 animate-fadeUp">
          <div>
            <h1 className="font-display text-5xl tracking-tight">
              Your <span className="text-[var(--rust)]">Albums</span>
            </h1>
            <p className="text-[var(--muted)] text-sm mt-1">
              {sessions.length} project{sessions.length !== 1 ? "s" : ""}
            </p>
          </div>

          <button
            onClick={() => setShowCreate(true)}
            className="font-display text-base tracking-[0.15em] bg-[var(--ink)] text-[var(--paper)] px-6 py-3 hover:bg-[var(--rust)] transition-all hover:-translate-y-0.5"
          >
            New Album
          </button>
        </div>

        {/* Session cards */}
        <div className="flex flex-col gap-4">
          {isLoading ? (
            <p className="text-[var(--muted)]">Loading...</p>
          ) : sessions.length === 0 ? (
            <div className="text-center py-20 animate-fadeUp">
              <p className="font-display text-3xl text-[var(--muted)] mb-4">
                No albums yet
              </p>
              <p className="text-[var(--muted)] text-sm mb-6">
                Start your first project and let the producers take over.
              </p>
              <button
                onClick={() => setShowCreate(true)}
                className="font-display text-base tracking-[0.15em] bg-[var(--rust)] text-[var(--paper)] px-6 py-3 hover:-translate-y-0.5 transition-all"
              >
                Create Your First Album
              </button>
            </div>
          ) : (
            sessions.map((session, i) => (
              <div
                key={session.id}
                onClick={() => navigate(`/session/${session.id}`)}
                className="bg-[var(--track-bg)] border border-transparent hover:border-[var(--ink)] p-5 cursor-pointer transition-all animate-fadeUp"
                style={{ animationDelay: `${i * 0.05}s` }}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-display text-xl tracking-wide">
                      {session.name}
                    </h3>
                    <p className="text-[var(--muted)] text-xs mt-1">
                      {session.genre && <span>{session.genre}</span>}
                      {session.genre && session.mood && <span> · </span>}
                      {session.mood && <span>{session.mood}</span>}
                      {!session.genre && !session.mood && <span>No genre set</span>}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className={`status-badge status-${session.status}`}>
                      {session.status.replace("_", " ")}
                    </span>
                    <span className="text-[var(--muted)] text-xs">
                      {session.targetTrackCount} tracks
                    </span>
                  </div>
                </div>

                {session.concept && (
                  <p className="text-[var(--muted)] text-xs mt-2 line-clamp-2">
                    {session.concept}
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      </main>

      {/* Create modal */}
      {showCreate && (
        <CreateModal
          onClose={() => setShowCreate(false)}
          onCreate={(data) => createSession.mutate(data)}
          isCreating={createSession.isPending}
        />
      )}
    </div>
  );
}

function CreateModal({
  onClose,
  onCreate,
  isCreating,
}: {
  onClose: () => void;
  onCreate: (data: Record<string, unknown>) => void;
  isCreating: boolean;
}) {
  const [name, setName] = useState("");
  const [genre, setGenre] = useState("");
  const [mood, setMood] = useState("");
  const [trackCount, setTrackCount] = useState(10);

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-[var(--paper)] border border-[var(--ink)] p-8 max-w-md w-full animate-fadeUp">
        <h2 className="font-display text-3xl mb-6">
          New <span className="text-[var(--rust)]">Album</span>
        </h2>

        <div className="flex flex-col gap-4">
          <div>
            <label className="text-xs tracking-[0.2em] uppercase text-[var(--muted)] block mb-1">
              Album Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Untitled Album"
              className="w-full px-3 py-2 border border-[var(--ink)] bg-white text-sm font-sans outline-none focus:border-[var(--rust)]"
            />
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-xs tracking-[0.2em] uppercase text-[var(--muted)] block mb-1">
                Genre
              </label>
              <input
                type="text"
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
                placeholder="e.g. indie rock"
                className="w-full px-3 py-2 border border-[var(--ink)] bg-white text-sm font-sans outline-none focus:border-[var(--rust)]"
              />
            </div>
            <div className="flex-1">
              <label className="text-xs tracking-[0.2em] uppercase text-[var(--muted)] block mb-1">
                Mood
              </label>
              <input
                type="text"
                value={mood}
                onChange={(e) => setMood(e.target.value)}
                placeholder="e.g. nostalgic"
                className="w-full px-3 py-2 border border-[var(--ink)] bg-white text-sm font-sans outline-none focus:border-[var(--rust)]"
              />
            </div>
          </div>

          <div>
            <label className="text-xs tracking-[0.2em] uppercase text-[var(--muted)] block mb-1">
              Number of Tracks
            </label>
            <input
              type="number"
              value={trackCount}
              onChange={(e) => setTrackCount(parseInt(e.target.value) || 10)}
              min={1}
              max={30}
              className="w-20 px-3 py-2 border border-[var(--ink)] bg-white text-sm font-sans outline-none focus:border-[var(--rust)]"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={() =>
              onCreate({
                name: name || "Untitled Album",
                genre,
                mood,
                targetTrackCount: trackCount,
              })
            }
            disabled={isCreating}
            className="font-display text-base tracking-[0.15em] bg-[var(--ink)] text-[var(--paper)] px-6 py-3 hover:bg-[var(--rust)] transition-colors disabled:bg-[var(--muted)]"
          >
            {isCreating ? "Creating..." : "Create"}
          </button>
          <button
            onClick={onClose}
            className="text-sm text-[var(--muted)] hover:text-[var(--ink)]"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="waveform-loader">
        {Array.from({ length: 7 }).map((_, i) => (
          <span
            key={i}
            style={{
              height: `${8 + Math.random() * 14}px`,
              animationDelay: `${i * 0.1}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
