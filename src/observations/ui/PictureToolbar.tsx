// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The controls over the three tabs (ADR-0032 §2, §8): *Filters* with the
 * count of those that are on and the clear button beside it while any is,
 * *View local*, the picture's two sizes and its zoom, and the count of what
 * is shown — and, under them while *Filters* is on, the filter row itself.
 *
 * Presentational: what the controls mean is `usePictureFilters`, which the
 * page hands in whole.
 */
import type { ReactNode } from 'react'
import Badge from '@mui/material/Badge'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Divider from '@mui/material/Divider'
import FormControlLabel from '@mui/material/FormControlLabel'
import IconButton from '@mui/material/IconButton'
import InputAdornment from '@mui/material/InputAdornment'
import Switch from '@mui/material/Switch'
import TextField from '@mui/material/TextField'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import type { Translate } from '../../i18n'
import { AddIcon, CloseIcon, FilterIcon, FitIcon, MinusIcon, SearchIcon } from '../../widgets/icons'
import type { Filters } from '../filter'
import type { PictureSize } from '../graph'
import { SavedPopover, ScopesPopover } from './FilterPopovers'
import type { ScopeOption } from './FilterPopovers'
import { ZOOM } from './usePictureFilters'
import type { PictureFilters } from './usePictureFilters'

export type PictureToolbarProps = {
  f: PictureFilters
  /** Which tab is up: the sizes and the zoom are the picture's, and the Solutions tab has no scopes below. */
  tab: 'register' | 'analysis' | 'solutions'
  scopeLabel: (path: string) => string
  s: Translate
}

const Rule = () => <Divider orientation="vertical" flexItem sx={{ mx: 0.5, my: 0.5 }} />

export function PictureToolbar({ f, tab, scopeLabel, s }: PictureToolbarProps) {
  const { result } = f
  const count = result.filtering
    ? s('observation.shownOf', { shown: result.shown, total: result.total })
    : s('observation.shownAll', { count: result.total })
  return (
    <>
      <Box
        data-testid="picture-toolbar"
        sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1, px: 1.5, py: 0.75, borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper' }}
      >
        <Tooltip title={f.rowOpen ? s('observation.filtersHide') : s('observation.filtersShow')}>
          <Button
            size="small"
            variant={f.rowOpen ? 'outlined' : 'text'}
            startIcon={<FilterIcon size={15} />}
            onClick={f.toggleRow}
            aria-pressed={f.rowOpen}
            data-testid="filters-toggle"
            data-guide="observations.filters"
            sx={{ textTransform: 'none' }}
          >
            <Badge badgeContent={f.active} color="primary" sx={{ '& .MuiBadge-badge': { position: 'static', transform: 'none', ml: 1 } }}>
              {s('observation.filters')}
            </Badge>
          </Button>
        </Tooltip>
        {f.active > 0 && (
          <Tooltip title={s('observation.filtersClear')}>
            <IconButton size="small" aria-label={s('observation.filtersClear')} onClick={f.clear} data-testid="filters-clear">
              <CloseIcon size={15} />
            </IconButton>
          </Tooltip>
        )}
        {tab !== 'solutions' && <><Rule /><LocalSwitch f={f} s={s} /></>}
        {tab === 'analysis' && <><Rule /><SizeSwitch f={f} s={s} /><Rule /><ZoomControls f={f} s={s} /></>}
        <Box sx={{ flex: 1 }} />
        <Typography variant="caption" color="text.secondary" data-testid="picture-count" sx={{ fontVariantNumeric: 'tabular-nums' }}>
          {count}{f.hiddenLocal > 0 ? ` · ${s('observation.localHidden', { count: f.hiddenLocal })}` : ''}
        </Typography>
      </Box>
      {f.rowOpen && <FilterRow f={f} scopeLabel={scopeLabel} s={s} />}
    </>
  )
}

function LocalSwitch({ f, s }: { f: PictureFilters; s: Translate }) {
  return (
    <Tooltip title={f.hasBelow ? s('observation.viewLocalTip') : s('observation.viewLocalNone')}>
      {/* A span, so the tooltip still says why while the switch is off for want of scopes below. */}
      <Box component="span" data-guide="observations.viewLocal">
        <FormControlLabel
          sx={{ mx: 0 }}
          disabled={!f.hasBelow}
          control={<Switch size="small" color="info" checked={f.viewLocal} onChange={(event) => f.setViewLocal(event.target.checked)} data-testid="view-local" />}
          label={<Typography sx={{ fontSize: 13 }}>{s('observation.viewLocal')}</Typography>}
        />
      </Box>
    </Tooltip>
  )
}

