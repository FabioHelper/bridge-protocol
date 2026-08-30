#!/usr/bin/env node
/**
 * Packs the game into ONE self-contained HTML file suitable for publishing as a Claude artifact.
 *
 * An artifact is a single page that cannot fetch local files, so every texture is inlined as a
 * base64 data: URI on `window.OPS_HERO_ASSETS`, which `src/config/AssetSource.ts` reads.
 *
 * Phaser is INLINED by default (the Arcade-only build, ~1 MB) so the page has zero external
 * dependencies and renders even if a CDN is blocked or slow. Pass --cdn to load it from jsDelivr
 * instead, which is on the artifact CSP allowlist and yields a much smaller file.
 *
 * Usage:  npm run build:artifact            (self-contained, recommended)
 *         npm run build:artifact -- --cdn   (smaller page, needs jsDelivr at view time)
 * Output: build/ops-hero.html
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ASSETS_DIR = join(ROOT, 'public', 'assets');
const BUNDLE = join(ROOT, 'build', 'artifact-bundle', 'game.js');
const OUT = join(ROOT, 'build', 'ops-hero.html');

// Pinned exactly, matching package.json. Arcade-only build: the game never uses Matter.
const PHASER_CDN = 'https://cdn.jsdelivr.net/npm/phaser@4.2.1/dist/phaser-arcade-physics.min.js';
const PHASER_LOCAL = join(ROOT, 'node_modules', 'phaser', 'dist', 'phaser-arcade-physics.min.js');
const USE_CDN = process.argv.includes('--cdn');
const ARTIFACT_SIZE_LIMIT = 16 * 1024 * 1024;

function inlineAssets() {
  const table = {};
  let bytes = 0;
  for (const file of readdirSync(ASSETS_DIR).sort()) {
    if (!file.endsWith('.png')) continue;
    const buffer = readFileSync(join(ASSETS_DIR, file));
    bytes += buffer.length;
    table[file] = `data:image/png;base64,${buffer.toString('base64')}`;
  }
  return { table, bytes };
}

function main() {
  let bundle;
  try {
    bundle = readFileSync(BUNDLE, 'utf8');
  } catch {
    console.error(
      'Missing build/artifact-bundle/game.js.\n' +
        'Run: npx vite build --config vite.artifact.config.ts',
    );
    process.exit(1);
  }

  const { table, bytes } = inlineAssets();
  const count = Object.keys(table).length;
  if (count === 0) {
    console.error('No PNGs in public/assets. Run `npm run assets:placeholders` first.');
    process.exit(1);
  }

  // Engine: inlined by default so the artifact has no external dependency at all.
  let phaserTag;
  if (USE_CDN) {
    phaserTag = `<script src="${PHASER_CDN}"><\/script>`;
  } else {
    try {
      phaserTag = `<script>${readFileSync(PHASER_LOCAL, 'utf8')}<\/script>`;
    } catch {
      console.error(`Missing ${PHASER_LOCAL}. Run npm install, or pass --cdn.`);
      process.exit(1);
    }
  }

  const html = `<title>OPS HERO: Mainframe Run</title>
<style>
  html, body { margin: 0; height: 100%; background: #06080f; overflow: hidden; }
  body { display: flex; align-items: center; justify-content: center; }
  #game-root { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; }
  /* Nearest-neighbour upscaling: the single most important rule for pixel art. */
  #game-root canvas { image-rendering: pixelated; display: block; }
</style>
<div id="game-root"></div>
<script>window.OPS_HERO_ASSETS = ${JSON.stringify(table)};<\/script>
${phaserTag}
<script>${bundle}<\/script>
`;

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, html, 'utf8');
  const size = statSync(OUT).size;
  console.log(`Wrote ${OUT}`);
  console.log(
    `  engine: ${USE_CDN ? 'jsDelivr CDN' : 'inlined (self-contained)'}\n` +
      `  ${count} textures inlined (${(bytes / 1024).toFixed(0)} KB raw)\n` +
      `  page ${(size / 1024 / 1024).toFixed(2)} MB of the 16 MB artifact limit`,
  );
  if (size > ARTIFACT_SIZE_LIMIT) {
    console.error('ERROR: exceeds the 16 MB artifact limit.');
    process.exit(1);
  }
}

main();
