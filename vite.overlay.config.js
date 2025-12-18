import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  // Root of the mini-site
  root: 'examples/sites/overlay',

  // FIX: Tell Vite to look for .env in the main project root
  // (Go up 3 levels: overlay -> sites -> examples -> ROOT)
  envDir: '../../..',

  base: './',

  build: {
    outDir: '../../../dist-overlay',
    emptyOutDir: true,

    rollupOptions: {
      input: {
        main: resolve(__dirname, 'examples/sites/overlay/index.html'),
        about: resolve(__dirname, 'examples/sites/overlay/about.html'),
        shop: resolve(__dirname, 'examples/sites/overlay/shop/index.html')
      }
    }
  },

  server: {
    fs: {
      allow: ['../../..']
    }
  }
});