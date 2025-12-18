import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: 'examples/sites/branding',
  envDir: '../../..',
  base: './',
  build: {
    outDir: '../../../dist-branding',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'examples/sites/branding/index.html'),
        about: resolve(__dirname, 'examples/sites/branding/about.html'),
        shop: resolve(__dirname, 'examples/sites/branding/shop/index.html')
      }
    }
  },
  server: {
    fs: { allow: ['../../..'] }
  }
});