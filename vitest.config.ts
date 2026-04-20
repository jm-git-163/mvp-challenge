import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    include: ['engine/**/*.test.ts', 'data/**/*.test.ts', 'tests/**/*.test.ts'],
    exclude: ['node_modules', 'dist', '.expo'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['engine/**', 'data/**'],
      exclude: ['**/*.test.ts', '**/*.d.ts'],
    },
  },
});
