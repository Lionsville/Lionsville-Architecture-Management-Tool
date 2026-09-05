import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // 'node' keeps the runner lean for the pure model/theme logic (the bulk of
    // the suite). Component tests opt into a DOM per-file with a docblock:
    //   // @vitest-environment jsdom
    // — same convention as hal_app (see hal_app/TESTING.md).
    environment: 'node',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
});
