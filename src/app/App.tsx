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
import type { Diagnostic, DiagnosticEntry } from '../platform/diagnostics'
import { reasonOf, ShellError } from '../platform/errors'
import { messageFor } from './messageFor'
import { flattenScopes, namesUnder } from '../projects/scope'
import type { ScopeKind, ScopeSnapshot } from '../projects/scope'
import {
  contentOf, everyScope, modelsOf, moveScope, picturesOf, placeTogether, readScope, refusedError, stepOf, summaryOf,
} from '../projects/scopeAccess'
import type { RecordLink } from '../projects/links'
import { SCOPE_MOVED } from '../projects/revision'
import type { Repositories } from '../ports/Repositories'
import { parentScope, ROOT_SCOPE, scopePathFor, scopePathLabel } from '../projects/scopePath'
import type { ScopePath } from '../projects/scopePath'
import { NO_WINDOW_CHROME } from '../platform/windowChrome'
import { sourceIsReadOnly } from '../platform/workingSource'
import type { SourceMenuEntry } from '../platform/sourceProvider'
import type {
  SourceAgentPanelProps, SourceChipFaceProps, SourceChipPanelProps, SourceChromeProps, SourceMenuContext, SourceOpen,
  SourcePreferencesPanelProps,
} from '../ports/ProviderParts'
import { ErrorBoundary } from './ErrorBoundary'
import { useOrganisation } from './organisation/useOrganisation'
import type { ProjectSettings } from './ProjectSettingsDialog'
import { ToastBar } from './ToastBar'
import { usePasswordPrompt } from './usePasswordPrompt'
import { useOpenIntoPrompt } from './useOpenIntoPrompt'
import { useAgentServer } from './useAgentServer'
import { AppDialogs, AppNotices, AppScreen, HomeHistoryDialogs } from './AppPanels'
import type { AppHost, AppProps } from './appProps'
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
 *
 * `screen` is where the app is, as `app.current` tells the agent (ADR-0019's
 * `Screen`): the scope that is open with its view and the page over it, or
 * the home that is up and its page. The other half of `open` — a chrome that
 * can send a person somewhere can see when they have arrived, and a strip
 * about a place can say nothing while the person is somewhere else — and
 * the same words, so the two cannot drift. A new value each time the screen
 * moves and the same one while it does not, so a chrome may compare it.
 *
 * `movedBy` is who moved the app there ({@link MovedBy}): an agent can move it
 * as a person can (ADR-0019), and a chrome that waits for somebody to arrive
 * somewhere may care which of them did. Said of the move that produced
 * `screen`, and handed with it.
 */
export type SourceChrome = ComponentType<SourceChromeProps>

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
export type { SourceOpen }

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
export type SourceAgentPanel = ComponentType<SourceAgentPanelProps>

/**
 * What a provider puts inside *Preferences* about its own source: what this
 * person does about it on this machine — pull when it opens, push after an
 * entry is recorded, where a source has somewhere to push to.
 *
 * The analogue of {@link SourceAgentPanel} in the other dialog, and for the
 * same reasons: asked of the open source's provider alone, because the
 * dialog is about this window and the source it works from; drawn under the
 * app's own sections in a boundary of its own. Handed what the provider
 * handed with its parts (`own`), which is where it finds the source it is
 * about.
 */
export type SourcePreferencesPanel = ComponentType<SourcePreferencesPanelProps>

/**
 * What pressing the chip that names a registered source opens: a panel of the
 * provider's own, anchored to the chip.
 *
 * The chip's `onClick` (`platform/sourceProvider.ts`) can only run something,
 * and what a name on a bar is usually a way into — who is signed in, what they
 * can reach from here, a short account of where the work stands — is
 * something to show beside it. Without this a provider's chrome would have to
 * draw a popover of its own and find the chip in the page to hang it from,
 * which is the second app in the same window that `chrome` exists to stop.
 *
 * So the shell draws it: under the chip, inside the theme and the language, in
 * a boundary of its own, and wherever the chip is — on every home and on the
 * workspace's bar, which every page opens beneath. It is handed what a chrome
 * is handed ({@link SourceChrome}) and `close`, which shuts it; Escape and a
 * press outside shut it too. Asked of the open source's provider alone, as the
 * chip is. On the registration beside `chrome`, and core's three register none.
 */
export type SourceChipPanel = ComponentType<SourceChipPanelProps>

/**
 * What the chip that names a registered source looks like, where a word is not
 * the whole of it: a small component of the provider's own, drawn inside the
 * chip in place of its label.
 *
 * A chip's `label` is a string, and a string cannot say what a picture of a
 * person says at a glance — who is signed in, as a face or their initials, and
 * a mark beside it that something is waiting behind the press. A provider that
 * wanted that could only draw it somewhere else and point at the chip.
 *
 * So the shell keeps what makes the chip a chip — the one `button`, the press,
 * the panel under it, the tooltip, the place on both bars — and hands the face
 * two facts: `label`, the provider's word for it now, which stays the chip's
 * accessible name and its tooltip because a picture has none; and `open`,
 * whether the panel under it is showing. Drawn inside the theme and the
 * language, in a boundary of its own, so a face that falls over costs the face
 * and the chip goes back to its label. It should be small: it sits in a bar
 * that is the window's drag surface on the desktop, beside the crumbs.
 *
 * Asked of the open source's provider alone, as the chip is. On the
 * registration beside `chipPanel`, and core's three register none, so their
 * chip is the word it always was.
 */
