import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  // 1. Set the root to the HTML folder so paths are flat
  root: 'tests/public',

  build: {
    // 2. Output back to the main project 'dist' folder
    outDir: '../../dist',
    emptyOutDir: true,

    rollupOptions: {
      input: {
        main: resolve(__dirname, 'tests/public/index.html'),
        overlay: resolve(__dirname, 'tests/public/test-overlay.html'),
        api: resolve(__dirname, 'tests/public/test-api.html'),
        headless: resolve(__dirname, 'tests/public/test-headless.html'),
        liveOverlay: resolve(__dirname, 'tests/public/live-overlay.html'),
        liveApi: resolve(__dirname, 'tests/public/live-api.html'),
      },
    }
  },

  // 3. Allow Vite to import files from the parent 'src' directory
  server: {
    fs: {
      allow: ['../..']
    }
  }
});