import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // 1. Force the test runner to look in the project root, not 'examples/frontend'
    root: '.',

    // 2. Explicitly look for our test files
    include: ['tests/**/*.test.js'],

    // 3. Ensure the environment is set (requires 'happy-dom' package)
    environment: 'happy-dom',

    // 4. Clean up output
    reporters: ['default'],
  }
});