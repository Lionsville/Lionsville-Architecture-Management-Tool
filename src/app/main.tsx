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
 * another place to keep work is a provider registered in the composition
 * (`composition.ts`), rather than a hunt through the tree for every place that
 * assumed a browser.
 *
 * So what belongs in this file is: environment setup that must happen before
 * anything renders, the choice of adapters, and the wiring. Anything that makes
 * a decision belongs in `core/`; anything that draws belongs in `ui/`.
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { configureElkWorker, configureLibavoidWasm, configureLibavoidWorker } from '../layout'
import ElkWorker from 'elkjs/lib/elk-worker.min.js?worker'
import RouterWorker from '../layout/routerWorker.ts?worker'
import { detectBrowserLanguage, translator } from '../i18n'
import {
  composeShell, desktopCommandChannel, EXAMPLE_OFFERS, INTERCHANGE, openSource, overSource, registeredChrome, registeredConnects,
  registeredMenus, reloadWhenScriptsAreGone, sourceAgentPanel, sourceChip, sourceChipFace, sourceChipPanel,
  sourceConnected, sourceDescription, sourceDestination, sourcePreferencesPanel, sourceRecentActivity, sourceSayings,
} from './composition'
import type { RegisteredConnect } from './composition'
import type { SourceLocation, SourceRecent, SourceWayIn } from '../platform/sourceProvider'
import { readLanguage, readLastScope, withoutLastScope } from '../projects/preferences'
import { readScope } from '../projects/scopeAccess'
import { sourceKey } from '../platform/workingSource'
import {
  bootDecidedBy, dialogAsked, landedAt, landingOf, placeLanding, placeToRead, readPlaceScope, reopened, withoutDialog,
} from './bootLanding'
import { readPlace } from '../agent/place'
import type { Place } from '../agent/place'
import type { BootDialog, BootLanding } from './bootLanding'
import { App } from './App'
import { BootFailure } from './BootFailure'
import type { ChooseDestination } from './workingFileFlows'

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
 * Vite's `?worker` import, as for the placement engine below: the build
 * bundles the worker and hands back its constructor, an ES module worker
 * (`worker.format` in `vite.config.ts`), where a computed URL would build
 * cleanly and then 404.
 */
configureLibavoidWorker(() => new RouterWorker())

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
let browserShell = composeShell(translator(detectBrowserLanguage(navigator.languages ?? navigator.language)))
let shell = browserShell

/** Whether the open scope holds an edit not yet written, as the app last said. */
let unsaved = false

// Before anything is rendered: a part reached later is a script of its own,
// and a deploy while this tab was open is a script that is gone. Never
// reloaded over work a reload would lose — an edit not yet written, or a
// source nothing outlives the tab in: the part says it did not load instead.
reloadWhenScriptsAreGone(browserShell, () => !unsaved && !shell.source.transient)

/**
 * The working file's part, fetched once the first screen is up and the page
 * is idle, so Export and Open find it loaded rather than asking for it then —
 * when a tab left open over a deploy would find it gone.
 */
let preloaded = false
function preloadWhenIdle(): void {
  if (preloaded) return
  preloaded = true
  const idle = (globalThis as { requestIdleCallback?: (run: () => void) => number }).requestIdleCallback
  if (idle) idle(() => INTERCHANGE.preload())
  else setTimeout(() => INTERCHANGE.preload(), 2_000)
}

/** The menu bar, and the documents the OS opens us with. Nothing in a browser tab. */
const commands = desktopCommandChannel()

/**
 * What the boot read, kept where the failure handler can still see it.
 *
 * The two steps fail differently. If the *preferences* would not read there is
 * nothing to carry forward; if the *scope* would not load, the language and
 * the theme are perfectly good and only the address has to go.
 */
let stored: unknown = undefined

/** A preference that could not be written: nothing is lost now, and the next start asks again. */
function reportPreferences(cause: unknown): void {
  shell.diagnostics.report({ level: 'warn', where: 'preferences', message: 'the preferences could not be written', cause })
}

