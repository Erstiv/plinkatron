import { Router } from "express";
import { db } from "../db.js";
import { sessions, tracks } from "@shared/schema";
import { eq, desc } from "drizzle-orm";

const router = Router();

// List all sessions
router.get("/", async (_req, res) => {
  const rows = await db.select().from(sessions).orderBy(desc(sessions.createdAt));
  res.json(rows);
});

// Get single session with tracks
router.get("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const session = await db.query.sessions.findFirst({
    where: eq(sessions.id, id),
    with: { tracks: true },
  });
  if (!session) return res.status(404).json({ error: "Session not found" });
  // Sort tracks by trackNumber
  session.tracks.sort((a, b) => a.trackNumber - b.trackNumber);
  res.json(session);
});

// Create session + placeholder tracks
router.post("/", async (req, res) => {
  const { name, concept, genre, mood, influences, targetTrackCount } = req.body;
  const count = targetTrackCount || 5;

  const [session] = await db.insert(sessions).values({
    name: name || "Untitled Session",
    concept,
    genre,
    mood,
    influences,
    targetTrackCount: count,
  }).returning();

  // Create placeholder tracks
  const trackInserts = Array.from({ length: count }, (_, i) => ({
    sessionId: session.id,
    trackNumber: i + 1,
    title: `Track ${i + 1}`,
    status: "empty" as const,
  }));
  await db.insert(tracks).values(trackInserts);

  // Return with tracks
  const full = await db.query.sessions.findFirst({
    where: eq(sessions.id, session.id),
    with: { tracks: true },
  });
  res.status(201).json(full);
});

// Update session
router.patch("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const { name, concept, genre, mood, influences, targetTrackCount, status, coverArtUrl, coverArtPrompt } = req.body;
  const [updated] = await db.update(sessions)
    .set({
      ...(name !== undefined && { name }),
      ...(concept !== undefined && { concept }),
      ...(genre !== undefined && { genre }),
      ...(mood !== undefined && { mood }),
      ...(coverArtUrl !== undefined && { coverArtUrl }),
      ...(coverArtPrompt !== undefined && { coverArtPrompt }),
      ...(influences !== undefined && { influences }),
      ...(targetTrackCount !== undefined && { targetTrackCount }),
      ...(status !== undefined && { status }),
      updatedAt: new Date(),
    })
    .where(eq(sessions.id, id))
    .returning();
  if (!updated) return res.status(404).json({ error: "Session not found" });
  res.json(updated);
});

// Delete session (cascades to tracks)
router.delete("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  await db.delete(sessions).where(eq(sessions.id, id));
  res.json({ ok: true });
});

export default router;
