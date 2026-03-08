import { Router } from "express";
import { db } from "../db";
import { albumSessions, tracks, insertAlbumSessionSchema } from "@shared/schema";
import { eq, desc, and } from "drizzle-orm";
import { isAuthenticated } from "../auth";

const router = Router();

// ── List all sessions for current user ───────────────────────────

router.get("/", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const sessions = await db
      .select()
      .from(albumSessions)
      .where(eq(albumSessions.userId, userId))
      .orderBy(desc(albumSessions.updatedAt));

    res.json(sessions);
  } catch (error) {
    console.error("Error listing sessions:", error);
    res.status(500).json({ message: "Failed to list sessions" });
  }
});

// ── Get single session with tracks ───────────────────────────────

router.get("/:id", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const sessionId = parseInt(req.params.id);

    const [session] = await db
      .select()
      .from(albumSessions)
      .where(
        and(eq(albumSessions.id, sessionId), eq(albumSessions.userId, userId))
      );

    if (!session) {
      return res.status(404).json({ message: "Session not found" });
    }

    const sessionTracks = await db
      .select()
      .from(tracks)
      .where(eq(tracks.sessionId, sessionId))
      .orderBy(tracks.trackNumber);

    res.json({ ...session, tracks: sessionTracks });
  } catch (error) {
    console.error("Error fetching session:", error);
    res.status(500).json({ message: "Failed to fetch session" });
  }
});

// ── Create new session ───────────────────────────────────────────

router.post("/", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const { name, concept, genre, mood, influences, targetTrackCount } =
      req.body;

    const [session] = await db
      .insert(albumSessions)
      .values({
        userId,
        name: name || "Untitled Album",
        concept,
        genre,
        mood,
        influences,
        targetTrackCount: targetTrackCount || 10,
        status: "draft",
      })
      .returning();

    // Auto-create placeholder tracks based on target count
    const trackCount = targetTrackCount || 10;
    const trackInserts = Array.from({ length: trackCount }, (_, i) => ({
      sessionId: session.id,
      trackNumber: i + 1,
      title: `Track ${i + 1}`,
      status: "concept" as const,
    }));

    await db.insert(tracks).values(trackInserts);

    res.status(201).json(session);
  } catch (error) {
    console.error("Error creating session:", error);
    res.status(500).json({ message: "Failed to create session" });
  }
});

// ── Update session ───────────────────────────────────────────────

router.patch("/:id", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const sessionId = parseInt(req.params.id);

    // Verify ownership
    const [existing] = await db
      .select()
      .from(albumSessions)
      .where(
        and(eq(albumSessions.id, sessionId), eq(albumSessions.userId, userId))
      );

    if (!existing) {
      return res.status(404).json({ message: "Session not found" });
    }

    const { name, concept, genre, mood, influences, targetTrackCount, status, sunoPersonaId } =
      req.body;

    const [updated] = await db
      .update(albumSessions)
      .set({
        ...(name !== undefined && { name }),
        ...(concept !== undefined && { concept }),
        ...(genre !== undefined && { genre }),
        ...(mood !== undefined && { mood }),
        ...(influences !== undefined && { influences }),
        ...(targetTrackCount !== undefined && { targetTrackCount }),
        ...(status !== undefined && { status }),
        ...(sunoPersonaId !== undefined && { sunoPersonaId }),
        updatedAt: new Date(),
      })
      .where(eq(albumSessions.id, sessionId))
      .returning();

    res.json(updated);
  } catch (error) {
    console.error("Error updating session:", error);
    res.status(500).json({ message: "Failed to update session" });
  }
});

// ── Delete session ───────────────────────────────────────────────

router.delete("/:id", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const sessionId = parseInt(req.params.id);

    const [deleted] = await db
      .delete(albumSessions)
      .where(
        and(eq(albumSessions.id, sessionId), eq(albumSessions.userId, userId))
      )
      .returning();

    if (!deleted) {
      return res.status(404).json({ message: "Session not found" });
    }

    res.json({ message: "Session deleted" });
  } catch (error) {
    console.error("Error deleting session:", error);
    res.status(500).json({ message: "Failed to delete session" });
  }
});

// ── Duplicate session ────────────────────────────────────────────

router.post("/:id/duplicate", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const sessionId = parseInt(req.params.id);

    const [original] = await db
      .select()
      .from(albumSessions)
      .where(
        and(eq(albumSessions.id, sessionId), eq(albumSessions.userId, userId))
      );

    if (!original) {
      return res.status(404).json({ message: "Session not found" });
    }

    const [newSession] = await db
      .insert(albumSessions)
      .values({
        userId,
        name: `${original.name} (Copy)`,
        concept: original.concept,
        genre: original.genre,
        mood: original.mood,
        influences: original.influences,
        targetTrackCount: original.targetTrackCount,
        status: "draft",
        configJson: original.configJson,
        sunoPersonaId: original.sunoPersonaId,
      })
      .returning();

    // Duplicate tracks
    const originalTracks = await db
      .select()
      .from(tracks)
      .where(eq(tracks.sessionId, sessionId))
      .orderBy(tracks.trackNumber);

    if (originalTracks.length > 0) {
      const trackInserts = originalTracks.map((t) => ({
        sessionId: newSession.id,
        trackNumber: t.trackNumber,
        title: t.title,
        status: "concept" as const,
        lyrics: t.lyrics,
        lyricsRaw: t.lyricsRaw,
        stylePrompt: t.stylePrompt,
        styleTags: t.styleTags,
        instrumental: t.instrumental,
      }));

      await db.insert(tracks).values(trackInserts);
    }

    res.status(201).json(newSession);
  } catch (error) {
    console.error("Error duplicating session:", error);
    res.status(500).json({ message: "Failed to duplicate session" });
  }
});

export default router;
