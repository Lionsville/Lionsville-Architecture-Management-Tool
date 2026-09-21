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
import { configureElkWorker, configureLibavoidWasm, configureLibavoidWorker } from '../layout'
import ElkWorker from 'elkjs/lib/elk-worker.min.js?worker'
import { detectBrowserLanguage, translator } from '../i18n'
import {
  browserFolders, composeShell, desktopCommandChannel, desktopFileChannel, inBrowserFolder,
  inWorkingDirectory,
} from './composition'
import type { DesktopDirectory, Shell } from './composition'
import {
  mayOfferAdoption, readLanguage, readLastScope, readWorkingDirectory, withDeclinedFolder,
  withMigratedFolder, withoutLastScope, withWorkingDirectory,
} from '../projects/preferences'
import { holdsScopes, migrated, migrateInto, upgradeProjects } from '../projects/migration'
import { WITHOUT_ORGANISATION } from '../projects/folderSettings'
import type { PullOutcome } from '../platform/sync'
import { sourceKey } from '../platform/workingSource'
import { isOpenableScope } from '../projects/scope'
import type { ScopeSnapshot } from '../projects/scope'
import { EXAMPLES } from './examples'
import { App } from './App'
import { AdoptFolder } from './AdoptFolder'
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
 * And the same for the placement engine, for the same reason. ELK's layered
 * algorithm is synchronous and its cost grows far faster than the board does —
 * two hundred boxes in half a second, three hundred in five. On this thread
 * that is a window that stops answering with a spinner that cannot even turn;
 * beside it, it is a wait somebody can watch and call off, which is what makes
 * the Cancel on the Tidy button honest.
 *
 * elkjs ships the worker as a built script, so this is its own module rather
 * than one of ours — Vite's `?worker` suffix is what turns it into a
 * constructor at build time.
 */
configureElkWorker(() => new ElkWorker())

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
const browserShell = composeShell()
let shell = browserShell

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
  if (!files) {
    // A browser tab, where a folder is best effort: only if this browser can
    // give one, only if it gave one before, and only if the permission is still
    // granted — asking again needs a click, and a boot is not one.
    const handle = browserFolders.possible() ? await browserFolders.remembered() : undefined
    if (handle) shell = inBrowserFolder(shell, handle, handle.name)
    return
  }
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
 * Deliberately a fresh mount rather than a swap in place, and `renderApp`
 * is what makes it one: `App` is keyed on the working source, so a new
 * folder is a new tree under it. The store is handed to `App` as a prop and
 * everything under it — the picker's list, the open project, the session's
 * undo stack, the index — belongs to the projects in one folder; switching
 * folders is exactly the moment none of that should carry over. It is the
 * same reasoning as remounting the workspace when the project changes, one
 * level up. This comment said "fresh boot" for a while with nothing behind
 * it, and the open organisation stayed open over the new folder's store.
 */
function chooseWorkingDirectory(): void {
  // One catch around the whole of it, and not only around the picker: a throw
  // after the pick — copying in, the format pass — used to be an unhandled
  // rejection, which is a folder chosen and a screen that does not change.
  const failed = (cause: unknown) => {
    shell.diagnostics.report({
      level: 'error', where: 'workingDirectory', message: 'the folder was not opened', cause,
    })
    // Said on screen as well as in the trail: a pick that ends in nothing looks
    // like a button that does nothing.
    renderApp(stored, undefined, undefined, cause)
  }
  if (!files) {
    void openBrowserFolder().catch(failed)
    return
  }
  void files.chooseDirectory().then(async (chosen) => {
    if (!chosen) return
    await workIn(chosen)
  }).catch(failed)
}