export type SourceChipFace = ComponentType<SourceChipFaceProps>

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
export type { SourceMenuContext }

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
   * what every field above does. Present and different is a move: the scope
   * and everything under it go to their new addresses together, identities and
   * all (`ScopeRepository.move`).
   */
  parent?: ScopePath
}

export type { AppBoot, AppHost, AppProps, AppProvider } from './appProps'

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
  const { agent, diagnostics, repositories } = props
  const base = useShellBase(props)
  const { source, host, services, nav, tree, agentServer, commands, organisation, refreshTree } = base
  const { toasts, s, failedRef } = services
  const { project } = nav

  const restoreIntoHome = useCallback((command: Command) => {
    const held = organisation.root
    if (!held?.id) return
    // Expecting what the screen read. A restore is not made again over a scope
    // that moved: it was worked out from what the page showed, and putting back
    // a version over changes the person never saw is not what they chose — so
    // the refusal is said, and the page reads the scope as it stands now.
    void repositories.scopes.apply([{ scope: held.id, steps: [stepOf(command)], expects: held.revision }]).then(
      (answer) => {
        if (!('refused' in answer)) { organisation.refresh(); tree.refresh(); return }
        if (answer.refused === SCOPE_MOVED) {
          toasts.notify(s(SCOPE_MOVED), 'warning')
          organisation.refresh()
          return
        }
        failedRef.current('organisation.restore', refusedError(answer.refused), 'group.saveFailed')
      },
      (cause: unknown) => failedRef.current('organisation.restore', cause, 'group.saveFailed'),
    )
  }, [organisation, repositories, tree, toasts, s, failedRef])
  /**
   * The tree's records, read when a gesture asks (ADR-0012 §10), and the two
   * things to do again once one has landed: the listing this screen shows, and
   * the index everything below it decides ownership by.
   */
  const readTreeModels = useCallback(async () => modelsOf(await repositories.index.read()), [repositories])
  /** Every scope in full, for the working file (ADR-0018). Read on the gesture, never held. */
  const readWorkingSet = useCallback(() => everyScope(repositories), [repositories])
  /**
   * The scopes an opened working file brought with it, written where they say
   * they belong (ADR-0018): each a content that arrives whole, landed as one
   * apply over every scope it names — every content or none, so a refusal
   * part way leaves no scope holding half of the file (ADR-0023, amendment 2).
   * The scopes that were not there are made first, shallowest first, and
   * taken away again where the contents are refused; a page that dies between
   * the two may leave one of them there, empty. Each landing expects what was
   * read of its scope, so one somebody changed in between refuses the whole,
   * and nothing of the file's contents is written.
   */
  const adoptScopes = useCallback(async (held: readonly ScopeSnapshot[]) => {
    try {
      await placeTogether(repositories, held.map((scope) => ({
        address: scope.path, content: contentOf(scope, []), pictures: picturesOf(scope.imageLibrary),
      })))
    } catch (cause) {
      throw new ShellError('shell.workingFileNotLanded', {
        reason: cause instanceof ShellError ? messageFor(cause, s) : reasonOf(cause),
      })
    }
  }, [repositories, s])
  /** One scope as it is kept now: what an opened working file is read back through (ADR-0023, amended). */
  const readScopeAt = useCallback((path: ScopePath) => readScope(repositories.scopes, path), [repositories])
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
    organisation, home: nav.home, setHome: nav.setHome, scopeOpen: project !== undefined, repositories,
    index: tree.index, restore: restoreIntoHome, documents: props.documents,
    workingSet: readWorkingSet,
    readScope: readScopeAt,
    adopt: async (held) => {
      await adoptScopes(held)
      treeChanged()
    },
    ...prompts, chooseDestination: props.provider?.destination,
    doors: { history: commands.homeHistory, files: commands.homeFiles }, notify: toasts.notify, s,
  })
  const findings = useTreeFindings({ index: tree.index, tree: organisation.tree, home: nav.home, scopes: repositories.scopes })
  const applyProjectSettings = useProjectSettings({ base, repositories })

  const ancestry = useScopeAncestry({ project, scopes: repositories.scopes, tree: organisation.tree, failedRef, s })
  const shellAgent = useShellAgent({
    gateway: agent, status: agentServer.status, tree: findings.shellTree, project, home: nav.home,
    homeName: home.name, organisationName: organisation.tree.name, goHome: nav.goHome,
    openScopeAt: nav.openScopeAt, notify: toasts.notify, s,
    watchScreen: (props.provider?.chrome?.length ?? 0) > 0 || props.provider?.chipPanel !== undefined,
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
    props, source, host, hostMenu: host.hostMenu ?? false, windowChrome: host.windowChrome ?? NO_WINDOW_CHROME,
    services, nav, tree, organisation, findings, home, ancestry, agentServer, agent: shellAgent, machine,
    commands, provider, order, prompts, todayDay,
    writes: { readTreeModels, readWorkingSet, adoptScopes, readScope: readScopeAt, treeChanged, applyProjectSettings },
  }
}

