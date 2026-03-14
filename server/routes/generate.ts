import { Router } from "express";
import { db } from "../db.js";
import { tracks, sessions } from "@shared/schema";
import { eq } from "drizzle-orm";
import * as suno from "../services/suno.js";
import * as gemini from "../services/gemini.js";

const router = Router();

// ── Generate a single track via Suno ─────────────────────────────
// POST /api/generate/:trackId
router.post("/:trackId", async (req, res) => {
  const trackId = parseInt(req.params.trackId);
  const track = await db.query.tracks.findFirst({ where: eq(tracks.id, trackId) });
  if (!track) return res.status(404).json({ error: "Track not found" });

  try {
    // Mark as generating
    await db.update(tracks).set({ status: "generating", updatedAt: new Date() }).where(eq(tracks.id, trackId));

    let clips: suno.SunoClip[];

    if (track.lyrics && track.stylePrompt && track.title) {
      // Custom generation — we have lyrics + style
      console.log(`[generate] custom generate: "${track.title}"`);
      clips = await suno.generateCustom({
        title: track.title,
        lyrics: track.instrumental ? undefined : track.lyrics,
        style: track.stylePrompt,
        instrumental: track.instrumental ?? false,
      });
    } else {
      // Simple generation — just a prompt
      const prompt = track.lyrics || track.title || "instrumental music";
      console.log(`[generate] simple generate: "${prompt.slice(0, 60)}..."`);
      clips = await suno.generateSimple(prompt, track.instrumental ?? false);
    }

    if (!clips || clips.length === 0) {
      throw new Error("Suno returned no clips");
    }

    // Store the task/clip IDs
    const clipIds = clips.map((c) => c.id);
    await db.update(tracks).set({
      sunoTaskId: clipIds.join(","),
      sunoClipId: clipIds[0],
      updatedAt: new Date(),
    }).where(eq(tracks.id, trackId));

    // Poll until ready
    console.log(`[generate] polling for clips: ${clipIds.join(", ")}`);
    const ready = await suno.pollUntilReady(clipIds);
    const best = ready[0]; // Take the first clip

    // Save results
    await db.update(tracks).set({
      status: "complete",
      audioUrl: best.audio_url || best.stream_audio_url,
      imageUrl: best.image_url || best.image_large_url,
      duration: best.duration ? Math.round(best.duration) : null,
      sunoClipId: best.id,
      sunoMeta: best as any,
      updatedAt: new Date(),
    }).where(eq(tracks.id, trackId));

    const updated = await db.query.tracks.findFirst({ where: eq(tracks.id, trackId) });
    res.json(updated);

  } catch (err: any) {
    console.error(`[generate] error for track ${trackId}:`, err.message);
    await db.update(tracks).set({ status: "error", updatedAt: new Date() }).where(eq(tracks.id, trackId));
    res.status(500).json({ error: err.message });
  }
});

// ── AI: Brainstorm session concept ───────────────────────────────
// POST /api/generate/ai/brainstorm
router.post("/ai/brainstorm", async (req, res) => {
  try {
    const { name, genre, mood, influences } = req.body;
    const concept = await gemini.brainstormConcept({ name, genre, mood, influences });
    res.json({ concept });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── AI: Write lyrics ─────────────────────────────────────────────
// POST /api/generate/ai/lyrics
router.post("/ai/lyrics", async (req, res) => {
  try {
    const { title, concept, genre, mood } = req.body;
    const lyrics = await gemini.writeLyrics({ title, concept, genre, mood });
    res.json({ lyrics });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── AI: Generate style prompt ────────────────────────────────────
// POST /api/generate/ai/style
router.post("/ai/style", async (req, res) => {
  try {
    const { title, genre, mood, concept } = req.body;
    const style = await gemini.generateStylePrompt({ title, genre, mood, concept });
    res.json({ style });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Suno: Generate lyrics (via Suno's own AI) ────────────────────
// POST /api/generate/suno/lyrics
router.post("/suno/lyrics", async (req, res) => {
  try {
    const { concept } = req.body;
    const result = await suno.generateLyrics(concept);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── AI: Generate art prompt ──────────────────────────────────────
// POST /api/generate/ai/art-prompt
router.post("/ai/art-prompt", async (req, res) => {
  try {
    const { sessionId, trackId, type } = req.body;
    let sessionData: any = null;
    let trackData: any = null;

    if (sessionId) {
      sessionData = await db.query.sessions.findFirst({ where: eq(sessions.id, sessionId) });
    }
    if (trackId) {
      trackData = await db.query.tracks.findFirst({ where: eq(tracks.id, trackId) });
    }

    const prompt = await gemini.generateArtPrompt({
      sessionName: sessionData?.name,
      trackTitle: trackData?.title,
      concept: sessionData?.concept,
      genre: sessionData?.genre,
      mood: sessionData?.mood,
      type: type || "album",
    });
    res.json({ prompt });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── AI: Generate cover art image ─────────────────────────────────
// POST /api/generate/ai/cover-art
router.post("/ai/cover-art", async (req, res) => {
  try {
    const { prompt, sessionId, trackId } = req.body;
    if (!prompt) return res.status(400).json({ error: "prompt is required" });
    if (!sessionId) return res.status(400).json({ error: "sessionId is required" });

    console.log(`[artwork] generating cover art for session ${sessionId}${trackId ? ` track ${trackId}` : ""}`);
    const { imagePath, imageUrl } = await gemini.generateCoverArt({ prompt, sessionId, trackId });
    console.log(`[artwork] saved to ${imagePath}`);

    // Save to DB
    if (trackId) {
      await db.update(tracks).set({ coverArtUrl: imageUrl, updatedAt: new Date() }).where(eq(tracks.id, trackId));
    } else {
      await db.update(sessions).set({ coverArtUrl: imageUrl, coverArtPrompt: prompt, updatedAt: new Date() }).where(eq(sessions.id, sessionId));
    }

    res.json({ imageUrl, prompt });
  } catch (err: any) {
    console.error("[artwork] error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Check Suno credits ───────────────────────────────────────────
// GET /api/generate/credits
router.get("/credits", async (_req, res) => {
  try {
    const credits = await suno.getCredits();
    res.json(credits);
  } catch (err: any) {
    res.status(500).json({ error: err.message, sunoReachable: false });
  }
});

export default router;
