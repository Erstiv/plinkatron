/**
 * Gemini service — uses @google/genai for lyrics, concepts, and cover art generation.
 */
import { GoogleGenAI } from "@google/genai";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { resolve } from "path";

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

// ── Generate an art prompt for album/track cover ─────────────────

export async function generateArtPrompt(opts: {
  sessionName?: string;
  trackTitle?: string;
  concept?: string;
  genre?: string;
  mood?: string;
  type: "album" | "track";
}): Promise<string> {
  const prompt = `You are an album cover art director. Create a detailed image generation prompt for a ${opts.type} cover.

${opts.sessionName ? `Album: ${opts.sessionName}` : ""}
${opts.trackTitle ? `Track: ${opts.trackTitle}` : ""}
${opts.concept ? `Concept: ${opts.concept}` : ""}
${opts.genre ? `Genre: ${opts.genre}` : ""}
${opts.mood ? `Mood: ${opts.mood}` : ""}

Write a detailed, vivid image prompt that would work for AI image generation.
The image should be square (album cover format), visually striking, and match the music's mood.
Do NOT include any text, words, or typography in the image — pure visual art only.
Keep the prompt under 500 characters. Return ONLY the prompt, no explanations.`;

  return generate(prompt);
}

// ── Generate cover art image via Imagen ──────────────────────────

export async function generateCoverArt(opts: {
  prompt: string;
  sessionId: number;
  trackId?: number;
}): Promise<{ imagePath: string; imageUrl: string }> {
  const ai = getClient();

  const response = await ai.models.generateImages({
    model: "imagen-4.0-generate-001",
    prompt: opts.prompt,
    config: {
      numberOfImages: 1,
      aspectRatio: "1:1",
    } as any,
  });

  if (!response.generatedImages || response.generatedImages.length === 0) {
    throw new Error("Imagen returned no images");
  }

  const imgBytes = response.generatedImages[0].image?.imageBytes;
  if (!imgBytes) throw new Error("No image bytes in response");

  // Save to uploads directory
  const uploadsDir = resolve(process.cwd(), "uploads", "artwork");
  if (!existsSync(uploadsDir)) mkdirSync(uploadsDir, { recursive: true });

  const filename = opts.trackId
    ? `session-${opts.sessionId}-track-${opts.trackId}-${Date.now()}.png`
    : `session-${opts.sessionId}-cover-${Date.now()}.png`;
  const filePath = resolve(uploadsDir, filename);
  const buffer = Buffer.from(imgBytes, "base64");
  writeFileSync(filePath, buffer);

  return {
    imagePath: filePath,
    imageUrl: `/uploads/artwork/${filename}`,
  };
}
