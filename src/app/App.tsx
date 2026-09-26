// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The shell. Two states: you are in a project, or you are choosing one.
 *
 * What used to be here — the session, the toolbar, the dialogs — moved to
 * {@link ProjectWorkspace}, because all of it only means something once a
 * project is open. What remains is the part that outlives a project: the theme,
 * the language, the toasts, and which project you are in.
 *
 * Every capability arrives as a prop, typed as the narrowest shape that will do.
 * `App` genuinely needs most of a store — it lists, loads, saves and removes —
 * but the hooks below it do not, and each asks for its own slice. Nothing here
 * knows whether a project lives in browser storage, on disk or on a server.
 */
import { useCallback, useMemo, useRef } from 'react'
import type { ComponentType } from 'react'
import Box from '@mui/material/Box'
import CssBaseline from '@mui/material/CssBaseline'
import { ThemeProvider } from '@mui/material/styles'
import type { Command, ElementId } from '../model'
import { apply, fromArrays, toArrays } from '../model'
import type { Diagnostic, DiagnosticEntry } from '../platform/diagnostics'
import { reasonOf } from '../platform/errors'
import { flattenScopes, moveScope, namesUnder, renameScope, setScopeDefaults, unreadableAt } from '../projects/scope'
import type { ScopeKind, ScopeModel, ScopeSnapshot, ScopeSummary } from '../projects/scope'
import { applyRefPatch } from '../projects/readdress'
import { treeModels, treeScopes } from '../projects/scopeIndex'
import type { RecordLink } from '../projects/links'
import { isScopeMoved, SCOPE_MOVED } from '../projects/revision'
import { parentScope, ROOT_SCOPE, scopePathFor, scopePathLabel } from '../projects/scopePath'
import type { ScopePath } from '../projects/scopePath'
import { NO_WINDOW_CHROME } from '../platform/windowChrome'
import { useSync } from './useSync'
import { BROWSER_STORAGE } from '../platform/workingSource'
import type { SourceMenuEntry } from '../platform/sourceProvider'
import { ErrorBoundary } from './ErrorBoundary'
import { carryRefs } from './carryRefs'
import { useOrganisation } from './organisation/useOrganisation'
import type { ScopeSession } from './useModelSession'
import type { ProjectSettings } from './ProjectSettingsDialog'
import { ToastBar } from './ToastBar'
import type { Destination } from '../agent/screen'
import { usePasswordPrompt } from './usePasswordPrompt'
import { useOpenIntoPrompt } from './useOpenIntoPrompt'
import { useAgentServer } from './useAgentServer'
import { AppDialogs, AppNotices, AppScreen, HomeHistoryDialogs } from './AppPanels'
import type { AppFolder, AppHost, AppProps } from './appProps'
import { useHomeParts } from './useHomeParts'
import { useMachineSettings } from './useMachineSettings'
import { useProviderParts } from './useProviderParts'
import { useScopeAncestry } from './useScopeAncestry'
import { useShellAgent } from './useShellAgent'
import { useHostFacts, useShellCommands, useWindowTitle } from './useShellCommands'
import { useShellNavigation } from './useShellNavigation'
import { useOpeningFailures, useProjectOrder, useShellServices } from './useShellServices'
import { useTreeFindings, useTreeIndex } from './useTreeFindings'
import type { ShellParts } from './shellParts'

/**
 * What `App` does to a store.
 *
 * Spelled out rather than named, so the workspace and the picker below can each
 * be handed a smaller slice of it and a reader can see that they were.
 */
/**
 * What the shell does to the diagnostics seam: reports, and — for the crash
 * fallback it hands the trail to — reads back.
 */
export type ShellDiagnostics = {
  report(entry: Diagnostic): void
  recent(): DiagnosticEntry[]
}

