/**
 * The bar at the top: what the design is called, when it was last accepted, and
 * the four things you can do with it.
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
import type { Language, Translate } from '@lionsville/solution-design'
import type { ThemeMode } from '../core/preferences'
import { NO_WINDOW_CHROME } from '../core/windowChrome'
import type { WindowChrome } from '../core/windowChrome'
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
  s: Translate
  /**
   * What the window leaves to this bar. On the desktop the macOS title bar is
   * hidden behind us, so this bar owns the two things it used to do: keep clear
   * of the traffic lights, and be the surface you drag the window by.
   */
  windowChrome?: WindowChrome
}

export function ShellToolbar({
  designName, groupName, savedAt, language, themeMode, onCycleTheme,
  onSaveWorkingFile, onSaveInterchange, onOpenFile, onLeave, onOpenSettings, s,
  windowChrome = NO_WINDOW_CHROME,
}: ShellToolbarProps) {
  const [saveMenu, setSaveMenu] = useState<HTMLElement | null>(null)

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
      <Box sx={{ flex: 1 }} />
      <Typography sx={{ fontSize: 11, color: 'text.secondary' }} data-testid="saved-indicator">
        {savedAt ? s('shell.saved', { time: clockTime(savedAt, language) }) : s('shell.notSaved')}
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
