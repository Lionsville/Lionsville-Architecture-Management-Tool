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
import type { MouseEvent, ReactNode } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Popover from '@mui/material/Popover'
import Tooltip from '@mui/material/Tooltip'
import useMediaQuery from '@mui/material/useMediaQuery'
import Typography from '@mui/material/Typography'
import type { Language, StringKey, Translate } from '../i18n'
import type { DocumentStatus } from '../projects/documentSession'
import { ancestorScopes } from '../projects/scopePath'
import type { ScopePath } from '../projects/scopePath'
import type { ScopeSummary } from '../projects/scope'
import { scopeDisplayName } from '../projects/scopeLabel'
import { NO_WINDOW_CHROME } from '../platform/windowChrome'
import type { WindowChrome } from '../platform/windowChrome'
import type { WorkingSource } from '../platform/workingSource'
import type { SourceChip } from '../platform/sourceProvider'
import { ActivityMenu } from './ActivityMenu'
import { BackForward } from './BackForward'
import type { ActivityEntry, ActivityMenuProps } from './ActivityMenu'
import { BarEnd } from './BarEnd'
import type { ToolbarAgent, ToolbarOverflow } from './BarEnd'
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
  'external-changed': 'shell.changedElsewhere',
  conflict: 'shell.conflict',
}

/**
 * The indicator for a source whose changes travel as steps: the source's own
 * word where its provider answers one, and nothing where it does not — never a
 * save time, because nothing is saved. A refused write and the two states a
 * person has to act on keep their words: those are true whatever the source.
 */
export function stepStatusText(
  status: DocumentStatus, saveFailed: boolean, sourceStatus: boolean, s: Translate,
): string {
  if (saveFailed) return s('shell.saveRefused')
  if (status === 'conflict' || status === 'external-changed') return s(STATUS_LABEL[status]!)
  if (!sourceStatus) return ''
  return status === 'dirty' || status === 'saving' ? s('shell.stepsSending') : s('shell.stepsSent')
}

/** The indicator for a source that is written whole: the state's word, or the time of the last save. */
function saveStatusText(
  status: DocumentStatus, saveFailed: boolean, savedAt: Date | null, language: Language, s: Translate,
): string {
  if (saveFailed) return s('shell.saveRefused')
  const word = STATUS_LABEL[status]
  if (word) return s(word)
  return savedAt ? s('shell.saved', { time: clockTime(savedAt, language) }) : s('shell.notSaved')
}

/** Red is for what the user has to act on, not for what is merely in flight. */
function alarming(status: DocumentStatus, saveFailed: boolean): boolean {
  return saveFailed || status === 'conflict' || status === 'external-changed'
}

/**
 * What the source is called on the bar: its provider's word for a source of
 * its kind (`SourceProvider.labelKey`) with the source's name in it — *Folder ·
 * Architecture*, *In this browser* — or, where it gave none, the name alone.
 * No word of ours in front of it: only the provider knows what kind of place
 * it is, and a label invented here would be this shell guessing about
 * somewhere it has never heard of.
 *
 * `chip` is that provider's word for it *now* (`platform/sourceProvider.ts`),
 * which is not always the word the source was opened under: a source somebody
 * has to be known to before it answers anything is called the name it was
 * given at the handshake, and the person can sign out of it without the source
 * changing. So the chip wins where a provider gave one.
 */
export function sourceLabel(
  source: WorkingSource, s: Translate, chip?: SourceChip, labelKey?: StringKey | (string & {}),
): string {
  if (chip) return chip.label
  return labelKey ? s(labelKey as StringKey, { name: source.name }) : source.name
}

/**
 * What the chip says when you hover it: where this actually keeps things, and
 * what that costs you — the provider's word about this moment first, then its
 * standing sentence (`describeKey`). A chip that has just been renamed to
 * somebody's name has something else to say on hover than the registration
 * does, and a provider that only renamed it said nothing new and keeps the
 * sentence. Nothing rather than a sentence of ours: a guess about somewhere
 * this shell has never heard of could promise a copy that cannot be made.
 */
export function sourceTipKey(
  describeKey?: StringKey | (string & {}), chip?: SourceChip,
): StringKey | (string & {}) | undefined {
  return chip?.tipKey ?? describeKey
}

/**
 * The one source that says *nothing here will outlive this tab*, and is drawn
 * in the warning colour for it.
 */
export function sourceIsAlarming(source: WorkingSource): boolean {
  return source.transient === true
}

/**
 * The chip that names where work is kept, as a bar draws it: the source, the
 * provider's sentence and its word for it now, and what pressing it opens.
 */
