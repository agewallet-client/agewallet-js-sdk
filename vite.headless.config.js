import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  // 1. Set the root to the specific mini-site folder
  root: 'examples/sites/headless',

  // 2. Point back to the main project root to find the .env file
  // (Path is relative to the 'root' defined above)
  envDir: '../../..',

  base: './', // Ensures relative paths for assets

  build: {
    // 3. Output to a specific folder in the project root
    outDir: '../../../dist-headless',
    emptyOutDir: true,

    rollupOptions: {
      input: {
        // Define the 3 pages explicitly
        main: resolve(__dirname, 'examples/sites/headless/index.html'),
        about: resolve(__dirname, 'examples/sites/headless/about.html'),
        shop: resolve(__dirname, 'examples/sites/headless/shop/index.html')
      }
    }
  },

  server: {
    fs: {
      // Allow importing the SDK source code from outside the site root
      allow: ['../../..']
    }
  }
});