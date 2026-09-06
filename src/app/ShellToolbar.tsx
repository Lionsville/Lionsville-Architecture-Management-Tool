/**
 * The bar at the top: what the design is called, when it was last accepted, the
 * three pages beside the canvas, and the four things you can do with the file.
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
import Typography from '@mui/material/Typography'
import type { Language, Translate } from '../i18n'
import type { ThemeMode } from '../projects/preferences'
import { NO_WINDOW_CHROME } from '../platform/windowChrome'
import type { WindowChrome } from '../platform/windowChrome'
import { ActivityMenu } from './ActivityMenu'
import type { ActivityEntry } from './ActivityMenu'
import { SaveMenu } from './SaveMenu'
import { THEME_GLYPH, THEME_LABEL } from './useShellPreferences'

/**
 * The clock in the user's language.
 *
 * `nl-NL` used to be hardcoded here, which gave a Dutch time on an English
 * screen. The locale now follows the language choice — same button, same answer.
 */
export function clockTime(at: Date, language: Language): string {
  return at.toLocaleTimeString(language === 'nl' ? 'nl-NL' : 'en-GB', {
    hour: '2-digit', minute: '2-digit',
  })
}

export type ShellToolbarProps = {
  designName: string
  /**
   * The group this project is filed under — a customer, a department, a
   * programme. Shown beside the design's name because the same design name in
   * two groups is not only possible, it is the normal case.
   */
  groupName: string
  /** When the store last accepted this design; `null` means never. */
  savedAt: Date | null
  /**
   * The last write was refused.
   *
   * Shown instead of the time, not beside it: a time from before the failure is
   * older than the work on screen, and an indicator saying "Saved · 14:02"
   * while nothing has been saved since 14:02 is the most expensive kind of
   * wrong this bar can be.
   */
  saveFailed?: boolean
  language: Language
  themeMode: ThemeMode
  onCycleTheme: () => void
  onSaveWorkingFile: () => void
  onSaveInterchange: () => void
  /** Open the file dialog; the field itself lives elsewhere (`useFilePicker`). */
  onOpenFile: () => void
  /** Leave this project and go back to the picker. */
  onLeave: () => void
  /** Open the project's own settings: its name and its group. */
  onOpenSettings: () => void
  /**
   * The three pages beside the canvas. Documentation opens on the selected
   * element (the editor resolves which); decisions is the ADR page; search is
   * the one over elements, documentation and decisions together.
   */
  onOpenDocumentation: () => void
  onOpenDecisions: () => void
  onOpenSearch: () => void
  /**
   * Every change made to this project this session, oldest first — read when
   * the list is opened, not held. A function rather than an array because the
   * stack is a ref: nothing renders from it, and asking for it on every render
   * of this bar would be paying for a list nobody has opened.
   */
  activity: () => readonly ActivityEntry[]
  s: Translate
  /**
   * What the window leaves to this bar. On the desktop the macOS title bar is
   * hidden behind us, so this bar owns the two things it used to do: keep clear
   * of the traffic lights, and be the surface you drag the window by.
   */
  windowChrome?: WindowChrome
}

export function ShellToolbar({
  designName, groupName, savedAt, saveFailed = false, language, themeMode, onCycleTheme,
  onSaveWorkingFile, onSaveInterchange, onOpenFile, onLeave, onOpenSettings,
  onOpenDocumentation, onOpenDecisions, onOpenSearch, activity, s,
  windowChrome = NO_WINDOW_CHROME,
}: ShellToolbarProps) {
  const [saveMenu, setSaveMenu] = useState<HTMLElement | null>(null)
  const [activityMenu, setActivityMenu] = useState<HTMLElement | null>(null)

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
      <Tooltip title={s('shell.projectsTip')}>
        <Button
          size="small"
          color="inherit"
          onClick={onLeave}
          sx={{ fontSize: 11, minWidth: 0, px: 1, color: 'text.secondary' }}
        >
          {s('shell.projects')}
        </Button>
      </Tooltip>
      <Typography sx={{ fontSize: 13, fontWeight: 700 }}>{designName}</Typography>
      <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{groupName}</Typography>
      <Tooltip title={s('settings.title')}>
        <Button
          size="small"
          color="inherit"
          onClick={onOpenSettings}
          sx={{ fontSize: 11, minWidth: 0, px: 1, color: 'text.secondary' }}
        >
          {s('settings.open')}
        </Button>
      </Tooltip>
      <Box sx={{ width: '1px', alignSelf: 'stretch', my: 0.5, mx: 0.5, borderLeft: 1, borderColor: 'divider' }} />
      {([
        ['shell.documentation', 'shell.documentationTip', onOpenDocumentation],
        ['shell.decisions', 'shell.decisionsTip', onOpenDecisions],
        ['shell.search', 'shell.searchTip', onOpenSearch],
      ] as const).map(([label, tip, onClick]) => (
        <Tooltip key={label} title={s(tip)}>
          <Button
            size="small"
            color="inherit"
            onClick={onClick}
            sx={{ fontSize: 11, minWidth: 0, px: 1, color: 'text.secondary' }}
          >
            {s(label)}
          </Button>
        </Tooltip>
      ))}
      <Tooltip title={s('shell.activityTip')}>
        <Button
          size="small"
          color="inherit"
          onClick={(e) => setActivityMenu(e.currentTarget)}
          sx={{ fontSize: 11, minWidth: 0, px: 1, color: 'text.secondary' }}
        >
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
      <Box sx={{ flex: 1 }} />
      <Typography
        sx={{ fontSize: 11, color: saveFailed ? 'error.main' : 'text.secondary' }}
        data-testid="saved-indicator"
      >
        {saveFailed
          ? s('shell.saveRefused')
          : savedAt ? s('shell.saved', { time: clockTime(savedAt, language) }) : s('shell.notSaved')}
      </Typography>
      <Tooltip title={s('shell.themeTip', { name: s(THEME_LABEL[themeMode]) })}>
        <IconButton
          size="small"
          aria-label={s('shell.theme')}
          onClick={onCycleTheme}
          sx={{ color: 'text.secondary', fontSize: 14, width: 30, height: 30 }}
        >
          {THEME_GLYPH[themeMode]}
        </IconButton>
      </Tooltip>
      <Button size="small" variant="contained" onClick={(e) => setSaveMenu(e.currentTarget)}>
        {s('shell.save')}
      </Button>
      <SaveMenu
        anchorEl={saveMenu}
        onClose={() => setSaveMenu(null)}
        onSaveWorkingFile={onSaveWorkingFile}
        onSaveInterchange={onSaveInterchange}
        s={s}
      />
      <Button size="small" onClick={onOpenFile}>{s('shell.open')}</Button>
    </Box>
  )
}