/** The boot's language, for what a source records before there is an app to ask. */
function bootWords() {
  return translator(readLanguage(stored) ?? detectBrowserLanguage(navigator.languages ?? navigator.language))
}

/**
 * Every registered provider that offers a way in, in the order they
 * registered — the folder among them — and the one the host names: its *Open…*
 * line and its Recent list (`SourceConnect.hostMenu`). A way in that cannot be
 * taken here — a picker this browser does not have — is not offered at all.
 */
const connects: readonly RegisteredConnect[] = registeredConnects()
  .filter((way) => way.connect.possible?.() ?? true)
const hostWay = connects.find((way) => way.connect.hostMenu)

/** Has a way in been taken, or a source resumed? Until then work is where the boot composed it. */
let sourced = false

/** The places the host's way in worked from lately: the first screen's list. Empty until the boot has asked. */
let recents: readonly SourceRecent[] = []

async function readRecents(): Promise<void> {
  const recent = hostWay?.connect.recent
  if (!recent) return
  // None is an answer the first screen can give; a channel that failed to say
  // is one the trail should have.
  recents = await recent().catch((cause: unknown) => {
    shell.diagnostics.report({ level: 'warn', where: 'source', message: 'the recent places could not be read', cause })
    return recents
  })
}

/**
 * Work from a source a registered provider answers for, the folder included.
 *
 * `openSource` is the one call: the parts a provider builds and its word about
 * the five words the bar says travel together, and this file is not the place
 * to restate that. `App` is keyed on the working source, so what follows is a
 * fresh mount and not a swap in place — the open scope, the session's stack,
 * the index and every watcher belong to one source.
 *
 * Awaited, because a source may have to do something before it can be read: a
 * folder is pulled and brought up to date, and a source somewhere else shakes
 * hands and says what it is. `readOnly` has to be right at the first paint
 * rather than a moment after it.
 *
 * A rejection is not caught here. It is a source that could not be opened, which
 * each caller answers in the way that suits where it is: the boot's own failure
 * screen, or the notice a way in already has.
 */
async function workFrom(kind: string, opening: unknown): Promise<boolean> {
  // The shell as it stands, before this source's parts are spread over it: the
  // trail to report on, the seams already filled, the person's language for
  // what a source records as it opens, and where work was kept before any
  // source was chosen.
  const parts = await openSource(kind, opening, {
    diagnostics: shell.diagnostics, shell, s: bootWords(),
    ...(browserShell.repositories ? { beneath: browserShell.repositories } : {}),
  })
  // The scopes are read right after the first render, so a source that brought
  // nowhere to keep them — a provider written without the types — is not one
  // this boot can use: said here rather than discovered as an empty screen.
  if (!(parts as Partial<typeof parts>).repositories) {
    shell.diagnostics.report({ level: 'error', where: 'source', message: `the '${kind}' source brought no repositories` })
    return false
  }
  shell = overSource(shell, parts)
  sourced = true
  return true
}

/**
 * A place a person just chose, by a way in: opened, remembered as this
 * machine's for the next boot where its provider keeps one, and the app drawn
 * over it. Nothing back is a person who closed the dialog: they have said
 * what they meant, and a screen that reported an error would be arguing with
 * them. A rejection is a failure, and is both reported and said on screen — a
 * way in that ends in nothing looks like a button that does nothing.
 */
