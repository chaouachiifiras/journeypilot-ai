#!/usr/bin/env node
/**
 * Generates a static index.html for Capacitor from a TanStack Start build.
 *
 * Run after `vite build` and before `npx cap sync`.
 * This is additive only: it does not change the web build or the app code.
 *
 * The generator is build-output-agnostic: it discovers TanStack Start output
 * whether Vite/Nitro writes to `.output/` or `dist/`, then ensures Capacitor's
 * configured webDir (`.output/public`) points at the real static assets.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const capacitorPublicDir = path.join(projectRoot, ".output", "public");

async function exists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function findManifest(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const found = await findManifest(full);
      if (found) return found;
    } else if (
      entry.name.startsWith("_tanstack-start-manifest_") &&
      entry.name.endsWith(".mjs")
    ) {
      return full;
    }
  }
  return null;
}

async function resolveBuildDirs() {
  // Support both Nitro output conventions so the script works regardless of
  // the local Vite/Nitro version or preset.
  const candidates = [
    {
      serverDir: path.join(projectRoot, ".output", "server"),
      publicDir: path.join(projectRoot, ".output", "public"),
    },
    {
      serverDir: path.join(projectRoot, "dist", "server"),
      publicDir: path.join(projectRoot, "dist", "client"),
    },
  ];

  for (const { serverDir, publicDir } of candidates) {
    if (!(await exists(serverDir)) || !(await exists(publicDir))) continue;
    const manifestPath = await findManifest(serverDir);
    if (manifestPath) {
      return { serverDir, publicDir, manifestPath };
    }
  }

  throw new Error(
    "TanStack Start manifest not found. Looked in .output/server and dist/server. Run `vite build` first."
  );
}

async function ensureCapacitorPublicDir(actualPublicDir) {
  const actualResolved = path.resolve(actualPublicDir);
  const capResolved = path.resolve(capacitorPublicDir);

  // Already the configured Capacitor webDir — nothing to do.
  if (actualResolved === capResolved) return;

  // Ensure the parent `.output` directory exists before creating the link.
  await fs.mkdir(path.dirname(capResolved), { recursive: true });

  // Clear any stale symlink, file, or directory left by a previous run.
  try {
    const stat = await fs.lstat(capResolved);
    if (stat.isSymbolicLink() || !stat.isDirectory()) {
      await fs.unlink(capResolved);
    } else {
      await fs.rm(capResolved, { recursive: true, force: true });
    }
  } catch (err) {
    if (err.code !== "ENOENT") throw err;
  }

  // Expose the real build output at the stable Capacitor webDir path.
  const linkType = process.platform === "win32" ? "junction" : "dir";
  await fs.symlink(actualResolved, capResolved, linkType);
  console.log(
    `Linked Capacitor webDir ${capacitorPublicDir} -> ${actualPublicDir}`
  );
}

async function main() {
  // Discover where Vite/Nitro actually wrote the build output.
  const { manifestPath, publicDir: actualPublicDir } =
    await resolveBuildDirs();

  // `capacitor.config.ts` webDir is `.output/public`; make sure it exists
  // and points to the real build output before writing index.html.
  await ensureCapacitorPublicDir(actualPublicDir);

  const manifestUrl = pathToFileURL(manifestPath);
  // Bust Node's module cache so consecutive web/mobile builds in one process
  // can never reuse a stale manifest module.
  manifestUrl.searchParams.set("mtime", String(Date.now()));
  const manifestModule = await import(manifestUrl.href);
  const manifest = manifestModule.tsrStartManifest?.();
  const rootRoute = manifest?.routes?.__root__;
  if (!rootRoute) {
    throw new Error("__root__ route missing from TanStack Start manifest.");
  }

  const scripts = rootRoute.scripts ?? [];
  const preloads = rootRoute.preloads ?? [];

  // Discover the generated CSS file in the client assets.
  const assetsDir = path.join(capacitorPublicDir, "assets");
  const assetFiles = await fs.readdir(assetsDir);
  const cssFile = assetFiles.find((f) => f.endsWith(".css"));

  const toAsset = (p) => (p.startsWith("/") ? p.slice(1) : p);

  const preloadTags = preloads
    .map((p) => `<link rel="modulepreload" href="${toAsset(p)}" />`)
    .join("\n    ");

  const scriptTags = scripts
    .map((s) => {
      const src = s.attrs?.src ? toAsset(s.attrs.src) : "";
      const asyncAttr = s.attrs?.async ? " async" : "";
      const typeAttr = s.attrs?.type ? ` type="${s.attrs.type}"` : "";
      return `<script${typeAttr}${asyncAttr} src="${src}"></script>`;
    })
    .join("\n    ");

  const cssTag = cssFile
    ? `<link rel="stylesheet" href="assets/${cssFile}" />`
    : "";

  const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <title>JourneyPilot AI</title>
    <meta
      name="description"
      content="AI-powered travel planning: personalized itineraries, hotels, restaurants, activities and photography spots — tailored to your budget and style."
    />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      rel="stylesheet"
      href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Inter:wght@400;500;600;700&family=Noto+Naskh+Arabic:wght@400;500;600;700&display=swap"
    />
    ${cssTag}
    ${preloadTags}
  </head>
  <body>
    <div id="root"></div>
    ${scriptTags}
  </body>
</html>
`;

  await fs.writeFile(
    path.join(capacitorPublicDir, "index.html"),
    html,
    "utf8"
  );
  console.log(
    `Wrote Capacitor index.html to ${path.join(capacitorPublicDir, "index.html")}`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
