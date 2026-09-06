import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

// Every test in the repository, in one runner. Deliberately its own config and
// not `vite.config.ts`: that one copies libavoid.wasm into public/ on load,
// which is no use to a test runner.
//
// Three projects and not one, because the right environment is not the same
// everywhere. The pure model and layout code is plain TypeScript and runs
// fastest without a browser around it; the shell's UI and its browser adapter
// touch the document and localStorage and cannot run in node at all. One shared
// `environment` would mean either no component tests, or every pure test
// dragged through a jsdom.
//
// The editor's tree draws the line per file instead, with a
// `// @vitest-environment jsdom` docblock — a docblock beats the project's
// setting, so both conventions live side by side until the move puts the
// editor's files under `src/` too.
const alias = {
  '@lionsville/solution-design': resolve(__dirname, 'vendor/solution-design/src/index.ts'),
}

export default defineConfig({
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: 'model',
          environment: 'node',
          include: ['src/**/*.test.ts'],
          exclude: ['src/ui/**', 'src/adapters/browser/**'],
        },
      },
      {
        plugins: [react()],
        resolve: { alias },
        test: {
          name: 'ui',
          environment: 'jsdom',
          include: ['src/ui/**/*.test.{ts,tsx}', 'src/adapters/browser/**/*.test.{ts,tsx}'],
        },
      },
      {
        test: {
          name: 'editor',
          environment: 'node',
          include: ['vendor/solution-design/src/**/*.{test,spec}.{ts,tsx}'],
          // The editor's date tests were written against a fixed zone and used
          // to get it from `TZ=UTC` in front of its own `vitest` command. That
          // command is gone; the setting is not optional, so it lives here.
          env: { TZ: 'UTC' },
        },
      },
    ],
  },
})
