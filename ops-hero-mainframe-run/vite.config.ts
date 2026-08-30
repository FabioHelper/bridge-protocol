import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';

// Vite configuration for a zero-backend, statically hosted Phaser build.
// `base: './'` keeps the production bundle runnable from any sub-path (itch.io, GitHub Pages, file server).
export default defineConfig({
  base: './',
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    host: true,
  },
  preview: {
    port: 4173,
    host: true,
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
    assetsInlineLimit: 0, // Never inline PNGs: pixel-art textures must stay as discrete files.
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          phaser: ['phaser'],
        },
      },
    },
  },
});
