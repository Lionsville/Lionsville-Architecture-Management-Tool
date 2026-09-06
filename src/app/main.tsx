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
import { configureLibavoidWasm, configureLibavoidWorker } from '../layout'
import { detectBrowserLanguage, translator } from '../i18n'
import {
  composeShell, desktopCommandChannel, desktopFileChannel, inWorkingDirectory,
} from './composition'
import type { DesktopDirectory, Shell } from './composition'
import {
  readLastProject, readMigratedFolders, readWorkingDirectory, withMigratedFolder,
  withoutLastProject, withWorkingDirectory,
} from '../projects/preferences'
import { migrated, migrateInto } from '../projects/migration'
import type { ProjectSnapshot } from '../projects/project'
import { EXAMPLES } from './examples'
import { App } from './App'
import { BootFailure } from './BootFailure'

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
  new URL('../layout/routerWorker.ts', import.meta.url),
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
let shell = composeShell()

/**
 * The desktop's file channel, or nothing at all in a browser tab.
 *
 * Asked once, here, because it is the answer to "can this build keep projects
 * in a folder" — and everything below phrases itself as "if we can".
 */
const files = desktopFileChannel()

/** The File menu, and the documents the OS opens us with. */
const commands = desktopCommandChannel()

/**
 * The folder this machine works in, if it has one it may still use.
 *
 * The preference says which folder; the main process says which folders the
 * user has actually granted. The intersection is what may be opened, and it is
 * checked this way round on purpose: a path in a preferences blob is a wish,
 * and a blob can be edited by anybody with a text editor.
 */
async function rememberedDirectory(stored: unknown): Promise<void> {
  if (!files) return
  const granted = await files.recentDirectories().catch(() => [])
  // Kept for the first-run screen: a machine that has worked in a folder before
  // should be one click away from it, not one dialog.
  recentFolders = granted
  const wanted = readWorkingDirectory(stored)
  if (!wanted) return
  const directory = granted.find((held) => held.root === wanted)
  if (directory) shell = inWorkingDirectory(shell, files, directory)
}

/** What the first-run screen offers. Empty until the boot has asked. */
let recentFolders: readonly DesktopDirectory[] = []

/**
 * Choosing a folder, which starts the app again.
 *
 * Deliberately a fresh boot rather than a swap in place. The store is handed to
 * `App` as a prop and everything under it — the picker's list, the open
 * project, the session's undo stack — belongs to the projects in one folder;
 * switching folders is exactly the moment none of that should carry over. It is
 * the same reasoning as remounting the workspace when the project changes, one
 * level up.
 */
function chooseWorkingDirectory(): void {
  if (!files) return
  void files.chooseDirectory().then(async (chosen) => {
    if (!chosen) return
    await workIn(chosen)
  }, (cause: unknown) => {
    shell.diagnostics.report({
      level: 'error', where: 'workingDirectory', message: 'the folder was not chosen', cause,
    })
  })
}

/**
 * A folder named by the host — the Recent menu, and the smoke run.
 *
 * Only ever one main has granted, and main checks that on every call it
 * receives, so there is nothing to verify here. The recents are consulted for
 * the folder's NAME and nothing else; a folder that is not in that list (the
 * smoke run grants one it deliberately does not remember) is opened under the
 * last segment of its path.
 */
function nameOf(root: string): string {
  return root.split(/[/\\]/).filter(Boolean).pop() ?? root
}

function openWorkingDirectory(root: string): void {
  if (!files) return
  void files.recentDirectories().then(
    async (granted) => {
      await workIn(granted.find((held) => held.root === root) ?? { root, name: nameOf(root) })
    },
    (cause: unknown) => {
      shell.diagnostics.report({
        level: 'error', where: 'workingDirectory', message: 'the folder was not opened', cause,
      })
    },
  )
}

async function workIn(chosen: DesktopDirectory): Promise<void> {
    if (!files) return
    const inFolder = inWorkingDirectory(shell, files, chosen)
    let kept = withWorkingDirectory(stored, chosen.root)
    if (await moveInto(inFolder, chosen.root)) kept = withMigratedFolder(kept, chosen.root)
    stored = kept
    // Best effort, and the app still opens the folder if it fails: this run
    // works, the next one asks again.
    await shell.preferences.write(kept).catch((cause: unknown) => {
      shell.diagnostics.report({
        level: 'warn', where: 'workingDirectory', message: 'preference not written', cause,
      })
    })
    shell = inFolder
    renderApp(kept, undefined)
}

