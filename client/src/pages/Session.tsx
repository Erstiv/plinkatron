import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { queryClient, apiFetch } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import Header from "@/components/Header";
import TrackCard from "@/components/TrackCard";
import type { AlbumSession, Track } from "@shared/schema";

interface SessionWithTracks extends AlbumSession {
  tracks: Track[];
}

export default function Session() {
  const [, params] = useRoute("/session/:id");
  const sessionId = params?.id;
  const { isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState<"tracks" | "concept" | "artwork">(
    "tracks"
  );

  const { data: session, isLoading } = useQuery<SessionWithTracks>({
    queryKey: ["session", sessionId],
    queryFn: () => apiFetch(`/api/sessions/${sessionId}`),
    enabled: isAuthenticated && !!sessionId,
  });

  const brainstorm = useMutation({
    mutationFn: () =>
      apiFetch(`/api/producers/concept/${sessionId}`, { method: "POST" }),
    onSuccess: (data) => {
      // Update session with the concept
      apiFetch(`/api/sessions/${sessionId}`, {
        method: "PATCH",
        body: JSON.stringify({
          concept: data.concept,
          name: data.albumTitle || session?.name,
        }),
      }).then(() =>
        queryClient.invalidateQueries({ queryKey: ["session", sessionId] })
      );
    },
  });

  const batchGenerate = useMutation({
    mutationFn: () =>
      apiFetch(`/api/generate/batch/${sessionId}`, { method: "POST" }),
  });

  if (isLoading || !session) {
    return (
      <div className="min-h-screen">
        <Header />
        <div className="flex items-center justify-center py-20">
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
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header />

      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* Session header */}
        <div className="mb-8 animate-fadeUp">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="font-display text-5xl tracking-tight">
                {session.name}
              </h1>
              <p className="text-[var(--muted)] text-sm mt-1">
                {session.genre && <span>{session.genre}</span>}
                {session.genre && session.mood && <span> · </span>}
                {session.mood && <span>{session.mood}</span>}
                <span> · {session.tracks.length} tracks</span>
              </p>
            </div>

            <span className={`status-badge status-${session.status}`}>
              {session.status.replace("_", " ")}
            </span>
          </div>

          {session.concept && (
            <p className="text-sm text-[var(--muted)] mt-3 max-w-2xl leading-relaxed">
              {session.concept}
            </p>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-[#d4d0c8]">
          {(["tracks", "concept", "artwork"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-xs tracking-[0.15em] uppercase transition-colors ${
                activeTab === tab
                  ? "text-[var(--ink)] border-b-2 border-[var(--rust)] -mb-px"
                  : "text-[var(--muted)] hover:text-[var(--ink)]"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === "tracks" && (
          <div className="animate-fadeUp">
            {/* Action bar */}
            <div className="flex gap-3 mb-6">
              <button
                onClick={() => brainstorm.mutate()}
                disabled={brainstorm.isPending}
                className="text-xs tracking-[0.15em] uppercase border border-[var(--ink)] px-4 py-2 hover:bg-[var(--ink)] hover:text-[var(--paper)] transition-colors disabled:opacity-50"
              >
                {brainstorm.isPending ? "Brainstorming..." : "Brainstorm Concept"}
              </button>
              <button
                onClick={() => batchGenerate.mutate()}
                disabled={batchGenerate.isPending}
                className="text-xs tracking-[0.15em] uppercase bg-[var(--rust)] text-[var(--paper)] px-4 py-2 hover:bg-[var(--ink)] transition-colors disabled:opacity-50"
              >
                {batchGenerate.isPending ? "Generating..." : "Generate All"}
              </button>
            </div>

            {/* Track list */}
            <div className="flex flex-col gap-3">
              {session.tracks.map((track, i) => (
                <TrackCard
                  key={track.id}
                  track={track}
                  sessionId={session.id}
                  index={i}
                />
              ))}
            </div>
          </div>
        )}

        {activeTab === "concept" && (
          <ConceptTab session={session} onBrainstorm={() => brainstorm.mutate()} />
        )}

        {activeTab === "artwork" && (
          <ArtworkTab sessionId={session.id} />
        )}
      </main>
    </div>
  );
}

function ConceptTab({
  session,
  onBrainstorm,
}: {
  session: SessionWithTracks;
  onBrainstorm: () => void;
}) {
  return (
    <div className="animate-fadeUp max-w-2xl">
      <h2 className="font-display text-2xl mb-4">Album Concept</h2>

      {session.concept ? (
        <div className="bg-[var(--track-bg)] p-6">
          <p className="text-sm leading-relaxed">{session.concept}</p>
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-[var(--muted)] mb-4">No concept yet.</p>
          <button
            onClick={onBrainstorm}
            className="font-display text-base tracking-[0.15em] bg-[var(--ink)] text-[var(--paper)] px-6 py-3 hover:bg-[var(--rust)] transition-colors"
          >
            Brainstorm with AI
          </button>
        </div>
      )}
    </div>
  );
}

function ArtworkTab({ sessionId }: { sessionId: number }) {
  const generateArtPrompt = useMutation({
    mutationFn: () =>
      apiFetch(`/api/producers/artwork/${sessionId}`, { method: "POST" }),
  });

  return (
    <div className="animate-fadeUp max-w-2xl">
      <h2 className="font-display text-2xl mb-4">Cover Art</h2>

      <div className="text-center py-12">
        <p className="text-[var(--muted)] mb-4">
          Generate album art using AI (Gemini + Nano Banana Pro).
        </p>
        <button
          onClick={() => generateArtPrompt.mutate()}
          disabled={generateArtPrompt.isPending}
          className="font-display text-base tracking-[0.15em] bg-[var(--ink)] text-[var(--paper)] px-6 py-3 hover:bg-[var(--rust)] transition-colors disabled:bg-[var(--muted)]"
        >
          {generateArtPrompt.isPending ? "Generating..." : "Generate Art Prompt"}
        </button>

        {generateArtPrompt.data && (
          <div className="mt-6 bg-[var(--track-bg)] p-6 text-left">
            <p className="text-xs tracking-[0.2em] uppercase text-[var(--muted)] mb-2">
              Image Prompt
            </p>
            <p className="text-sm leading-relaxed">
              {(generateArtPrompt.data as any).imagePrompt}
            </p>
            <p className="text-xs tracking-[0.2em] uppercase text-[var(--muted)] mt-4 mb-2">
              Art Direction
            </p>
            <p className="text-sm text-[var(--muted)]">
              {(generateArtPrompt.data as any).artDirection}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
