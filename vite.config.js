import { defineConfig } from 'vite';

/**
 * Vite configuration for the Fighting Demo.
 *
 * The game is a classic single page Phaser 3 app:
 *   - `public/` holds static art that must keep stable URLs (`/assets/...`)
 *   - `src/` holds the ES module game source
 *   - `dist/` is the deployable, fully static production build
 */
export default defineConfig({
  base: './',
  publicDir: 'public',
  server: {
    host: true,
    port: 5173,
    strictPort: false,
    // Allow the game to be embedded / previewed through proxied hosts
    // (e.g. https://<port>-<sandbox>.e2b.app) as well as localhost.
    allowedHosts: true,
  },
  preview: {
    host: true,
    port: 4173,
    allowedHosts: true,
  },
  build: {
    target: 'es2019',
    outDir: 'dist',
    assetsInlineLimit: 8192,
    sourcemap: false,
    chunkSizeWarningLimit: 2048,
    rollupOptions: {
      output: {
        // Phaser is by far the biggest dependency: keep it in its own chunk so
        // application updates do not invalidate the (large, cacheable) engine.
        manualChunks: {
          phaser: ['phaser'],
        },
      },
    },
  },
});