function SizeSwitch({ f, s }: { f: PictureFilters; s: Translate }) {
  const option = (value: PictureSize, label: string, tip: string) => (
    <Tooltip title={tip}>
      <ToggleButton value={value} data-testid={`picture-size-${value}`} sx={{ px: 1.25, py: 0.25, textTransform: 'none' }}>{label}</ToggleButton>
    </Tooltip>
  )
  return (
    <ToggleButtonGroup
      exclusive
      size="small"
      value={f.view.size}
      onChange={(_event, value: PictureSize | null) => { if (value) f.view.setSize(value) }}
      aria-label={s('observation.size')}
      data-guide="observations.size"
    >
      {option('large', s('observation.sizeLarge'), s('observation.sizeLargeTip'))}
      {option('small', s('observation.sizeSmall'), s('observation.sizeSmallTip'))}
    </ToggleButtonGroup>
  )
}

function ZoomControls({ f, s }: { f: PictureFilters; s: Translate }) {
  const { view } = f
  const button = (label: string, icon: ReactNode, onClick: () => void, testId: string, pressed?: boolean) => (
    <Tooltip title={label}>
      <IconButton size="small" aria-label={label} onClick={onClick} data-testid={testId} aria-pressed={pressed} color={pressed ? 'primary' : 'default'}>{icon}</IconButton>
    </Tooltip>
  )
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
      {button(s('observation.zoomFit'), <FitIcon size={16} />, view.fitNow, 'picture-fit', view.fit)}
      {button(s('observation.zoomOut'), <MinusIcon size={15} />, () => view.zoomTo(view.zoom - ZOOM.step), 'picture-zoom-out')}
      <Typography variant="caption" color="text.secondary" data-testid="picture-zoom" sx={{ minWidth: 40, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
        {Math.round(view.zoom * 100)}%
      </Typography>
      {button(s('observation.zoomIn'), <AddIcon size={15} />, () => view.zoomTo(view.zoom + ZOOM.step), 'picture-zoom-in')}
    </Box>
  )
}

/** One text filter: a short label in the box, an example as its placeholder, and what it keeps on hover. */
function FilterField(props: {
  field: Exclude<keyof Filters, 'scopesOff'>
  short?: string
  label: string
  example: string
  tip: string
  f: PictureFilters
}) {
  const { field, f } = props
  const value = f.filters[field]
  return (
    <Tooltip title={props.tip}>
      <TextField
        size="small"
        value={value}
        onChange={(event) => f.setFilters({ ...f.filters, [field]: event.target.value })}
        placeholder={props.example}
        data-testid={`filter-${field}`}
        slotProps={{
          htmlInput: { 'aria-label': props.label, autoComplete: 'off' },
          input: {
            startAdornment: (
              <InputAdornment position="start" sx={{ color: 'text.secondary' }}>
                {props.short
                  ? <Typography component="span" sx={{ fontSize: 11, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase' }}>{props.short}</Typography>
                  : <SearchIcon size={14} />}
              </InputAdornment>
            ),
          },
        }}
        sx={{
          width: 190,
          '& .MuiInputBase-input': { fontSize: 13, py: 0.75 },
          ...(value.trim() ? { '& .MuiOutlinedInput-notchedOutline': { borderColor: 'primary.main', borderWidth: 2 } } : {}),
        }}
      />
    </Tooltip>
  )
}

function FilterRow({ f, scopeLabel, s }: { f: PictureFilters; scopeLabel: (path: string) => string; s: Translate }) {
  const here = f.inView[0]?.scope
  const scopes: ScopeOption[] = f.inView.map((one) => ({ path: one.scope, label: scopeLabel(one.scope), here: one.scope === here }))
  return (
    <Box
      role="search"
      aria-label={s('observation.filters')}
      data-testid="filter-row"
      data-guide="observations.filterRow"
      sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1, px: 1.5, py: 1, borderBottom: 1, borderColor: 'divider', bgcolor: 'background.default' }}
    >
      <ScopesPopover scopes={scopes} off={f.filters.scopesOff} onChange={(scopesOff) => f.setFilters({ ...f.filters, scopesOff })} s={s} />
      <FilterField f={f} field="observations" short={s('observation.filterObs')} label={s('observation.filterObsField')} example={s('observation.filterObsExample')} tip={s('observation.filterObsTip')} />
      <FilterField f={f} field="causes" short={s('observation.filterCause')} label={s('observation.filterCauseField')} example={s('observation.filterCauseExample')} tip={s('observation.filterCauseTip')} />
      <FilterField f={f} field="roots" short={s('observation.filterRoot')} label={s('observation.filterRootField')} example={s('observation.filterRootExample')} tip={s('observation.filterRootTip')} />
      <FilterField f={f} field="search" label={s('observation.filterSearchField')} example={s('observation.filterSearchField')} tip={s('observation.filterSearchTip')} />
      <Box sx={{ flex: 1 }} />
      <SavedPopover
        list={f.saved.list}
        canSave={f.active > 0}
        onSave={f.saved.save}
        onRecall={f.saved.recall}
        onDelete={f.saved.remove}
        s={s}
      />
    </Box>
  )
}
