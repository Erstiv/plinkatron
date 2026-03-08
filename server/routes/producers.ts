/**
 * Producer routes — the suggest/edit AI endpoints
 *
 * These map to the Cassian pattern:
 *   SUGGEST → AI generates a proposal
 *   EDIT    → User modifies, AI revises
 */

import { Router } from "express";
import { db } from "../db";
import { tracks, albumSessions, producerLogs } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { isAuthenticated } from "../auth";
import {
  brainstormConcept,
  writeLyrics,
  generateStylePrompt,
  generateArtPrompt,
} from "../services/gemini";
import { sanitizeLyrics, sanitizeStylePrompt } from "../utils/sunoSanitizer";

const router = Router();

// ── Concept Producer: Brainstorm album concept ───────────────────

router.post("/concept/:sessionId", isAuthenticated, async (req: any, res) => {
  try {
    const sessionId = parseInt(req.params.sessionId);
    const userId = req.user.claims.sub;

    const [session] = await db
      .select()
      .from(albumSessions)
      .where(
        and(eq(albumSessions.id, sessionId), eq(albumSessions.userId, userId))
      );
    if (!session) return res.status(404).json({ message: "Session not found" });

    const result = await brainstormConcept({
      genre: session.genre || req.body.genre,
      mood: session.mood || req.body.mood,
      influences: session.influences || req.body.influences,
      description: req.body.description,
    });

    // Log the suggestion
    await db.insert(producerLogs).values({
      sessionId,
      producer: "concept",
      action: "suggest",
      details: result as any,
    });

    res.json(result);
  } catch (error: any) {
    console.error("Concept brainstorm error:", error);
    res.status(500).json({ message: error.message || "Brainstorm failed" });
  }
});

// ── Lyric Producer: Write lyrics for a track ─────────────────────

router.post("/lyrics/:trackId", isAuthenticated, async (req: any, res) => {
  try {
    const trackId = parseInt(req.params.trackId);
    const userId = req.user.claims.sub;

    const [track] = await db.select().from(tracks).where(eq(tracks.id, trackId));
    if (!track) return res.status(404).json({ message: "Track not found" });

    const [session] = await db
      .select()
      .from(albumSessions)
      .where(
        and(
          eq(albumSessions.id, track.sessionId),
          eq(albumSessions.userId, userId)
        )
      );
    if (!session) return res.status(404).json({ message: "Track not found" });

    const result = await writeLyrics({
      trackTitle: track.title || "Untitled",
      description: req.body.description || "",
      genre: session.genre || req.body.genre || "any",
      mood: session.mood || req.body.mood || "any",
      albumConcept: session.concept || undefined,
    });

    // Sanitize for Suno
    const sanitized = sanitizeLyrics(result.lyrics);

    // Log
    await db.insert(producerLogs).values({
      sessionId: track.sessionId,
      trackId,
      producer: "lyrics",
      action: "suggest",
      details: {
        ...result,
        sanitizeWarnings: sanitized.warnings,
      } as any,
    });

    res.json({
      ...result,
      sanitizedLyrics: sanitized.text,
      sanitizeWarnings: sanitized.warnings,
      isSunoReady: sanitized.isClean,
    });
  } catch (error: any) {
    console.error("Lyrics generation error:", error);
    res.status(500).json({ message: error.message || "Lyrics generation failed" });
  }
});

// ── Lyric Producer: Sanitize uploaded lyrics ─────────────────────

router.post("/lyrics/sanitize", isAuthenticated, async (req: any, res) => {
  try {
    const { lyrics } = req.body;
    if (!lyrics) return res.status(400).json({ message: "No lyrics provided" });

    const result = sanitizeLyrics(lyrics);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// ── Style Producer: Generate style prompt ────────────────────────

router.post("/style/:trackId", isAuthenticated, async (req: any, res) => {
  try {
    const trackId = parseInt(req.params.trackId);
    const userId = req.user.claims.sub;

    const [track] = await db.select().from(tracks).where(eq(tracks.id, trackId));
    if (!track) return res.status(404).json({ message: "Track not found" });

    const [session] = await db
      .select()
      .from(albumSessions)
      .where(
        and(
          eq(albumSessions.id, track.sessionId),
          eq(albumSessions.userId, userId)
        )
      );
    if (!session) return res.status(404).json({ message: "Track not found" });

    const result = await generateStylePrompt({
      description: req.body.description || track.title || "",
      genre: session.genre || req.body.genre,
      mood: session.mood || req.body.mood,
      referenceAnalysis: req.body.referenceAnalysis,
    });

    // Sanitize
    const sanitized = sanitizeStylePrompt(result.stylePrompt);

    // Log
    await db.insert(producerLogs).values({
      sessionId: track.sessionId,
      trackId,
      producer: "style",
      action: "suggest",
      details: { ...result, sanitizeWarnings: sanitized.warnings } as any,
    });

    res.json({
      ...result,
      sanitizedPrompt: sanitized.text,
      sanitizeWarnings: sanitized.warnings,
    });
  } catch (error: any) {
    console.error("Style generation error:", error);
    res.status(500).json({ message: error.message || "Style generation failed" });
  }
});

// ── Art Producer: Generate cover art prompt ──────────────────────

router.post("/artwork/:sessionId", isAuthenticated, async (req: any, res) => {
  try {
    const sessionId = parseInt(req.params.sessionId);
    const userId = req.user.claims.sub;

    const [session] = await db
      .select()
      .from(albumSessions)
      .where(
        and(eq(albumSessions.id, sessionId), eq(albumSessions.userId, userId))
      );
    if (!session) return res.status(404).json({ message: "Session not found" });

    const result = await generateArtPrompt({
      albumTitle: session.name,
      concept: session.concept || "",
      genre: session.genre || "any",
      mood: session.mood || "any",
      lyrics: req.body.lyrics,
    });

    // Log
    await db.insert(producerLogs).values({
      sessionId,
      producer: "artwork",
      action: "suggest",
      details: result as any,
    });

    res.json(result);
  } catch (error: any) {
    console.error("Art prompt error:", error);
    res.status(500).json({ message: error.message || "Art prompt generation failed" });
  }
});

export default router;
