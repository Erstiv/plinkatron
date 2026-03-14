/**
 * Simple fetch wrapper for API calls.
 */
const BASE = "/api";

export async function apiFetch<T = any>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(opts?.headers || {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `API error ${res.status}`);
  }
  return res.json();
}

export const api = {
  // Sessions
  getSessions: () => apiFetch("/sessions"),
  getSession: (id: number) => apiFetch(`/sessions/${id}`),
  createSession: (data: any) => apiFetch("/sessions", { method: "POST", body: JSON.stringify(data) }),
  updateSession: (id: number, data: any) => apiFetch(`/sessions/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteSession: (id: number) => apiFetch(`/sessions/${id}`, { method: "DELETE" }),

  // Tracks
  getTrack: (id: number) => apiFetch(`/tracks/${id}`),
  updateTrack: (id: number, data: any) => apiFetch(`/tracks/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  addTrack: (data: any) => apiFetch("/tracks", { method: "POST", body: JSON.stringify(data) }),
  deleteTrack: (id: number) => apiFetch(`/tracks/${id}`, { method: "DELETE" }),

  // Generation
  generateTrack: (trackId: number) => apiFetch(`/generate/${trackId}`, { method: "POST" }),
  brainstorm: (data: any) => apiFetch("/generate/ai/brainstorm", { method: "POST", body: JSON.stringify(data) }),
  writeLyrics: (data: any) => apiFetch("/generate/ai/lyrics", { method: "POST", body: JSON.stringify(data) }),
  generateStyle: (data: any) => apiFetch("/generate/ai/style", { method: "POST", body: JSON.stringify(data) }),
  sunoLyrics: (concept: string) => apiFetch("/generate/suno/lyrics", { method: "POST", body: JSON.stringify({ concept }) }),
  getCredits: () => apiFetch("/generate/credits"),

  // Health
  health: () => apiFetch("/health"),
};
