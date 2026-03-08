import { Router } from "express";
import { db } from "../db";
import {
  tracks,
  trackVersions,
  albumSessions,
  producerLogs,
} from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { isAuthenticated } from "../auth";

const router = Router();

// ── Get single track with versions ───────────────────────────────

router.get("/:id", isAuthenticated, async (req: any, res) => {
  try {
    const trackId = parseInt(req.params.id);
    const userId = req.user.claims.sub;

    const [track] = await db.select().from(tracks).where(eq(tracks.id, trackId));

    if (!track) {
      return res.status(404).json({ message: "Track not found" });
    }

    // Verify ownership through session
    const [session] = await db
      .select()
      .from(albumSessions)
      .where(
        and(
          eq(albumSessions.id, track.sessionId),
          eq(albumSessions.userId, userId)
        )
      );

    if (!session) {
      return res.status(404).json({ message: "Track not found" });
    }

    const versions = await db
      .select()
      .from(trackVersions)
      .where(eq(trackVersions.trackId, trackId))
      .orderBy(desc(trackVersions.versionNumber));

    const logs = await db
      .select()
      .from(producerLogs)
      .where(eq(producerLogs.trackId, trackId))
      .orderBy(desc(producerLogs.createdAt));

    res.json({ ...track, versions, logs });
  } catch (error) {
    console.error("Error fetching track:", error);
    res.status(500).json({ message: "Failed to fetch track" });
  }
});

// ── Update track (lyrics, style, title, etc.) ────────────────────

router.patch("/:id", isAuthenticated, async (req: any, res) => {
  try {
    const trackId = parseInt(req.params.id);
    const userId = req.user.claims.sub;

    // Verify ownership
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

    const allowedFields = [
      "title",
      "lyrics",
      "lyricsRaw",
      "lyricsSunoReady",
      "stylePrompt",
      "styleTags",
      "instrumental",
      "sunoPersonaId",
      "status",
      "trackNumber",
      "isrc",
      "songwriterCredits",
      "copyrightInfo",
    ];

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    const [updated] = await db
      .update(tracks)
      .set(updates)
      .where(eq(tracks.id, trackId))
      .returning();

    res.json(updated);
  } catch (error) {
    console.error("Error updating track:", error);
    res.status(500).json({ message: "Failed to update track" });
  }
});

// ── Add a track to session ───────────────────────────────────────

router.post("/", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const { sessionId, title, trackNumber } = req.body;

    // Verify ownership
    const [session] = await db
      .select()
      .from(albumSessions)
      .where(
        and(eq(albumSessions.id, sessionId), eq(albumSessions.userId, userId))
      );
    if (!session) return res.status(404).json({ message: "Session not found" });

    // Auto-assign track number if not provided
    let num = trackNumber;
    if (!num) {
      const existingTracks = await db
        .select()
        .from(tracks)
        .where(eq(tracks.sessionId, sessionId));
      num = existingTracks.length + 1;
    }

    const [track] = await db
      .insert(tracks)
      .values({
        sessionId,
        trackNumber: num,
        title: title || `Track ${num}`,
        status: "concept",
      })
      .returning();

    res.status(201).json(track);
  } catch (error) {
    console.error("Error adding track:", error);
    res.status(500).json({ message: "Failed to add track" });
  }
});

// ── Delete a track ───────────────────────────────────────────────

router.delete("/:id", isAuthenticated, async (req: any, res) => {
  try {
    const trackId = parseInt(req.params.id);
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

    await db.delete(tracks).where(eq(tracks.id, trackId));
    res.json({ message: "Track deleted" });
  } catch (error) {
    console.error("Error deleting track:", error);
    res.status(500).json({ message: "Failed to delete track" });
  }
});

// ── Approve a track version ──────────────────────────────────────

router.post(
  "/:trackId/versions/:versionId/approve",
  isAuthenticated,
  async (req: any, res) => {
    try {
      const trackId = parseInt(req.params.trackId);
      const versionId = parseInt(req.params.versionId);

      // Unapprove all other versions of this track
      await db
        .update(trackVersions)
        .set({ approved: false })
        .where(eq(trackVersions.trackId, trackId));

      // Approve this version
      const [approved] = await db
        .update(trackVersions)
        .set({ approved: true })
        .where(eq(trackVersions.id, versionId))
        .returning();

      // Update track status
      await db
        .update(tracks)
        .set({ status: "approved", updatedAt: new Date() })
        .where(eq(tracks.id, trackId));

      // Log it
      await db.insert(producerLogs).values({
        sessionId: (
          await db.select().from(tracks).where(eq(tracks.id, trackId))
        )[0].sessionId,
        trackId,
        producer: "generation",
        action: "approve",
        details: { versionId: approved.id, versionNumber: approved.versionNumber },
      });

      res.json(approved);
    } catch (error) {
      console.error("Error approving version:", error);
      res.status(500).json({ message: "Failed to approve version" });
    }
  }
);

export default router;
