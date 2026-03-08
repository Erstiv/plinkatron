// ── Load .env manually (no dotenv dependency) ───────────────────
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";

function loadEnvFile() {
  // Try multiple locations to find .env
  const candidates = [
    resolve(dirname(__dirname), ".env"),      // parent of dist/
    resolve(__dirname, ".env"),               // same dir as dist/
    resolve(__dirname, "../.env"),            // up one from dist/
    "/var/www/plinkatron/.env",              // absolute fallback
    resolve(process.cwd(), ".env"),          // current working dir
  ];

  for (const envPath of candidates) {
    if (existsSync(envPath)) {
      const content = readFileSync(envPath, "utf-8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIndex = trimmed.indexOf("=");
        if (eqIndex === -1) continue;
        const key = trimmed.slice(0, eqIndex).trim();
        const value = trimmed.slice(eqIndex + 1).trim().replace(/^["']|["']$/g, "");
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
      console.log(`[env] Loaded .env from ${envPath}`);
      return;
    }
  }
  console.error("[env] WARNING: No .env file found!");
}

loadEnvFile();

import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  })
);

app.use(express.urlencoded({ extended: false }));

// ── Request Logger ───────────────────────────────────────────────

export function log(message: string, source = "plinkatron") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse).slice(0, 200)}`;
      }
      log(logLine);
    }
  });

  next();
});

// ── Serve uploaded/generated audio files ─────────────────────────

app.use("/uploads", express.static("uploads"));
app.use("/generated", express.static("generated"));

// ── Boot ─────────────────────────────────────────────────────────

(async () => {
  await registerRoutes(httpServer, app);

  // Global error handler
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
    throw err;
  });

  // Serve static (production) or Vite dev server (development)
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  const port = parseInt(process.env.PORT || "3004", 10);
  httpServer.listen(
    { port, host: "0.0.0.0", reusePort: true },
    () => {
      log(`serving on port ${port}`);
    }
  );
})();
