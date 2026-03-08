import { sql } from "drizzle-orm";
import {
  pgTable,
  serial,
  integer,
  text,
  varchar,
  timestamp,
  boolean,
  jsonb,
  pgEnum,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Re-export auth models
export * from "./models/auth";

// ── Enums ────────────────────────────────────────────────────────

export const sessionStatusEnum = pgEnum("session_status", [
  "draft",
  "in_progress",
  "complete",
  "archived",
]);

export const trackStatusEnum = pgEnum("track_status", [
  "concept",
  "lyrics_draft",
  "lyrics_approved",
  "styled",
  "generating",
  "generated",
  "approved",
  "mastered",
  "distributed",
]);

export const distributionPlatformEnum = pgEnum("distribution_platform", [
  "tunecore",
  "distrokid",
  "cdbaby",
]);

// ── Album Sessions ───────────────────────────────────────────────

export const albumSessions = pgTable("album_sessions", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  name: text("name").notNull(),
  concept: text("concept"),
  genre: text("genre"),
  mood: text("mood"),
  influences: text("influences"),
  targetTrackCount: integer("target_track_count").default(10),
  status: sessionStatusEnum("status").default("draft").notNull(),
  configJson: jsonb("config_json").$type<Record<string, unknown>>(),
  sunoPersonaId: text("suno_persona_id"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// ── Tracks ───────────────────────────────────────────────────────

export const tracks = pgTable("tracks", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id")
    .notNull()
    .references(() => albumSessions.id, { onDelete: "cascade" }),
  trackNumber: integer("track_number").notNull(),
  title: text("title").default("Untitled Track"),
  status: trackStatusEnum("status").default("concept").notNull(),

  // Lyrics
  lyrics: text("lyrics"),
  lyricsRaw: text("lyrics_raw"), // original before Suno sanitization
  lyricsSunoReady: boolean("lyrics_suno_ready").default(false),

  // Style
  stylePrompt: text("style_prompt"),
  styleTags: jsonb("style_tags").$type<string[]>(),
  instrumental: boolean("instrumental").default(false),

  // Suno generation
  sunoPersonaId: text("suno_persona_id"),

  // Metadata for distribution
  isrc: varchar("isrc", { length: 12 }),
  songwriterCredits: text("songwriter_credits"),
  copyrightInfo: text("copyright_info"),

  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// ── Track Versions (every Suno generation attempt) ──────────────

export const trackVersions = pgTable("track_versions", {
  id: serial("id").primaryKey(),
  trackId: integer("track_id")
    .notNull()
    .references(() => tracks.id, { onDelete: "cascade" }),
  versionNumber: integer("version_number").notNull(),
  sunoTrackId: text("suno_track_id"),
  audioUrl: text("audio_url"),
  audioPath: text("audio_path"),
  duration: integer("duration"), // seconds
  tags: text("tags"),
  approved: boolean("approved").default(false),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// ── Artwork ──────────────────────────────────────────────────────

export const artwork = pgTable("artwork", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id")
    .notNull()
    .references(() => albumSessions.id, { onDelete: "cascade" }),
  trackId: integer("track_id").references(() => tracks.id, {
    onDelete: "set null",
  }),
  type: text("type").notNull().default("album_cover"), // album_cover | track_art
  prompt: text("prompt"),
  geminiAnalysis: text("gemini_analysis"),
  imagePath: text("image_path"),
  imageUrl: text("image_url"),
  approved: boolean("approved").default(false),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// ── Distribution Packages ────────────────────────────────────────

export const distributionPackages = pgTable("distribution_packages", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id")
    .notNull()
    .references(() => albumSessions.id, { onDelete: "cascade" }),
  platform: distributionPlatformEnum("platform").notNull(),
  status: text("status").default("pending").notNull(), // pending | submitted | live | error
  upc: varchar("upc", { length: 13 }),
  metadataJson: jsonb("metadata_json").$type<Record<string, unknown>>(),
  submittedAt: timestamp("submitted_at"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// ── Share Links ──────────────────────────────────────────────────

export const shareLinks = pgTable("share_links", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id")
    .notNull()
    .references(() => albumSessions.id, { onDelete: "cascade" }),
  trackId: integer("track_id").references(() => tracks.id, {
    onDelete: "set null",
  }),
  shareToken: varchar("share_token", { length: 32 }).notNull().unique(),
  expiresAt: timestamp("expires_at"),
  viewCount: integer("view_count").default(0),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// ── Producer Logs (audit trail like Cassian's changelog) ─────────

export const producerLogs = pgTable("producer_logs", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id")
    .notNull()
    .references(() => albumSessions.id, { onDelete: "cascade" }),
  trackId: integer("track_id").references(() => tracks.id, {
    onDelete: "set null",
  }),
  producer: text("producer").notNull(), // concept | lyrics | style | generation | artwork | master | distribute
  action: text("action").notNull(), // suggest | edit | approve | reject | generate | error
  details: jsonb("details").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// ── Zod Insert Schemas ───────────────────────────────────────────

export const insertAlbumSessionSchema = createInsertSchema(albumSessions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTrackSchema = createInsertSchema(tracks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTrackVersionSchema = createInsertSchema(trackVersions).omit({
  id: true,
  createdAt: true,
});

export const insertArtworkSchema = createInsertSchema(artwork).omit({
  id: true,
  createdAt: true,
});

// ── Type Inference ───────────────────────────────────────────────

export type AlbumSession = typeof albumSessions.$inferSelect;
export type InsertAlbumSession = z.infer<typeof insertAlbumSessionSchema>;
export type Track = typeof tracks.$inferSelect;
export type InsertTrack = z.infer<typeof insertTrackSchema>;
export type TrackVersion = typeof trackVersions.$inferSelect;
export type InsertTrackVersion = z.infer<typeof insertTrackVersionSchema>;
export type Artwork = typeof artwork.$inferSelect;
export type InsertArtwork = z.infer<typeof insertArtworkSchema>;
export type ProducerLog = typeof producerLogs.$inferSelect;
export type ShareLink = typeof shareLinks.$inferSelect;
export type DistributionPackage = typeof distributionPackages.$inferSelect;