async function openBrowserFolder(): Promise<void> {
  const handle = await browserFolders.choose()
  if (!handle) {
    shell.diagnostics.report({ level: 'info', where: 'workingDirectory', message: 'no folder was chosen' })
    return
  }
  // The trail says where a pick got to, because "nothing happened" has been
  // reported and a folder's name is not the folder's content.
  shell.diagnostics.report({ level: 'info', where: 'workingDirectory', message: 'a folder was chosen' })
  const inFolder = inBrowserFolder(shell, handle, handle.name)
  // The same offer as the desktop's, and the same rule: asked at most once per
  // folder, copied at most once anywhere, nothing deleted. Keyed on the
  // folder's name, which is all a tab knows about where it is.
  let kept = withWorkingDirectory(stored, handle.name)
  kept = withAdoption(kept, handle.name, await adoptInto(inFolder, handle.name, handle.name))
  stored = kept
  await shell.preferences.write(kept).catch(() => undefined)
  shell = inFolder
  await upgradeFormat()
  shell.diagnostics.report({ level: 'info', where: 'workingDirectory', message: 'the folder is open' })
  renderApp(kept, undefined)
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
    kept = withAdoption(kept, chosen.root, await adoptInto(inFolder, chosen.root, chosen.name))
    stored = kept
    // Best effort, and the app still opens the folder if it fails: this run
    // works, the next one asks again.
    await shell.preferences.write(kept).catch((cause: unknown) => {
      shell.diagnostics.report({
        level: 'warn', where: 'workingDirectory', message: 'preference not written', cause,
      })
    })
    shell = inFolder
    // The first-run screen and the Recent menu read this list; a folder
    // granted just now belongs on it without a restart.
    recentFolders = await files.recentDirectories().catch(() => recentFolders)
    // After the pull, so what is migrated is what the remote just handed over.
    const initialSync = await pullOnOpen()
    await upgradeFormat()
    renderApp(kept, undefined, initialSync)
}

/**
 * Pull from the folder's remote, if this machine says so (ADR-0005).
 *
 * Here, at the edge, because of when it has to happen: before the project is
 * read, so what opens is what was pulled, and before the watcher starts, so a
 * fast-forward's writes are never reported as somebody else's change. It
 * begins with a snapshot — the app writes files without committing them, and
 * a fast-forward that touched unrecorded work would refuse — under the only
 * message a boot can draft. Everything about it may say no, and a refusal is
 * a notice the shell shows rather than a failure to open.
 */
async function pullOnOpen(): Promise<PullOutcome | undefined> {
  const { history, folderSettings } = shell
  if (!history?.sync || !folderSettings) return undefined
  try {
    if (!(await folderSettings.readLocal()).git.pullOnOpen) return undefined
    // No repository, no remote: nothing to pull, and nothing to say about it.
    if (!await history.keeping()) return undefined
    const s = translator(readLanguage(stored) ?? detectBrowserLanguage(navigator.languages ?? navigator.language))
    await history.snapshot(s('history.beforeSync'))
    return await history.sync.pull()
  } catch (cause) {
    shell.diagnostics.report({ level: 'warn', where: 'sync', message: 'pull on open failed', cause })
    return undefined
  }
}

/**
 * What the pick should remember about this folder.
 *
 * `nothing to record` covers both "there was nothing to bring" and "the copy
 * did not finish". Neither is an answer, and neither should stop the offer
 * being made again.
 */
type Adoption = 'copied' | 'declined' | 'nothing to record'

/** The pick's answer, folded into the blob the next boot reads. */
function withAdoption(
  kept: Record<string, unknown>, root: string, adoption: Adoption,
): Record<string, unknown> {
  if (adoption === 'copied') return withMigratedFolder(kept, root)
  if (adoption === 'declined') return withDeclinedFolder(kept, root)
  return kept
}

