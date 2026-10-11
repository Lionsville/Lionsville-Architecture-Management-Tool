// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The sheet's bar: the way back where the page is a dialog, its name, and
 * what the page does to itself — find, the panels, a picture, its settings,
 * and *Show who is responsible* (ADR-0036, amended 11 October 2026), which
 * names the unit on every area, grouping and capability while it is on. Each
 * is the page's own state, held by the page; the bar draws and asks.
 */
import Box from '@mui/material/Box'
import FormControlLabel from '@mui/material/FormControlLabel'
import IconButton from '@mui/material/IconButton'
import Switch from '@mui/material/Switch'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import type { Translate } from '../../i18n'
import type { barChromeFor } from '../../platform/windowChrome'
import { BackIcon, ExportIcon, EyeIcon, SearchIcon, SlidersIcon } from '../../widgets/icons'

export type SheetBarProps = {
  /** In the tab: no way back, and no window chrome to keep clear of. */
  inline?: boolean
  chrome: ReturnType<typeof barChromeFor>
  /** The sheet's name; absent while there is no sheet, and then only the way back is drawn. */
  name: string | undefined
  readOnly: boolean
  onClose(): void
  finding: boolean
  onFind(anchor: HTMLElement): void
  panelsShown: boolean
  onPanels(): void
  /** Absent: no picture can be handed over. */
  onExport?(): void
  onSettings(): void
  /** *Show who is responsible*, where the host says who is. */
  responsible?: { shown: boolean; onShown(shown: boolean): void }
  t: Translate
}

export function SheetBar(props: SheetBarProps) {
  const { chrome, name, t } = props
  const sheet = name !== undefined
  return (
    <Box
      data-testid="sheet-topbar"
      sx={{
        display: 'flex', flexWrap: 'wrap', rowGap: 0.5, alignItems: 'center', gap: 1, px: 1.5, minHeight: 48, flexShrink: 0,
        pl: props.inline ? undefined : `${12 + chrome.controlsInset}px`,
        WebkitAppRegion: !props.inline && chrome.draggable ? 'drag' : undefined,
        '& button, & a, & input, & label': { WebkitAppRegion: 'no-drag' },
        borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper',
      }}
    >
      {!props.inline && (
        <Tooltip title={t('sheet.close')}>
          <IconButton size="small" aria-label={t('sheet.close')} onClick={props.onClose}>
            <BackIcon />
          </IconButton>
        </Tooltip>
      )}
      <Typography sx={{ fontSize: 13, fontWeight: 700 }}>{name ?? t('sheet.page')}</Typography>
      <Box sx={{ flex: 1 }} />
      {sheet && props.responsible && (
        <FormControlLabel
          data-guide="sheet.showResponsible" data-testid="sheet-show-responsible"
          control={<Switch size="small" checked={props.responsible.shown} onChange={(event) => props.responsible?.onShown(event.target.checked)} />}
          label={<Typography sx={{ fontSize: 12 }}>{t('sheet.showResponsible')}</Typography>}
          sx={{ mr: 0.5 }}
        />
      )}
      {sheet && (
        <Tooltip title={t('sheet.find')}>
          <IconButton size="small" aria-label={t('sheet.find')} aria-expanded={props.finding} onClick={(event) => props.onFind(event.currentTarget)}>
            <SearchIcon size={16} />
          </IconButton>
        </Tooltip>
      )}
      {sheet && (
        <Tooltip title={props.panelsShown ? t('sheet.hidePanels') : t('sheet.showPanels')}>
          <IconButton
            size="small"
            aria-label={props.panelsShown ? t('sheet.hidePanels') : t('sheet.showPanels')}
            aria-pressed={!props.panelsShown}
            onClick={props.onPanels}
          >
            <EyeIcon />
          </IconButton>
        </Tooltip>
      )}
      {sheet && props.onExport && (
        <Tooltip title={t('sheet.export')}>
          <IconButton size="small" aria-label={t('sheet.export')} onClick={props.onExport}>
            <ExportIcon />
          </IconButton>
        </Tooltip>
      )}
      {!props.readOnly && sheet && (
        <Tooltip title={t('sheet.settings')}>
          <IconButton size="small" aria-label={t('sheet.settings')} onClick={props.onSettings}>
            <SlidersIcon />
          </IconButton>
        </Tooltip>
      )}
    </Box>
  )
}
