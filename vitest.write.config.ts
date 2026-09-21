import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.write.test.ts'],
    exclude: ['node_modules', 'dist'],
    testTimeout: 60_000,
    hookTimeout: 30_000,
    fileParallelism: false,
    reporters: ['verbose'],
    passWithNoTests: false,
  },
});