/**
 * The scopes that were in browser storage, copied into the folder — once, and
 * only when the person picking it says so.
 *
 * **Both halves of the old rule were wrong.** It copied as a side effect of
 * choosing a folder, and it did so once *per folder*. A folder nobody has
 * migrated into is every folder somebody has just made, so a folder chosen to
 * start something new arrived with an organisation already in it — and the
 * next empty folder got one too, being equally unmigrated. One folder per
 * customer is exactly the case that must not carry the first customer's
 * landscape into the second's.
 *
 * So: only while nothing has been rescued anywhere yet, only when there is
 * something to rescue, and only when asked. The list of folders stays, because
 * it is still the record of where the work went.
 *
 * **A no is remembered per folder**, because a browser hands out a folder
 * permission that rarely survives a restart: the same folder is picked again on
 * the next boot, and a question already answered must not be asked twice.
 *
 * Nothing is deleted from browser storage, here or later. Until somebody has
 * opened the migrated folder and seen their work in it, the old copy is the
 * only one that has certainly survived, and a drive can be unplugged.
 */
async function adoptInto(folder: Shell, root: string, label: string): Promise<Adoption> {
  if (!mayOfferAdoption(stored, root)) return 'nothing to record'
  // From the boot's browser storage and never from `shell`: once a folder is
  // open, `shell` IS that folder, and *Change…* to an empty one copied the
  // open organisation into it — five scopes of somebody's landscape, in a
  // folder chosen to start something else.
  if (!await holdsScopes(browserShell.scopes)) return 'nothing to record'
  if (!await askAdoption(label)) return 'declined'
  const tally = await migrateInto(browserShell.scopes, folder.scopes).catch((cause: unknown) => {
    shell.diagnostics.report({
      level: 'error', where: 'migration', message: 'copying into the folder failed', cause,
    })
    return undefined
  })
  // Recorded as neither: a copy that did not finish is one to offer again.
  if (!tally) return 'nothing to record'
  // Counts, never names: this line goes to a log file the user is invited to
  // hand over.
  shell.diagnostics.report({
    level: 'info',
    where: 'migration',
    message: `copied ${tally.scopes} scopes, kept ${tally.kept}, failed ${tally.failed}`,
  })
  // A run that wrote nothing because the folder already held it all has rescued
  // the work as surely as one that wrote every file.
  return migrated(tally) || tally.failed === 0 ? 'copied' : 'nothing to record'
}

/**
 * The question, on a screen of its own.
 *
 * Rendered where `BootFailure` is and for its reasons: this is the composition
 * root, no app is mounted that would survive the answer — the store beneath it
 * is the thing being decided — and a question behind a backdrop is a question
 * that gets clicked away. The app mounts once, after the answer, against
 * whichever store it chose.
 */
function askAdoption(label: string): Promise<boolean> {
  const s = translator(readLanguage(stored)
    ?? detectBrowserLanguage(navigator.languages ?? navigator.language))
  return new Promise<boolean>((resolve) => {
    root.render(
      <AdoptFolder
        s={s}
        folderName={label}
        onCopy={() => resolve(true)}
        onSkip={() => resolve(false)}
      />,
    )
  })
}

/**
 * Every project in this source, in the format this build writes.
 *
 * ADR-0012 §11: an older folder is transformed rather than quietly half-read,
 * and the transformation is a pass rather than a rewrite on save, because the
 * files the format has stopped writing only leave the folder when a project is
 * written back. It asks the store first and almost always gets nothing, so it
 * needs no preference to remember it has run — the folder itself is the record.
 *
 * The snapshot comes first where there is one to take (ADR-0008 keeps what the
 * folder looked like), and where there is not — a browser tab, a folder with no
 * git — it migrates anyway and says so in the trail. Refusing to open somebody's
 * work for want of a commit would be the worse answer.
 */
