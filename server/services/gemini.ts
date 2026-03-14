/**
 * Gemini service — uses @google/genai for lyrics writing and concept brainstorming.
 */
import { GoogleGenAI } from "@google/genai";

function getClient() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY not set");
  return new GoogleGenAI({ apiKey: key });
}

async function generate(prompt: string, model = "gemini-2.5-pro-preview-06-05"): Promise<string> {
  const ai = getClient();
  const res = await ai.models.generateContent({
    model,
    contents: prompt,
  });
  return res.text?.trim() || "";
}

// ── Brainstorm an album/session concept ──────────────────────────

export async function brainstormConcept(opts: {
  name?: string;
  genre?: string;
  mood?: string;
  influences?: string;
}): Promise<string> {
  const prompt = `You are a creative music producer. Brainstorm a cohesive album concept.

Details provided:
- Album name: ${opts.name || "(not decided)"}
- Genre: ${opts.genre || "(open)"}
- Mood: ${opts.mood || "(open)"}
- Influences: ${opts.influences || "(none specified)"}

Write a 2-3 paragraph concept description that includes:
1. The overall theme/narrative arc
2. Suggested track ideas (just names and one-line descriptions)
3. The sonic palette (instruments, production style)

Be creative and specific. Write in a conversational tone.`;

  return generate(prompt);
}

// ── Write lyrics for a track ─────────────────────────────────────

export async function writeLyrics(opts: {
  title: string;
  concept?: string;
  genre?: string;
  mood?: string;
}): Promise<string> {
  const prompt = `You are a songwriter. Write lyrics for a song.

Title: ${opts.title}
${opts.concept ? `Album concept: ${opts.concept}` : ""}
${opts.genre ? `Genre: ${opts.genre}` : ""}
${opts.mood ? `Mood: ${opts.mood}` : ""}

Write complete song lyrics with verses, chorus, and a bridge.
Use Suno-compatible metatags like [Verse], [Chorus], [Bridge], [Outro].
Keep total length under 3000 characters (Suno's limit).
Return ONLY the lyrics, no explanations.`;

  return generate(prompt);
}

// ── Generate a Suno style prompt ─────────────────────────────────

export async function generateStylePrompt(opts: {
  title: string;
  genre?: string;
  mood?: string;
  concept?: string;
}): Promise<string> {
  const prompt = `You are a music production expert. Generate a Suno AI style/tags string for a song.

Title: ${opts.title}
${opts.genre ? `Genre: ${opts.genre}` : ""}
${opts.mood ? `Mood: ${opts.mood}` : ""}
${opts.concept ? `Album concept: ${opts.concept}` : ""}

Return ONLY a comma-separated list of genre tags and style descriptors.
Example: "indie rock, dreamy guitars, reverb-heavy vocals, slow tempo, melancholic"
Keep it under 200 characters. Do NOT include artist names. Return ONLY the tags.`;

  return generate(prompt);
}
