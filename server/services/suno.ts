/**
 * Suno API Client
 *
 * Talks to the self-hosted gcui-art/suno-api running on the same server.
 * Default: http://localhost:3000
 *
 * Endpoints used:
 *   POST /api/custom_generate  — generate with lyrics + style tags
 *   POST /api/generate         — generate from prompt only
 *   GET  /api/get?ids=x,y      — poll for track status
 *   GET  /api/get_limit         — check remaining credits
 */

const SUNO_API_BASE = process.env.SUNO_API_URL || "http://localhost:3000";

export interface SunoGenerateRequest {
  prompt: string; // lyrics (for custom_generate) or description (for generate)
  tags?: string; // style tags like "indie rock, dreamy, reverb"
  title?: string;
  make_instrumental?: boolean;
  wait_audio?: boolean;
}

export interface SunoTrack {
  id: string;
  title: string;
  audio_url: string;
  image_url?: string;
  tags?: string;
  status: string;
  duration?: number;
  created_at?: string;
}

export interface SunoCredits {
  credits_left?: number;
  remaining_credits?: number;
}

// ── Generate a track ─────────────────────────────────────────────

export async function generateTrack(
  request: SunoGenerateRequest
): Promise<SunoTrack[]> {
  const endpoint = request.tags
    ? "/api/custom_generate"
    : "/api/generate";

  const body = request.tags
    ? {
        prompt: request.prompt,
        tags: request.tags,
        title: request.title || "Untitled",
        make_instrumental: request.make_instrumental || false,
        wait_audio: request.wait_audio ?? true,
      }
    : {
        prompt: request.prompt,
        make_instrumental: request.make_instrumental || false,
        wait_audio: request.wait_audio ?? true,
      };

  const res = await fetch(`${SUNO_API_BASE}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Suno API error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  return Array.isArray(data) ? data : [data];
}

// ── Poll for track completion ────────────────────────────────────

export async function pollTracks(
  ids: string[],
  maxAttempts = 30,
  intervalMs = 3000
): Promise<SunoTrack[]> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const res = await fetch(
      `${SUNO_API_BASE}/api/get?ids=${ids.join(",")}`
    );

    if (!res.ok) {
      throw new Error(`Suno poll error: ${res.status}`);
    }

    const tracks: SunoTrack[] = await res.json();
    const ready = tracks.filter(
      (t) => t.audio_url && t.status !== "queued" && t.status !== "streaming"
    );

    if (ready.length === tracks.length) {
      return ready;
    }

    await new Promise((r) => setTimeout(r, intervalMs));
  }

  throw new Error("Timed out waiting for Suno tracks to render");
}

// ── Check credit balance ─────────────────────────────────────────

export async function getCredits(): Promise<number | null> {
  try {
    const res = await fetch(`${SUNO_API_BASE}/api/get_limit`);
    if (!res.ok) return null;

    const data: SunoCredits = await res.json();
    return data.credits_left ?? data.remaining_credits ?? null;
  } catch {
    return null;
  }
}
