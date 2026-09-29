// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What the shell draws, over its parts (`shellParts.ts`): one of its three
 * screens, the home's history, the standing notices and the providers'
 * strips, and the dialogs that outlive a scope.
 */
import type { ImageEntry } from '../model/imageName'
import { PicturesProvider } from '../documentation/ui/Pictures'
import { useCallback, useRef } from 'react'
import type { ReactNode } from 'react'
import { LanguageProvider } from '../i18n'
import type { StringKey } from '../i18n'
import { sourceIsReadOnly } from '../platform/workingSource'
import { ConnectAgentDialog } from './dialogs/ConnectAgentDialog'
import { PreferencesDialog } from './dialogs/PreferencesDialog'
import { ErrorBoundary } from './ErrorBoundary'
import { HistoryPage } from './history/lazyHistoryPage'
import { SnapshotDialog } from './history/SnapshotDialog'
import { FirstRun } from './organisation/FirstRun'
import { OrganisationScreen } from './organisation/OrganisationScreen'
import { ProjectWorkspace } from './ProjectWorkspace'
import type { ScopeSnapshot } from '../projects/scope'
import type { ScopePath } from '../projects/scopePath'
import type { ScopeSession } from './useModelSession'
import { watchTreeShape } from './treeShape'
import { AgentDrivingBanner } from './AgentDrivingBanner'
import type { ShellParts } from './shellParts'
import type { SourceChromeProps } from '../ports/ProviderParts'
import { sourceLabel } from './ShellToolbar'
import type { ToolbarChip } from './ShellToolbar'
import { reasonIn } from './messageFor'

/** One of the three: nowhere to keep anything yet, a scope open, or a home. */
export function AppScreen({ parts }: { parts: ShellParts }) {
  const { props, nav } = parts
  if (props.provider?.sourceNeeded) {
    /* Nowhere to keep anything yet, where the host needs a way in taken
       first. Not the picker: there is nowhere for a scope to be until this is
       answered, and offering a list of scopes kept inside the app is offering
       the thing ADR-0003 removed. */
    return <FirstRun waysIn={parts.provider.offered ?? []} s={parts.services.s} windowChrome={parts.windowChrome} />
  }
  if (nav.project) return <OpenWorkspace parts={parts} project={nav.project} />
  return <Home parts={parts} />
}

/** The menu on a host that has none of its own (ADR-0005): the same on both screens. */
function overflowFor<Can extends { history?: boolean; scope: boolean }>(parts: ShellParts, can: Can) {
  const { services: { prefs }, commands: { bus } } = parts
  if (parts.hostMenu) return undefined
  return {
    ...parts.provider.overflowSource,
    themeMode: prefs.themeMode,
    can: { connect: Boolean(parts.provider.offered?.some((way) => way.hostMenu)), ...can },
    onCommand: bus.send,
  }
}

/**
 * May this person change the scope at this path? What the workspace is told
 * about the scope it opens, asked of any scope: the source may be read-only as
 * a whole, or its provider may say so per scope (`AppProvider.readOnlyAt`).
 */
function writableFor(parts: ShellParts): (path: ScopePath) => boolean {
  const { source, props } = parts
  return (path) => !(sourceIsReadOnly(source) || (props.provider?.readOnlyAt?.(path) ?? false))
}

/**
 * What the open scope's session is handed to: the provider's own taker, and —
 * where the source publishes steps — the listener that reads the tree again
 * after a step that changes its shape (`treeShape.ts`). One function, and the
 * same one while neither half changes: the workspace hands its session over
 * again whenever this does.
 */
function useScopeSessionTaker(parts: ShellParts): ((session: ScopeSession) => (() => void) | void) | undefined {
  const take = parts.provider.takeScopeSession
  const publishes = parts.props.provider?.publishesSteps ?? false
  // Read through a ref, never a dependency: `treeChanged` is a new function
  // on every render of the shell (the index hook answers a fresh object), and
  // a taker that changed with it was a session taken back from the provider
  // and handed over again on every render — which a provider that publishes
  // steps answered by sending what it still held a second time, and the far
  // end refused the second create as an id it already had.
  const readAgain = useRef(parts.writes.treeChanged)
  readAgain.current = parts.writes.treeChanged
  // Through a ref for the same reason, and asked at the read: while the source
  // says it is not connected, the read is skipped (`treeShape.ts`).
  const connected = useRef(parts.props.provider?.connected)
  connected.current = parts.props.provider?.connected
  const both = useCallback((session: ScopeSession) => {
    const watching = watchTreeShape(
      session.steps.onChange, () => readAgain.current(), undefined, () => connected.current?.() ?? true,
    )
    const taken = take?.(session)
    return () => {
      watching()
      if (typeof taken === 'function') taken()
    }
  }, [take])
  return publishes ? both : take
}

