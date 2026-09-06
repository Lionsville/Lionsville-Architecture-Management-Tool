import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'
import { libavoidWasm } from './build/libavoidWasm'

// The editor package lives in this repository, under vendor/. Nothing here
// points outside this directory.
const PKG = resolve(__dirname, 'vendor/solution-design/src/index.ts')

export default defineConfig({
  // The wasm publish used to be a bare copyFileSync at config load with an
  // empty catch. It is a plugin now, and one that fails a build rather than a
  // packaged app; see build/libavoidWasm.ts.
  plugins: [react(), libavoidWasm(__dirname)],
  // The `dedupe` list that used to sit here is gone with the editor's second
  // node_modules. It existed because two copies of React, Emotion and MUI meant
  // two theme contexts, and everything coloured through `sx` fell back to the
  // default (light) theme — in dark mode, a white bar with white text. One
  // node_modules cannot produce a second copy, so the list has nothing left to
  // do. `harness.test.tsx` is the canary if that is ever wrong again.
  resolve: { alias: { '@lionsville/solution-design': PKG } },
  // The router worker is an ES module, and not for looks: it imports libavoid-js
  // only when it needs it, and Vite's default (iife) cannot build that split —
  // "UMD and IIFE output formats are not supported for code-splitting builds".
  // This belongs with the `{ type: 'module' }` the shell constructs it with.
  worker: { format: 'es' },
  server: { host: '127.0.0.1', port: 5200 },
  preview: { host: '127.0.0.1', port: 4180 },
})
