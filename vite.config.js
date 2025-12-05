import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  // 1. Set the root to the new frontend examples folder
  root: 'examples/frontend',

  build: {
    // 2. Output back to the main project 'dist' folder (Depth is still 2 levels up)
    outDir: '../../dist',
    emptyOutDir: true,

    rollupOptions: {
      input: {
        main: resolve(__dirname, 'examples/frontend/index.html'),
        overlay: resolve(__dirname, 'examples/frontend/overlay-mode.html'),
        api: resolve(__dirname, 'examples/frontend/secure-api-fetch.html'),
        headless: resolve(__dirname, 'examples/frontend/custom-ui-headless.html'),
        localStorage: resolve(__dirname, 'examples/frontend/spa-local-storage.html'),
        redis: resolve(__dirname, 'examples/frontend/ssr-redis-session.html'),
        branding: resolve(__dirname, 'examples/frontend/branding-options.html'),
      },
    }
  },

  // 3. Allow Vite to import files from the parent 'src' directory
  server: {
    fs: {
      allow: ['..']
    }
  },
  test: {
    environment: 'happy-dom'
  }
});