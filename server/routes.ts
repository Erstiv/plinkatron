import type { Express } from "express";
import type { Server } from "http";
import { setupAuth, registerAuthRoutes } from "./auth";
import sessionsRouter from "./routes/sessions";
import tracksRouter from "./routes/tracks";
import generateRouter from "./routes/generate";
import producersRouter from "./routes/producers";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // 1. Setup authentication
  await setupAuth(app);
  registerAuthRoutes(app);

  // 2. API routes
  app.use("/api/sessions", sessionsRouter);
  app.use("/api/tracks", tracksRouter);
  app.use("/api/generate", generateRouter);
  app.use("/api/producers", producersRouter);

  // 3. Health check
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", app: "plinkatron", timestamp: new Date().toISOString() });
  });

  return httpServer;
}
