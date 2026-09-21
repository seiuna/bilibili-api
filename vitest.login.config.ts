import { defineConfig } from 'vitest/config';

// Explicit opt-in; default config never discovers authenticated tests.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.login.test.ts'],
    exclude: ['node_modules', 'dist', 'src/**/*.write.test.ts'],
    testTimeout: 20_000,
    hookTimeout: 30_000,
    fileParallelism: false,
    reporters: ['verbose'],
    passWithNoTests: false,
  },
});
