// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What this app may be built from: the licences, the packages, and the ones
 * that must be one copy. `build/dependencies.ts` holds the tree to it in
 * `npm run check`.
 *
 * **Why these licences.** This tree is AGPL-3.0, and the same packages are
 * bundled into builds that are distributed under other terms, so a shipped
 * package has to be one that can travel with both: permissive licences that ask
 * for their notice and nothing else (MIT, ISC, the BSDs, Apache-2.0, 0BSD, CC0,
 * the Unlicense, Blue Oak, and Python-2.0 for the parsers that carry it), and
 * MPL-2.0, whose copyleft stops at the files it covers, which are shipped
 * unmodified with their source a download away. Every notice is reproduced in
 * `THIRD-PARTY-NOTICES.md`, and the test beside that file keeps it current.
 *
 * **Not in the set**, and so an exception by name or a failure: the GPL family
 * (strong copyleft over the whole work), the LGPL and EPL (weak copyleft that
 * asks something of how the library is combined, so each use is decided once and
 * written down), the Creative Commons licences other than CC0 (not written for
 * software), `UNLICENSED`, and a package that declares nothing and ships no text
 * that names a licence.
 */
import type { Policy } from './dependencies.ts'

export const policy: Policy = {
  allowed: [
    'MIT', 'ISC', 'BSD-2-Clause', 'BSD-3-Clause', 'Apache-2.0', '0BSD', 'CC0-1.0',
    'Unlicense', 'BlueOak-1.0.0', 'Python-2.0', 'MPL-2.0',
  ],

  exceptions: {
    'elkjs': {
      licence: 'EPL-2.0 OR GPL-3.0-or-later',
      why: 'Taken under EPL-2.0, which asks that the library\'s own source stays available under it: it ships unmodified, as its own worker file, and its notice names where the source is; confirmed by the owner, 26 September 2026.',
    },
    'libavoid-js': {
      licence: 'LGPL-2.1-or-later',
      why: 'The router. Its engine is a WebAssembly file published beside the bundle rather than compiled into it (`build/libavoidWasm.ts`), so a user can replace it with their own build, which is what the LGPL asks of a work that uses the library; confirmed by the owner, 26 September 2026.',
    },
  },

  // Every package the shipped source imports. Everything is bundled and
  // `dependencies` is empty on purpose (`electron-builder.cjs`), so this list,
  // and not `package.json`, is where "what ships" is decided.
  runtime: {
    '@modelcontextprotocol/sdk': {
      licence: 'MIT',
      why: 'Named by the desktop smoke run, which drives the app as an agent would; loaded from node_modules at run time and never bundled, and listed because the scan reads its type import as an import.',
    },
    '@mui/material': { licence: 'MIT', why: 'Every control, dialog and theme on every screen.' },
    '@xyflow/react': { licence: 'MIT', why: 'The canvas: nodes, edges, panning and selection on every board.' },
    'elkjs': { licence: 'EPL-2.0 OR GPL-3.0-or-later', why: 'Automatic layout, as a worker; see its licence exception.' },
    'fflate': { licence: 'MIT', why: 'The working file is a zip; it reads and writes it.' },
    'html-to-image': { licence: 'MIT', why: 'Exporting a board or a laid-out page as a picture.' },
    'libavoid-js': { licence: 'LGPL-2.1-or-later', why: 'Orthogonal routing of the lines around the boxes; see its licence exception.' },
    'mermaid': { licence: 'MIT', why: 'Diagrams written in a description, drawn in the documentation.' },
    'react': { licence: 'MIT', why: 'Every screen is a React tree.' },
    'react-dom': { licence: 'MIT', why: 'The UI, in a browser and in the desktop window.' },
    'react-markdown': { licence: 'MIT', why: 'Descriptions and decision records are markdown, drawn without HTML.' },
    'remark-gfm': { licence: 'MIT', why: 'Tables, task lists and strikethrough in that markdown.' },
    'simple-icons': { licence: 'CC0-1.0', why: 'The vendor marks a technology element can carry.' },
  },

  // Module-level state — React's dispatcher, a theme context, a style cache —
  // is per copy, and a second copy draws nothing wrong until a component that
  // resolved it runs.
  singletons: ['react', 'react-dom', 'react/jsx-runtime', 'scheduler', '@mui/*', '@emotion/*'],

  parts: [{ install: '.', sources: ['src', 'electron'] }],
}
