/**
 * Gemini API Client
 *
 * Used by producers for:
 *   - Concept brainstorming (album themes, track arcs)
 *   - Lyric writing and editing
 *   - Style prompt generation
 *   - Cover art prompt creation
 *   - Reference song analysis interpretation
 */

import { GoogleGenAI } from "@google/genai";

let genAIClient: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (!genAIClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
    genAIClient = new GoogleGenAI({ apiKey });
  }
  return genAIClient;
}

// ── Generate text content ────────────────────────────────────────

export async function generateText(
  prompt: string,
  options?: {
    model?: string;
    temperature?: number;
    maxOutputTokens?: number;
  }
): Promise<string> {
  const client = getClient();
  const model = options?.model || "gemini-2.5-pro";

  const response = await client.models.generateContent({
    model,
    contents: prompt,
    config: {
      temperature: options?.temperature ?? 0.7,
      maxOutputTokens: options?.maxOutputTokens ?? 8192,
    },
  });

  return response.text || "";
}

// ── Generate JSON content (with markdown fence stripping) ────────

export async function generateJSON<T = Record<string, unknown>>(
  prompt: string,
  options?: {
    model?: string;
    temperature?: number;
    maxOutputTokens?: number;
  }
): Promise<T> {
  const raw = await generateText(prompt, {
    ...options,
    temperature: options?.temperature ?? 0.3,
  });

  // Strip markdown code fences (Gemini sometimes wraps JSON)
  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.split("```")[1];
    if (cleaned.startsWith("json")) {
      cleaned = cleaned.slice(4);
    }
  }

  return JSON.parse(cleaned.trim());
}

// ── Brainstorm album concept ─────────────────────────────────────

export async function brainstormConcept(input: {
  genre?: string;
  mood?: string;
  influences?: string;
  description?: string;
}): Promise<{
  albumTitle: string;
  concept: string;
  trackSuggestions: Array<{
    number: number;
    title: string;
    description: string;
    role: string; // opener, build, climax, closer, interlude
  }>;
  moodArc: string;
}> {
  const prompt = `You are a creative music producer brainstorming an album concept.

Based on the following input, create a cohesive album concept:

GENRE: ${input.genre || "any"}
MOOD: ${input.mood || "any"}
INFLUENCES: ${input.influences || "none specified"}
DESCRIPTION: ${input.description || "none"}

Return ONLY valid JSON with this exact structure:
{
  "albumTitle": "suggested album title",
  "concept": "2-3 sentence album concept/narrative",
  "trackSuggestions": [
    {
      "number": 1,
      "title": "track title",
      "description": "what this track sounds/feels like",
      "role": "opener"
    }
  ],
  "moodArc": "description of how the album builds emotionally from start to finish"
}

Suggest 8-12 tracks. Each track should have a role: opener, build, climax, cooldown, closer, or interlude.
The album should feel like a journey with emotional peaks and valleys.`;

  return generateJSON(prompt);
}

// ── Write lyrics for a track ─────────────────────────────────────

export async function writeLyrics(input: {
  trackTitle: string;
  description: string;
  genre: string;
  mood: string;
  albumConcept?: string;
}): Promise<{
  lyrics: string;
  structure: string;
  sunoReady: boolean;
  warnings: string[];
}> {
  const prompt = `You are a professional songwriter.

Write lyrics for the following track:

TITLE: ${input.trackTitle}
DESCRIPTION: ${input.description}
GENRE: ${input.genre}
MOOD: ${input.mood}
${input.albumConcept ? `ALBUM CONTEXT: ${input.albumConcept}` : ""}

IMPORTANT RULES (Suno compatibility):
- Do NOT use any real artist names, band names, or proper nouns of real people
- Do NOT reference specific copyrighted songs
- Use [Verse], [Chorus], [Bridge], [Outro] structure tags
- Keep total length under 3000 characters
- Write emotionally authentic lyrics that fit the mood

Return ONLY valid JSON:
{
  "lyrics": "the full lyrics with [Verse] [Chorus] etc. tags",
  "structure": "verse-chorus-verse-chorus-bridge-chorus-outro",
  "sunoReady": true,
  "warnings": ["any issues found, or empty array"]
}`;

  return generateJSON(prompt);
}

// ── Generate style prompt from description ───────────────────────

export async function generateStylePrompt(input: {
  description: string;
  genre?: string;
  mood?: string;
  referenceAnalysis?: string;
}): Promise<{
  stylePrompt: string;
  tags: string[];
}> {
  const prompt = `You are a music production expert creating a Suno AI style prompt.

Based on the following, create a concise style description and tags:

DESCRIPTION: ${input.description}
GENRE: ${input.genre || "any"}
MOOD: ${input.mood || "any"}
${input.referenceAnalysis ? `REFERENCE SONG ANALYSIS: ${input.referenceAnalysis}` : ""}

RULES:
- Tags should be comma-separated genre/mood/instrument descriptors
- NO artist names, band names, or proper nouns of real people
- Keep the style prompt under 200 characters
- Be specific about instruments, tempo feel, and production style

Return ONLY valid JSON:
{
  "stylePrompt": "dreamy indie rock, reverb-heavy guitars, soft female vocals, 120 BPM",
  "tags": ["indie rock", "dreamy", "reverb", "soft vocals"]
}`;

  return generateJSON(prompt);
}

// ── Generate cover art prompt ────────────────────────────────────

export async function generateArtPrompt(input: {
  albumTitle: string;
  concept: string;
  lyrics?: string;
  genre: string;
  mood: string;
}): Promise<{
  imagePrompt: string;
  negativePrompt: string;
  colorPalette: string[];
  artDirection: string;
}> {
  const prompt = `You are a visual art director creating album cover art concepts.

Create an image generation prompt for album cover art:

ALBUM: ${input.albumTitle}
CONCEPT: ${input.concept}
GENRE: ${input.genre}
MOOD: ${input.mood}
${input.lyrics ? `LYRICS EXCERPT: ${input.lyrics.slice(0, 500)}` : ""}

RULES:
- The prompt should describe a visual scene, not text
- No text or typography in the image
- Should feel like a professional album cover
- 80-150 words for the image prompt

Return ONLY valid JSON:
{
  "imagePrompt": "detailed visual description for image generation",
  "negativePrompt": "things to avoid: text, letters, watermarks, low quality",
  "colorPalette": ["#hex1", "#hex2", "#hex3", "#hex4"],
  "artDirection": "brief description of the visual style"
}`;

  return generateJSON(prompt);
}