export type ToolbarChip = {
  source: WorkingSource
  describeKey?: StringKey | (string & {})
  /** The provider's word for a source of its kind (`sourceLabel`). */
  labelKey?: StringKey | (string & {})
  chip?: SourceChip
  /**
   * The provider's panel (`App`'s `SourceChipPanel`), already inside its
   * boundary and the language: drawn under the chip while it is open, and
   * handed the way to shut it.
   */
  panel?: (close: () => void) => ReactNode
  /**
   * The provider's face for it (`App`'s `SourceChipFace`), already inside its
   * boundary and the language: drawn in the chip in place of the label, told
   * whether the panel is open, and handed the label to fall back on.
   */
  face?: (open: boolean, fallback: ReactNode) => ReactNode
}

/**
 * The chip itself: the same on a home's bar and on the workspace's.
 *
 * A real `button` where there is something to press — the provider's `onClick`,
 * its panel, or both — and not a span that listens: this bar is the window's
 * drag surface on the desktop, and the rule that keeps a control clickable
 * inside it names elements (`& button, & a, & input`) rather than whatever
 * happens to have a handler. A span with an `onClick` here would be dead
 * surface that drags the window instead.
 */
export function SourceChipView({ source, describeKey, labelKey, chip, panel, face, s }: ToolbarChip & { s: Translate }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const presses = chip?.onClick !== undefined || panel !== undefined
  const press = (event: MouseEvent<HTMLElement>) => {
    chip?.onClick?.()
    if (panel) setAnchor(event.currentTarget)
  }
  const tip = sourceTipKey(describeKey, chip)
  const label = sourceLabel(source, s, chip, labelKey)
  if (face) {
    return (
      <>
        <FacedChip label={label} tip={tip === undefined ? undefined : s(tip as StringKey)}
          open={anchor !== null} presses={presses} onPress={press} hasPanel={panel !== undefined}>
          {face(anchor !== null, label)}
        </FacedChip>
        {panel && <ChipPanelPopover anchor={anchor} onClose={() => setAnchor(null)} panel={panel} />}
      </>
    )
  }
  return (
    <>
      {/* The sentence about where work is kept: this tree's for a built-in
          kind, the provider's own for a registered source, and — where a
          provider gave none — nothing, which an empty title is how MUI says.
          A guess of ours about somewhere this shell has never heard of could
          promise a copy that cannot be made. */}
      <Tooltip title={tip === undefined ? '' : s(tip as StringKey)} disableFocusListener>
        <Typography
          data-testid="working-source"
          {...(presses ? { component: 'button' as const, type: 'button', onClick: press } : {})}
          sx={{
            fontSize: 11, px: 0.75, py: 0.25, borderRadius: 1, whiteSpace: 'nowrap',
            color: sourceIsAlarming(source) ? 'warning.main' : 'text.secondary',
            border: 1, borderColor: sourceIsAlarming(source) ? 'warning.main' : 'divider',
            // A button brings the browser's own font and background with it,
            // so both are said back to what the chip has always looked like.
            fontFamily: 'inherit', bgcolor: 'transparent',
            cursor: presses ? 'pointer' : undefined,
          }}
        >
          {label}
        </Typography>
      </Tooltip>
      {panel && <ChipPanelPopover anchor={anchor} onClose={() => setAnchor(null)} panel={panel} />}
    </>
  )
}

/**
 * How tall the provider's panel may be: most of the window, and never more
 * than a panel that is read at a glance needs.
 */
export const CHIP_PANEL_MAX_HEIGHT = 'min(640px, calc(100vh - 80px))'

/**
 * The provider's panel, under the chip that opened it: focus goes into it and
 * comes back to the chip when it shuts, and it appears without growing where
 * the person asked their system for less motion.
 *
 * **Never taller than {@link CHIP_PANEL_MAX_HEIGHT}.** The paper is a column
 * that scrolls: a panel that lets one part of itself grow (`flex: 1`,
 * `minHeight: 0`, its own `overflow`) keeps its head and foot in place and
 * scrolls the middle, and one that does not is scrolled whole — either way
 * its last line is on the screen. As wide as what the panel draws, up to the
 * width the popover allows.
 */