function take(way: RegisteredConnect, chose: () => Promise<unknown>): Promise<void> {
  return chose().then(async (opening) => {
    if (opening === undefined) {
      shell.diagnostics.report({ level: 'info', where: 'source', message: 'nothing was chosen' })
      return
    }
    // The trail says where a pick got to, because "nothing happened" has been
    // reported and where it was is not what it holds.
    shell.diagnostics.report({ level: 'info', where: 'source', message: 'a place was chosen' })
    if (!await workFrom(way.kind, opening)) return
    const remember = way.connect.remember
    if (remember) {
      stored = remember(stored, opening)
      // The source opens either way; one that could not be remembered is asked
      // for again at the next start, and the trail says why.
      await shell.preferences.write(stored as Record<string, unknown>).catch(reportPreferences)
    }
    // The first screen and the Recent menu read this list; a place granted
    // just now belongs on it without a restart.
    if (way === hostWay) await readRecents()
    shell.diagnostics.report({ level: 'info', where: 'source', message: 'the source is open' })
    renderApp(stored, undefined)
  }).catch((cause: unknown) => {
    shell.diagnostics.report({ level: 'error', where: 'source', message: 'the source was not opened', cause })
    renderApp(stored, undefined, { cause, key: way.connect.failedKey })
  })
}

/**
 * Somewhere new a working file may become (ADR-0025), by the host's way in:
 * chosen and looked at by its provider, written by the file's flow, and moved
 * into here the way *Open…* moves.
 */
const chooseDestination: ChooseDestination | undefined = (() => {
  const destination = hostWay && sourceDestination(hostWay.kind)
  if (!hostWay || !destination) return undefined
  return async () => {
    const found = await destination()
    if (!found) return undefined
    return {
      name: found.name,
      occupied: found.occupied,
      place: async (scopes) => {
        await found.place(scopes)
        await take(hostWay, () => Promise.resolve(found.opening))
      },
      read: (path) => found.read(path),
    }
  }
})()

/** One button per way in, in the order they registered, as the screens draw them. */
function waysIn(): readonly SourceWayIn[] {
  return connects.map((way) => ({
    kind: way.kind,
    labelKey: way.connect.labelKey,
    onConnect: () => { void take(way, () => way.connect.open()) },
    // The location bound here and the source asked for there: an address may be
    // read where the page is (`pageLocation`), and what is open moves while the
    // window is open, so the shell asks the rest of the question every time it
    // draws the button.
    ...(way.connect.offer
      ? { offer: (source) => way.connect.offer?.({ source, location: pageLocation() }) }
      : {}),
    ...(way.connect.hostMenu ? { hostMenu: true } : {}),
    ...(way.connect.required?.() ? { required: true } : {}),
    ...(way.connect.introKey ? { introKey: way.connect.introKey } : {}),
    ...(way.connect.firstLabelKey ? { firstLabelKey: way.connect.firstLabelKey } : {}),
    ...(way === hostWay ? { recent: recents } : {}),
    ...(way.connect.reopen ? { onReopen: (key: string) => { void take(way, () => way.connect.reopen!(key)) } } : {}),
  } satisfies SourceWayIn))
}

/**
 * What every registered provider draws for itself, and what they want in the
 * app's own menu, whichever source this boot ends up working from — read once,
 * because registration happens at module load, and every registration's rather
 * than the open source's: the press that opens a source happens on a screen
 * where that provider is not the source yet.
 */
const chromes = registeredChrome()
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
  for (const way of connects) {
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
    // boot has a screen for that.
    if (await workFrom(way.kind, opening)) return true
  }
  return false
}

/**
 * The place this machine worked from last, where a way in keeps one and it may
 * still be opened: the first that answers wins. One that could not say is a
 * boot that opens where the fallback keeps work, and the trail says why.
 */
async function resumed(): Promise<void> {
  for (const way of connects) {
    const resume = way.connect.resume
    if (!resume) continue
    const opening = await resume(stored).catch((cause: unknown) => {
      shell.diagnostics.report({ level: 'warn', where: 'source', message: 'the last place could not be reopened', cause })
      return undefined
    })
    if (opening !== undefined && await workFrom(way.kind, opening)) return
  }
}

/**
 * A dialog the address asked to have open at the first paint (`bootLanding`),
 * read once, and taken out of the address at once so a reload does not open
 * it again. The desktop's page has no query, so there it is always nothing.
 */
