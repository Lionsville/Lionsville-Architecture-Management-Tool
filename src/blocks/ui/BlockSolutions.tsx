// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A building block's *Solutions* (ADR-0043 §3): the catalogue of what could
 * deliver it — a product, a service, something built in house — never how
 * well, which each scope says for itself. A line says where each is weighed
 * and chosen, and which landscape elements are it; a solution's status and
 * elements are changed here, one step in the scope that keeps the block.
 */
import { useState } from 'react'
import Autocomplete from '@mui/material/Autocomplete'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import MenuItem from '@mui/material/MenuItem'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import type { StringKey } from '../../i18n'
import { useStrings } from '../../i18n/LanguageContext'
import { SOLUTION_SORTS, SOLUTION_STATUSES } from '../../model/buildingBlock'
import type { SolutionBlock, SolutionBlockStatus, SolutionSort } from '../../model/types'
import { FieldsDialog } from '../../widgets/CompactForms'
import { useBlocks } from './BlocksContext'
import { SORT_WORD } from './EvaluationGrid'
import type { BlockRow } from './BlocksContext'

export const STATUS_WORD: Record<SolutionBlockStatus, StringKey> = {
  candidate: 'blocks.statusCandidate', evaluated: 'blocks.statusEvaluated', inUse: 'blocks.statusInUse', retired: 'blocks.statusRetired',
}

const CELL = { borderBottom: 1, borderColor: 'divider', px: 1.5, py: 0.75, fontSize: 13, textAlign: 'left', verticalAlign: 'top' } as const
const HEADS: StringKey[] = ['blocks.name', 'blocks.supplier', 'blocks.sort', 'blocks.status', 'blocks.weighedIn', 'blocks.chosenIn', 'blocks.isElement']

/** One solution's line: what it is, where it is weighed and chosen, and its status, changed in place where the person may. */
function SolutionLine({ row, sbb }: { row: BlockRow; sbb: SolutionBlock }) {
  const access = useBlocks()
  const { t } = useStrings()
  if (!access) return null
  const evaluations = access.evaluationsOf(row.block.id)
  const weighed = evaluations.filter((one) => one.evaluation.options.includes(sbb.id)).map((one) => access.scopeLabel(one.scope))
  const chosen = evaluations.filter((one) => one.evaluation.chosen === sbb.id).map((one) => access.scopeLabel(one.scope))
  const setStatus = (status: SolutionBlockStatus) => access.update(row.block.id, {
    sbbs: (row.block.sbbs ?? []).map((one) => (one.id === sbb.id ? { ...one, status } : one)),
  })
  return (
    <tr data-testid={`sbb-${sbb.id}`}>
      <Box component="td" sx={{ ...CELL, fontWeight: 600 }}>{sbb.name}</Box>
      <Box component="td" sx={CELL}>{sbb.supplier ?? '—'}</Box>
      <Box component="td" sx={CELL}>{t(SORT_WORD[sbb.sort])}</Box>
      <Box component="td" sx={CELL}>
        {access.mayWrite(row.scope) ? (
          <TextField
            select size="small" variant="standard" value={sbb.status} onChange={(event) => setStatus(event.target.value as SolutionBlockStatus)}
            slotProps={{ htmlInput: { 'aria-label': t('blocks.statusOf', { name: sbb.name }) } }}
          >
            {SOLUTION_STATUSES.map((one) => <MenuItem key={one} value={one}>{t(STATUS_WORD[one])}</MenuItem>)}
          </TextField>
        ) : t(STATUS_WORD[sbb.status])}
      </Box>
      <Box component="td" sx={{ ...CELL, color: 'text.secondary' }}>{weighed.join(', ') || '—'}</Box>
      <Box component="td" sx={{ ...CELL, color: 'success.main' }}>{chosen.join(', ')}</Box>
      <Box component="td" sx={{ ...CELL, color: 'text.secondary', minWidth: 200 }}>
        {access.mayWrite(row.scope) ? <ElementsField row={row} sbb={sbb} /> : (sbb.elements ?? []).map((id) => access.elementName(id)).join(', ') || '—'}
      </Box>
    </tr>
  )
}

