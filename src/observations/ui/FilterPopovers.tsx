// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The two popovers of the filter row (ADR-0032 §8): which scopes are shown,
 * with a field that narrows a long list; and the saved filters, recalled from
 * a list, deleted one at a time, and saved under a name the person gives.
 */
import { useState, type ReactNode } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Checkbox from '@mui/material/Checkbox'
import FormControlLabel from '@mui/material/FormControlLabel'
import IconButton from '@mui/material/IconButton'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemText from '@mui/material/ListItemText'
import Popover from '@mui/material/Popover'
import TextField from '@mui/material/TextField'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import type { Translate } from '../../i18n'
import { matchesQuery } from '../../model/textSearch'
import { BookmarkIcon, CaretIcon, CloseIcon, ScopeIcon } from '../../widgets/icons'
import type { Filters, SavedFilter } from '../filter'

/** A button in the filter row that opens a popover under itself. */
function PopoverButton(props: {
  label: ReactNode
  tip: string
  icon: ReactNode
  on?: boolean
  testId: string
  children: (close: () => void) => ReactNode
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const close = () => setAnchor(null)
  return (
    <>
      <Tooltip title={props.tip}>
        <Button
          size="small"
          variant="outlined"
          color={props.on ? 'primary' : 'inherit'}
          startIcon={props.icon}
          endIcon={<CaretIcon />}
          onClick={(event) => setAnchor(event.currentTarget)}
          aria-haspopup="dialog"
          aria-expanded={anchor !== null}
          data-testid={props.testId}
          sx={{ textTransform: 'none', whiteSpace: 'nowrap', borderColor: props.on ? undefined : 'divider' }}
        >
          {props.label}
        </Button>
      </Tooltip>
      <Popover
        open={anchor !== null}
        anchorEl={anchor}
        onClose={close}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        slotProps={{ paper: { sx: { p: 1.5, width: 300 }, role: 'dialog', 'aria-label': props.tip } as object }}
      >
        {props.children(close)}
      </Popover>
    </>
  )
}

export type ScopeOption = { path: string; label: string; here: boolean }

export function ScopesPopover({ scopes, off, onChange, s }: {
  scopes: readonly ScopeOption[]
  off: readonly string[]
  onChange: (scopesOff: string[]) => void
  s: Translate
}) {
  const [query, setQuery] = useState('')
  const on = scopes.filter((one) => !off.includes(one.path)).length
  const listed = scopes.filter((one) => matchesQuery(query, [one.label, one.path]))
  const toggle = (path: string, shown: boolean) => onChange(shown ? off.filter((one) => one !== path) : [...off, path])
  return (
    <PopoverButton
      label={<>{s('observation.filterScopes')}&nbsp;<Box component="span" sx={{ color: 'text.secondary' }}>{s('observation.filterScopesOn', { on, total: scopes.length })}</Box></>}
      tip={s('observation.filterScopesTip')}
      icon={<ScopeIcon size={14} />}
      on={on < scopes.length}
      testId="filter-scopes"
    >
      {() => (
        <>
          <TextField
            size="small"
            fullWidth
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={s('observation.filterScopesFind')}
            slotProps={{ htmlInput: { 'aria-label': s('observation.filterScopesFind'), autoComplete: 'off' } }}
          />
          <Box sx={{ mt: 1, maxHeight: 260, overflow: 'auto' }} data-testid="filter-scopes-list">
            {listed.map((one) => (
              <FormControlLabel
                key={one.path}
                sx={{ display: 'flex', mx: 0 }}
                control={<Checkbox size="small" checked={!off.includes(one.path)} onChange={(event) => toggle(one.path, event.target.checked)} />}
                label={(
                  <Typography sx={{ fontSize: 13 }}>
                    {one.label}{' '}
                    <Box component="span" sx={{ color: 'text.secondary', fontSize: 12 }}>
                      {one.here ? s('observation.filterScopeHere') : s('observation.filterScopeLocal')}
                    </Box>
                  </Typography>
                )}
              />
            ))}
            {listed.length === 0 && <Typography variant="body2" color="text.secondary" sx={{ p: 1 }}>{s('observation.filterScopesNone')}</Typography>}
          </Box>
          <Box sx={{ display: 'flex', gap: 1, mt: 1, pt: 1, borderTop: 1, borderColor: 'divider' }}>
            <Button size="small" onClick={() => onChange([])}>{s('observation.filterScopesAll')}</Button>
            <Button size="small" onClick={() => onChange(scopes.filter((one) => !one.here).map((one) => one.path))}>{s('observation.filterScopesOnly')}</Button>
          </Box>
        </>
      )}
    </PopoverButton>
  )
}

/** A saved filter in a line: what each box says, and how many scopes it switches off. */
export function describeFilters(filters: Filters, s: Translate): string {
  return [
    filters.observations.trim() && `${s('observation.filterObs')}: ${filters.observations.trim()}`,
    filters.causes.trim() && `${s('observation.filterCause')}: ${filters.causes.trim()}`,
    filters.roots.trim() && `${s('observation.filterRoot')}: ${filters.roots.trim()}`,
    filters.search.trim() && `“${filters.search.trim()}”`,
    filters.scopesOff.length > 0 && s('observation.savedScopesOff', { count: filters.scopesOff.length }),
  ].filter(Boolean).join(' · ')
}

export function SavedPopover({ list, canSave, onSave, onRecall, onDelete, s }: {
  list: readonly SavedFilter[]
  /** A filter is on, so there is something to save. */
  canSave: boolean
  onSave: (name: string) => void
  onRecall: (one: SavedFilter) => void
  onDelete: (name: string) => void
  s: Translate
}) {
  const [name, setName] = useState('')
  return (
    <PopoverButton label={s('observation.savedFilters')} tip={s('observation.savedFiltersTip')} icon={<BookmarkIcon size={14} />} testId="filter-saved">
      {(close) => (
        <>
          <List dense disablePadding data-testid="filter-saved-list">
            {list.map((one) => (
              <ListItem
                key={one.name}
                disablePadding
                secondaryAction={(
                  <Tooltip title={s('observation.savedDelete', { name: one.name })}>
                    <IconButton edge="end" size="small" aria-label={s('observation.savedDelete', { name: one.name })} onClick={() => onDelete(one.name)}>
                      <CloseIcon size={14} />
                    </IconButton>
                  </Tooltip>
                )}
              >
                <ListItemButton onClick={() => { onRecall(one); close() }} sx={{ borderRadius: 1 }}>
                  <ListItemText primary={one.name} secondary={describeFilters(one.filters, s)} slotProps={{ primary: { sx: { fontSize: 13 } }, secondary: { sx: { fontSize: 11.5 } } }} />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
          {list.length === 0 && <Typography variant="body2" color="text.secondary" sx={{ px: 0.5, pb: 1 }}>{s('observation.savedNone')}</Typography>}
          <Box
            component="form"
            onSubmit={(event) => { event.preventDefault(); if (canSave && name.trim()) { onSave(name); setName('') } }}
            sx={{ display: 'grid', gap: 0.75, mt: 1, pt: 1, borderTop: 1, borderColor: 'divider' }}
          >
            <Typography component="label" htmlFor="saved-filter-name" variant="caption">{s('observation.savedName')}</Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField
                id="saved-filter-name"
                size="small"
                fullWidth
                value={name}
                disabled={!canSave}
                onChange={(event) => setName(event.target.value)}
                placeholder={canSave ? s('observation.savedNameExample') : s('observation.savedNeedsFilter')}
                slotProps={{ htmlInput: { maxLength: 40, autoComplete: 'off' } }}
              />
              <Button type="submit" size="small" variant="contained" disabled={!canSave || !name.trim()}>{s('observation.savedSave')}</Button>
            </Box>
            <Typography variant="caption" color="text.secondary">{s('observation.savedNote')}</Typography>
          </Box>
        </>
      )}
    </PopoverButton>
  )
}