async function upgradeFormat(): Promise<void> {
  const { history, diagnostics, folderSettings } = shell
  const s = translator(readLanguage(stored)
    ?? detectBrowserLanguage(navigator.languages ?? navigator.language))
  // The organisation's name, where a build before scopes put it: `folder.json`
  // (ADR-0012 §1). Read before the pass because the root it is about to write
  // is what the name is for, and taken out of the file after — a name in two
  // places is a name that can disagree with itself.
  const settings = await folderSettings?.readFolder().catch(() => undefined)
  const tally = await upgradeProjects(shell.scopes, {
    rootName: settings?.legacyOrganisationName
      ?? (shell.source.kind === 'folder' ? shell.source.name : undefined),
    record: history && (async () => {
      if (!await history.available() || !await history.keeping()) return false
      return history.snapshot(s('history.beforeUpgrade'))
    }),
  }).catch((cause: unknown) => {
    diagnostics.report({
      level: 'error', where: 'formatUpgrade', message: 'upgrading the file format failed', cause,
    })
    return undefined
  })
  // Counts, never names: this line goes to a log file the user is invited to
  // hand over. Silent when there was nothing to do, which is almost always.
  if (!tally || (tally.upgraded === 0 && tally.created === 0 && tally.failed === 0)) return
  if (settings?.legacyOrganisationName) {
    // Best effort, and after the root is written: a key left behind is stale
    // data in a file every build forgives, where a name taken away before the
    // scope that replaces it exists would be a name lost.
    await folderSettings?.writeFolder(WITHOUT_ORGANISATION).catch((cause: unknown) => {
      diagnostics.report({
        level: 'warn', where: 'formatUpgrade', message: 'the old organisation key was left in place', cause,
      })
    })
  }
  diagnostics.report({
    level: tally.failed ? 'warn' : 'info',
    where: 'formatUpgrade',
    message: `upgraded ${tally.upgraded} scopes, created ${tally.created}, failed ${tally.failed}, snapshot ${tally.recorded}`,
  })
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
function renderApp(
  storedPreferences: unknown, initialProject: ScopeSnapshot | undefined, initialSync?: PullOutcome,
  folderFailure?: unknown,
): void {
  root.render(
    <StrictMode>
      <App
        // A folder change is a fresh mount, not a swap in place: see
        // `chooseWorkingDirectory` and `sourceKey`.
        key={sourceKey(shell.source)}
        scopes={shell.scopes}
        preferences={shell.preferences}
        documents={shell.documents}
        diagnostics={shell.diagnostics}
        hostControls={shell.hostControls}
        source={shell.source}
        sourceStatus={shell.sourceStatus}
        onChooseWorkingDirectory={
          files || browserFolders.possible() ? chooseWorkingDirectory : undefined
        }
        needsFolder={Boolean(files)}
        onOpenWorkingDirectory={files ? openWorkingDirectory : undefined}
        recentFolders={recentFolders}
        watchProject={shell.watchProject}
        commands={commands?.on}
        hostMenu={Boolean(commands)}
        onUnsavedWork={commands?.reportUnsaved}
        onThemeMode={commands?.reportTheme}
        onScopeOpen={commands?.reportScopeOpen}
        history={shell.history}
        folderSettings={shell.folderSettings}
        updateSettings={shell.updateSettings}
        agent={shell.agent}
        initialSync={initialSync}
        folderFailure={folderFailure}
        initialProject={initialProject}
        initialPreferences={storedPreferences}
        examples={EXAMPLES}
        makeId={makeId}
        browserLanguages={navigator.languages ?? navigator.language}
        windowChrome={shell.windowChrome}
        onTitle={shell.showTitle}
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
    // After the folder, before the project: see `pullOnOpen`.
    const initialSync = await pullOnOpen()
    // And before the project is read, so what opens is already this format.
    await upgradeFormat()
    // Not on a desktop with no folder yet: there is nothing to reopen, because
    // the only place a project could be is the app's own storage, which is
    // exactly what ADR-0003 retired. The first-run screen asks instead.
    const lastScope = files && shell.source.kind !== 'folder'
      ? undefined
      : readLastScope(storedPreferences)
    const held = lastScope === undefined ? undefined : await shell.scopes.load(lastScope)
    // A scope with no views is a domain (ADR-0012 §1): there is nothing for the
    // canvas to show, so the picker opens instead of an empty editor.
    const initialProject = isOpenableScope(held) ? held : undefined
    renderApp(storedPreferences, initialProject, initialSync)
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
          const kept = withoutLastScope(stored)
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