function OpenWorkspace({ parts, project }: { parts: ShellParts; project: ScopeSnapshot }) {
  const { props, services: { toasts, prefs, s, reportKept }, nav, writes, ancestry, prompts, host } = parts
  const onSession = useScopeSessionTaker(parts)
  return (
    <ProjectWorkspace
      // Remounting on a project switch is the mechanism, not an accident:
      // the session's undo stack, aliases and pending batches belong to
      // one project and must not survive into another.
      key={`${project.path}#${nav.reloadKey}`}
      project={project}
      source={{
        repositories: props.repositories,
        watch: nav.watchOpenProject,
        // Two facts about where work is kept that the workspace reads as
        // its own: whether it may be written at all, and what this source
        // means by the words on the bar.
        readOnly: sourceIsReadOnly(parts.source) || (props.provider?.readOnlyAt?.(project.path) ?? false),
        status: props.provider?.status,
        onWork: props.provider?.onWork,
        onSession,
        chip: workspaceChip(parts),
        publishesSteps: props.provider?.publishesSteps ?? false,
        recentActivity: props.provider?.recentActivity,
        unreadableKey: props.provider?.sayings?.unreadableKey,
        onResult: reportKept,
      }}
      tree={{
        index: parts.tree.index,
        scopeModels: parts.tree.models,
        scopes: parts.organisation.tree,
        ancestorDecisions: ancestry.ancestorDecisions,
        groupName: ancestry.groupName,
        groupClient: ancestry.groupClient,
        models: writes.readTreeModels,
        carryOut: writes.carryOut,
        onAdoptScopes: writes.adoptScopes,
        readScope: writes.readScope,
        onChanged: writes.treeChanged,
      }}
      navigation={{
        crumbs: ancestry.crumbs, onGoHome: nav.goHome, onOpenScope: nav.openScopeAt, onReload: nav.reloadOpenProject, initialPage: nav.initialPage,
      }}
      settings={{ onOpen: parts.organisation.refresh, onApply: writes.applyProjectSettings }}
      host={{
        commands: parts.commands.bus.on,
        hostMenu: parts.hostMenu,
        overflow: overflowFor(parts, { scope: true }),
        onUnsavedWork: host.onUnsavedWork,
        windowChrome: parts.windowChrome,
        controls: props.hostControls,
        diagnostics: props.diagnostics,
      }}
      files={{
        documents: props.documents,
        interchange: props.interchange,
        askPassword: prompts.password.askPassword,
        landing: prompts.openInto.prompts,
        chooseDestination: props.provider?.destination,
      }}
      snapshots={{ history: props.repositories.history, note: historyNote(parts), kept: props.provider?.historyKept }}
      agent={{ onSession: parts.agent.registerAgentSession, bar: parts.agentServer.bar }}
      shell={{ s, language: prefs.language, notify: toasts.notify, makeId: props.makeId }}
      preferences={{ initial: prefs.preferences, onChange: prefs.savePreferences }}
    />
  )
}

function Home({ parts }: { parts: ShellParts }) {
  const { props, services: { prefs, s }, nav, findings, organisation } = parts
  const { openScopeAt } = nav
  // The home's own document shows the home scope's pictures, as a workspace
  // shows its scope's.
  return (
    <PicturesProvider
      source={props.repositories.images}
      scope={organisation.root?.id ?? ''}
      library={organisation.root?.images ?? NO_PICTURES}
      onFailure={parts.services.failed.bind(undefined, 'pictures')}
    >
      <OrganisationScreen
        organisation={parts.organisation}
        examples={props.examples}
        order={parts.order.order}
        onOrderChange={parts.order.chooseOrder}
        source={parts.source}
        sourceDescription={props.provider?.description}
        sourceSayings={props.provider?.sayings}
        sourceChip={parts.provider.chip}
        chipPanel={chipPanelFor(parts)}
        chipFace={chipFaceFor(parts)}
        waysIn={parts.provider.offered}
        // The same two the workspace's bar carries: the menu on a host
        // that has none of its own, and the agent glyph, which has to be
        // reachable with nothing open (ADR-0007). The folder's history, from
        // its front door too (`homeHistory`).
        overflow={overflowFor(parts, { history: parts.home.history.available, scope: false })}
        agent={parts.agentServer.bar}
        onGoHome={nav.goHome}
        findings={findings.treeFindings}
        register={findings.register}
        technology={findings.technology}
        initiatives={findings.initiatives}
        sharedObservations={findings.sharedObservations}
        platformTree={findings.platformTree}
        onOpenRegisterRow={(path, id) => openScopeAt(path, { page: 'element', id })}
        onOpenRegisterPage={(path, id) => openScopeAt(path, { page: 'document', id })}
        onLinkFromRegister={(path, id, to) => openScopeAt(path, { page: 'link', id, to })}
        pageRequest={parts.agent.orgPageRequest}
        onPageChange={parts.agent.setOrgPage}
        writable={writableFor(parts)}
        today={parts.todayDay}
        language={prefs.language}
        s={s}
        windowChrome={parts.windowChrome}
      />
    </PicturesProvider>
  )
}

