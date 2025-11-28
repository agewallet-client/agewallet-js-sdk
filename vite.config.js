import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    // This tells Vite these are the pages we want to build
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'tests/public/index.html'),
        overlay: resolve(__dirname, 'tests/public/test-overlay.html'),
        api: resolve(__dirname, 'tests/public/test-api.html'),
        headless: resolve(__dirname, 'tests/public/test-headless.html'),
        liveOverlay: resolve(__dirname, 'tests/public/live-overlay.html'),
        liveApi: resolve(__dirname, 'tests/public/live-api.html'),
      },
    },
    minify: 'esbuild',
    sourcemap: true,
    outDir: 'dist',
    emptyOutDir: true
  },
  server: {
    fs: {
      allow: ['..']
    }
  },
  root: '.',
  test: {
    environment: 'happy-dom'
  }
});