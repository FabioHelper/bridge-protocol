import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';

/**
 * Build variant for the single-file Claude artifact.
 *
 * Differences from the normal build:
 *  - `phaser` is EXTERNAL and resolved from the global `Phaser`, because the artifact loads it from
 *    the CSP-allowed jsDelivr CDN rather than bundling 1.4 MB of engine.
 *  - IIFE output with no code splitting, so tools/build_artifact.mjs can inline exactly one script.
 */
export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    target: 'es2022',
    outDir: 'build/artifact-bundle',
    emptyOutDir: true,
    lib: {
      entry: fileURLToPath(new URL('./src/main.ts', import.meta.url)),
      formats: ['iife'],
      name: 'OpsHero',
      fileName: () => 'game.js',
    },
    rollupOptions: {
      external: ['phaser'],
      output: { globals: { phaser: 'Phaser' }, inlineDynamicImports: true },
    },
    sourcemap: false,
    minify: 'esbuild',
  },
});