/**
 * A screen of the source provider's own, drawn inside this shell.
 *
 * Everything else a provider brings is a store, a setting or a function; some of
 * what it has to do is a *strip*, a badge, a dialog — settle two changes that
 * disagree, say it is reconnecting, ask for an address again. The provider owns
 * what it draws, for the same reason it owns its way in: what has to be said
 * there is its business, and a shell that tried to describe all of it would be a
 * shell edited for the fifth provider.
 *
 * What this shell owes is somewhere to put it. Without one the only place left
 * is a container of the provider's own on `document.body` — outside the theme,
 * outside the language, above or below whatever the app has drawn — which is a
 * second app in the same window wearing the wrong colours. So it renders here:
 * inside the theme and inside the language, beside the app's own notices, on
 * every screen, with the session of the scope that is open while one is.
 *
 * `session` is absent where nothing is open, which is most of the time on the
 * organisation screen and all of the time on the first-run screen. A provider
 * that has nothing to say then draws nothing, which is what `null` is for.
 *
 * **It is drawn for every registered provider, open or not.** A chrome that
 * arrived with the parts of an opened source was a chrome no unopened provider
 * had: the first press of its way in had nowhere to draw the dialog that asks
 * where to connect to, which is the one screen a provider needs BEFORE it is
 * the source. So the boot hands over one per registration
 * (`composition.ts`'s `registeredChrome`) and this shell draws them all, giving
 * `session` to the one whose provider answers for the open source and to no
 * other.
 *
 * **So a chrome must be idempotent about its own state.** It is mounted while
 * its provider is nobody's source, and mounted again — a fresh component, with
 * fresh state — when a source opens, because the app is keyed on the working
 * source. Whatever it has to remember across that (a handshake in flight, a
 * dialog left open, a subscription) belongs where the provider keeps it and not
 * in this component, and being mounted twice over one session must cost nothing
 * but a render.
 *
 * `open` is the way out of the notice: a provider's chrome may have to send the
 * person to a scope — the one its sentence names — and a sentence that names a
 * place without being a way to it is a sentence that asks somebody to go and
 * find it in the tree. It is {@link SourceOpen}, so what a chrome can ask for is
 * what the agent can ask for (ADR-0019) and not a second grammar for the same
 * three words.
 */
export type SourceChrome = ComponentType<{ session?: ScopeSession; open: SourceOpen }>

/**
 * Sending the person to a scope, as a provider's chrome or a menu line may.
 *
 * The same {@link Destination} ADR-0019 gave the agent — a scope path, a page
 * and an id — bound to the same shell functions `app.open` moves the app with.
 * A provider knows a path and nothing about this shell's screens: which of them
 * a destination lands on, whether a home or a workspace answers for it, and what
 * *open* costs when another scope is already open are all decided in one place,
 * here, and would otherwise be decided a second time by everybody composing over
 * this build.
 *
 * `scope` absent means the scope that is open, which is what it means to the
 * agent; with nothing open it is the home that is up. Nothing comes back: a
 * scope is read before it is entered and a path that names nothing is a refreshed
 * tree, which is the same answer *Open …* gives a person.
 */
export type SourceOpen = (to: Destination) => void

/**
 * One provider's chrome, and which provider's it is.
 *
 * The kind it registered under, because that is what says whether the open
 * source is this provider's: `sourceProviderKind` answers the same question
 * from the other side, and a chrome handed a session belonging to somebody
 * else's source would be a strip describing a document its provider has never
 * seen.
 */
export type RegisteredChrome = {
  readonly kind: string
  readonly chrome: SourceChrome
}

/**
 * What a provider puts inside *Connect an agent* (ADR-0007) for its own source.
 *
 * That dialog is about one way of reaching this landscape: a server on this
 * machine, on the loopback, which only the desktop can listen on — so in a
 * browser tab the whole of it is a paragraph saying to open the app instead.
 * That sentence is true about the loopback and false about the question the
 * person asked, once the source their work is kept in can be reached by an agent
 * some other way: it tells them to go somewhere else to do a thing that can be
 * done here.
 *
 * So the provider answering for the open source fills that space in. In a tab it
 * takes the paragraph's place, because the paragraph is the alternative to
 * nothing and this is a better one. On the desktop it is drawn under the
 * loopback section rather than instead of it: both ways in exist there, the
 * switch is still this machine's, and hiding one of two true answers to pick a
 * favourite is not this shell's call.
 *
 * Handed the session of the open scope, as a chrome is ({@link SourceChrome}) —
 * that dialog can be opened from a home with nothing open, so it may be absent.
 * Drawn in a boundary of its own for the same reason: a panel somebody else
 * wrote falling over must cost the panel and not the window. On the
 * registration, beside `chrome` and `menu`, and core's three register none.
 */
