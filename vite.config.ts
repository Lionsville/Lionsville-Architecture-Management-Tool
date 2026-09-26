import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { libavoidWasm } from './build/libavoidWasm'
import { oneElk } from './build/oneElk'
import { bundleBudget, WEB_BUDGET } from './build/bundleBudget'

export default defineConfig({
  // The wasm publish used to be a bare copyFileSync at config load with an
  // empty catch. It is a plugin now, and one that fails a build rather than a
  // packaged app; see build/libavoidWasm.ts.
  // ELK once, as the worker, and a budget the build fails over: see the two
  // files in build/ for why each exists.
  plugins: [react(), libavoidWasm(__dirname), oneElk(__dirname), bundleBudget()],
  // Vite's own warning fires for every chunk over 500 kB, which this app has
  // always had, so nobody read it; the budget above is the one that fails.
  build: { chunkSizeWarningLimit: WEB_BUDGET.file / 1000 },
  // The router worker is an ES module, and not for looks: it imports libavoid-js
  // only when it needs it, and Vite's default (iife) cannot build that split —
  // "UMD and IIFE output formats are not supported for code-splitting builds".
  // This belongs with the `{ type: 'module' }` the shell constructs it with.
  worker: { format: 'es' },
  server: { host: '127.0.0.1', port: 5200 },
  preview: { host: '127.0.0.1', port: 4180 },
})