/**
 * The projects that were in browser storage, copied into the folder — once.
 *
 * Once per folder, which is what the preference records. Copying again would be
 * harmless in itself (nothing already in a folder is overwritten) but it would
 * resurrect projects the user deleted from the folder on purpose.
 *
 * Nothing is deleted from browser storage, here or later. Until somebody has
 * opened the migrated folder and seen their work in it, the old copy is the
 * only one that has certainly survived, and a drive can be unplugged.
 */
async function moveInto(folder: Shell, root: string): Promise<boolean> {
  if (readMigratedFolders(stored).includes(root)) return false
  const tally = await migrateInto(
    { from: shell.projects, into: folder.projects },
    { from: shell.groups, into: folder.groups },
  ).catch((cause: unknown) => {
    shell.diagnostics.report({
      level: 'error', where: 'migration', message: 'copying into the folder failed', cause,
    })
    return undefined
  })
  if (!tally) return false
  // Counts, never names: this line goes to a log file the user is invited to
  // hand over.
  shell.diagnostics.report({
    level: 'info',
    where: 'migration',
    message: `copied ${tally.projects} projects and ${tally.groups} groups, kept ${tally.kept}, failed ${tally.failed}`,
  })
  // Marked as done even when there was nothing to copy: an empty browser store
  // has been migrated, and asking again every time is how a folder acquires
  // projects somebody threw away.
  return migrated(tally) || tally.failed === 0
}

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
function renderApp(storedPreferences: unknown, initialProject: ProjectSnapshot | undefined): void {
  root.render(
    <StrictMode>
      <App
        projects={shell.projects}
        groupRecords={shell.groups}
        preferences={shell.preferences}
        documents={shell.documents}
        diagnostics={shell.diagnostics}
        hostControls={shell.hostControls}
        storage={shell.storage}
        workingDirectory={shell.workingDirectory}
        onChooseWorkingDirectory={files ? chooseWorkingDirectory : undefined}
        onOpenWorkingDirectory={files ? openWorkingDirectory : undefined}
        recentFolders={recentFolders}
        watchProject={shell.watchProject}
        commands={commands?.on}
        onUnsavedWork={commands?.reportUnsaved}
        history={shell.history}
        initialProject={initialProject}
        initialPreferences={storedPreferences}
        examples={EXAMPLES}
        makeId={makeId}
        browserLanguages={navigator.languages ?? navigator.language}
        windowChrome={shell.windowChrome}
      />
    </StrictMode>,
  )
}

/**
 * What the boot read, kept where the failure handler can still see it.
 *
 * The two steps fail differently. If the *preferences* would not read there is
 * nothing to carry forward; if the *project* would not load, the language and
 * the theme are perfectly good and only the ref has to go.
 */
let stored: unknown = undefined

/**
 * A boot that fails is an app nobody can get back into.
 *
 * This chain had no `.catch`. A preferences blob a browser would not hand back,
 * or a last project too damaged to load, meant `root.render` was never reached:
 * a white page, on this reload and on every reload after it, because the thing
 * that broke the boot is read again at the start of the next one. The way out
 * has to be a button, not an instruction to clear browser storage by hand.
 */
void shell.preferences.read()
  .then(async (storedPreferences) => {
    stored = storedPreferences
    // Before the project is read, because it decides which store reads it.
    await rememberedDirectory(storedPreferences)
    // Not on a desktop with no folder yet: there is nothing to reopen, because
    // the only place a project could be is the app's own storage, which is
    // exactly what ADR-0003 retired. The first-run screen asks instead.
    const lastProject = files && !shell.workingDirectory
      ? undefined
      : readLastProject(storedPreferences)
    const initialProject = lastProject ? await shell.projects.load(lastProject) : undefined
    renderApp(storedPreferences, initialProject)
  })
  .catch((error: unknown) => {
    shell.diagnostics.report({
      level: 'error', where: 'boot', message: 'the boot chain rejected', cause: error,
    })
    const s = translator(detectBrowserLanguage(navigator.languages ?? navigator.language))
    root.render(
      <BootFailure
        s={s}
        error={error}
        onReload={shell.hostControls.reload}
        onStartFresh={() => {
          const kept = withoutLastProject(stored)
          // Best effort: the store may be the very thing that refused. Writing
          // it back is what stops the next boot repeating this one — the render
          // below happens either way.
          void shell.preferences.write(kept).catch(() => {})
          renderApp(kept, undefined)
        }}
      />,
    )
  })

/**
 * Development only: Vite reloads this module on a change, and without this
 * `createRoot()` would run a second time on the same container — React complains
 * and the tab is broken until you refresh. `import.meta.hot` does not exist in
 * the production bundle, so this branch disappears from it.
 */
import.meta.hot?.dispose(() => root.unmount())
