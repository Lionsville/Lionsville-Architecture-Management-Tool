// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The bar at the top: what you are working from, what you have open and how
 * it stands, the three pages beside the canvas, and — on a host with no menu
 * bar — the menu.
 *
 * It reads left to right the way ADR-0005 asks: where you are — the
 * organisation, each scope between, and the open one, as crumbs — with its
 * settings, then the status beside them. Pressing a crumb goes to that
 * scope's home, which is how you leave; the organisation's name is the first
 * crumb and the way back to the first screen. The source left this bar for
 * the root's home, because it is a fact about the folder and the folder is
 * the root. Saving, opening, exporting and the history moved out of here and
 * into the File menu, where ⌘S already was; on the web the overflow at the
 * end carries the same list, and the theme went the same way.
 *
 * Takes no decisions and holds no state except which menu is open. Everything
 * that happens arrives from outside as a function, and there is no file field
 * and no storage in it — which is what lets this component be exercised in a
 * test without an editor, without a model and without browser APIs.
 */
import { useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import useMediaQuery from '@mui/material/useMediaQuery'
import Typography from '@mui/material/Typography'
import type { Language, StringKey, Translate } from '../i18n'
import type { DocumentStatus } from '../projects/documentSession'
import { ancestorScopes, ROOT_SCOPE, scopePathLabel } from '../projects/scopePath'
import type { ScopePath } from '../projects/scopePath'
import type { AgentServerStatus } from '../platform/agentServer'
import { AgentIcon } from '../widgets/icons'
import type { HostCommand } from '../platform/hostCommands'
import type { MenuCapabilities } from '../platform/menu'
import type { ThemeMode } from '../platform/theme'
import { NO_WINDOW_CHROME } from '../platform/windowChrome'
import type { WindowChrome } from '../platform/windowChrome'
import type { WorkingSource } from '../platform/workingSource'
import type { SourceChip, SourceMenuEntry, SourceWorkChanged } from '../platform/sourceProvider'
import { ActivityMenu } from './ActivityMenu'
import type { ActivityEntry } from './ActivityMenu'
import { OverflowMenu } from './OverflowMenu'
import { clockTime } from './clockTime'

/**
 * The word for each state, and the two that have none.
 *
 * `clean` and `no-file` fall through to the timestamp: one has a time worth
 * showing and the other has nothing to say beyond "not yet". Everything else is
 * a word, because a time is an answer to a different question.
 */
const STATUS_LABEL: Partial<Record<DocumentStatus, StringKey>> = {
  dirty: 'shell.unsaved',
  saving: 'shell.saving',
  'external-changed': 'shell.changedOnDisk',
  conflict: 'shell.conflict',
}

/** Red is for what the user has to act on, not for what is merely in flight. */
function alarming(status: DocumentStatus, saveFailed: boolean): boolean {
  return saveFailed || status === 'conflict' || status === 'external-changed'
}

/**
 * What the source is called on the bar. A folder by its name — the name is
 * what the person called it in their file manager, and the path is long.
 *
 * A registered source is called what its provider called it, with no word of
 * ours in front of it: only the provider knows what kind of place it is, and a
 * label invented here would be this shell guessing about somewhere it has
 * never heard of.
 *
 * `chip` is that provider's word for it *now* (`platform/sourceProvider.ts`),
 * which is not always the word the source was opened under: a source somebody
 * has to be known to before it answers anything is called the name it was given
 * at the handshake, and the person can sign out of it without the source
 * changing. So the chip wins where a provider gave one, and `name` is what is
 * left where it did not. A built-in kind reads neither.
 */
export function sourceLabel(source: WorkingSource, s: Translate, chip?: SourceChip): string {
  switch (source.kind) {
    case 'folder': return s('shell.sourceFolder', { name: source.name })
    case 'browserStorage': return s('shell.sourceBrowser')
    case 'memory': return s('shell.sourceMemory')
    case 'registered': return chip?.label ?? source.name
  }
}

/**
 * What the chip says when you hover it: where this actually keeps things, and
 * what that costs you.
 *
 * Beside {@link sourceLabel} because the two answer one question between them,
 * and the organisation's bar and the workspace's must not drift on it.
 *
 * A sentence per built-in kind, because this tree knows what a folder and a
 * browser's storage are and what each of them costs. For a registered source it
 * is the provider's own sentence or nothing at all: `describeKey`, from the
 * registration (`platform/sourceProvider.ts`), in the provider's own table.
 * Nothing rather than a sentence of ours for the reason the LABEL is the
 * provider's — a guess about somewhere this shell has never heard of could
 * promise a copy that cannot be made or a folder that does not exist, and a chip
 * that only says where work is kept is already true.
 */
export function sourceTipKey(
  source: WorkingSource, describeKey?: StringKey | (string & {}), chip?: SourceChip,
): StringKey | (string & {}) | undefined {
  switch (source.kind) {
    case 'folder': return 'shell.sourceTipFolder'
    case 'memory': return 'shell.sourceTipMemory'
    case 'browserStorage': return 'shell.sourceTipBrowser'
    // The provider's word about this moment first, then its standing sentence
    // about where work is kept: a chip that has just been renamed to somebody's
    // name has something else to say on hover than the registration does, and a
    // provider that only renamed it said nothing new and keeps the sentence.
    case 'registered': return chip?.tipKey ?? describeKey
  }
}

/**
 * The one source that says *nothing here will outlive this tab*, and is drawn
 * in the warning colour for it. A registered source that cannot keep anything
 * would be a provider nobody would register.
 */
export function sourceIsAlarming(source: WorkingSource): boolean {
  return source.kind === 'memory'
}

/**
 * One scope above the one on show: its address, and what to call it.
 *
 * The bar's way back, and the way into any level between the organisation
 * and the open scope — a group has a home of its own (`OrganisationScreen`),
 * and before the crumbs the bar named the organisation and the project and
 * left the level between them out.
 */
export type Crumb = { path: ScopePath; name: string }

/**
 * The crumbs above a scope, root first, named from the listing.
 *
 * The listing rather than the loaded ancestors: it is read at boot whatever
 * is up, so the bar says where you are before a single document has been
 * read for it. A scope the listing does not name — a folder somebody removed
 * — is called by its path's last segment, and the root with no name yet by
 * the word for one.
 */
export function crumbsFor(
  of: ScopePath, scopes: readonly { path: ScopePath; name: string }[], s: Translate,
): Crumb[] {
  const byPath = new Map(scopes.map((scope) => [scope.path, scope.name.trim()]))
  return ancestorScopes(of).reverse().map((path) => ({
    path,
    name: byPath.get(path) || (path === ROOT_SCOPE ? s('picker.organisation') : scopePathLabel(path)),
  }))
}

/**
 * Where you are: every scope above, as a button each, and the one on show in
 * bold and not a button — it is where you already are. Shared by this bar and
 * a scope's home, so the two read the same and a crumb means one thing.
 */
export function Crumbs({ crumbs, current, currentPath, onGoHome, s }: {
  crumbs: readonly Crumb[]
  current: string
  /** The open scope's path: its own crumb leads to its home too. */
  currentPath: ScopePath
  onGoHome: (path: ScopePath) => void
  s: Translate
}) {
  // Narrow windows: the crumbs give way before anything else does, the
  // leftmost first — an ancestor's name is the one a reader can most afford
  // to lose — each to an ellipsis rather than a wrap.
  const shrinking = (order: number) => ({
    minWidth: 0, flexShrink: order, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  } as const)
  return (
    <Box data-testid="crumbs" sx={{ display: 'flex', alignItems: 'center', gap: 0.25, minWidth: 0, flexShrink: 1 }}>
      {crumbs.map((crumb, index) => (
        <Box key={crumb.path} sx={{ display: 'flex', alignItems: 'center', gap: 0.25, ...shrinking(crumbs.length - index + 1) }}>
          <Tooltip title={s('shell.crumbTip', { name: crumb.name })}>
            <Button
              size="small"
              color="inherit"
              onClick={() => onGoHome(crumb.path)}
              data-testid={`crumb-${crumb.path}`}
              sx={{
                fontSize: 13, fontWeight: 500, px: 0.75, py: 0,
                textTransform: 'none', color: 'text.secondary',
                ...shrinking(1), display: 'block',
              }}
            >
              {crumb.name}
            </Button>
          </Tooltip>
          <Typography aria-hidden sx={{ fontSize: 12, color: 'text.disabled' }}>›</Typography>
        </Box>
      ))}
      {/* The open scope is a button as well: a page that ends on a canvas with
          nothing to draw — an organisation whose views are all laid out — has
          no other way back to the home it came from. */}
      <Tooltip title={s('shell.crumbTip', { name: current })}>
        <Button
          size="small"
          color="inherit"
          onClick={() => onGoHome(currentPath)}
          data-testid="crumb-current"
          sx={{ fontSize: 13, fontWeight: 700, px: 0.5, py: 0, textTransform: 'none', color: 'text.primary', ...shrinking(1), display: 'block' }}
        >
          {current}
        </Button>
      </Tooltip>
    </Box>
  )
}

/**
 * The agent glyph (ADR-0007): the one place the server's state is visible,
 * and how a person finds out the feature exists. Three states, encoded in the
 * glyph and named in its tooltip.
 */
export type ToolbarAgent = {
  status: AgentServerStatus
  onOpen: () => void
}

/** What the glyph says, per state. */
export function agentTip(status: AgentServerStatus, s: Translate): string {
  switch (status.kind) {
    case 'off': return s('agent.tipOff')
    case 'listening': return s('agent.tipListening', { port: status.port })
    case 'connected': return s('agent.tipConnected', { name: status.client.name })
  }
}

/** The web's overflow. Absent on the desktop, which has a menu bar. */
export type ToolbarOverflow = {
  themeMode: ThemeMode
  can: MenuCapabilities
  onCommand: (command: HostCommand) => void
  /**
   * What the source providers want in the menu, asked for when it opens
   * (`App`'s `SourceMenu`). Absent where no provider registered a line, which
   * is every build in this repository.
   */
  sourceEntries?: () => readonly SourceMenuEntry[]
  /** A provider says its own answer has moved, so an open menu asks again. */
  onSourceWork?: SourceWorkChanged
}

export type ShellToolbarProps = {
  designName: string
  /**
   * Every scope above this one, root first. Shown before the design's name
   * because the same design name in two domains is not only possible, it is
   * the normal case — and each is the way to that scope's home.
   */
  crumbs: readonly Crumb[]
  /** When the store last accepted this design; `null` means never. */
  savedAt: Date | null
  /**
   * Where the document stands — dirty, saving, changed underneath us, or in
   * conflict. `clean` is the ordinary case and shows the time instead, because
   * "Saved · 14:02" says both things at once and a word would say less.
   */
  status?: DocumentStatus
  /**
   * The last write was refused.
   *
   * Shown instead of the time, not beside it: a time from before the failure is
   * older than the work on screen, and an indicator saying "Saved · 14:02"
   * while nothing has been saved since 14:02 is the most expensive kind of
   * wrong this bar can be.
   */
  saveFailed?: boolean
  /**
   * Who else has this scope open, names only — the shell is told, and never
   * works it out (`useModelSession.ts`, `ScopeSession.alsoHere`). Empty for
   * every source that ships, and then the bar says nothing rather than saying
   * that nobody is there.
   */
  alsoHere?: readonly string[]
  language: Language
  /** Leave this scope for the home of one above it, or its own: what a crumb does. */
  onGoHome: (path: ScopePath) => void
  /** The open scope's path, for its own crumb. */
  scopePath: ScopePath
  /** Open the project's own settings: its name and its group. */
  onOpenSettings: () => void
  /**
   * The three pages beside the canvas. Documentation opens on the selected
   * element (the editor resolves which); decisions is the ADR page; search is
   * the one over elements, documentation and decisions together.
   */
  onOpenDocumentation: () => void
  onOpenDecisions: () => void
  /** What was seen, and what lies behind it (ADR-0021). */
  onOpenObservations: () => void
  /** The time axis and the plans over it (ADR-0009). */
  onOpenRoadmap: () => void
  onOpenSearch: () => void
  /**
   * Every change made to this project this session, oldest first — read when
   * the list is opened, not held. A function rather than an array because the
   * stack is a ref: nothing renders from it, and asking for it on every render
   * of this bar would be paying for a list nobody has opened.
   */
  activity: () => readonly ActivityEntry[]
  /** The menu, for a host that has no menu bar. */
  overflow?: ToolbarOverflow
  /** The agent glyph. Present on every host: on the web it opens the explanation. */
  agent?: ToolbarAgent
  s: Translate
  /**
   * What the window leaves to this bar. On the desktop the macOS title bar is
   * hidden behind us, so this bar owns the two things it used to do: keep clear
   * of the traffic lights, and be the surface you drag the window by.
   */
  windowChrome?: WindowChrome
}

export function ShellToolbar({
  designName, crumbs, scopePath, savedAt, status = 'clean', saveFailed = false,
  alsoHere = [], language, onGoHome, onOpenSettings, onOpenDocumentation, onOpenDecisions, onOpenObservations, onOpenRoadmap,
  onOpenSearch, activity,
  overflow, agent, s, windowChrome = NO_WINDOW_CHROME,
}: ShellToolbarProps) {
  const [activityMenu, setActivityMenu] = useState<HTMLElement | null>(null)
  // Half a screen: the status collapses to a dot that says the same thing on
  // hover, before the bar has to wrap or clip.
  const narrow = useMediaQuery('(max-width: 1100px)')

  const quiet = { fontSize: 11, minWidth: 0, px: 1, color: 'text.secondary' } as const
  const statusText = saveFailed
    ? s('shell.saveRefused')
    : STATUS_LABEL[status]
      ? s(STATUS_LABEL[status]!)
      : savedAt ? s('shell.saved', { time: clockTime(savedAt, language) }) : s('shell.notSaved')

  return (
    <Box data-testid="shell-toolbar" sx={{
      display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 0.75,
      borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper', flex: '0 0 auto',
      // The window controls are painted over this bar's start, so the first
      // button begins after them rather than under them. 12px is this bar's own
      // padding — the same `px: 1.5` as on the right, spelled out because it is
      // being added to.
      pl: `${12 + windowChrome.controlsInset}px`,
      // Drag the bar, drag the window — except where something is clickable.
      // Stated once for every control in here, so a button added later cannot
      // quietly become dead surface.
      WebkitAppRegion: windowChrome.draggable ? 'drag' : undefined,
      '& button, & a, & input': { WebkitAppRegion: 'no-drag' },
    }}>
      <Crumbs crumbs={crumbs} current={designName} currentPath={scopePath} onGoHome={onGoHome} s={s} />
      <Tooltip title={s('settings.title')}>
        <Button size="small" color="inherit" onClick={onOpenSettings} sx={quiet}>
          {s('settings.open')}
        </Button>
      </Tooltip>
      <Tooltip title={narrow ? statusText : ''}>
        <Typography
          sx={{ fontSize: 11, color: alarming(status, saveFailed) ? 'error.main' : 'text.secondary', whiteSpace: 'nowrap', flexShrink: 0 }}
          data-testid="saved-indicator"
          aria-label={narrow ? statusText : undefined}
        >
          {narrow ? '●' : statusText}
        </Typography>
      </Tooltip>
      {alsoHere.length > 0 && (
        <Typography
          data-testid="also-here"
          sx={{ fontSize: 11, color: 'text.secondary', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 260 }}
        >
          {s('shell.alsoHere', { names: alsoHere.join(', ') })}
        </Typography>
      )}
      <Box sx={{ flex: 1 }} />
      {([
        ['shell.documentation', 'shell.documentationTip', onOpenDocumentation],
        ['shell.decisions', 'shell.decisionsTip', onOpenDecisions],
        ['shell.observations', 'shell.observationsTip', onOpenObservations],
        ['shell.roadmap', 'shell.roadmapTip', onOpenRoadmap],
        ['shell.search', 'shell.searchTip', onOpenSearch],
      ] as const).map(([label, tip, onClick]) => (
        <Tooltip key={label} title={s(tip)}>
          <Button size="small" color="inherit" onClick={onClick} sx={quiet}>
            {s(label)}
          </Button>
        </Tooltip>
      ))}
      <Tooltip title={s('shell.activityTip')}>
        <Button size="small" color="inherit" onClick={(e) => setActivityMenu(e.currentTarget)} sx={quiet}>
          {s('shell.activity')}
        </Button>
      </Tooltip>
      <ActivityMenu
        anchorEl={activityMenu}
        onClose={() => setActivityMenu(null)}
        entries={activityMenu ? activity() : []}
        language={language}
        s={s}
      />
      {agent && (
        <Tooltip title={agentTip(agent.status, s)}>
          <IconButton
            size="small"
            aria-label={agentTip(agent.status, s)}
            data-testid="agent-glyph"
            data-state={agent.status.kind}
            onClick={agent.onOpen}
            sx={{
              width: 30, height: 30,
              // Dimmed when off, ordinary when listening, the accent when
              // something is actually editing beside the person.
              color: agent.status.kind === 'connected'
                ? 'primary.main'
                : agent.status.kind === 'listening' ? 'text.secondary' : 'text.disabled',
            }}
          >
            <AgentIcon filled={agent.status.kind === 'connected'} />
          </IconButton>
        </Tooltip>
      )}
      {overflow && (
        <OverflowMenu
          themeMode={overflow.themeMode}
          can={overflow.can}
          onCommand={overflow.onCommand}
          sourceEntries={overflow.sourceEntries}
          onSourceWork={overflow.onSourceWork}
          s={s}
        />
      )}
    </Box>
  )
}
