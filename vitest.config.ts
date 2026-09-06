import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// Every test in the repository, in one runner, with one convention.
//
// Deliberately its own config and not `vite.config.ts`: that one copies
// libavoid.wasm into public/ on load, which is no use to a test runner.
//
// One project, and it took the move to make that possible. `node` is the
// default because most of the tree is arithmetic — the model, the layout, the
// pure halves of every module — and a jsdom around all of it would cost several
// seconds on every run for the benefit of the minority that needs a document.
// That minority says so per file:
//
//   // @vitest-environment jsdom
//
// The editor's tree always worked that way; the shell used to draw the line by
// directory in this file instead, which needed two projects and stopped being
// possible the moment a module had both halves in it (`decisions/adr.test.ts`
// is node, `decisions/ui/AdrPage.test.tsx` is not). Every jsdom test in the
// repository now carries the docblock, so the directory rule had nothing left
// to decide.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    // `electron/` as well as `src/`: the main process now does something worth
    // testing — it resolves paths from an untrusted renderer inside a folder the
    // user chose, and writes files atomically. Neither is code to leave to a
    // smoke run. The files it tests import `node:fs` and no Electron, which is
    // exactly why they are separate from the IPC wiring.
    include: ['src/**/*.{test,spec}.{ts,tsx}', 'electron/**/*.{test,spec}.ts'],
    // The perf tests have a runner of their own (`vitest.perf.config.ts`) and a
    // step of their own in the gate. They build landscapes of thousands of
    // elements, which is tens of seconds — the wrong thing to put in front of a
    // loop whose whole value is that it takes a few.
    exclude: ['**/node_modules/**', '**/dist/**', 'src/**/*.perf.test.{ts,tsx}'],
    // The date tests were written against a fixed zone. Not optional, so it is
    // here rather than in front of a command someone has to remember.
    env: { TZ: 'UTC' },
  },
})
