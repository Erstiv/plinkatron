/**
 * Manual .env loader — zero dependencies.
 * Tries multiple paths so it works whether you run from project root,
 * from dist/, or via PM2 with any cwd.
 */
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export function loadEnv() {
  const candidates = [
    resolve(__dirname, "..", ".env"),          // server/../.env (project root)
    resolve(process.cwd(), ".env"),            // current working directory
    "/var/www/plinkatron/.env",                // absolute fallback
  ];

  for (const p of candidates) {
    if (!existsSync(p)) continue;
    const raw = readFileSync(p, "utf-8");
    let loaded = 0;
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq < 1) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      // Strip surrounding quotes
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) {
        process.env[key] = val;
        loaded++;
      }
    }
    console.log(`[env] loaded ${loaded} vars from ${p}`);
    return;
  }
  console.error("[env] WARNING: no .env file found, checked:", candidates);
}
