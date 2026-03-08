import { Router } from "express";
import { db } from "../db";
import { tracks, trackVersions, producerLogs, albumSessions } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { isAuthenticated } from "../auth";
import { generateTrack, pollTracks, getCredits } from "../services/suno";

const router = Router();

// ── Generate a single track via Suno ─────────────────────────────

router.post("/track/:trackId", isAuthenticated, async (req: any, res) => {
  try {
    const trackId = parseInt(req.params.trackId);
    const userId = req.user.claims.sub;

    // Load track and verify ownership
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

    // Require lyrics or set as instrumental
    if (!track.lyrics && !track.instrumental) {
      return res
        .status(400)
        .json({ message: "Track needs lyrics or must be set to instrumental" });
    }

    // Update status
    await db
      .update(tracks)
      .set({ status: "generating", updatedAt: new Date() })
      .where(eq(tracks.id, trackId));

    // Log the generation request
    await db.insert(producerLogs).values({
      sessionId: track.sessionId,
      trackId,
      producer: "generation",
      action: "generate",
      details: {
        stylePrompt: track.stylePrompt,
        instrumental: track.instrumental,
      },
    });

    // Call Suno
    const sunoTracks = await generateTrack({
      prompt: track.lyrics || track.title || "Instrumental track",
      tags: track.stylePrompt || undefined,
      title: track.title || "Untitled",
      make_instrumental: track.instrumental || false,
      wait_audio: true,
    });

    // If tracks came back without audio, poll
    let readyTracks = sunoTracks.filter((t) => t.audio_url);
    if (readyTracks.length === 0 && sunoTracks.length > 0) {
      const ids = sunoTracks.map((t) => t.id);
      readyTracks = await pollTracks(ids);
    }

    // Determine next version number
    const existingVersions = await db
      .select()
      .from(trackVersions)
      .where(eq(trackVersions.trackId, trackId));
    const nextVersion = existingVersions.length + 1;

    // Save versions
    const savedVersions = [];
    for (let i = 0; i < readyTracks.length; i++) {
      const sunoTrack = readyTracks[i];
      const [version] = await db
        .insert(trackVersions)
        .values({
          trackId,
          versionNumber: nextVersion + i,
          sunoTrackId: sunoTrack.id,
          audioUrl: sunoTrack.audio_url,
          duration: sunoTrack.duration ? Math.round(sunoTrack.duration) : null,
          tags: sunoTrack.tags || track.stylePrompt,
          approved: false,
        })
        .returning();
      savedVersions.push(version);
    }

    // Update track status
    await db
      .update(tracks)
      .set({ status: "generated", updatedAt: new Date() })
      .where(eq(tracks.id, trackId));

    res.json({
      message: `Generated ${savedVersions.length} version(s)`,
      versions: savedVersions,
    });
  } catch (error: any) {
    console.error("Generation error:", error);

    // Log the error
    const trackId = parseInt(req.params.trackId);
    const [track] = await db
      .select()
      .from(tracks)
      .where(eq(tracks.id, trackId));
    if (track) {
      await db.insert(producerLogs).values({
        sessionId: track.sessionId,
        trackId,
        producer: "generation",
        action: "error",
        details: { error: error.message },
      });

      // Reset status
      await db
        .update(tracks)
        .set({ status: "styled", updatedAt: new Date() })
        .where(eq(tracks.id, trackId));
    }

    res.status(500).json({ message: error.message || "Generation failed" });
  }
});

// ── Batch generate multiple tracks ───────────────────────────────

router.post("/batch/:sessionId", isAuthenticated, async (req: any, res) => {
  try {
    const sessionId = parseInt(req.params.sessionId);
    const userId = req.user.claims.sub;
    const { trackIds } = req.body; // optional: specific tracks to generate

    const [session] = await db
      .select()
      .from(albumSessions)
      .where(
        and(
          eq(albumSessions.id, sessionId),
          eq(albumSessions.userId, userId)
        )
      );
    if (!session) return res.status(404).json({ message: "Session not found" });

    // Get tracks ready for generation
    let readyTracks = await db
      .select()
      .from(tracks)
      .where(eq(tracks.sessionId, sessionId));

    if (trackIds) {
      readyTracks = readyTracks.filter((t) => trackIds.includes(t.id));
    }

    // Filter to only tracks with lyrics or instrumental flag
    readyTracks = readyTracks.filter(
      (t) => t.lyrics || t.instrumental
    );

    if (readyTracks.length === 0) {
      return res
        .status(400)
        .json({ message: "No tracks ready for generation" });
    }

    // Start generation (non-blocking — return immediately)
    res.json({
      message: `Queued ${readyTracks.length} tracks for generation`,
      trackIds: readyTracks.map((t) => t.id),
    });

    // TODO: In a production system, this would use a job queue (Bull, etc.)
    // For now, we generate sequentially in the background
    for (const track of readyTracks) {
      try {
        await db
          .update(tracks)
          .set({ status: "generating", updatedAt: new Date() })
          .where(eq(tracks.id, track.id));

        const sunoTracks = await generateTrack({
          prompt: track.lyrics || track.title || "Instrumental",
          tags: track.stylePrompt || undefined,
          title: track.title || "Untitled",
          make_instrumental: track.instrumental || false,
          wait_audio: true,
        });

        let ready = sunoTracks.filter((t) => t.audio_url);
        if (ready.length === 0 && sunoTracks.length > 0) {
          ready = await pollTracks(sunoTracks.map((t) => t.id));
        }

        const existingVersions = await db
          .select()
          .from(trackVersions)
          .where(eq(trackVersions.trackId, track.id));

        for (let i = 0; i < ready.length; i++) {
          await db.insert(trackVersions).values({
            trackId: track.id,
            versionNumber: existingVersions.length + 1 + i,
            sunoTrackId: ready[i].id,
            audioUrl: ready[i].audio_url,
            duration: ready[i].duration
              ? Math.round(ready[i].duration!)
              : null,
            tags: ready[i].tags || track.stylePrompt,
          });
        }

        await db
          .update(tracks)
          .set({ status: "generated", updatedAt: new Date() })
          .where(eq(tracks.id, track.id));
      } catch (err: any) {
        console.error(`Batch gen error for track ${track.id}:`, err);
        await db
          .update(tracks)
          .set({ status: "styled", updatedAt: new Date() })
          .where(eq(tracks.id, track.id));
      }
    }
  } catch (error: any) {
    console.error("Batch generation error:", error);
    res.status(500).json({ message: error.message || "Batch generation failed" });
  }
});

// ── Get Suno credits ─────────────────────────────────────────────

router.get("/credits", isAuthenticated, async (_req, res) => {
  const credits = await getCredits();
  res.json({ credits });
});

export default router;
