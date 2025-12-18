import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: 'examples/sites/local',
  envDir: '../../..',
  base: './',
  build: {
    outDir: '../../../dist-local',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'examples/sites/local/index.html'),
        about: resolve(__dirname, 'examples/sites/local/about.html'),
        shop: resolve(__dirname, 'examples/sites/local/shop/index.html')
      }
    }
  },
  server: {
    fs: { allow: ['../../..'] }
  }
});