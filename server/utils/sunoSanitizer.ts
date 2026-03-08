/**
 * Suno Sanitizer
 *
 * Strips content that Suno doesn't allow or handles poorly:
 * - Real artist/band names
 * - Copyrighted song references
 * - Proper nouns that might trigger content filters
 *
 * This runs as a final pass before sending lyrics to Suno.
 */

// Common artist/band names that might slip through
// This is a starter list — extend as needed
const BANNED_TERMS = [
  // These are patterns, not exact matches
  /\b(beatles|nirvana|radiohead|pink floyd|led zeppelin)\b/gi,
  /\b(taylor swift|beyonce|drake|kanye|eminem|rihanna)\b/gi,
  /\b(elvis|madonna|prince|bowie|hendrix)\b/gi,
  /\b(coldplay|metallica|queen|acdc|ac\/dc)\b/gi,
  /\b(spotify|apple music|youtube music|soundcloud)\b/gi,
];

export interface SanitizeResult {
  text: string;
  isClean: boolean;
  warnings: string[];
  removedTerms: string[];
}

export function sanitizeLyrics(lyrics: string): SanitizeResult {
  let text = lyrics;
  const warnings: string[] = [];
  const removedTerms: string[] = [];

  for (const pattern of BANNED_TERMS) {
    const matches = text.match(pattern);
    if (matches) {
      for (const match of matches) {
        removedTerms.push(match);
        warnings.push(
          `Removed "${match}" — Suno doesn't allow real artist/brand names`
        );
      }
      text = text.replace(pattern, "[...]");
    }
  }

  // Check total length (Suno limit is ~3000 chars for lyrics)
  if (text.length > 3000) {
    warnings.push(
      `Lyrics are ${text.length} chars — Suno has a ~3000 char limit. Consider trimming.`
    );
  }

  return {
    text,
    isClean: removedTerms.length === 0 && text.length <= 3000,
    warnings,
    removedTerms,
  };
}

/**
 * Validate that a style prompt is Suno-ready
 */
export function sanitizeStylePrompt(prompt: string): SanitizeResult {
  let text = prompt;
  const warnings: string[] = [];
  const removedTerms: string[] = [];

  for (const pattern of BANNED_TERMS) {
    const matches = text.match(pattern);
    if (matches) {
      for (const match of matches) {
        removedTerms.push(match);
        warnings.push(
          `Removed "${match}" from style prompt — use genre descriptors instead`
        );
      }
      text = text.replace(pattern, "");
    }
  }

  // Clean up extra spaces
  text = text.replace(/\s+/g, " ").trim();

  if (text.length > 200) {
    warnings.push("Style prompt is long — Suno works best with concise tags.");
  }

  return {
    text,
    isClean: removedTerms.length === 0,
    warnings,
    removedTerms,
  };
}