export type SourceAgentPanel = ComponentType<{ session?: ScopeSession }>

/**
 * What a provider is told when it is asked what it wants in the menu.
 *
 * The same two facts the workspace reads about a source before it draws
 * anything: the scope that is open as whoever answers for the source sees it —
 * absent for every provider but the one whose source is open, exactly as with
 * {@link SourceChrome}, and absent for that one too while nothing is open — and
 * whether work here may be written at all. A provider that offers *Share this
 * scope…* has both questions answered before it decides whether to offer it,
 * which is the whole reason the lines are asked for rather than registered once.
 *
 * It names a `ScopeSession`, which is why the lines are declared on the
 * registration in `composition.ts` beside `chrome` and not in `platform/`: what
 * a line IS is a `SourceMenuEntry` and lives down there, where a test with no
 * DOM can read it.
 */
export type SourceMenuContext = {
  readonly session?: ScopeSession
  readonly readOnly: boolean
  /**
   * Sending the person to a scope ({@link SourceOpen}), for a line that is a
   * way somewhere rather than something done here — the same call a chrome is
   * given, because a line and a strip are two shapes of the one thing a
   * provider has to say.
   */
  readonly open: SourceOpen
}

/**
 * The lines one provider wants in the app's own menu, asked for afresh.
 *
 * A function and not a list, because what a provider offers moves: signed in or
 * not, a scope open or not, work in flight or not. It is asked when the menu is
 * opened and again whenever the provider says its own answer has moved
 * (`onSourceWork`), which are the two moments the person can see the difference.
 */
export type SourceMenu = (context: SourceMenuContext) => readonly SourceMenuEntry[]

/** One provider's menu lines, and which provider's they are. */
export type RegisteredMenu = {
  readonly kind: string
  readonly menu: SourceMenu
}

/**
 * Which page the workspace should be showing the moment it appears.
 *
 * The organisation's own pages are reached from the cards on its screen, and
 * the root scope that holds them usually draws nothing at all — its decisions,
 * its plans and its business architecture are what it has, and a canvas is not.
 * Without this, pressing *Open* on a card would land a person on an empty board
 * with the page they asked for still shut.
 *
 * Shell vocabulary rather than either screen's: one screen says it and the
 * other obeys it, and a type that lived in either would make them import each
 * other.
 */
export type InitialPage =
  /** The decisions page, on one record when an id is given (ADR-0019). */
  | { page: 'decisions'; id?: string }
  /** The observations page (ADR-0021), on one observation or cause when an id is given. */
  | { page: 'observations'; id?: string }
  | { page: 'roadmap' }
  /** A platform's report, or a service's (ADR-0013, ADR-0014): derived, opened by id, never made. */
  | { page: 'platform'; id: ElementId }
  | { page: 'service'; id: ElementId }
  /** A sheet by id, or — with none — the one the scope is about to be given. */
  | { page: 'sheet'; id?: string }
  /** The enterprise map, likewise. */
  | { page: 'map'; id?: string }
  /** The technology landscape (ADR-0015), likewise. */
  | { page: 'technology'; id?: string }
  /** One plan, on its page over the roadmap — an initiative opened where it lives (ADR-0012 §7). */
  | { page: 'plan'; id: string }
  /**
   * A record, selected on the board that draws it — a row of the register,
   * opened where it is answered for.
   */
  | { page: 'element'; id: ElementId }
  /**
   * A record's page — the document and the record's fields — opened in the
   * scope that answers for it, which is where the fields may be written.
   */
  | { page: 'document'; id: ElementId }
  /** The documentation page as the bar opens it: on the selected element, or the first. */
  | { page: 'documentation' }
  /** One board, made the active one — a row of the views table on a landscape's home. */
  | { page: 'board'; id: string }
  /**
   * Not a page, and here anyway: *link* (ADR-0012 §10), asked the moment the
   * scope opens.
   *
   * A gesture is applied by the session that holds the scope — one `Command`,
   * one undo step, one Activity line — so the register's *Link…* cannot do it
   * where it stands. What it can do is open the scope that should yield and
   * ask there, which is this.
   */
  | { page: 'link'; id: ElementId; to: ScopePath }

