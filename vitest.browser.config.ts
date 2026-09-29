import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'

/**
 * The tests that need a real browser, and so a runner of their own.
 *
 * Browser storage is written around what a browser's IndexedDB does and node
 * has none: the suites in `npm run check` run over a fake of it, which keeps
 * the behaviours the store is written around, and fake-indexeddb. These run
 * the same contract and suites over the real thing, in Chromium and in
 * WebKit — the engine of every browser on iOS — with what a fake cannot
 * show: a page closed half-way through a write, a second tab across an
 * upgrade, and — in Chromium, through a storage bucket of 1 MB — a quota the
 * browser enforces (`IndexedDbStore.browser.test.ts`). WebKit has no buckets
 * and cannot be given a small quota, so there the refusal is the node
 * suites' injected one. And layout, which jsdom does not do: a document's
 * pictures laid out from the library do not move when their bytes arrive,
 * and one far below the window is never asked for
 * (`documentation/ui/Pictures.browser.test.tsx`).
 *
 * Not in `npm run check`: it starts two browsers, which is seconds the fast
 * loop should not pay. Run it with `npm run test:browser`, a gate of its own,
 * after `npx playwright install chromium webkit` once per machine.
 */
export default defineConfig({
  test: {
    include: ['src/**/*.browser.test.{ts,tsx}'],
    env: { TZ: 'UTC' },
    testTimeout: 60_000,
    // A failed test's screenshot, under `tmp/` with the rest of what a run leaves.
    attachmentsDir: 'tmp/vitest-attachments',
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
      instances: [{ browser: 'chromium' }, { browser: 'webkit' }],
    },
  },
})
