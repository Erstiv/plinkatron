import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient, apiFetch } from "@/lib/queryClient";
import type { Track } from "@shared/schema";

interface TrackCardProps {
  track: Track;
  sessionId: number;
  index: number;
}

export default function TrackCard({ track, sessionId, index }: TrackCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [lyricsInput, setLyricsInput] = useState(track.lyrics || "");
  const [styleInput, setStyleInput] = useState(track.stylePrompt || "");
  const [titleInput, setTitleInput] = useState(track.title || "");

  // Suggest lyrics via AI
  const suggestLyrics = useMutation({
    mutationFn: () =>
      apiFetch(`/api/producers/lyrics/${track.id}`, { method: "POST" }),
    onSuccess: (data: any) => {
      setLyricsInput(data.sanitizedLyrics || data.lyrics);
    },
  });

  // Suggest style via AI
  const suggestStyle = useMutation({
    mutationFn: () =>
      apiFetch(`/api/producers/style/${track.id}`, { method: "POST" }),
    onSuccess: (data: any) => {
      setStyleInput(data.sanitizedPrompt || data.stylePrompt);
    },
  });

  // Save track changes
  const saveTrack = useMutation({
    mutationFn: (updates: Record<string, unknown>) =>
      apiFetch(`/api/tracks/${track.id}`, {
        method: "PATCH",
        body: JSON.stringify(updates),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["session", String(sessionId)] });
    },
  });

  // Generate this track via Suno
  const generate = useMutation({
    mutationFn: () =>
      apiFetch(`/api/generate/track/${track.id}`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["session", String(sessionId)] });
    },
  });

  const statusColors: Record<string, string> = {
    concept: "text-[var(--muted)]",
    lyrics_draft: "text-[var(--gold)]",
    lyrics_approved: "text-[var(--gold)]",
    styled: "text-blue-600",
    generating: "text-[var(--rust)]",
    generated: "text-[var(--success)]",
    approved: "text-[var(--success)]",
    mastered: "text-emerald-700",
    distributed: "text-purple-600",
  };

  return (
    <div
      className="bg-[var(--track-bg)] border border-transparent hover:border-[var(--ink)] transition-all animate-fadeUp"
      style={{ animationDelay: `${index * 0.04}s` }}
    >
      {/* Collapsed view */}
      <div
        className="flex items-center justify-between p-4 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-4">
          <span className="font-display text-lg text-[var(--muted)] w-8">
            {String(track.trackNumber).padStart(2, "0")}
          </span>
          <div>
            <h3 className="font-display text-lg tracking-wide">
              {track.title || "Untitled"}
            </h3>
            <p className="text-[var(--muted)] text-xs">
              {track.stylePrompt
                ? track.stylePrompt.slice(0, 60) + (track.stylePrompt.length > 60 ? "..." : "")
                : "No style set"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span
            className={`text-xs tracking-[0.1em] uppercase ${
              statusColors[track.status] || "text-[var(--muted)]"
            }`}
          >
            {track.status.replace("_", " ")}
          </span>
          <span className="text-[var(--muted)] text-sm">
            {expanded ? "▲" : "▼"}
          </span>
        </div>
      </div>

      {/* Expanded editor */}
      {expanded && (
        <div className="border-t border-[#d4d0c8] p-5 animate-fadeUp">
          {/* Title */}
          <div className="mb-4">
            <label className="text-xs tracking-[0.2em] uppercase text-[var(--muted)] block mb-1">
              Title
            </label>
            <input
              type="text"
              value={titleInput}
              onChange={(e) => setTitleInput(e.target.value)}
              className="w-full px-3 py-2 border border-[var(--ink)] bg-white text-sm outline-none focus:border-[var(--rust)]"
            />
          </div>

          {/* Lyrics */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs tracking-[0.2em] uppercase text-[var(--muted)]">
                Lyrics
              </label>
              <button
                onClick={() => suggestLyrics.mutate()}
                disabled={suggestLyrics.isPending}
                className="text-xs text-[var(--rust)] hover:underline disabled:opacity-50"
              >
                {suggestLyrics.isPending ? "Writing..." : "Suggest with AI"}
              </button>
            </div>
            <textarea
              value={lyricsInput}
              onChange={(e) => setLyricsInput(e.target.value)}
              rows={8}
              placeholder="[Verse 1]&#10;Write your lyrics here...&#10;&#10;[Chorus]&#10;..."
              className="w-full px-3 py-2 border border-[var(--ink)] bg-white text-sm font-sans outline-none focus:border-[var(--rust)] resize-y leading-relaxed"
            />
            <p className="text-[var(--muted)] text-xs mt-1">
              {lyricsInput.length}/3000 chars
              {lyricsInput.length > 3000 && (
                <span className="text-[var(--rust)]"> — over Suno limit</span>
              )}
            </p>
          </div>

          {/* Style prompt */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs tracking-[0.2em] uppercase text-[var(--muted)]">
                Style Prompt
              </label>
              <button
                onClick={() => suggestStyle.mutate()}
                disabled={suggestStyle.isPending}
                className="text-xs text-[var(--rust)] hover:underline disabled:opacity-50"
              >
                {suggestStyle.isPending ? "Generating..." : "Suggest with AI"}
              </button>
            </div>
            <input
              type="text"
              value={styleInput}
              onChange={(e) => setStyleInput(e.target.value)}
              placeholder="e.g. dreamy indie rock, reverb guitars, soft vocals"
              className="w-full px-3 py-2 border border-[var(--ink)] bg-white text-sm outline-none focus:border-[var(--rust)]"
            />
          </div>

          {/* Instrumental toggle */}
          <div className="flex items-center gap-2 mb-5">
            <input
              type="checkbox"
              id={`instrumental-${track.id}`}
              checked={track.instrumental || false}
              onChange={(e) =>
                saveTrack.mutate({ instrumental: e.target.checked })
              }
              className="accent-[var(--rust)]"
            />
            <label
              htmlFor={`instrumental-${track.id}`}
              className="text-sm text-[var(--muted)]"
            >
              Instrumental (no vocals)
            </label>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={() =>
                saveTrack.mutate({
                  title: titleInput,
                  lyrics: lyricsInput,
                  stylePrompt: styleInput,
                  status:
                    lyricsInput && styleInput ? "styled" : lyricsInput ? "lyrics_draft" : track.status,
                })
              }
              disabled={saveTrack.isPending}
              className="text-xs tracking-[0.15em] uppercase border border-[var(--ink)] px-4 py-2 hover:bg-[var(--ink)] hover:text-[var(--paper)] transition-colors disabled:opacity-50"
            >
              {saveTrack.isPending ? "Saving..." : "Save"}
            </button>

            <button
              onClick={() => generate.mutate()}
              disabled={
                generate.isPending ||
                (!lyricsInput && !track.instrumental)
              }
              className="text-xs tracking-[0.15em] uppercase bg-[var(--rust)] text-[var(--paper)] px-4 py-2 hover:bg-[var(--ink)] transition-colors disabled:opacity-50"
            >
              {generate.isPending ? "Generating..." : "Generate Track"}
            </button>
          </div>

          {generate.error && (
            <p className="text-[var(--rust)] text-xs mt-2">
              {(generate.error as Error).message}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
