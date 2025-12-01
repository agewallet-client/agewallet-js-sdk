// vite.lib.config.js
import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: false, // CRITICAL: Don't delete the demos built by the main config
    sourcemap: true,    // Helpful for debugging
    lib: {
      entry: resolve(__dirname, 'src/index.js'),
      name: 'AgeWallet',
      // Generate 3 formats:
      // 1. es (NPM/Bundlers) -> agewallet.js
      // 2. umd (Node/Old)    -> agewallet.umd.cjs
      // 3. iife (Browser)    -> agewallet.min.js (The Downloadable)
      formats: ['es', 'umd', 'iife'],
      fileName: (format) => {
        if (format === 'iife') return 'agewallet.min.js';
        if (format === 'umd') return 'agewallet.umd.cjs';
        return 'agewallet.js';
      }
    }
  }
});