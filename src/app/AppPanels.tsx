// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What the shell draws, over its parts (`shellParts.ts`): one of its three
 * screens, the home's history, the standing notices and the providers'
 * strips, and the dialogs that outlive a scope.
 */
import Alert from '@mui/material/Alert'
import { LanguageProvider } from '../i18n'
import { sourceIsReadOnly } from '../platform/workingSource'
import { ConnectAgentDialog } from './dialogs/ConnectAgentDialog'
import { PreferencesDialog } from './dialogs/PreferencesDialog'
import { ErrorBoundary } from './ErrorBoundary'
import { HistoryPage } from './history/HistoryPage'
import { SnapshotDialog } from './history/SnapshotDialog'
import { ChooseFolder } from './organisation/ChooseFolder'
import { OrganisationScreen } from './organisation/OrganisationScreen'
import { ProjectWorkspace } from './ProjectWorkspace'
import type { ScopeSnapshot } from '../projects/scope'
import { SyncNotice } from './SyncNotice'
import { AgentDrivingBanner } from './AgentDrivingBanner'
import type { ShellParts } from './shellParts'

/** One of the three: nowhere to keep anything yet, a scope open, or a home. */
export function AppScreen({ parts }: { parts: ShellParts }) {
  const { source, folder, nav } = parts
  if (folder.needed && folder.onChoose && source.kind !== 'folder' && source.kind !== 'registered') {
    /* The desktop, with nowhere to keep anything yet. Not the picker:
       there is nowhere for a project to be until this is answered, and
       offering a list of projects kept inside the app is offering the
       thing ADR-0003 removed. A source a provider answers for is an
       answer to the same question — this screen asks where work should
       live, not which folder it is in, and a build that has connected to
       one and is still being asked has been asked twice. */
    return (
      <ChooseFolder
        recent={folder.recent}
        onChoose={folder.onChoose}
        onOpen={folder.onOpen ?? (() => {})}
        waysIn={parts.provider.offered}
        s={parts.services.s}
        windowChrome={parts.windowChrome}
      />
    )
  }
  if (nav.project) return <OpenWorkspace parts={parts} project={nav.project} />
  return <Home parts={parts} />
}

/** The menu on a host that has none of its own (ADR-0005): the same on both screens. */
function overflowFor<Can extends { history?: boolean; scope: boolean }>(parts: ShellParts, can: Can) {
  const { services: { prefs }, commands: { bus }, folder } = parts
  if (parts.hostMenu) return undefined
  return {
    ...parts.provider.overflowSource,
    themeMode: prefs.themeMode,
    can: { folders: Boolean(folder.onChoose), ...can },
    onCommand: bus.send,
  }
}

function OpenWorkspace({ parts, project }: { parts: ShellParts; project: ScopeSnapshot }) {
  const { props, services: { toasts, prefs, s, reportStorage }, nav, writes, ancestry, prompts, folder, host } = parts
  return (
    <ProjectWorkspace
      // Remounting on a project switch is the mechanism, not an accident:
      // the session's undo stack, aliases and pending batches belong to
      // one project and must not survive into another.
      key={`${project.path}#${nav.reloadKey}`}
      project={project}
      source={{
        store: writes.store,
        watch: nav.watchOpenProject,
        // Two facts about where work is kept that the workspace reads as
        // its own: whether it may be written at all, and what this source
        // means by the words on the bar.
        readOnly: sourceIsReadOnly(parts.source),
        status: props.provider?.status,
        onWork: props.provider?.onWork,
        onSession: parts.provider.takeScopeSession,
        publishesSteps: props.provider?.publishesSteps ?? false,
        onResult: reportStorage,
      }}
      tree={{
        index: parts.tree.index,
        scopes: parts.organisation.tree,
        ancestorDecisions: ancestry.ancestorDecisions,
        groupName: ancestry.groupName,
        groupClient: ancestry.groupClient,
        models: writes.readTreeModels,
        workingSet: writes.readWorkingSet,
        onAdoptScopes: writes.adoptScopes,
        onChanged: writes.treeChanged,
      }}
      navigation={{ crumbs: ancestry.crumbs, onGoHome: nav.goHome, onOpenScope: nav.openScopeAt, initialPage: nav.initialPage }}
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
        askPassword: prompts.password.askPassword,
        landing: prompts.openInto.prompts,
        chooseFolder: folder.onChooseForWorkingFile,
      }}
      snapshots={{ history: folder.history, onTaken: parts.sync.afterSnapshot }}
      agent={{ onSession: parts.agent.registerAgentSession, bar: parts.agentServer.bar }}
      shell={{ s, language: prefs.language, notify: toasts.notify, makeId: props.makeId }}
      preferences={{ initial: prefs.preferences, onChange: prefs.savePreferences }}
    />
  )
}