/** The landscape elements a solution is, linked in place: what a chosen solution with none yet is given (§8). */
function ElementsField({ row, sbb }: { row: BlockRow; sbb: SolutionBlock }) {
  const access = useBlocks()
  const { t } = useStrings()
  if (!access) return null
  const choices = access.elementChoices() as { id: string; name: string }[]
  const value = (sbb.elements ?? []).map((id) => choices.find((one) => one.id === id) ?? { id, name: access.elementName(id) })
  const set = (next: readonly { id: string }[]) => access.update(row.block.id, {
    sbbs: (row.block.sbbs ?? []).map((one) => {
      if (one.id !== sbb.id) return one
      const { elements: _was, ...rest } = one
      void _was
      return next.length ? { ...rest, elements: next.map((held) => held.id) } : rest
    }),
  })
  return (
    <Autocomplete
      multiple size="small" options={choices} value={value} onChange={(_event, next) => set(next)}
      getOptionLabel={(one) => one.name} isOptionEqualToValue={(a, b) => a.id === b.id}
      renderInput={(params) => <TextField {...params} variant="standard" placeholder={value.length ? '' : '—'} slotProps={{ ...params.slotProps, htmlInput: { ...params.slotProps.htmlInput, 'aria-label': t('blocks.elementsOf', { name: sbb.name }) } }} />}
    />
  )
}

export function BlockSolutions({ row }: { row: BlockRow }) {
  const access = useBlocks()
  const { t } = useStrings()
  const [adding, setAdding] = useState(false)
  if (!access) return null
  const sbbs = row.block.sbbs ?? []
  return (
    <>
      <Typography sx={{ fontSize: 13, color: 'text.secondary', mb: 2, maxWidth: 760 }}>{t('blocks.solutionsIntro')}</Typography>
      {sbbs.length === 0 ? <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>{t('blocks.solutionsEmpty')}</Typography> : (
        <Box component="table" sx={{ borderCollapse: 'collapse', width: '100%' }} data-testid="block-solutions">
          <thead>
            <tr>{HEADS.map((key) => <Box component="th" key={key} sx={{ ...CELL, fontWeight: 600 }}>{t(key)}</Box>)}</tr>
          </thead>
          <tbody>{sbbs.map((sbb) => <SolutionLine key={sbb.id} row={row} sbb={sbb} />)}</tbody>
        </Box>
      )}
      {access.mayWrite(row.scope) && <Button size="small" onClick={() => setAdding(true)} sx={{ mt: 2 }} data-testid="block-add-sbb">{t('blocks.addSbb')}</Button>}
      {adding && <SolutionDialog row={row} onClose={() => setAdding(false)} />}
    </>
  )
}

/** A new solution in the catalogue; the elements that are it, where there are any yet. */
export function SolutionDialog({ row, onClose }: { row: BlockRow; onClose: (made?: string) => void }) {
  const access = useBlocks()
  const { t } = useStrings()
  const [name, setName] = useState('')
  const [supplier, setSupplier] = useState('')
  const [sort, setSort] = useState<SolutionSort>('product')
  const [elements, setElements] = useState<{ id: string; name: string }[]>([])
  if (!access) return null
  const add = () => {
    const sbb: SolutionBlock = {
      id: access.makeId('sb'), name: name.trim(), ...(supplier.trim() ? { supplier: supplier.trim() } : {}), sort, status: 'candidate',
      ...(elements.length ? { elements: elements.map((one) => one.id) } : {}),
    }
    access.update(row.block.id, { sbbs: [...(row.block.sbbs ?? []), sbb] })
    onClose(sbb.id)
  }
  return (
    <FieldsDialog open onClose={() => onClose()} maxWidth="sm" fullWidth>
      <DialogTitle>{t('blocks.addSbbTitle')}</DialogTitle>
      <DialogContent sx={{ display: 'grid', gap: 2, pt: '8px !important' }}>
        <TextField autoFocus label={t('blocks.name')} value={name} onChange={(event) => setName(event.target.value)} slotProps={{ htmlInput: { 'data-testid': 'sbb-name' } }} />
        <TextField label={t('blocks.supplier')} value={supplier} onChange={(event) => setSupplier(event.target.value)} />
        <TextField select label={t('blocks.sort')} value={sort} onChange={(event) => setSort(event.target.value as SolutionSort)}>
          {SOLUTION_SORTS.map((one) => <MenuItem key={one} value={one}>{t(SORT_WORD[one])}</MenuItem>)}
        </TextField>
        <Autocomplete
          multiple options={access.elementChoices() as { id: string; name: string }[]} value={elements} onChange={(_event, next) => setElements(next)}
          getOptionLabel={(one) => one.name} isOptionEqualToValue={(a, b) => a.id === b.id}
          renderInput={(params) => <TextField {...params} label={t('blocks.isElement')} helperText={t('blocks.isElementHelp')} />}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={() => onClose()}>{t('common.cancel')}</Button>
        <Button variant="contained" disabled={!name.trim()} onClick={add} data-testid="sbb-add">{t('blocks.add')}</Button>
      </DialogActions>
    </FieldsDialog>
  )
}
