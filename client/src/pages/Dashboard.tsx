import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { api } from "../lib/api";

interface Session {
  id: number;
  name: string;
  genre?: string;
  mood?: string;
  status: string;
  targetTrackCount: number;
  createdAt: string;
}

export default function Dashboard() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [, navigate] = useLocation();

  // Form state
  const [name, setName] = useState("");
  const [genre, setGenre] = useState("");
  const [mood, setMood] = useState("");
  const [influences, setInfluences] = useState("");
  const [trackCount, setTrackCount] = useState(5);

  useEffect(() => {
    loadSessions();
  }, []);

  async function loadSessions() {
    try {
      const data = await api.getSessions();
      setSessions(data);
    } catch (err) {
      console.error("Failed to load sessions:", err);
    } finally {
      setLoading(false);
    }
  }

  async function createSession() {
    if (!name.trim()) return;
    try {
      const session = await api.createSession({
        name: name.trim(),
        genre: genre.trim() || null,
        mood: mood.trim() || null,
        influences: influences.trim() || null,
        targetTrackCount: trackCount,
      });
      navigate(`/session/${session.id}`);
    } catch (err: any) {
      alert("Failed to create session: " + err.message);
    }
  }

  async function deleteSession(id: number, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm("Delete this session and all its tracks?")) return;
    await api.deleteSession(id);
    setSessions((s) => s.filter((x) => x.id !== id));
  }

  if (loading) {
    return <div className="flex justify-center py-20"><div className="loader" /></div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h2 className="font-display text-2xl tracking-wide">Your Sessions</h2>
        <button
          onClick={() => setShowCreate(true)}
          className="bg-rust hover:bg-rust/80 text-paper px-5 py-2 rounded-lg font-medium transition"
        >
          + New Session
        </button>
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowCreate(false)}>
          <div className="bg-ink border border-paper/10 rounded-xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-xl mb-4">New Session</h3>
            <div className="space-y-3">
              <input
                placeholder="Session name *"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-paper/5 border border-paper/10 rounded-lg px-4 py-2 text-paper placeholder:text-muted/50 focus:outline-none focus:border-gold/50"
                autoFocus
              />
              <input
                placeholder="Genre (e.g. indie rock, lo-fi hip hop)"
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
                className="w-full bg-paper/5 border border-paper/10 rounded-lg px-4 py-2 text-paper placeholder:text-muted/50 focus:outline-none focus:border-gold/50"
              />
              <input
                placeholder="Mood (e.g. melancholic, upbeat)"
                value={mood}
                onChange={(e) => setMood(e.target.value)}
                className="w-full bg-paper/5 border border-paper/10 rounded-lg px-4 py-2 text-paper placeholder:text-muted/50 focus:outline-none focus:border-gold/50"
              />
              <input
                placeholder="Influences (e.g. Radiohead, Bon Iver)"
                value={influences}
                onChange={(e) => setInfluences(e.target.value)}
                className="w-full bg-paper/5 border border-paper/10 rounded-lg px-4 py-2 text-paper placeholder:text-muted/50 focus:outline-none focus:border-gold/50"
              />
              <div className="flex items-center gap-3">
                <label className="text-sm text-muted">Tracks:</label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={trackCount}
                  onChange={(e) => setTrackCount(parseInt(e.target.value) || 5)}
                  className="w-20 bg-paper/5 border border-paper/10 rounded-lg px-3 py-2 text-paper focus:outline-none focus:border-gold/50"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={createSession} className="flex-1 bg-rust hover:bg-rust/80 text-paper py-2 rounded-lg font-medium transition">
                Create
              </button>
              <button onClick={() => setShowCreate(false)} className="flex-1 bg-paper/5 hover:bg-paper/10 text-muted py-2 rounded-lg transition">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sessions list */}
      {sessions.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-muted text-lg mb-2">No sessions yet</p>
          <p className="text-muted/60 text-sm">Create your first session to start making music</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sessions.map((s) => (
            <div
              key={s.id}
              onClick={() => navigate(`/session/${s.id}`)}
              className="bg-paper/5 border border-paper/10 rounded-xl p-5 cursor-pointer hover:border-gold/30 transition group"
            >
              <div className="flex items-start justify-between">
                <h3 className="font-display text-lg group-hover:text-gold transition">{s.name}</h3>
                <button
                  onClick={(e) => deleteSession(s.id, e)}
                  className="text-muted/40 hover:text-red-400 text-sm transition"
                  title="Delete"
                >
                  x
                </button>
              </div>
              <div className="flex gap-2 mt-2 text-xs text-muted">
                {s.genre && <span className="bg-paper/5 px-2 py-0.5 rounded">{s.genre}</span>}
                {s.mood && <span className="bg-paper/5 px-2 py-0.5 rounded">{s.mood}</span>}
              </div>
              <div className="flex items-center justify-between mt-4 text-xs text-muted/60">
                <span>{s.targetTrackCount} tracks</span>
                <span className={`badge badge-${s.status}`}>{s.status}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
