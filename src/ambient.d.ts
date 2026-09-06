// Ambient declarations for dependencies without complete type coverage.

// elkjs ships types for its root entry only. We import the self-contained
// bundle (no web-worker wiring needed in Vite/Vitest), which resolves to the
// same API surface as the root entry.
declare module 'elkjs/lib/elk.bundled.js' {
  import ELK from 'elkjs';
  export * from 'elkjs';
  export default ELK;
}

// Allow importing @xyflow/react's stylesheet from TypeScript.
declare module '*.css';