function ChipPanelPopover({ anchor, onClose, panel }: {
  anchor: HTMLElement | null
  onClose: () => void
  panel: (close: () => void) => ReactNode
}) {
  const still = useMediaQuery('(prefers-reduced-motion: reduce)')
  return (
    <Popover
      open={anchor !== null}
      anchorEl={anchor}
      onClose={onClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      slotProps={{
        paper: {
          sx: { maxHeight: CHIP_PANEL_MAX_HEIGHT, display: 'flex', flexDirection: 'column', overflowY: 'auto' },
        },
      }}
      {...(still ? { transitionDuration: 0 } : {})}
    >
      {anchor && panel(onClose)}
    </Popover>
  )
}

/**
 * The chip, where the provider drew it a face: the same `button` and the same
 * press, with the face inside it in place of the words.
 *
 * A picture has no name, so the label the face replaced is the button's name,
 * and the tooltip says it — the provider's sentence after it, where it gave
 * one, as the description. Where there is a panel behind the press, the button
 * says so and says whether it is open, which the word chip never needed: a
 * word on a bar reads as a fact, and a face with a panel behind it is a menu
 * button.
 */
function FacedChip({ label, tip, open, presses, onPress, hasPanel, children }: {
  label: string
  tip?: string
  open: boolean
  presses: boolean
  onPress: (event: MouseEvent<HTMLElement>) => void
  hasPanel: boolean
  children: ReactNode
}) {
  return (
    // Not on focus: the panel hands focus back to the chip when it shuts, and a
    // tooltip that opened on that is a layer over the bar the next press can
    // land on instead of the control under it. Hover still says it.
    <Tooltip title={tip === undefined ? label : `${label} — ${tip}`} disableFocusListener>
      <Box
        data-testid="working-source"
        aria-label={label}
        {...(presses
          ? {
            component: 'button' as const, type: 'button', onClick: onPress,
            ...(hasPanel ? { 'aria-haspopup': 'dialog' as const, 'aria-expanded': open } : {}),
          }
          : { role: 'img' })}
        sx={{
          display: 'inline-flex', alignItems: 'center', p: 0, m: 0, border: 0, borderRadius: 999,
          bgcolor: 'transparent', color: 'inherit', font: 'inherit', lineHeight: 0,
          cursor: presses ? 'pointer' : undefined,
          '&:focus-visible': { outline: 2, outlineColor: 'primary.main', outlineOffset: 2 },
        }}
      >
        {children}
      </Box>
    </Tooltip>
  )
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
  of: ScopePath, scopes: readonly ScopeSummary[], s: Translate,
): Crumb[] {
  // One answer to "what is this scope called" (`scopeDisplayName`), the one the
  // register, the map and the history say it with too.
  return ancestorScopes(of).reverse().map((path) => ({
    path,
    name: scopeDisplayName(path, scopes, s('picker.organisation')),
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
    <Box data-testid="crumbs" data-guide="shell.crumbs" sx={{ display: 'flex', alignItems: 'center', gap: 0.25, minWidth: 0, flexShrink: 1 }}>
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

// The glyph and the menu moved to the end both bars share (`BarEnd`); their
// words are still said here, where the callers of this bar read them.
export { agentTip } from './BarEnd'
export type { ToolbarAgent, ToolbarOverflow } from './BarEnd'

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
   * Every change of the open scope travels as a step (`Shell.publishesSteps`),
   * so there is no save to report: "Not saved yet" and "Saved · 14:02" come
   * from a write that never happens, and say something false about work that
   * is already where it is kept. The bar then says what the source says
   * instead — see {@link ShellToolbarProps.sourceStatus} — or nothing.
   */
  publishesSteps?: boolean
  /**
   * The source's provider answers the five words itself (`AppProvider.status`),
   * so `status` is its word and not a file's. Read only where `publishesSteps`:
   * then a clean status is "all sent" and a dirty or saving one is "sending",
   * and without an answer of the provider's own the bar says nothing at all.
   */
  sourceStatus?: boolean
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
  /**
   * What the source's own log says was lately done to this scope, by everybody
   * (`platform/sourceProvider.ts`'s `SourceRecentActivity`, bound to the open
   * scope). Absent where the source keeps none, and the list is the session's.
   */
  recentActivity?: ActivityMenuProps['recent']
  /**
   * Whether the source keeps a log of its own, which the tooltip says: the
   * list is then what was lately done and by whom, and otherwise what was
   * done since the scope was opened. Absent, it is whether there is a list
   * to ask at all.
   */
  activityKept?: boolean
  /** The menu, for a host that has no menu bar. */
  overflow?: ToolbarOverflow
  /** The agent glyph. Present on every host: on the web it opens the explanation. */
  agent?: ToolbarAgent
  /**
   * The chip that names where work is kept, on this bar too: only where the
   * open source's provider gave a word or a panel of its own for it, because
   * a way into something has to be where the person is. Drawn at the right
   * end of the bar, after the agent control and before the menu — the place
   * it has on every home too. Absent for every source that ships, whose chip
   * is on the organisation's home and nowhere else, as it always was.
   */
  sourceChip?: ToolbarChip
  /**
   * The open source's provider's own button (`App`'s `SourceBarButton`),
   * already inside its boundary and the language: drawn after the agent
   * control and before the chip. Absent for every source that ships.
   */
  barButton?: ReactNode
  s: Translate
  /**
   * What the window leaves to this bar. On the desktop the macOS title bar is
   * hidden behind us, so this bar owns the two things it used to do: keep clear
   * of the traffic lights, and be the surface you drag the window by.
   */
  windowChrome?: WindowChrome
}

/**
 * A quiet button in a top bar: it keeps its width. It used to give way to
 * nothing (`minWidth: 0`) and its label spilled over its neighbour's; at 400 %
 * zoom (1.4.10) every label in the bar was drawn over another.
 */
export const QUIET = { fontSize: 11, minWidth: 0, px: 1, color: 'text.secondary', flexShrink: 0, whiteSpace: 'nowrap' } as const

/** A top bar that runs out of width takes a second row, rather than overlapping itself. */
export const WRAPS = { flexWrap: 'wrap', rowGap: 0.5 } as const

export function ShellToolbar({
  designName, crumbs, scopePath, savedAt, status = 'clean', saveFailed = false,
  publishesSteps, sourceStatus, alsoHere = [], language, onGoHome, onOpenSettings, onOpenDocumentation, onOpenDecisions, onOpenObservations, onOpenRoadmap,
  onOpenSearch, activity, recentActivity, activityKept = recentActivity !== undefined,
  overflow, agent, barButton, sourceChip, s, windowChrome = NO_WINDOW_CHROME,
}: ShellToolbarProps) {
  const [activityMenu, setActivityMenu] = useState<HTMLElement | null>(null)
  // Half a screen: the status collapses to a dot that says the same thing on
  // hover, before the bar has to wrap or clip.
  const narrow = useMediaQuery('(max-width: 1100px)')

  const quiet = QUIET
  const statusText = publishesSteps === true
    ? stepStatusText(status, saveFailed, sourceStatus === true, s)
    : saveStatusText(status, saveFailed, savedAt, language, s)

  return (
    <Box data-testid="shell-toolbar" sx={{
      display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 0.75, ...WRAPS,
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
      <BackForward chrome={windowChrome} s={s} />
      <Crumbs crumbs={crumbs} current={designName} currentPath={scopePath} onGoHome={onGoHome} s={s} />
      <Tooltip title={s('settings.title')}>
        <Button size="small" color="inherit" onClick={onOpenSettings} sx={quiet}>
          {s('settings.open')}
        </Button>
      </Tooltip>
      {statusText && <Tooltip title={narrow ? statusText : ''}>
        <Typography
          sx={{ fontSize: 11, color: alarming(status, saveFailed) ? 'error.main' : 'text.secondary', whiteSpace: 'nowrap', flexShrink: 0 }}
          data-testid="saved-indicator"
          aria-label={narrow ? statusText : undefined}
        >
          {narrow ? '●' : statusText}
        </Typography>
      </Tooltip>}
      {alsoHere.length > 0 && (
        <Typography
          data-testid="also-here" data-guide="shell.alsoHere"
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
      {/* Since it was opened, or lately and by whom: which one the list is
          depends on whether the source keeps a log of its own. */}
      <Tooltip title={s(activityKept ? 'shell.activityTipKept' : 'shell.activityTip')}>
        <Button size="small" color="inherit" onClick={(e) => setActivityMenu(e.currentTarget)} sx={quiet} data-guide="shell.activity">
          {s('shell.activity')}
        </Button>
      </Tooltip>
      <ActivityMenu
        anchorEl={activityMenu}
        onClose={() => setActivityMenu(null)}
        entries={activityMenu ? activity() : []}
        {...(recentActivity ? { recent: recentActivity } : {})}
        language={language}
        s={s}
      />
      {/* The chip at the right end, beside the agent control: what it names
          is who and where the person is, which a bar says last, and the
          same place on every screen it is drawn on. */}
      <BarEnd
        agent={agent} button={barButton} chip={sourceChip && <SourceChipView {...sourceChip} s={s} />}
        overflow={overflow} s={s}
      />
    </Box>
  )
}
