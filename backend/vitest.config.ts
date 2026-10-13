import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    globalSetup: ['tests/setup.ts'],
    testTimeout: 30000,
    hookTimeout: 60000,
    // Jalankan berurutan: semua test berbagi satu DB test
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    env: {
      NODE_ENV: 'test',
    },
  },
});
