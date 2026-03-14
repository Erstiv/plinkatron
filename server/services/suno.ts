/**
 * Suno API client — talks to a gcui-art/suno-api instance.
 *
 * Endpoints used:
 *   POST /api/generate          — simple generation from prompt
 *   POST /api/custom_generate   — custom lyrics + style + title
 *   POST /api/generate_lyrics   — AI lyrics from a concept
 *   GET  /api/get?ids=x,y       — poll / fetch clips by ID
 *   GET  /api/get_limit          — check remaining credits
 */

function baseUrl(): string {
  const url = process.env.SUNO_API_URL || "http://localhost:3000";
  return url.replace(/\/+$/, "");
}

async function sunoFetch<T = any>(path: string, opts?: RequestInit): Promise<T> {
  const url = `${baseUrl()}${path}`;
  console.log(`[suno] ${opts?.method || "GET"} ${url}`);
  const res = await fetch(url, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(opts?.headers || {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Suno API ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

// ── Types ─────────────────────────────────────────────────────────

export interface SunoClip {
  id: string;
  status: string;        // "submitted" | "queued" | "streaming" | "complete"
  audio_url?: string;
  stream_audio_url?: string;
  image_url?: string;
  image_large_url?: string;
  title?: string;
  tags?: string;
  prompt?: string;
  duration?: number;
  created_at?: string;
  model_name?: string;
  [key: string]: any;
}

export interface SunoCredits {
  credits_left: number;
  period: string;
  monthly_limit: number;
  monthly_usage: number;
}

// ── Simple generation (prompt only) ──────────────────────────────

export async function generateSimple(prompt: string, instrumental = false): Promise<SunoClip[]> {
  return sunoFetch<SunoClip[]>("/api/generate", {
    method: "POST",
    body: JSON.stringify({
      prompt,
      make_instrumental: instrumental,
      wait_audio: false,
    }),
  });
}

// ── Custom generation (lyrics + style + title) ───────────────────

export async function generateCustom(opts: {
  title: string;
  lyrics?: string;
  style: string;
  instrumental?: boolean;
}): Promise<SunoClip[]> {
  return sunoFetch<SunoClip[]>("/api/custom_generate", {
    method: "POST",
    body: JSON.stringify({
      prompt: opts.lyrics || "",
      tags: opts.style,
      title: opts.title,
      make_instrumental: opts.instrumental ?? false,
      wait_audio: false,
    }),
  });
}

// ── Generate lyrics from concept ─────────────────────────────────

export async function generateLyrics(concept: string): Promise<{ text: string; title: string }> {
  const result = await sunoFetch<any>("/api/generate_lyrics", {
    method: "POST",
    body: JSON.stringify({ prompt: concept }),
  });
  return { text: result.text || result.lyrics || "", title: result.title || "" };
}

// ── Poll / fetch clips by ID ────────────────────────────────────

export async function getClips(ids: string[]): Promise<SunoClip[]> {
  const idsStr = ids.join(",");
  return sunoFetch<SunoClip[]>(`/api/get?ids=${idsStr}`);
}

// ── Poll until clip is ready (max ~2 min) ────────────────────────

export async function pollUntilReady(ids: string[], maxAttempts = 40, intervalMs = 3000): Promise<SunoClip[]> {
  for (let i = 0; i < maxAttempts; i++) {
    const clips = await getClips(ids);
    const allDone = clips.every(
      (c) => c.status === "streaming" || c.status === "complete" || c.audio_url
    );
    if (allDone) return clips;

    const hasError = clips.some((c) => c.status === "error");
    if (hasError) throw new Error(`Suno generation failed: ${JSON.stringify(clips)}`);

    console.log(`[suno] poll ${i + 1}/${maxAttempts} — status: ${clips.map((c) => c.status).join(", ")}`);
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error("Suno generation timed out after polling");
}

// ── Check credits ────────────────────────────────────────────────

export async function getCredits(): Promise<SunoCredits> {
  return sunoFetch<SunoCredits>("/api/get_limit");
}

// ── Health check — is the Suno API reachable? ────────────────────

export async function checkHealth(): Promise<boolean> {
  try {
    await getCredits();
    return true;
  } catch {
    return false;
  }
}
