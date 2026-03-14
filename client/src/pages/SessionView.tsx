import { useState, useEffect, useRef } from "react";
import { useParams, Link } from "wouter";
import { api } from "../lib/api";

interface Track {
  id: number;
  trackNumber: number;
  title: string;
  status: string;
  lyrics: string | null;
  lyricsRaw: string | null;
  stylePrompt: string | null;
  instrumental: boolean;
  audioUrl: string | null;
  imageUrl: string | null;
  coverArtUrl: string | null;
  duration: number | null;
}

interface Session {
  id: number;
  name: string;
  concept: string | null;
  genre: string | null;
  mood: string | null;
  influences: string | null;
  coverArtUrl: string | null;
  coverArtPrompt: string | null;
  status: string;
  tracks: Track[];
}

export default function SessionView() {
  const params = useParams<{ id: string }>();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTrack, setActiveTrack] = useState<number | null>(null);
  const [busy, setBusy] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadSession();
  }, [params.id]);

  async function loadSession() {
    try {
      const data = await api.getSession(parseInt(params.id!));
      setSession(data);
      if (!activeTrack && data.tracks.length > 0) {
        setActiveTrack(data.tracks[0].id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function getTrack() {
    return session?.tracks.find((t) => t.id === activeTrack) || null;
  }

  async function updateTrack(trackId: number, data: Partial<Track>) {
    const updated = await api.updateTrack(trackId, data);
    setSession((s) => {
      if (!s) return s;
      return { ...s, tracks: s.tracks.map((t) => (t.id === trackId ? { ...t, ...updated } : t)) };
    });
  }

  async function handleBrainstorm() {
    if (!session) return;
    setBusy((b) => ({ ...b, brainstorm: true }));
    try {
      const { concept } = await api.brainstorm({
        name: session.name,
        genre: session.genre,
        mood: session.mood,
        influences: session.influences,
      });
      await api.updateSession(session.id, { concept });
      setSession((s) => s ? { ...s, concept } : s);
    } catch (err: any) {
      alert("Brainstorm failed: " + err.message);
    } finally {
      setBusy((b) => ({ ...b, brainstorm: false }));
    }
  }

  async function handleWriteLyrics(track: Track) {
    setBusy((b) => ({ ...b, [`lyrics-${track.id}`]: true }));
    try {
      const { lyrics } = await api.writeLyrics({
        title: track.title,
        concept: session?.concept,
        genre: session?.genre,
        mood: session?.mood,
      });
      await updateTrack(track.id, { lyrics, lyricsRaw: lyrics, status: "has_lyrics" });
    } catch (err: any) {
      alert("Write lyrics failed: " + err.message);
    } finally {
      setBusy((b) => ({ ...b, [`lyrics-${track.id}`]: false }));
    }
  }

  async function handleGenerateStyle(track: Track) {
    setBusy((b) => ({ ...b, [`style-${track.id}`]: true }));
    try {
      const { style } = await api.generateStyle({
        title: track.title,
        genre: session?.genre,
        mood: session?.mood,
        concept: session?.concept,
      });
      await updateTrack(track.id, { stylePrompt: style, status: track.lyrics ? "has_style" : track.status });
    } catch (err: any) {
      alert("Style generation failed: " + err.message);
    } finally {
      setBusy((b) => ({ ...b, [`style-${track.id}`]: false }));
    }
  }

  async function handleGenerate(track: Track) {
    setBusy((b) => ({ ...b, [`gen-${track.id}`]: true }));
    try {
      const updated = await api.generateTrack(track.id);
      setSession((s) => {
        if (!s) return s;
        return { ...s, tracks: s.tracks.map((t) => (t.id === track.id ? { ...t, ...updated } : t)) };
      });
    } catch (err: any) {
      alert("Generation failed: " + err.message);
      // Reload to get error status
      loadSession();
    } finally {
      setBusy((b) => ({ ...b, [`gen-${track.id}`]: false }));
    }
  }

  async function handleGenerateCoverArt() {
    if (!session) return;
    setBusy((b) => ({ ...b, coverArt: true }));
    try {
      // First get an art prompt from Gemini
      const { prompt } = await api.generateArtPrompt({
        sessionId: session.id,
        type: "album",
      });
      // Then generate the actual image
      const { imageUrl } = await api.generateCoverArt({
        prompt,
        sessionId: session.id,
      });
      setSession((s) => s ? { ...s, coverArtUrl: imageUrl, coverArtPrompt: prompt } : s);
    } catch (err: any) {
      alert("Cover art generation failed: " + err.message);
    } finally {
      setBusy((b) => ({ ...b, coverArt: false }));
    }
  }

  if (loading) {
    return <div className="flex justify-center py-20"><div className="loader" /></div>;
  }
  if (!session) {
    return <div className="text-center py-20 text-muted">Session not found</div>;
  }

  const track = getTrack();

  return (
    <div>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted mb-6">
        <Link href="/" className="hover:text-paper transition">Sessions</Link>
        <span>/</span>
        <span className="text-paper">{session.name}</span>
      </div>

      {/* Session header */}
      <div className="mb-8">
        <h2 className="font-display text-2xl tracking-wide mb-2">{session.name}</h2>
        <div className="flex gap-2 text-sm text-muted">
          {session.genre && <span className="bg-paper/5 px-2 py-0.5 rounded">{session.genre}</span>}
          {session.mood && <span className="bg-paper/5 px-2 py-0.5 rounded">{session.mood}</span>}
          {session.influences && <span className="bg-paper/5 px-2 py-0.5 rounded">{session.influences}</span>}
        </div>

        {/* Concept */}
        <div className="mt-4 bg-paper/5 rounded-lg p-4 border border-paper/10">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted uppercase tracking-wider">Album Concept</span>
            <button
              onClick={handleBrainstorm}
              disabled={busy.brainstorm}
              className="text-xs text-gold hover:text-gold/80 transition disabled:opacity-50"
            >
              {busy.brainstorm ? "Thinking..." : "AI Brainstorm"}
            </button>
          </div>
          <p className="text-sm text-paper/80 whitespace-pre-wrap">
            {session.concept || "No concept yet. Click AI Brainstorm to generate one."}
          </p>
        </div>

        {/* Album Cover Art */}
        <div className="mt-4 bg-paper/5 rounded-lg p-4 border border-paper/10">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted uppercase tracking-wider">Album Cover Art</span>
            <button
              onClick={handleGenerateCoverArt}
              disabled={busy.coverArt}
              className="text-xs text-gold hover:text-gold/80 transition disabled:opacity-50"
            >
              {busy.coverArt ? "Generating..." : "Generate Cover Art"}
            </button>
          </div>
          {session.coverArtUrl ? (
            <div className="flex gap-4 items-start">
              <img
                src={session.coverArtUrl}
                alt="Album cover"
                className="w-40 h-40 rounded-lg object-cover border border-paper/10"
              />
              <div className="flex-1">
                {session.coverArtPrompt && (
                  <p className="text-xs text-muted/60 italic">{session.coverArtPrompt}</p>
                )}
                <button
                  onClick={handleGenerateCoverArt}
                  disabled={busy.coverArt}
                  className="mt-2 text-xs text-rust hover:text-rust/80 transition disabled:opacity-50"
                >
                  Regenerate
                </button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted/40">
              {busy.coverArt ? "Creating your album artwork..." : "Click Generate to create AI cover art via Imagen"}
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Track list sidebar */}
        <div className="lg:col-span-1">
          <h3 className="text-xs text-muted uppercase tracking-wider mb-3">Tracklist</h3>
          <div className="space-y-1">
            {session.tracks.map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTrack(t.id)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition flex items-center justify-between ${
                  activeTrack === t.id
                    ? "bg-gold/10 text-gold border border-gold/20"
                    : "hover:bg-paper/5 text-paper/70"
                }`}
              >
                <span className="truncate">
                  <span className="text-muted/40 mr-2">{t.trackNumber}.</span>
                  {t.title || "Untitled"}
                </span>
                {t.status === "complete" && <span className="text-green-400 text-xs">&#9654;</span>}
                {t.status === "generating" && <div className="loader" style={{ width: 12, height: 12 }} />}
              </button>
            ))}
          </div>
        </div>

        {/* Track editor */}
        <div className="lg:col-span-3">
          {track ? (
            <TrackEditor
              track={track}
              session={session}
              busy={busy}
              onUpdate={updateTrack}
              onWriteLyrics={() => handleWriteLyrics(track)}
              onGenerateStyle={() => handleGenerateStyle(track)}
              onGenerate={() => handleGenerate(track)}
            />
          ) : (
            <p className="text-muted">Select a track</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Track Editor Component ───────────────────────────────────────

function TrackEditor({
  track,
  session,
  busy,
  onUpdate,
  onWriteLyrics,
  onGenerateStyle,
  onGenerate,
}: {
  track: Track;
  session: Session;
  busy: Record<string, boolean>;
  onUpdate: (id: number, data: Partial<Track>) => Promise<void>;
  onWriteLyrics: () => void;
  onGenerateStyle: () => void;
  onGenerate: () => void;
}) {
  const [title, setTitle] = useState(track.title || "");
  const [lyrics, setLyrics] = useState(track.lyrics || "");
  const [style, setStyle] = useState(track.stylePrompt || "");
  const [instrumental, setInstrumental] = useState(track.instrumental);
  const [dirty, setDirty] = useState(false);

  // Reset when track changes
  useEffect(() => {
    setTitle(track.title || "");
    setLyrics(track.lyrics || "");
    setStyle(track.stylePrompt || "");
    setInstrumental(track.instrumental);
    setDirty(false);
  }, [track.id, track.lyrics, track.stylePrompt, track.title, track.instrumental]);

  async function save() {
    await onUpdate(track.id, {
      title,
      lyrics: lyrics || null,
      stylePrompt: style || null,
      instrumental,
      status: style ? "has_style" : lyrics ? "has_lyrics" : "empty",
    });
    setDirty(false);
  }

  async function saveAndGenerate() {
    // Always save current form state to DB before generating
    await onUpdate(track.id, {
      title,
      lyrics: lyrics || null,
      stylePrompt: style || null,
      instrumental,
      status: style ? "has_style" : lyrics ? "has_lyrics" : "empty",
    });
    setDirty(false);
    onGenerate();
  }

  const isGenerating = busy[`gen-${track.id}`] || track.status === "generating";

  return (
    <div className="space-y-4">
      {/* Title + status */}
      <div className="flex items-center gap-3">
        <input
          value={title}
          onChange={(e) => { setTitle(e.target.value); setDirty(true); }}
          className="flex-1 bg-transparent border-b border-paper/10 text-xl font-display tracking-wide focus:outline-none focus:border-gold/50 pb-1"
          placeholder="Track title"
        />
        <span className={`badge badge-${track.status}`}>{track.status.replace("_", " ")}</span>
      </div>

      {/* Audio player (if complete) */}
      {track.audioUrl && (
        <div className="bg-paper/5 rounded-lg p-4 border border-green-500/20">
          <div className="flex items-center gap-4">
            {track.imageUrl && (
              <img src={track.imageUrl} alt="" className="w-16 h-16 rounded-lg object-cover" />
            )}
            <div className="flex-1">
              <audio controls src={track.audioUrl} className="w-full" />
              {track.duration && (
                <p className="text-xs text-muted mt-1">{Math.floor(track.duration / 60)}:{String(track.duration % 60).padStart(2, "0")}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Instrumental toggle */}
      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input
          type="checkbox"
          checked={instrumental}
          onChange={(e) => { setInstrumental(e.target.checked); setDirty(true); }}
          className="accent-gold"
        />
        <span className="text-muted">Instrumental (no lyrics)</span>
      </label>

      {/* Lyrics */}
      {!instrumental && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs text-muted uppercase tracking-wider">Lyrics</label>
            <button
              onClick={onWriteLyrics}
              disabled={busy[`lyrics-${track.id}`]}
              className="text-xs text-gold hover:text-gold/80 transition disabled:opacity-50"
            >
              {busy[`lyrics-${track.id}`] ? "Writing..." : "AI Write Lyrics"}
            </button>
          </div>
          <textarea
            value={lyrics}
            onChange={(e) => { setLyrics(e.target.value); setDirty(true); }}
            rows={12}
            placeholder="[Verse 1]&#10;Write your lyrics here...&#10;&#10;[Chorus]&#10;..."
            className="w-full bg-paper/5 border border-paper/10 rounded-lg px-4 py-3 text-sm text-paper placeholder:text-muted/30 focus:outline-none focus:border-gold/50 resize-y font-mono"
          />
          <p className="text-xs text-muted/40 mt-1">{lyrics.length}/3000 chars</p>
        </div>
      )}

      {/* Style prompt */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs text-muted uppercase tracking-wider">Style / Tags</label>
          <button
            onClick={onGenerateStyle}
            disabled={busy[`style-${track.id}`]}
            className="text-xs text-gold hover:text-gold/80 transition disabled:opacity-50"
          >
            {busy[`style-${track.id}`] ? "Generating..." : "AI Suggest Style"}
          </button>
        </div>
        <input
          value={style}
          onChange={(e) => { setStyle(e.target.value); setDirty(true); }}
          placeholder="e.g. indie rock, dreamy guitars, reverb-heavy vocals, slow tempo"
          className="w-full bg-paper/5 border border-paper/10 rounded-lg px-4 py-2 text-sm text-paper placeholder:text-muted/30 focus:outline-none focus:border-gold/50"
        />
        <p className="text-xs text-muted/40 mt-1">{style.length}/200 chars</p>
      </div>

      {/* Action buttons */}
      <div className="flex gap-3 pt-2">
        {dirty && (
          <button
            onClick={save}
            className="bg-paper/10 hover:bg-paper/20 text-paper px-5 py-2 rounded-lg text-sm font-medium transition"
          >
            Save Changes
          </button>
        )}
        <button
          onClick={saveAndGenerate}
          disabled={isGenerating || (!lyrics && !instrumental)}
          title={!lyrics && !instrumental ? "Add lyrics or set to instrumental first" : ""}
          className="bg-rust hover:bg-rust/80 text-paper px-5 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50 flex items-center gap-2"
        >
          {isGenerating ? (
            <>
              <div className="loader" style={{ width: 14, height: 14, borderTopColor: "#f5f0e8" }} />
              Generating...
            </>
          ) : (
            "Generate with Suno"
          )}
        </button>
      </div>
    </div>
  );
}
