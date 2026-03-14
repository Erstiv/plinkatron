import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";

// ── Sessions (albums / projects) ─────────────────────────────────

export const sessions = pgTable("sessions", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  concept: text("concept"),           // free-text album concept
  genre: text("genre"),               // e.g. "indie rock", "lo-fi hip hop"
  mood: text("mood"),                 // e.g. "melancholic", "upbeat"
  influences: text("influences"),     // e.g. "Radiohead, Bon Iver"
  targetTrackCount: integer("target_track_count").default(5),
  status: text("status").notNull().default("draft"),  // draft | generating | complete
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const sessionsRelations = relations(sessions, ({ many }) => ({
  tracks: many(tracks),
}));

// ── Tracks ───────────────────────────────────────────────────────

export const tracks = pgTable("tracks", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull().references(() => sessions.id, { onDelete: "cascade" }),
  trackNumber: integer("track_number").notNull(),
  title: text("title"),
  status: text("status").notNull().default("empty"),  // empty | has_lyrics | has_style | generating | complete | error
  // Lyrics
  lyrics: text("lyrics"),              // final lyrics sent to Suno
  lyricsRaw: text("lyrics_raw"),       // AI-generated lyrics before editing
  // Style
  stylePrompt: text("style_prompt"),   // Suno style/genre string
  instrumental: boolean("instrumental").default(false),
  // Suno results
  sunoTaskId: text("suno_task_id"),    // ID returned by /api/generate or /api/custom_generate
  sunoClipId: text("suno_clip_id"),    // clip ID from Suno response
  audioUrl: text("audio_url"),         // URL to the generated audio
  imageUrl: text("image_url"),         // Suno cover image
  duration: integer("duration"),       // seconds
  // Metadata
  sunoMeta: jsonb("suno_meta"),        // full Suno response for this track
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const tracksRelations = relations(tracks, ({ one }) => ({
  session: one(sessions, { fields: [tracks.sessionId], references: [sessions.id] }),
}));

// ── Zod schemas for insert validation ────────────────────────────

export const insertSessionSchema = createInsertSchema(sessions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTrackSchema = createInsertSchema(tracks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// ── TypeScript types ─────────────────────────────────────────────

export type Session = typeof sessions.$inferSelect;
export type InsertSession = typeof sessions.$inferInsert;
export type Track = typeof tracks.$inferSelect;
export type InsertTrack = typeof tracks.$inferInsert;
