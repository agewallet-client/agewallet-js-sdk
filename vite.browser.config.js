import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    sourcemap: true,
    lib: {
      entry: resolve(__dirname, 'src/browser.js'),
      name: 'AgeWallet',
      formats: ['iife'],
      fileName: () => 'agewallet.min.js'
    }
  }
});