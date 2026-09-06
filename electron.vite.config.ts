/**
 * The desktop build: main, preload, renderer, one config.
 *
 * The renderer half is `vite.config.ts` — same `worker.format`, same wasm
 * plugin. It is repeated rather than imported because electron-vite loads this
 * file per target and the web config carries `server`/`preview` settings that
 * mean nothing here; the wasm publish is the one shared part that could drift
 * silently, so that is the one that is factored out.
 */
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'
import { libavoidWasm } from './build/libavoidWasm'

const root = __dirname

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'out/main',
      rollupOptions: {
        input: resolve(root, 'electron/main/index.ts'),
        // CommonJS, and this is not a style preference — it is the difference
        // between the app working and not.
        //
        // Electron loads an ESM main *asynchronously*, and the `ready` event
        // does not wait for it. Anything that must happen before ready —
        // `registerSchemesAsPrivileged` above all — then runs too late, silently:
        // the scheme is registered without its privileges, the page loads with a
        // null origin, every `'self'` in the CSP matches nothing, and localStorage
        // throws SecurityError. The window shows the loading state forever and
        // the process reports no error at all. The same lateness makes
        // `app.whenReady()` hang rather than resolve.
        //
        // In CommonJS the entry is required synchronously before ready, which is
        // what the pre-ready APIs assume. The package is `"type": "module"`, so
        // the output has to be named `.cjs` — and package.json `main` points at
        // that name.
        output: { format: 'cjs', entryFileNames: 'index.cjs' },
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'out/preload',
      rollupOptions: {
        input: resolve(root, 'electron/preload/index.ts'),
        // CommonJS, and named `.cjs` because the package is `"type": "module"`.
        // A sandboxed renderer cannot load an ESM preload — that is a hard
        // Electron limitation, not a bundler preference, and dropping the
        // sandbox to get ESM would be trading the security posture for a file
        // extension.
        output: { format: 'cjs', entryFileNames: 'index.cjs' },
        // Do not tree-shake a bare call into `electron` out of the bundle.
        //
        // `protocol.registerSchemesAsPrivileged([...])` returns nothing and its
        // result is unused, so Rollup is entitled to decide the statement does
        // nothing and drop it — which it did, silently. The whole app then boots
        // with an unprivileged `app://`: opaque origin, every `'self'` in the CSP
        // matching nothing, localStorage throwing, and a window stuck on its
        // loading state with no error anywhere. Nothing in the build says a
        // statement was removed.
        //
        // Every pre-ready Electron call has this shape, so this is not a
        // one-off: the fix belongs on the build, not on the one statement that
        // happened to be noticed.
        treeshake: { moduleSideEffects: true },
      },
    },
  },
  renderer: {
    root,
    plugins: [react(), libavoidWasm(root)],
    worker: { format: 'es' },
    build: {
      outDir: 'out/renderer',
      rollupOptions: { input: resolve(root, 'index.html') },
    },
  },
})
