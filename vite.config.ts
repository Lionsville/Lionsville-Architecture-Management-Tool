import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { libavoidWasm } from './build/libavoidWasm'

export default defineConfig({
  // The wasm publish used to be a bare copyFileSync at config load with an
  // empty catch. It is a plugin now, and one that fails a build rather than a
  // packaged app; see build/libavoidWasm.ts.
  plugins: [react(), libavoidWasm(__dirname)],
  // The router worker is an ES module, and not for looks: it imports libavoid-js
  // only when it needs it, and Vite's default (iife) cannot build that split —
  // "UMD and IIFE output formats are not supported for code-splitting builds".
  // This belongs with the `{ type: 'module' }` the shell constructs it with.
  worker: { format: 'es' },
  server: { host: '127.0.0.1', port: 5200 },
  preview: { host: '127.0.0.1', port: 4180 },
})
