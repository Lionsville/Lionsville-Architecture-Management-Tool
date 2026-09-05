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
  // One copy of React, Emotion and MUI. The package under vendor/ has its own
  // node_modules (same versions), and without dedupe Vite loads them twice: the
  // shell and the package then talk to two theme contexts, and everything
  // coloured through `sx` falls back to the default (light) theme — in dark mode
  // a white bar with white text.
  resolve: {
    alias: { '@lionsville/solution-design': PKG },
    dedupe: ['react', 'react-dom', '@emotion/react', '@emotion/styled', '@mui/material', '@mui/system', '@xyflow/react'],
  },
  // The router worker is an ES module, and not for looks: it imports libavoid-js
  // only when it needs it, and Vite's default (iife) cannot build that split —
  // "UMD and IIFE output formats are not supported for code-splitting builds".
  // This belongs with the `{ type: 'module' }` the shell constructs it with.
  worker: { format: 'es' },
  server: { host: '127.0.0.1', port: 5200 },
  preview: { host: '127.0.0.1', port: 4180 },
})
