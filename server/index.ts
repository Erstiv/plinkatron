// Load environment FIRST — before any other imports
import { loadEnv } from "./env.js";
loadEnv();

import express from "express";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";
import sessionsRouter from "./routes/sessions.js";
import tracksRouter from "./routes/tracks.js";
import generateRouter from "./routes/generate.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const httpServer = createServer(app);

// ── Middleware ────────────────────────────────────────────────────

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Request logger (API calls only)
app.use((req, res, next) => {
  if (req.path.startsWith("/api")) {
    const start = Date.now();
    res.on("finish", () => {
      console.log(`${req.method} ${req.path} ${res.statusCode} ${Date.now() - start}ms`);
    });
  }
  next();
});

// ── API Routes ───────────────────────────────────────────────────

app.use("/api/sessions", sessionsRouter);
app.use("/api/tracks", tracksRouter);
app.use("/api/generate", generateRouter);

// Health check
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    env: {
      database: !!process.env.DATABASE_URL,
      suno: !!process.env.SUNO_API_URL,
      gemini: !!process.env.GEMINI_API_KEY,
    },
  });
});

// ── Static files (production) ────────────────────────────────────

if (process.env.NODE_ENV === "production") {
  const publicDir = path.resolve(__dirname, "public");
  app.use(express.static(publicDir));
  // SPA fallback — serve index.html for all non-API routes
  app.get("*", (_req, res) => {
    res.sendFile(path.join(publicDir, "index.html"));
  });
}

// ── Start ────────────────────────────────────────────────────────

const port = parseInt(process.env.PORT || "3004", 10);
httpServer.listen({ port, host: "0.0.0.0" }, () => {
  console.log(`[plinkatron] running on port ${port}`);
  console.log(`[plinkatron] NODE_ENV=${process.env.NODE_ENV}`);
  console.log(`[plinkatron] DB=${process.env.DATABASE_URL ? "configured" : "MISSING"}`);
  console.log(`[plinkatron] Suno=${process.env.SUNO_API_URL || "MISSING"}`);
  console.log(`[plinkatron] Gemini=${process.env.GEMINI_API_KEY ? "configured" : "MISSING"}`);
});
