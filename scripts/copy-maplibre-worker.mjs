// Copies maplibre-gl's worker script AND its sibling chunk (see this
// script's own reasoning below) from node_modules into public/, so Vite
// serves them as plain static files at a stable path — see
// src/components/ui/map.tsx's setWorkerUrl call for why this exists.
//
// Re-run this (`node scripts/copy-maplibre-worker.mjs`) after bumping the
// maplibre-gl dependency version, to keep the committed public/maplibre-gl/
// copy in sync. Also wired into the `dev`/`build` npm scripts so it stays
// fresh automatically — but the copy is committed to the repo too (not
// .gitignored) as a reliable fallback: this environment has been observed
// gating which lifecycle scripts actually run (`npm warn allow-scripts`),
// so this cannot safely depend on always executing.
//
// Why NOT a plain Vite `?url` import instead: maplibre-gl-worker.mjs has
// its own `import ... from "./maplibre-gl-shared.mjs"` — a real ~490KB
// sibling chunk it depends on at runtime. A `?url` import only copies the
// ONE file you import; it does not follow that file's own internal
// imports, so the worker script fails to load in the browser (its
// `./maplibre-gl-shared.mjs` import 404s) and the map hangs forever on the
// loading spinner. Copying both files into the SAME public/ directory
// keeps that relative import intact.
import { copyFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const srcDir = fileURLToPath(new URL('../node_modules/maplibre-gl/dist/', import.meta.url));
const destDir = fileURLToPath(new URL('../public/maplibre-gl/', import.meta.url));

mkdirSync(destDir, { recursive: true });
for (const file of ['maplibre-gl-worker.mjs', 'maplibre-gl-shared.mjs']) {
  copyFileSync(srcDir + file, destDir + file);
}
console.log(`Copied maplibre-gl worker + shared chunk to ${destDir}`);
