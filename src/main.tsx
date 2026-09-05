/**
 * Composition root. This file is the only place that decides anything about the
 * world the shell runs in.
 *
 * ## The pattern
 *
 * Dependencies point inward, and nothing points out.
 *
 *   core/         arithmetic — decisions, validation, the model. No React, no
 *                 browser, no IO. Knows nobody.
 *   ports/        the seams: interfaces the inside declares and the outside
 *                 satisfies. `ProjectStore`, `PreferencesStore`,
 *                 `DocumentGateway`. No implementations.
 *   adapters/     the outside world, one folder per flavour — browser storage,
 *                 memory, the DOM. May know about browsers; nothing may know
 *                 about it.
 *   examples/     starting points that ship with the app. Data, not config.
 *   ui/           React. Talks to seams, never to adapters.
 *   main.tsx      this file: picks the adapters, builds the graph, renders.
 *
 * Two rules make that hold up in practice rather than on paper.
 *
 * **Consumers declare the interface they need.** Not the widest one available —
 * the narrowest one that does the job. `useAutosave` asks for
 * `{ save(project) }`, not for a `ProjectStore`, so it cannot reach for `load()`
 * or `clear()` and a reader does not have to check whether it did. The concrete
 * `WebStorageProjectStore` satisfies those shapes structurally, so narrowing
 * costs nothing at this seam: no wrappers, no mapping layer, just a smaller type.
 * Widen a component's needs and you widen what a future change can break.
 *
 * **Only this file names both a seam and its filling.** Everywhere else the two
 * are kept apart, and ESLint enforces it (`eslint.config.js`): `core` and
 * `ports` may not import React or an adapter, `ui` may not import an adapter,
 * and browser globals are an error outside `adapters/`. That is the whole reason
 * a second target — a desktop build with files on disk instead of localStorage —
 * is a new folder under `adapters/` and one changed line here, rather than a
 * hunt through the tree for every place that assumed a browser.
 *
 * So what belongs in this file is: environment setup that must happen before
 * anything renders, the choice of adapters, and the wiring. Anything that makes
 * a decision belongs in `core/`; anything that draws belongs in `ui/`.
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { configureLibavoidWasm, configureLibavoidWorker } from '@lionsville/solution-design'
import { composeShell } from './composition'
import { readLastProject } from './core/preferences'
import { EXAMPLES } from './examples'
import { App } from './ui/App'

/**
 * The edge router runs on WebAssembly, and not on this thread.
 *
 * The wasm reference goes out absolute. Vite gives the worker its own URL under
 * `/assets/`, and a path like `/libavoid.wasm` resolves inside a worker against
 * that worker URL — on the same origin that works out, but this way the intent
 * is on the page without having to know the rule. The path stays unhashed (see
 * `vite.config.ts`): that is what the LGPL-2.1 of `libavoid-js` asks for here,
 * since a self-built libavoid can then be dropped in its place.
 */
configureLibavoidWasm(new URL('/libavoid.wasm', window.location.origin).href)

/**
 * `processTransaction()` is synchronous wasm with no timeout: on this thread a
 * large drawing is a frozen tab rather than a slow spinner. Beside the thread it
 * is neither, and a wasm `abort()` only takes the worker down — which the
 * package replaces on the next request (`terminateLibavoidWorker`).
 *
 * The URL must sit literally in the call: Vite recognises this pattern and
 * bundles the worker; a computed URL builds cleanly and then 404s.
 */
configureLibavoidWorker(() => new Worker(
  new URL('../vendor/solution-design/src/layout/routerWorker.ts', import.meta.url),
  { type: 'module' },
))

/**
 * Fresh ids for diagrams the shell creates itself.
 *
 * A clock and a counter, so it lives out here rather than inside a component:
 * everything downstream takes it as an argument and stays reproducible.
 */
let counter = 0
const makeId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${++counter}`

const container = document.getElementById('root')!
const root = createRoot(container)

/** The one line that chooses what the seams are filled with. */
const shell = composeShell()

/**
 * Read first, then render — and with `.then` rather than a top-level `await`.
 *
 * Reading has to happen out here. `ProjectStore.load()` returns a promise, as it
 * must (every backend after browser storage — disk, IPC, a server — is async),
 * but the shell underneath wants to start synchronously: no `null` case threaded
 * through every `useState` of an open project, and no flash of an empty editor.
 * Waiting at the edge of the app buys both.
 *
 * Not a top-level await because Vite builds to a target that has none
 * (chrome87 / safari14), and raising that target is a statement about which
 * browsers this tool still serves. That statement should not arrive as a side
 * effect of a refactor; these two lines cost nothing.
 *
 * **Which project, and what if there is none.** The last one you had open, if it
 * is still there — that is a preference, and the reason a refresh lands you back
 * in your work rather than on a menu. If there is no last project, or it has
 * since been deleted, or storage refuses entirely, `initialProject` is
 * `undefined` and the app opens on the picker. That is a normal first visit, not
 * an error, so nothing here reports it.
 */
void shell.preferences.read()
  .then(async (storedPreferences) => {
    const lastProject = readLastProject(storedPreferences)
    const initialProject = lastProject ? await shell.projects.load(lastProject) : undefined
    root.render(
      <StrictMode>
        <App
          projects={shell.projects}
          groupRecords={shell.groups}
          preferences={shell.preferences}
          documents={shell.documents}
          initialProject={initialProject}
          initialPreferences={storedPreferences}
          examples={EXAMPLES}
          makeId={makeId}
          browserLanguages={navigator.languages ?? navigator.language}
          windowChrome={shell.windowChrome}
        />
      </StrictMode>,
    )
  })

/**
 * Development only: Vite reloads this module on a change, and without this
 * `createRoot()` would run a second time on the same container — React complains
 * and the tab is broken until you refresh. `import.meta.hot` does not exist in
 * the production bundle, so this branch disappears from it.
 */
import.meta.hot?.dispose(() => root.unmount())