/** A home with no document has no pictures: the same empty library every time. */
const NO_PICTURES: readonly ImageEntry[] = []

/** Where the source keeps its history, in its provider's sentence, where it gave one. */
function historyNote(parts: ShellParts): string | undefined {
  const key = parts.props.provider?.historyNoteKey
  return key === undefined ? undefined : parts.services.s(key as StringKey)
}

/** The home's snapshot and history, while nothing is open (`useHomeParts`). */
export function HomeHistoryDialogs({ parts }: { parts: ShellParts }) {
  const { services: { prefs, s }, home } = parts
  const { history } = home
  return (
    <>
      <SnapshotDialog
        open={history.dialogOpen}
        keeping={history.keeping}
        draft={history.draft}
        onCancel={history.closeDialog}
        onTake={history.take}
        note={historyNote(parts)}
        s={s}
      />
      <HistoryPage
        open={history.pageOpen}
        onClose={history.closePage}
        entries={history.entries}
        chosen={history.chosen}
        onChoose={history.choose}
        current={home.model}
        subject={history.subject}
        onSubjectChange={history.setSubject}
        scopes={history.places.map((place) => home.scopeLabel(place))}
        onRestore={history.restore}
        onLabel={history.label}
        language={prefs.language}
        s={s}
        windowChrome={parts.windowChrome}
      />
    </>
  )
}

/**
 * What pressing the chip opens, where the open source's provider gave a panel:
 * inside the language and in a boundary of its own, for the reason a chrome is,
 * and handed what a chrome is handed.
 */
function chipPanelFor(parts: ShellParts): ((close: () => void) => ReactNode) | undefined {
  const { props, services: { prefs, s }, provider } = parts
  const Panel = provider.ChipPanel
  if (!Panel) return undefined
  return (close) => (
    <ErrorBoundary where="sourceChipPanel" diagnostics={props.diagnostics} controls={props.hostControls} s={s}>
      <LanguageProvider language={prefs.language}>
        <Panel {...chromeProps(parts, provider.openProvider)} close={close} />
      </LanguageProvider>
    </ErrorBoundary>
  )
}

/**
 * What the chip looks like where the open source's provider drew it a face:
 * inside the language and in a boundary of its own, for the reason a panel is.
 * A face that throws is drawn as nothing, and the chip is then its label again
 * (`SourceChipView`'s `fallback`), which is what it would have said anyway.
 */
function chipFaceFor(parts: ShellParts): ((open: boolean, fallback: ReactNode) => ReactNode) | undefined {
  const { props, services: { prefs, s }, provider } = parts
  const Face = provider.ChipFace
  if (!Face) return undefined
  return (open, fallback) => (
    <ErrorBoundary
      where="sourceChipFace" diagnostics={props.diagnostics} controls={props.hostControls} s={s} fallback={fallback}
    >
      <LanguageProvider language={prefs.language}>
        <Face label={sourceLabel(parts.source, s, provider.chip, props.provider?.sayings?.labelKey)} open={open} />
      </LanguageProvider>
    </ErrorBoundary>
  )
}

/**
 * The chip on the workspace's bar: only where the open source's provider gave a
 * word, a panel or a face for it. Every source that ships has none, and its
 * chip stays on the organisation's home alone.
 */
function workspaceChip(parts: ShellParts): ToolbarChip | undefined {
  const { chip, ChipPanel, ChipFace } = parts.provider
  if (!chip && !ChipPanel && !ChipFace) return undefined
  return {
    source: parts.source, describeKey: parts.props.provider?.description, labelKey: parts.props.provider?.sayings?.labelKey, chip,
    panel: chipPanelFor(parts), face: chipFaceFor(parts),
  }
}

/**
 * What one provider's chrome, or a panel of its own, is handed: the open
 * scope's session and the provider's own parts where it answers for the
 * source that is open, and to nobody else; the way about; and the app's ways
 * of saying something and of keeping a preference.
 */
