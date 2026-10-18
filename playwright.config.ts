import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests',
  testMatch: ['e2e/**/*.spec.ts', 'live/**/*.spec.ts'],
  timeout: 30_000,
  use: { trace: 'retain-on-failure' },
  projects: [
    { name: 'fixtures', testMatch: 'e2e/**/*.spec.ts' },
    // Hits github.com. Run by the scheduled canary workflow, not on every push.
    { name: 'live', testMatch: 'live/**/*.spec.ts', retries: 1, timeout: 60_000 },
  ],
});
