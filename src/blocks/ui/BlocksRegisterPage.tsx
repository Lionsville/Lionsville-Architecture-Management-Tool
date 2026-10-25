// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The register of building blocks (ADR-0043 §8): one row each — where it is
 * kept, its capabilities, its usage contexts, where it is evaluated with ✓
 * on the scopes that chose, and its solutions — over the whole organisation
 * or the blocks a home keeps or evaluates. A row opens the block's page; *New
 * building block* keeps one in a topic or a scope. A page over the home it
 * was opened from, reached from its card.
 */
import { useMemo, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import IconButton from '@mui/material/IconButton'
import MenuItem from '@mui/material/MenuItem'
import TextField from '@mui/material/TextField'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { useStrings } from '../../i18n/LanguageContext'
import { matchesQuery } from '../../model/textSearch'
import { barChromeFor } from '../../platform/windowChrome'
import type { WindowChrome } from '../../platform/windowChrome'
import { FieldsDialog } from '../../widgets/CompactForms'
import { PageClose } from '../../widgets/PageClose'
import { PageDialog } from '../../widgets/PageDialog'
import { useBlocks } from './BlocksContext'
import type { BlockRow, BlocksAccess } from './BlocksContext'

const CELL = { borderBottom: 1, borderColor: 'divider', px: 1.5, py: 0.75, fontSize: 13, textAlign: 'left', verticalAlign: 'top' } as const

/** Where each block is evaluated, the scopes that chose marked ✓. */
function evaluatedIn(access: BlocksAccess, block: string): string {
  return access.evaluationsOf(block).map((one) => `${access.scopeLabel(one.scope)}${one.evaluation.chosen ? ' ✓' : ''}`).join(', ')
}

function Row({ access, row }: { access: BlocksAccess; row: BlockRow }) {
  const { t } = useStrings()
  const { block, scope } = row
  return (
    <tr data-testid={`block-row-${block.id}`}>
      <Box component="td" sx={CELL}>
        <Button size="small" onClick={() => access.openBlock(block.id)} sx={{ textTransform: 'none', fontWeight: 600, p: 0, minWidth: 0 }}>{block.name}</Button>
      </Box>
      <Box component="td" sx={CELL}>{access.scopeLabel(scope)}</Box>
      <Box component="td" sx={CELL}>{(block.capabilities ?? []).length}</Box>
      <Box component="td" sx={CELL}>{(block.contexts ?? []).map((one) => one.name).join(', ') || '—'}</Box>
      <Box component="td" sx={{ ...CELL, color: 'text.secondary' }}>{evaluatedIn(access, block.id) || t('blocks.notEvaluated')}</Box>
      <Box component="td" sx={CELL}>{(block.sbbs ?? []).map((one) => one.name).join(' · ') || '—'}</Box>
    </tr>
  )
}

export function BlocksRegisterPage({ open, at, onClose, windowChrome }: {
  open: boolean
  /** The home it was opened over: the organisation lists every block, a scope those it keeps or evaluates. */
  at: string
  onClose: () => void
  windowChrome: WindowChrome
}) {
  const access = useBlocks()
  const { t } = useStrings()
  const bar = barChromeFor(windowChrome)
  const [query, setQuery] = useState('')
  const [making, setMaking] = useState(false)
  const version = access?.version ?? 0
  const rows = useMemo(() => {
    if (!access) return []
    const here = at === '' ? access.blocks() : (() => { const held = access.blocksAt(at); return [...held.kept, ...held.evaluated] })()
    return here.filter((one) => matchesQuery(query, [one.block.name, one.block.description, ...(one.block.sbbs ?? []).map((sbb) => sbb.name)]))
    // The version says the tree was read again.
  }, [access, version, at, query])
  if (!access) return null
  return (
    <PageDialog open={open} topInset={windowChrome.topInset} onClose={onClose} aria-label={t('blocks.registerTitle')}>
      <Box sx={{
        display: 'flex', alignItems: 'center', gap: 1, px: 1.5, pl: `${12 + bar.controlsInset}px`, minHeight: 48,
        borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper', flexShrink: 0,
      }}>
        <Tooltip title={t('common.close')}>
          <IconButton size="small" aria-label={t('common.close')} onClick={onClose}>
            <Box component="span" aria-hidden sx={{ display: 'inline-block', width: 18, textAlign: 'center', fontSize: 16, lineHeight: 1 }}>‹</Box>
          </IconButton>
        </Tooltip>
        <Typography component="h1" variant="body2" sx={{ fontWeight: 600 }}>{t('blocks.registerTitle')}</Typography>
        <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{at === '' ? t('blocks.registerAll') : t('blocks.registerScope', { scope: access.scopeLabel(at) })}</Typography>
        <Box sx={{ flex: 1 }} />
        <TextField size="small" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('blocks.search')} slotProps={{ htmlInput: { 'aria-label': t('blocks.search') } }} />
        {access.placeChoices().some((one) => access.mayWrite(one.path)) && (
          <Button size="small" variant="contained" onClick={() => setMaking(true)} data-testid="blocks-new" data-guide="blocks.new">{t('blocks.new')}</Button>
        )}
        <PageClose onClose={onClose} />
      </Box>
      <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
        {rows.length === 0 ? <Typography sx={{ color: 'text.secondary', fontSize: 14 }}>{query ? t('blocks.searchEmpty', { query }) : t('blocks.registerEmpty')}</Typography> : (
          <Box component="table" sx={{ borderCollapse: 'collapse', width: '100%' }} data-testid="blocks-register">
            <thead>
              <tr>
                {(['blocks.name', 'blocks.colKeptIn', 'blocks.capabilities', 'blocks.usageContexts', 'blocks.colEvaluatedIn', 'blocks.solutions'] as const).map((key) => (
                  <Box component="th" key={key} sx={{ ...CELL, fontWeight: 600 }}>{t(key)}</Box>
                ))}
              </tr>
            </thead>
            <tbody>{rows.map((row) => <Row key={row.block.id} access={access} row={row} />)}</tbody>
          </Box>
        )}
      </Box>
      {making && <NewBlockDialog access={access} at={at} onClose={() => setMaking(false)} />}
    </PageDialog>
  )
}