function Home({ parts }: { parts: ShellParts }) {
  const { props, services: { prefs, s }, nav, findings, folder } = parts
  const { openScopeAt } = nav
  return (
    <OrganisationScreen
      organisation={parts.organisation}
      examples={props.examples}
      order={parts.order.order}
      onOrderChange={parts.order.chooseOrder}
      source={parts.source}
      sourceDescription={props.provider?.description}
      sourceChip={parts.provider.chip}
      onChooseWorkingDirectory={folder.onChoose}
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
      onOpenRegisterRow={(path, id) => openScopeAt(path, { page: 'element', id })}
      onOpenRegisterPage={(path, id) => openScopeAt(path, { page: 'document', id })}
      onLinkFromRegister={(path, id, to) => openScopeAt(path, { page: 'link', id, to })}
      pageRequest={parts.agent.orgPageRequest}
      onPageChange={parts.agent.setOrgPage}
      today={parts.todayDay}
      language={prefs.language}
      s={s}
      windowChrome={parts.windowChrome}
    />
  )
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
        scopes={history.places.map((place) => home.scopeLabel(place.path))}
        onRestore={history.restore}
        onLabel={history.label}
        language={prefs.language}
        s={s}
        windowChrome={parts.windowChrome}
      />
    </>
  )
}

/** The standing notices, and every registered provider's own strip. */
export function AppNotices({ parts }: { parts: ShellParts }) {
  const { props, services: { prefs, s }, sync, agent, provider } = parts
  return (
    <>
      <SyncNotice
        open={sync.diverged}
        onTakeTheirs={() => sync.resolve('theirs')}
        onKeepOurs={() => sync.resolve('ours')}
        s={s}
      />
      <AgentDrivingBanner driving={agent.driving} onStop={agent.stop} s={s} />
      {parts.source.kind === 'memory' && (
        /* Along the bottom rather than above the toolbar: on the desktop that
           bar is the title bar, and anything pushed above it lands under the
           traffic lights. A standing strip is as visible and owes the window
           nothing. */
        <Alert
          severity="warning"
          square
          data-testid="storage-notice"
          sx={{ flex: '0 0 auto', borderRadius: 0, py: 0, fontSize: 12 }}
        >
          {s('shell.storageFailed')}
        </Alert>
      )}
      {provider.chromes.map(({ kind, chrome: Chrome }) => (
        /* Inside the theme and inside the language, so a provider's strip is
           in this person's dark mode and this person's Frisian; beside the
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
            <Chrome session={kind === provider.openProvider ? provider.openScope : undefined} open={agent.openSomewhere} />
          </LanguageProvider>
        </ErrorBoundary>
      ))}
    </>
  )
}

/** The dialogs that outlive a scope: the two file prompts, the preferences and *Connect an agent*. */
export function AppDialogs({ parts }: { parts: ShellParts }) {
  const { props, services: { prefs, s }, machine, agentServer, provider, folder, prompts } = parts
  const { updates, local } = machine
  const AgentPanel = provider.AgentPanel
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
        machine={folder.settings && folder.history && local && { ...local.git, onChange: machine.changeLocal }}
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
