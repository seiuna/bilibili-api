import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    testTimeout: 10_000,
    hookTimeout: 10_000,
    include: ['src/**/*.{test,spec}.ts'],
    exclude: ['node_modules', 'dist'],
    reporters: ['verbose'],
    silent: false,
    passWithNoTests: false,
  },
});