/** A new building block: its name and where it is kept, a topic first. */
function NewBlockDialog({ access, at, onClose }: { access: BlocksAccess; at: string; onClose: () => void }) {
  const { t } = useStrings()
  const places = access.placeChoices().filter((one) => access.mayWrite(one.path))
  const [name, setName] = useState('')
  // Over a scope's home, that scope; over the organisation's, the first topic — what a block is usually kept in.
  const [place, setPlace] = useState((at !== '' ? places.find((one) => one.path === at)?.path : undefined) ?? places[0]?.path ?? '')
  const [busy, setBusy] = useState(false)
  const make = () => {
    setBusy(true)
    void access.create(place, name).then((id) => { onClose(); if (id) access.openBlock(id) })
  }
  return (
    <FieldsDialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{t('blocks.new')}</DialogTitle>
      <DialogContent sx={{ display: 'grid', gap: 2, pt: '8px !important' }}>
        <TextField autoFocus label={t('blocks.name')} value={name} onChange={(event) => setName(event.target.value)} slotProps={{ htmlInput: { 'data-testid': 'block-name' } }} />
        <TextField select label={t('blocks.colKeptIn')} value={place} onChange={(event) => setPlace(event.target.value)} helperText={t('blocks.keptInHelp')} slotProps={{ inputLabel: { shrink: true }, select: { displayEmpty: true } }}>
          {places.map((one) => <MenuItem key={one.path} value={one.path}>{one.name}</MenuItem>)}
        </TextField>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button variant="contained" disabled={busy || !name.trim() || places.length === 0} onClick={make} data-testid="block-create">{t('blocks.create')}</Button>
      </DialogActions>
    </FieldsDialog>
  )
}
