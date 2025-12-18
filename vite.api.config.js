import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: 'examples/sites/api',
  envDir: '../../..', // Look for .env in project root
  base: './',

  build: {
    outDir: '../../../dist-api',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'examples/sites/api/index.html'),
        about: resolve(__dirname, 'examples/sites/api/about.html'),
        shop: resolve(__dirname, 'examples/sites/api/shop/index.html')
      }
    }
  },
  server: { fs: { allow: ['../../..'] } }
});