/**
 * The open scope's own settings (`ProjectSettingsDialog`): the name and the
 * defaults are the session's to change, as the commands they are, and the
 * workspace has made them by the time this is asked; what is left here is
 * where it is filed. A move takes the scope and everything under it to the
 * new address, identities and all, and the workspace is entered again there.
 */
function useProjectSettings({ base, repositories }: { base: ReturnType<typeof useShellBase>; repositories: Repositories }) {
  const { services, nav, tree } = base
  const { toasts, s, failed, reportKept } = services
  const { enter } = nav
  return useCallback(async (settings: ProjectSettings, current: ScopeSnapshot): Promise<void> => {
    const from = parentScope(current.path) ?? ROOT_SCOPE
    if (settings.group === from) {
      toasts.notify(s('settings.renamed', { name: settings.name }), 'success')
      return
    }
    try {
      const listing = summaryOf(await repositories.scopes.tree())
      // A name free under the old parent can be taken under the new one.
      const parent = flattenScopes(listing).find((scope) => scope.path === settings.group)
      const taken = namesUnder(parent)
      const to = taken.includes(scopePathLabel(current.path))
        ? scopePathFor(settings.group, settings.name, taken)
        : scopePathFor(settings.group, scopePathLabel(current.path))
      const moved = await moveScope(repositories.scopes, repositories.index, current.path, to)
      if (!moved) return
      enter(moved)
      tree.refresh()
      toasts.notify(s('settings.moved', { name: settings.name }), 'success')
    } catch (cause) {
      // A refusal is the repository's answer, said in its words; anything
      // else is the place work is kept not answering, which the notice says.
      if (cause instanceof ShellError) { failed('applyProjectSettings.move', cause, cause.key); return }
      failed('applyProjectSettings.move', cause)
      reportKept(false)
    }
  }, [repositories, enter, tree, toasts, failed, reportKept, s])
}

/** The services, where the shell is, the tree, the host's doors and the organisation screen. */
function useShellBase(props: AppProps) {
  const { repositories, diagnostics, hostControls, boot, agent, today = localToday } = props
  const source = props.source
  const changes = props.provider?.changes
  // The way in the host names: *Open…* in its menu, and its Recent list.
  const hostWay = props.provider?.waysIn?.find((way) => way.hostMenu)
  const host: AppHost = props.host ?? NOTHING
  const services = useShellServices({
    preferences: props.preferences, initialPreferences: boot.initialPreferences, browserLanguages: boot.browserLanguages,
    keepFailure: props.provider?.keepFailure, diagnostics,
  })
  const { toasts, prefs, s, reportKept, failed, failedRef } = services
  // Read once per render rather than per card: a finding re-derived because a
  // millisecond passed is a model walked again for nothing.
  const todayDay = useMemo(() => today(), [today])
  const refreshTree = useRef<() => void>(() => {})
  /** The index read again; bound once the index below exists, as `refreshTree` is. */
  const refreshIndex = useRef<() => void>(() => {})
  /**
   * May this person change the scope at this path? The question the workspace
   * asks of the scope it opens (`AppPanels`), asked here of any scope: a home
   * offers nothing that writes where the answer is no, and a page opened on a
   * scope with no document writes one only where it is yes.
   */
  const readOnlyAt = props.provider?.readOnlyAt
  const writable = useCallback(
    (path: ScopePath) => !(sourceIsReadOnly(source) || (readOnlyAt?.(path) ?? false)),
    [source, readOnlyAt],
  )
  const nav = useShellNavigation({
    initialProject: boot.initialProject, initialHome: boot.initialHome, scopes: repositories.scopes,
    changes, prefs, failedRef, refreshTree, refreshIndex, writable,
  })
  const { project, enter } = nav
  const tree = useTreeIndex(repositories.index, changes, failed)
  refreshIndex.current = tree.refresh
  const agentServer = useAgentServer({ agent, failedRef, notify: toasts.notify, s })
  const machine = useMachineSettings({
    updateSettings: host.updateSettings, failedRef, notify: toasts.notify, s,
    initiallyOpen: boot.opensDialog === 'preferences',
  })
  const commands = useShellCommands({
    commands: host.commands, onConnect: hostWay?.onConnect, onReopen: hostWay?.onReopen, prefs,
    openPreferences: machine.setOpen, openAgent: agentServer.openDialog, hostControls,
  })
  useOpeningFailures({ failure: boot.sourceFailure, failureKey: boot.sourceFailureKey, notify: toasts.notify, s })
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
    repositories,
    active: project === undefined,
    at: nav.home,
    onEnter: enter,
    onTreeChanged: tree.refresh,
    notify: toasts.notify,
    onFailure: failed,
    onKeptResult: reportKept,
    writable,
    s,
  })
  refreshTree.current = organisation.refresh
  return {
    source, host, services, todayDay, nav, tree, agentServer, machine, commands, order,
    organisation, refreshTree,
  }
}