function chromeProps(parts: ShellParts, kind: string): SourceChromeProps {
  const { services: { prefs, toasts }, agent, provider } = parts
  const opened = kind === provider.openProvider
  return {
    current: opened,
    session: opened ? provider.openScope : undefined,
    own: opened ? provider.own : undefined,
    open: agent.openSomewhere,
    screen: agent.screen ?? agent.screenNow(),
    movedBy: agent.movedBy,
    notify: toasts.notify,
    preferences: { read: prefs.readPreferences, write: prefs.writePreference },
    reread: () => {
      parts.nav.reloadOpenProject()
      parts.writes.treeChanged()
    },
    // A refusal said in the person's words: a chrome says the reason as it is.
    flush: () => (provider.openScope?.flush?.() ?? Promise.resolve()).catch((cause: unknown) => {
      throw new Error(reasonIn(cause, parts.services.s))
    }),
  }
}

/** The standing notices, and every registered provider's own strip. */
export function AppNotices({ parts }: { parts: ShellParts }) {
  const { props, services: { prefs, s }, agent, provider } = parts
  return (
    <>
      <AgentDrivingBanner driving={agent.driving} onStop={agent.stop} s={s} />
      {provider.chromes.map(({ kind, chrome: Chrome }) => (
        /* Inside the theme and inside the language, so a provider's strip is
           in this person's dark mode and this person's German; beside the
           app's own notices rather than around the screens, because it is one
           of them. In a boundary of its own for the reason the canvas has
           one: a strip somebody else wrote falling over must cost the strip
           and not the window — and one boundary EACH, so it does not cost the
           next provider's strip either.

           Every registration, open or not: the provider whose way in has just
           been pressed is by definition not the source yet, and its dialog has
           to be somewhere. The session goes to the one that answers for the
           source that is open, and to nobody else. */
        <ErrorBoundary
          key={kind}
          where="sourceChrome"
          diagnostics={props.diagnostics}
          controls={props.hostControls}
          s={s}
        >
          <LanguageProvider language={prefs.language}>
            <Chrome {...chromeProps(parts, kind)} />
          </LanguageProvider>
        </ErrorBoundary>
      ))}
    </>
  )
}

/** The dialogs that outlive a scope: the two file prompts, the preferences and *Connect an agent*. */
export function AppDialogs({ parts }: { parts: ShellParts }) {
  const { props, services: { prefs, s }, machine, agentServer, provider, prompts } = parts
  const { updates } = machine
  const AgentPanel = provider.AgentPanel
  const PreferencesPanel = provider.PreferencesPanel
  return (
    <>
      {prompts.password.dialog}
      {prompts.openInto.dialogs}
      {/* Invisible; the home's Open… clicks it. Beside the dialog rather than on
          the screen, because the home does not own the working file either. */}
      {parts.nav.project ? null : parts.home.picker.input}
      <PreferencesDialog
        open={machine.open}
        onClose={() => machine.setOpen(false)}
        language={prefs.language}
        onLanguageChange={prefs.chooseLanguage}
        themeMode={prefs.themeMode}
        onThemeChange={prefs.chooseTheme}
        order={parts.order.order}
        onOrderChange={parts.order.chooseOrder}
        updates={parts.host.updateSettings && updates && {
          checkAutomatically: updates.checkAutomatically, channel: updates.channel, onChange: machine.changeUpdates,
        }}
        sourcePanel={PreferencesPanel && (
          <ErrorBoundary
            where="sourcePreferencesPanel"
            diagnostics={props.diagnostics}
            controls={props.hostControls}
            s={s}
          >
            <PreferencesPanel own={provider.own} notify={parts.services.toasts.notify} />
          </ErrorBoundary>
        )}
        s={s}
      />
      <ConnectAgentDialog
        open={agentServer.dialogOpen}
        onClose={agentServer.closeDialog}
        status={props.agent ? agentServer.status : undefined}
        onEnabledChange={agentServer.changeEnabled}
        onNewToken={agentServer.newToken}
        copyText={props.hostControls.copyText}
        /* Built here rather than named there, so the dialog stays a dialog: it
           places what it is handed, and the session, the trail and the
           boundary are this file's to wire. The boundary is the chromes'
           reasoning inside a dialog — a panel somebody else wrote falling over
           must cost the panel and not the window. */
        sourcePanel={AgentPanel && (
          <ErrorBoundary
            where="sourceAgentPanel"
            diagnostics={props.diagnostics}
            controls={props.hostControls}
            s={s}
          >
            <AgentPanel session={provider.openScope} />
          </ErrorBoundary>
        )}
        s={s}
      />
    </>
  )
}
