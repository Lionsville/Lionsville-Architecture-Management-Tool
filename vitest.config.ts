import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

// The shell's tests, separate from the package's (`npm run test:package`).
// Deliberately its own config and not `vite.config.ts`: that one copies
// libavoid.wasm into public/ on load, which is no use to a test runner.
//
// Two projects and not one. The core is plain TypeScript and runs fastest
// without a browser around it; the shell's UI and its browser adapter touch the
// document and localStorage and so cannot run in node. One shared `environment`
// would mean either no component tests, or every core test dragged through a
// jsdom. The package under vendor/ does the same with a per-file
// `@vitest-environment` line; here the boundary falls neatly on the directory,
// so it lives in the config.
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
        resolve: {
          alias,
          // Same reason as in `vite.config.ts`: the package has its own
          // node_modules, and two copies of Emotion or React Flow break the
          // theme and the canvas context in a component test just as well as
          // they do in the browser.
          dedupe: ['react', 'react-dom', '@emotion/react', '@emotion/styled', '@mui/material', '@mui/system', '@xyflow/react'],
        },
        test: {
          name: 'ui',
          environment: 'jsdom',
          include: ['src/ui/**/*.test.{ts,tsx}', 'src/adapters/browser/**/*.test.{ts,tsx}'],
        },
      },
    ],
  },
})
