// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

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
  browserFolders, chooseFolderDestination, composeShell, desktopCommandChannel, desktopFileChannel,
  inBrowserFolder, inWorkingDirectory, openSource, registeredChrome, registeredConnects,
  registeredMenus, sourceAgentPanel, sourceChip, sourceDescription,
} from './composition'
import type { WorkingFileDestination } from './workingFileFlows'
import type { DesktopDirectory, RegisteredConnect, Shell } from './composition'
import type { SourceLocation, SourceWayIn } from '../platform/sourceProvider'
import {
  mayOfferAdoption, readLanguage, readLastScope, readWorkingDirectory, withDeclinedFolder,
  withMigratedFolder, withoutLastScope, withWorkingDirectory,
} from '../projects/preferences'
import { holdsScopes, migrated, migrateInto, upgradeProjects } from '../projects/migration'
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
 * Work from a source a registered provider answers for.
 *
 * `openSource` is the one call: the parts a provider builds and its word about
 * the five words the bar says travel together, and this file is not the place
 * to restate that. Everything else is the reasoning `chooseWorkingDirectory`
 * writes out below — `App` is keyed on the working source, so this is a fresh
 * mount and not a swap in place, because the open scope, the session's stack,
 * the index and every watcher belong to one source.
 *
 * Nothing is remembered about it. Where the work was is the provider's own
 * business, which is why `connect.fromLocation` exists: the address a build
 * reopens with is one it can read for itself, and a preference written from
 * here would be this file keeping a fact it cannot check.
 *
 * A rejection is not caught here. It is a source that could not be opened, which
 * each of the two callers below answers in the way that suits where it is: the
 * boot's own failure screen, or the notice a way in already has.
 */
async function workFrom(kind: string, opening: unknown): Promise<boolean> {
  // The shell as it stands, before this source's parts are spread over it: the
  // trail to report on, and the seams already filled — a provider that replaces
  // the store has no business composing a second preferences store or a second
  // *Save as…* dialog, and this is what it reuses instead.
  //
  // Awaited, because a source may have to shake hands before it can say what it
  // is: what it is called, which scopes it holds and whether this person may
  // write to it are answers over a wire, and `readOnly` has to be right at the
  // first paint rather than a moment after it. A folder answers before the
  // `await` has anything to do.
  const parts = await openSource(kind, opening, { diagnostics: shell.diagnostics, shell })
  // The preferences are read before the first render and the scopes right after
  // it, so a source that brought neither is not one this boot can use — said
  // here rather than discovered as an empty screen.
  if (!parts.scopes) {
    shell.diagnostics.report({
      level: 'error',
      where: 'source',
      message: `the '${kind}' source brought nowhere to keep a scope`,
    })
    return false
  }
  shell = { ...shell, ...parts, scopes: parts.scopes }
  return true
}

/**
 * The folder's way in is the button that has always been there.
 *
 * Every registered provider says how a person reaches it, the folder included —
 * but choosing a folder is more than opening a source: it is remembered as this
 * machine's preference, offered whatever is in browser storage, pulled and
 * walked through the format pass. That is `chooseWorkingDirectory`, which is
 * what the *Choose folder…* button already calls. A second button for the same
 * kind would be two buttons that do different amounts of the same thing.
 */
const FOLDER_ASKS_FOR_MORE = 'folder'

/**
 * The provider's own dialog, and then the shell over what it answered.
 *
 * Nothing back is a person who closed the dialog: they have said what they
 * meant, and a screen that reported an error would be arguing with them. A
 * rejection is a failure, and is both reported and said on screen — a way in
 * that ends in nothing looks like a button that does nothing.
 */
function connectTo(way: RegisteredConnect): void {
  void way.connect.open().then(async (opening) => {
    if (opening === undefined) {
      shell.diagnostics.report({ level: 'info', where: 'source', message: 'no source was chosen' })
      return
    }
    // A source that has to shake hands does it here, with the app that is
    // already on screen behind the press: this is the one way in where there is
    // something to look at while it happens, and the `catch` below is what says
    // so when it comes to nothing.
    if (!await workFrom(way.kind, opening)) return
    shell.diagnostics.report({ level: 'info', where: 'source', message: 'the source is open' })
    renderApp(stored, undefined)
  }).catch((cause: unknown) => {
    shell.diagnostics.report({
      level: 'error', where: 'source', message: 'the source was not opened', cause,
    })
    renderApp(stored, undefined, undefined, undefined, cause)
  })
}

/**
 * One button per registered provider that offers a way in, in the order they
 * registered. Empty in every build in this repository.
 */
const waysIn: readonly SourceWayIn[] = registeredConnects()
  .filter((way) => way.kind !== FOLDER_ASKS_FOR_MORE)
  .map((way) => ({
    kind: way.kind,
    labelKey: way.connect.labelKey,
    onConnect: () => connectTo(way),
    // The location bound here and the source asked for there: an address may be
    // read where the page is (`pageLocation`), and what is open moves while the
    // window is open, so the shell asks the rest of the question every time it
    // draws the button. Read at the ask rather than closed over, so a provider
    // reached by a link that changed sees the address it was reached at.
    offer: way.connect.offer
      ? (source) => way.connect.offer?.({ source, location: pageLocation() })
      : undefined,
  }))

