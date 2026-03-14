import { build as esbuild } from "esbuild";
import { build as viteBuild } from "vite";
import { rm, cp } from "fs/promises";

async function buildAll() {
  await rm("dist", { recursive: true, force: true });

  console.log("building client...");
  await viteBuild();

  console.log("building server...");
  await esbuild({
    entryPoints: ["server/index.ts"],
    platform: "node",
    format: "esm",
    bundle: true,
    outfile: "dist/index.mjs",
    banner: {
      // Fix for __dirname / __filename in ESM
      js: `import { createRequire } from 'module'; import { fileURLToPath as __fileURLToPath } from 'url'; import { dirname as __pathDirname } from 'path'; const __filename = __fileURLToPath(import.meta.url); const __dirname = __pathDirname(__filename); const require = createRequire(import.meta.url);`,
    },
    external: [
      // Keep native/binary deps external
      "pg-native",
    ],
    define: {
      "process.env.NODE_ENV": '"production"',
    },
    minify: false, // keep readable for debugging
    logLevel: "info",
  });

  console.log("build complete!");
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