export type ScopeLibrary = {
  list(): Promise<ScopeSummary>
  load(path: ScopePath): Promise<ScopeSnapshot | undefined>
  /** See `ScopeStore.save`: a save may say what it expects to overwrite. */
  save(scope: ScopeSnapshot, expects?: string): Promise<void>
  remove(path: ScopePath): Promise<void>
  /**
   * Every scope's records and rows, for the index (ADR-0012 §2). Optional on
   * the seam and optional here; `indexOf` loads each scope where a store
   * cannot answer it.
   */
  models?(): Promise<ScopeModel[]>
  /** One scope's prose, for the stand-ins an overview draws (ADR-0012 §3). Optional the same way. */
  descriptions?(path: ScopePath): Promise<Record<string, string> | undefined>
}

/** What the settings dialogs may change about a scope, whatever level it is. */
export type ScopeSettingsPatch = {
  name: string
  client?: string
  description?: string
  links?: RecordLink[]
  kind?: ScopeKind
  /**
   * Where it is filed, when that is what changed.
   *
   * Absent means "leave the address alone", which is what a rename does and
   * what every field above does. Present and different is a move: save the
   * subtree at its new addresses, then remove the old folder — never the other
   * way round.
   */
  parent?: ScopePath
}

export type { AppBoot, AppFolder, AppHost, AppProps, AppProvider } from './appProps'

/** A group nobody filled in: every field in it is optional. */
const NOTHING = {} as const