const askedDialog = (() => {
  const asked = dialogAsked(window.location.search)
  const rest = withoutDialog(window.location.href)
  if (rest !== undefined) window.history.replaceState(window.history.state, '', rest)
  return asked
})()

/**
 * A place the address's fragment carries (ADR-0033): where a reload in a
 * browser was a moment ago, or where a link copied from the bar points. Read
 * once, before anything moves the history; a fragment that is not a place is
 * left alone for the source that may have written it.
 */
const bootPlace = readPlace(window.location.hash)

/**
 * Where that place lands, once the source it is in is open. A read that fails
 * is a place this person may not be shown: said on the trail, and the
 * organisation's home, which is where a refused open leaves somebody who had
 * nothing open.
 */
async function landingAtPlace(place: Place): Promise<BootLanding> {
  const path = placeToRead(place)
  if (path === undefined) return placeLanding(undefined, place)
  const reading = readPlaceScope(shell.repositories.scopes, path).catch((cause: unknown) => {
    shell.diagnostics.report({ level: 'warn', where: 'boot', message: 'the place in the address could not be read', cause })
    return undefined
  })
  return landedAt(reading, place)
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

/** Does work here have nowhere to be kept until a way in is taken? The first screen asks. */
/**
 * The parts the boot's own source settles on, where it only learns what it can
 * keep by asking (`ProviderParts.settled`) — before anything is drawn, so the
 * bar says what is so from the first frame. A source that could not say keeps
 * the parts it opened with, and its strip says the rest.
 */
async function settled(): Promise<void> {
  if (!shell.settled) return
  const parts = await shell.settled().catch((cause: unknown) => {
    shell.diagnostics.report({ level: 'warn', where: 'source', message: 'the source could not say what it keeps', cause })
    return undefined
  })
  // Settled either way: a second boot step never asks again.
  shell = overSource(shell, parts ?? { ...shell, settled: undefined })
  browserShell = shell
}

function sourceNeeded(): boolean {
  return !sourced && connects.some((way) => way.connect.required?.())
}

/**
 * Read first, then render — and with `.then` rather than a top-level `await`.
 *
 * Reading has to happen out here: every source is asynchronous, but the shell
 * underneath wants to start synchronously — no `null` case threaded through
 * every `useState` of an open scope, and no flash of an empty editor.
 *
 * Not a top-level await because Vite builds to a target that has none
 * (chrome87 / safari14), and raising that target is a statement about which
 * browsers this tool still serves.
 */
function renderApp(
  storedPreferences: unknown, landing: BootLanding & { dialog?: BootDialog } | undefined,
  failed?: { cause: unknown; key?: string },
): void {
  root.render(
    <StrictMode>
      <App
        // A change of source is a fresh mount, not a swap in place: see
        // `workFrom` and `sourceKey`.
        key={sourceKey(shell.source)}
        repositories={shell.repositories}
        preferences={shell.preferences}
        documents={shell.documents}
        interchange={INTERCHANGE}
        diagnostics={shell.diagnostics}
        hostControls={shell.hostControls}
        boot={{
          initialProject: landing?.initialProject,
          ...(landing?.initialHome !== undefined ? { initialHome: landing.initialHome } : {}),
          ...(landing?.initialPage ? { initialPage: landing.initialPage } : {}),
          ...(landing?.initialHomePage ? { initialHomePage: landing.initialHomePage } : {}),
          ...(landing?.dialog ? { opensDialog: landing.dialog } : {}),
          initialPreferences: storedPreferences,
          browserLanguages: navigator.languages ?? navigator.language,
          ...(failed ? { sourceFailure: failed.cause, ...(failed.key ? { sourceFailureKey: failed.key } : {}) } : {}),
        }}
        source={shell.source}
        provider={{
          status: shell.sourceStatus,
          onWork: shell.onSourceWork,
          description: shell.sayings?.describeKey ?? sourceDescription(shell.source),
          chip: sourceChip(shell.source),
          keepFailure: shell.sourceFailure,
          agentPanel: sourceAgentPanel(shell.source),
          chipPanel: sourceChipPanel(shell.source),
          chipFace: sourceChipFace(shell.source),
          menu: menus,
          onScopeSession: shell.onScopeSession,
          publishesSteps: shell.publishesSteps,
          recentActivity: sourceRecentActivity(shell.source),
          connected: sourceConnected(shell.source),
          readOnlyAt: shell.readOnlyAt,
          chrome: chromes,
          waysIn: waysIn(),
          preferencesPanel: sourcePreferencesPanel(shell.source),
          own: shell.own,
          historyNoteKey: shell.historyNoteKey,
          historyKept: shell.historyKept,
          sayings: { ...sourceSayings(shell.source), ...shell.sayings },
          sourceNeeded: sourceNeeded(),
          changes: shell.changes,
          destination: chooseDestination,
        }}
        host={{
          commands: commands?.on,
          hostMenu: Boolean(commands),
          onUnsavedWork: (held: boolean) => {
            unsaved = held
            commands?.reportUnsaved(held)
          },
          onThemeMode: commands?.reportTheme,
          onLanguage: commands?.reportLanguage,
          onScopeOpen: commands?.reportScopeOpen,
          windowChrome: shell.windowChrome,
          onTitle: shell.showTitle,
          updateSettings: shell.updateSettings,
        }}
        agent={shell.agent}
        examples={EXAMPLE_OFFERS}
        makeId={makeId}
      />
    </StrictMode>,
  )
  preloadWhenIdle()
}

/**
 * A boot that fails is an app nobody can get back into.
 *
 * A preferences blob a browser would not hand back, or a last scope too
 * damaged to load, meant `root.render` was never reached: a white page, on
 * this reload and on every reload after it, because the thing that broke the
 * boot is read again at the start of the next one. The way out has to be a
 * button, not an instruction to clear browser storage by hand.
 */
void settled()
  .then(() => shell.preferences.read())
  .then(async (storedPreferences) => {
    stored = storedPreferences
    // An address the page was opened at wins over the place this machine last
    // worked from: it is what was asked for just now, and the preference is
    // what was asked for last time. Before the scope is read, because it
    // decides which source reads it.
    if (!await sourceFromLocation()) await resumed()
    await readRecents()
    // Where a way in is needed first, there is nothing to reopen: the only
    // place a scope could be is where the boot composed, which is exactly what
    // ADR-0003 retired. The first screen asks instead. A place in the fragment
    // (ADR-0033) wins over everything else, read now that the source it is in
    // is open; then an address that named a scope wins over the scope this
    // machine last had open, for the reason the address wins over the source
    // above; a home an address named is not read here at all — it reads its
    // own document once it is up (`scopeToRead`).
    const needed = sourceNeeded()
    const decided = bootDecidedBy(
      needed ? undefined : bootPlace, shell.opensAt, needed ? undefined : readLastScope(storedPreferences),
    )
    if ('place' in decided) {
      renderApp(storedPreferences, { ...await landingAtPlace(decided.place), dialog: askedDialog })
      return
    }
    const lastScope = decided.read
    // After the source opened, so what is read is what it holds now.
    // A scope with no views is a domain (ADR-0012 §1): there is nothing for the
    // canvas to show, so its home opens instead of an empty editor — and a
    // scope an address named opens on its home unless it named a view. A read
    // that keeps the first paint waiting too long lands on the scope's home.
    const landing = lastScope === undefined
      ? landingOf(undefined, shell.opensAt)
      : await reopened(readScope(shell.repositories.scopes, lastScope), lastScope, shell.opensAt)
    renderApp(storedPreferences, { ...landing, dialog: askedDialog })
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
          void shell.preferences.write(kept).catch(reportPreferences)
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
