import { Router } from "express";
import { db } from "../db.js";
import { tracks, sessions } from "@shared/schema";
import { eq } from "drizzle-orm";

const router = Router();

// Get a single track
router.get("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const track = await db.query.tracks.findFirst({ where: eq(tracks.id, id) });
  if (!track) return res.status(404).json({ error: "Track not found" });
  res.json(track);
});

// Update track fields (lyrics, style, title, etc.)
router.patch("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const { title, lyrics, lyricsRaw, stylePrompt, instrumental, status } = req.body;
  const [updated] = await db.update(tracks)
    .set({
      ...(title !== undefined && { title }),
      ...(lyrics !== undefined && { lyrics }),
      ...(lyricsRaw !== undefined && { lyricsRaw }),
      ...(stylePrompt !== undefined && { stylePrompt }),
      ...(instrumental !== undefined && { instrumental }),
      ...(status !== undefined && { status }),
      updatedAt: new Date(),
    })
    .where(eq(tracks.id, id))
    .returning();
  if (!updated) return res.status(404).json({ error: "Track not found" });
  res.json(updated);
});

// Add a new track to a session
router.post("/", async (req, res) => {
  const { sessionId, title, trackNumber } = req.body;
  // Auto-determine track number if not given
  let num = trackNumber;
  if (!num) {
    const existing = await db.select().from(tracks).where(eq(tracks.sessionId, sessionId));
    num = existing.length + 1;
  }
  const [track] = await db.insert(tracks).values({
    sessionId,
    trackNumber: num,
    title: title || `Track ${num}`,
  }).returning();
  res.status(201).json(track);
});

// Delete a track
router.delete("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  await db.delete(tracks).where(eq(tracks.id, id));
  res.json({ ok: true });
});

export default router;