/**
 * What every registered provider draws for itself, whichever source this boot
 * ends up working from. Empty in every build in this repository.
 *
 * Read once, out here, for the same reason the ways in are: registration
 * happens at module load, and a list read per render would be a fresh array
 * every render and the same entries every time. Every registration and not the
 * open source's own, because the press that opens a source happens on a screen
 * where that provider is not the source yet — and its dialog has to be
 * somewhere by then.
 */
const chromes = registeredChrome()

/**
 * And what they want in the app's own menu, read once for the same reason: the
 * registrations are made at module load, and every registration's lines rather
 * than the open source's, because the line a provider needs most is the one that
 * is pressed while it answers for nothing.
 */
const menus = registeredMenus()

/**
 * A build that knows its source before the first render, from the address the
 * page was opened at.
 *
 * Before anything renders, which is the whole point: a shell composed over the
 * fallback and swapped a moment later is a mount thrown away, and an empty
 * screen in between. Each provider reads the location for itself — this file
 * neither parses it nor knows what an address looks like — and the first that
 * recognises it wins; a provider that throws over a URL is a provider that
 * would have broken every boot, so it is caught here and reported.
 */
async function sourceFromLocation(): Promise<boolean> {
  const location = pageLocation()
  for (const way of registeredConnects()) {
    let opening: unknown
    try {
      opening = way.connect.fromLocation?.(location)
    } catch (cause) {
      shell.diagnostics.report({
        level: 'error', where: 'source', message: 'a source could not read the address', cause,
      })
      continue
    }
    if (opening === undefined) continue
    // Opening what the address named is deliberately NOT caught: reading a URL
    // is a guess and the next provider may recognise it, while a source that
    // recognised it and then could not be opened is the boot failing — and the
    // boot has a screen for that, which says the provider's own sentence and
    // offers a way back in. Swallowing it here would leave the fallback store
    // open under an address that says otherwise.
    if (await workFrom(way.kind, opening)) return true
  }
  return false
}

/**
 * Where the page was opened, as much of it as a provider may read.
 *
 * The one place this file reads an address, and the reason a provider is handed
 * three strings rather than the DOM's `Location`: what a provider does with them
 * is its own business, and this tree neither parses them nor says what an
 * address looks like.
 */
function pageLocation(): SourceLocation {
  return {
    href: window.location.href,
    search: window.location.search,
    hash: window.location.hash,
  }
}

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
  await openBrowserFolderWith(handle)
}

/**
 * A folder a working file just became (ADR-0025): chosen and written by the
 * composition, moved into here the way *Open Folder…* moves — the desktop's
 * route and the browser's, whichever this host has.
 */
async function chooseFolderForWorkingFile(): Promise<WorkingFileDestination | undefined> {
  const found = await chooseFolderDestination()
  if (!found) return undefined
  return {
    name: found.opening.name,
    occupied: found.occupied,
    place: async (scopes) => {
      await found.place(scopes)
      if (files) await workIn({ root: found.opening.root, name: found.opening.name })
      else await openBrowserFolderWith(found.opening.handle)
    },
  }
}

async function openBrowserFolderWith(handle: Parameters<typeof inBrowserFolder>[1] & { name: string }): Promise<void> {
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
  // is what the name is for. The key is left in the file: nothing this build
  // writes into a person's folder is a settings file of ours (ADR-0023), and
  // once the root has its name nothing reads the key again.
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
  folderFailure?: unknown, sourceFailure?: unknown,
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
        onSourceWork={shell.onSourceWork}
        sourceDescription={sourceDescription(shell.source)}
        sourceChip={sourceChip(shell.source)}
        storageFailure={shell.sourceFailure}
        agentPanel={sourceAgentPanel(shell.source)}
        sourceMenu={menus}
        onScopeSession={shell.onScopeSession}
        chrome={chromes}
        onChooseWorkingDirectory={
          files || browserFolders.possible() ? chooseWorkingDirectory : undefined
        }
        waysIn={waysIn}
        needsFolder={Boolean(files)}
        onOpenWorkingDirectory={files ? openWorkingDirectory : undefined}
        onChooseFolderForWorkingFile={
          files || browserFolders.possible() ? chooseFolderForWorkingFile : undefined
        }
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
        sourceFailure={sourceFailure}
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
    // An address the page was opened at wins over the folder this machine last
    // worked in: it is what was asked for just now, and the preference is what
    // was asked for last time.
    // Before the project is read, because it decides which store reads it.
    if (!await sourceFromLocation()) await rememberedDirectory(storedPreferences)
    // After the folder, before the project: see `pullOnOpen`.
    const initialSync = await pullOnOpen()
    // And before the project is read, so what opens is already this format.
    await upgradeFormat()
    // Not on a desktop with no folder yet: there is nothing to reopen, because
    // the only place a project could be is the app's own storage, which is
    // exactly what ADR-0003 retired. The first-run screen asks instead.
    // A source a provider answers for keeps scopes somewhere as surely as a
    // folder does, so the last one reopens from it too; what does not reopen is
    // a desktop with nowhere to keep anything, where the only place a project
    // could be is the app's own storage, which is exactly what ADR-0003 retired.
    const hasSource = shell.source.kind === 'folder' || shell.source.kind === 'registered'
    const lastScope = files && !hasSource
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