function localToday(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

export function App(props: AppProps) {
  const parts = useShellParts(props)
  const { prefs, s, toasts } = parts.services
  return (
    /* The theme lives here and not at module level: it hangs off state (light /
       dark / system) and must be able to change with it. CssBaseline sits inside
       it, because that is what paints the page background. */
    <ThemeProvider theme={prefs.theme}>
      <CssBaseline />
      <Box sx={{ height: '100vh', width: '100vw', display: 'flex', flexDirection: 'column' }}>
        {/* Inside the theme, so the fallback is painted in the user's colours,
            and around the two screens rather than around everything: a crash
            must not take the toast bar with it. */}
        <ErrorBoundary where="app" diagnostics={props.diagnostics} controls={props.hostControls} s={s}>
          <AppScreen parts={parts} />
        </ErrorBoundary>
        {!parts.nav.project && <HomeHistoryDialogs parts={parts} />}
        <AppNotices parts={parts} />
        <AppDialogs parts={parts} />
        <ToastBar
          toast={toasts.toast}
          open={toasts.open}
          onClose={toasts.close}
          onExited={toasts.exited}
        />
      </Box>
    </ThemeProvider>
  )
}

/**
 * Every piece of the shell's state, one hook per concern, composed in the
 * order they read each other: the services and where the shell is first, the
 * tree and the host's doors next, the organisation screen and what the open
 * scope is handed after, and the agent and the providers last. The writes
 * that read a scope, change it and put it back whole are this function's own
 * and stay here, where the store is.
 */
function useShellParts(props: AppProps): ShellParts {
  const { agent, diagnostics } = props
  const base = useShellBase(props)
  const { projects, source, folder, host, services, nav, sync, tree, agentServer, commands, organisation, refreshTree } = base
  const { toasts, s, reportStorage, failed, failedRef } = services
  const { project, enter } = nav

  /**
   * An address this app has just moved a project away from.
   *
   * A move is save-here, remove-there, and the workspace showing the project is
   * still mounted in between — with an autosave that could land on the old
   * address a millisecond after it was removed and put the project back. Two
   * copies, and the one the user goes on editing is the one that will disappear
   * next time.
   *
   * A ref and not state: closing this window needs the guard to be true NOW,
   * not after React has rendered. Cleared once the workspace has been given the
   * new address, which remounts it.
   */
  const movedAway = useRef<ScopePath | undefined>(undefined)
  const workspaceStore = useMemo(() => ({
    save: (held: ScopeSnapshot) => (
      movedAway.current === held.path ? Promise.resolve() : projects.save(held)
    ),
    load: (path: ScopePath) => projects.load(path),
    ...(projects.descriptions ? { descriptions: (path: ScopePath) => projects.descriptions!(path) } : {}),
  }), [projects])
  const restoreIntoHome = useCallback((command: Command) => {
    const held = organisation.root
    if (!held) return
    const result = apply(fromArrays(held.model), command)
    if (!result.ok) { toasts.notify(s(result.reason), 'error'); return }
    // Expecting what the screen read. A restore is not made again over a scope
    // that moved: it was worked out from what the page showed, and putting back
    // a version over changes the person never saw is not what they chose — so
    // the refusal is said, and the page reads the scope as it stands now.
    void projects.save({ ...held, model: toArrays(result.model) }, held.revision).then(
      () => { organisation.refresh(); tree.refresh() },
      (cause: unknown) => {
        if (isScopeMoved(cause)) {
          toasts.notify(s(SCOPE_MOVED), 'warning')
          organisation.refresh()
          return
        }
        failedRef.current('organisation.restore', cause, 'group.saveFailed')
      },
    )
  }, [organisation, projects, tree, toasts, s])
  /**
   * The tree's records, read when a gesture asks (ADR-0012 §10), and the two
   * things to do again once one has landed: the listing this screen shows, and
   * the index everything below it decides ownership by.
   */
  const readTreeModels = useCallback(() => treeModels(projects), [projects])
  /** Every scope in full, for the working file (ADR-0018). Read on the gesture, never held. */
  const readWorkingSet = useCallback(() => treeScopes(projects), [projects])
  /**
   * The scopes an opened working file brought with it, written where they say
   * they belong (ADR-0018).
   *
   * Shallowest first, which is the order `openDocumentBytes` answers in: a
   * child written before its parent would be filed under a folder that is not a
   * scope yet.
   */
  const adoptScopes = useCallback(async (held: readonly ScopeSnapshot[]) => {
    for (const scope of held) await projects.save(scope)
  }, [projects])
  const treeChanged = useCallback(() => {
    refreshTree.current()
    tree.refresh()
  }, [tree])

  /**
   * The one password dialog (ADR-0023), drawn here and lent to whichever of
   * the two file flows is asking: the workspace's, with a scope open, or the
   * home's below, with nothing open.
   */
  const prompts = { password: usePasswordPrompt(s), openInto: useOpenIntoPrompt(s) }
  const home = useHomeParts({
    organisation, home: nav.home, setHome: nav.setHome, scopeOpen: project !== undefined, history: folder.history,
    index: tree.index, restore: restoreIntoHome, onSnapshotTaken: sync.afterSnapshot, documents: props.documents,
    workingSet: readWorkingSet,
    adopt: async (held) => {
      await adoptScopes(held)
      treeChanged()
    },
    ...prompts, chooseFolder: folder.onChooseForWorkingFile,
    doors: { history: commands.homeHistory, files: commands.homeFiles }, notify: toasts.notify, s,
  })
  const findings = useTreeFindings({ index: tree.index, tree: organisation.tree, home: nav.home, projects })

  /**
   * Change a scope's name, where it is filed, or both.
   *
   * A rename edits the model in place. A move changes the address, so the store
   * has to take the new one before it forgets the old — that order matters:
   * removing first and then failing to save would lose the scope outright.
   *
   * The edit is made on `current` — the scope as the open session has it, not
   * as this component last saw it. Those two drift apart with every stroke of
   * editing, and applying settings to the stale one would write a model without
   * this afternoon's work over the model with it.
   *
   * What comes back is the saved scope when the workspace stays mounted, so the
   * session can take it on: without that, the session keeps a model that knows
   * nothing of the new defaults and the next autosave puts it back. Nothing
   * comes back from a move, because a move changes the address and the
   * workspace remounts on it anyway.
   */
  const applyProjectSettings = useCallback((
    settings: ProjectSettings,
    current: ScopeSnapshot,
  ): Promise<ScopeSnapshot | undefined> => {
    return projects.list().then(async (held) => {
      const targetGroup = settings.group
      const moving = targetGroup !== (parentScope(current.path) ?? ROOT_SCOPE)
      const named = setScopeDefaults(renameScope(current, settings.name), {
        author: settings.defaultAuthor,
        aspectConfig: settings.defaultAspectConfig,
      })
      let next = named

      if (moving) {
        // A name free under the old parent can be taken under the new one.
        const parent = flattenScopes(held).find((scope) => scope.path === targetGroup)
        const taken = namesUnder(parent)
        next = moveScope(named, taken.includes(scopePathLabel(current.path))
          ? scopePathFor(targetGroup, settings.name, taken)
          : scopePathFor(targetGroup, scopePathLabel(current.path)))
      }

      const moved = moving && current.path !== next.path
      // A move writes the scope at its new address and removes the old folder,
      // so a file the read did not take in would go with the folder and not
      // arrive at the other end (`ScopeSnapshot.unread`).
      if (moved && current.unread?.length) {
        failed('applyProjectSettings.unread', undefined, 'shell.unreadNotMoved')
        return undefined
      }
      // And a scope the listing could not read at the new address would be
      // written over by the move (`unreadableAt`).
      if (moved && unreadableAt(held, next.path) !== undefined) {
        failed('applyProjectSettings.unreadable', undefined, 'shell.unreadableInTheWay')
        return undefined
      }
      // A ref is an address, and a move carries the ones pointing into this
      // scope (ADR-0012 §3) — the same pass the organisation screen's move
      // makes, because it is the same act from a different dialog.
      if (moved) {
        try {
          const carried = await carryRefs({ scopes: projects, from: current.path, to: next.path })
          next = applyRefPatch(next, carried.get(current.path))
        } catch (cause) {
          failed('applyProjectSettings.readdress', cause)
          reportStorage(false)
          return undefined
        }
      }

      // Before the save, so nothing can write to the old address from the
      // moment this app stops considering it ours.
      if (moving) movedAway.current = current.path
      try {
        await projects.save(next)
      } catch (cause) {
        failed('applyProjectSettings.save', cause)
        reportStorage(false)
        movedAway.current = undefined
        return undefined
      }
      if (moved) {
        // Inside the guard, not after it. The save has landed, so the project
        // exists at both addresses; a remove that throws here used to do so
        // silently and leave a duplicate for the user to find in the picker
        // weeks later. The move itself still counts as done.
        try {
          await projects.remove(current.path)
        } catch (cause) {
          failed('applyProjectSettings.remove', cause)
          toasts.notify(s('shell.moveLeftCopy', { message: reasonOf(cause) }), 'warning')
        }
      }
      enter(next)
      movedAway.current = undefined
      toasts.notify(
        moving
          ? s('settings.moved', { name: settings.name })
          : s('settings.renamed', { name: settings.name }),
        'success',
      )
      return moved ? undefined : next
    }, (cause: unknown) => {
      failed('applyProjectSettings.list', cause)
      reportStorage(false)
      return undefined
    })
  }, [projects, enter, toasts, failed, reportStorage, s])

  const ancestry = useScopeAncestry({ project, projects, tree: organisation.tree, failedRef, s })
  const shellAgent = useShellAgent({
    gateway: agent, status: agentServer.status, tree: findings.shellTree, project, home: nav.home,
    homeName: home.name, organisationName: organisation.tree.name, goHome: nav.goHome,
    openScopeAt: nav.openScopeAt, notify: toasts.notify, s,
  })
  useWindowTitle({
    onTitle: host.onTitle, project, groupName: ancestry.groupName, organisationName: organisation.tree.name,
    home: nav.home, homeName: home.name,
  })
  const provider = useProviderParts({
    provider: props.provider ?? NOTHING, source, diagnostics, openSomewhere: shellAgent.openSomewhere,
  })
  const { machine, order, todayDay } = base
  return {
    props, source, folder, host, hostMenu: host.hostMenu ?? false, windowChrome: host.windowChrome ?? NO_WINDOW_CHROME,
    services, nav, sync, tree, organisation, findings, home, ancestry, agentServer, agent: shellAgent, machine,
    commands, provider, order, prompts, todayDay,
    writes: { store: workspaceStore, readTreeModels, readWorkingSet, adoptScopes, treeChanged, applyProjectSettings },
  }
}

/** The services, where the shell is, the tree, the host's doors and the organisation screen. */
function useShellBase(props: AppProps) {
  const { scopes: projects, diagnostics, hostControls, boot, agent, today = localToday } = props
  const source = props.source ?? BROWSER_STORAGE
  const folder: AppFolder = props.folder ?? NOTHING
  const host: AppHost = props.host ?? NOTHING
  const services = useShellServices({
    preferences: props.preferences, initialPreferences: boot.initialPreferences, browserLanguages: boot.browserLanguages,
    storageFailure: props.provider?.storageFailure, diagnostics,
  })
  const { toasts, prefs, s, reportStorage, failed, failedRef } = services
  // Read once per render rather than per card: a finding re-derived because a
  // millisecond passed is a model walked again for nothing.
  const todayDay = useMemo(() => today(), [today])
  const refreshTree = useRef<() => void>(() => {})
  const nav = useShellNavigation({
    initialProject: boot.initialProject, projects, watchProject: folder.watch, prefs, failedRef, refreshTree,
  })
  const { project, enter } = nav
  const sync = useSync({
    history: folder.history, folderSettings: folder.settings, initial: boot.initialSync,
    onTheirs: nav.reloadOpenProject, notify: toasts.notify, s, diagnostics,
  })
  const tree = useTreeIndex(projects, folder.watch, failed)
  const agentServer = useAgentServer({ agent, failedRef, notify: toasts.notify, s })
  const machine = useMachineSettings({
    updateSettings: host.updateSettings, folderSettings: folder.settings, history: folder.history,
    failedRef, notify: toasts.notify, s,
  })
  const commands = useShellCommands({
    commands: host.commands, onChooseFolder: folder.onChoose, onOpenFolder: folder.onOpen, prefs,
    openPreferences: machine.setOpen, openAgent: agentServer.openDialog, hostControls,
  })
  useOpeningFailures({ folderFailure: boot.folderFailure, sourceFailure: boot.sourceFailure, notify: toasts.notify, s })
  useHostFacts({ project, onScopeOpen: host.onScopeOpen, themeMode: prefs.themeMode, onThemeMode: host.onThemeMode })
  const order = useProjectOrder(prefs)

  /**
   * The organisation screen's wiring (`useOrganisation`).
   *
   * Called whatever is on screen, because the tree it holds is what the open
   * workspace's settings dialog offers as a parent to file under — and because
   * a hook cannot be called conditionally. It reads the root's own document
   * only while its screen is up, which is the one read on this path that costs
   * anything.
   */
  const organisation = useOrganisation({
    scopes: projects,
    active: project === undefined,
    at: nav.home,
    onEnter: enter,
    onTreeChanged: tree.refresh,
    notify: toasts.notify,
    onFailure: failed,
    onStorageResult: reportStorage,
    s,
  })
  refreshTree.current = organisation.refresh
  return {
    projects, source, folder, host, services, todayDay, nav, sync, tree, agentServer, machine, commands, order,
    organisation, refreshTree,
  }
}
