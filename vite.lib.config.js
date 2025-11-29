// vite.lib.config.js
import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    // Output to the root dist folder
    outDir: 'dist',

    // IMPORTANT: Do not delete the demo files we just built
    emptyOutDir: false,

    lib: {
      entry: resolve(__dirname, 'src/index.js'),
      name: 'AgeWallet', // Global variable name for UMD build (window.AgeWallet)
      fileName: (format) => `agewallet.${format}.js` // agewallet.umd.js, agewallet.es.js
    }
  }
});