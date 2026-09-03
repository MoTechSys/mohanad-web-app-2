import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      // Exclude only the top-level barrel + types + tests. utils/index.ts
      // is THE utils source file (no separate utils.ts), so it must stay in.
      exclude: [
        'src/index.ts',
        'src/types/**',
        'src/constants/index.ts',
        'src/schemas/index.ts',
        'src/**/__tests__/**',
        'src/**/*.test.ts',
      ],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
  },
});
