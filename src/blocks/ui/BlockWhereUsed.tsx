// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A building block's *Where used* (ADR-0043 §4, §7): each scope's evaluation
 * of it, a line each, and *Evaluate for a scope…* — offering to copy the
 * ratings of a scope that evaluated it before, which are the new scope's own
 * from then on. An evaluation opened shows the contexts that apply there,
 * the solutions weighed, the grid and the fit, and *Propose a decision…*,
 * kept in that scope; accepting the decision there writes the choice.
 */
import { useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Checkbox from '@mui/material/Checkbox'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import FormControlLabel from '@mui/material/FormControlLabel'
import MenuItem from '@mui/material/MenuItem'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { useStrings } from '../../i18n/LanguageContext'
import { FieldsDialog } from '../../widgets/CompactForms'
import { useBlocks } from './BlocksContext'
import type { BlockRow } from './BlocksContext'
import { EvaluationView } from './EvaluationView'
import { scopeMenuItems } from '../../widgets/ScopeChoices'

const CELL = { borderBottom: 1, borderColor: 'divider', px: 1.5, py: 0.75, fontSize: 13, textAlign: 'left', verticalAlign: 'top' } as const

export function BlockWhereUsed({ row, evaluating, onEvaluate, onChapter }: {
  row: BlockRow
  /** The scope whose evaluation is open; none, the list. */
  evaluating: string | undefined
  onEvaluate: (scope: string | undefined) => void
  onChapter: (context: string) => void
}) {
  const access = useBlocks()
  const { t } = useStrings()
  const [adding, setAdding] = useState(false)
  if (!access) return null
  if (evaluating !== undefined) return <EvaluationView row={row} scope={evaluating} onBack={() => onEvaluate(undefined)} onChapter={onChapter} />
  const { block } = row
  const evaluations = access.evaluationsOf(block.id)
  const sbbName = (id: string | undefined) => (block.sbbs ?? []).find((one) => one.id === id)?.name
  return (
    <Box sx={{ maxWidth: 900 }}>
      <Typography sx={{ fontSize: 13, color: 'text.secondary', mb: 2 }}>{t('blocks.whereUsedIntro')}</Typography>
      {evaluations.length === 0 ? <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>{t('blocks.noEvaluations')}</Typography> : (
        <Box component="table" sx={{ borderCollapse: 'collapse', width: '100%' }} data-testid="block-evaluations">
          <thead>
            <tr>
              {(['blocks.colScope', 'blocks.colContexts', 'blocks.colOptions', 'blocks.colChosen'] as const).map((key) => (
                <Box component="th" key={key} sx={{ ...CELL, fontWeight: 600 }}>{t(key)}</Box>
              ))}
            </tr>
          </thead>
          <tbody>
            {evaluations.map(({ scope, evaluation }) => (
              <tr key={scope} data-testid={`evaluation-row-${scope}`}>
                <Box component="td" sx={CELL}>
                  <Button size="small" onClick={() => onEvaluate(scope)} sx={{ textTransform: 'none', fontWeight: 600, p: 0, minWidth: 0 }}>{access.scopeLabel(scope)}</Button>
                </Box>
                <Box component="td" sx={CELL}>{(block.contexts ?? []).filter((one) => evaluation.contexts.includes(one.id)).map((one) => one.name).join(', ') || '—'}</Box>
                <Box component="td" sx={{ ...CELL, color: 'text.secondary' }}>{evaluation.options.map(sbbName).filter(Boolean).join(' · ') || '—'}</Box>
                <Box component="td" sx={{ ...CELL, color: evaluation.chosen ? 'success.main' : 'text.secondary' }}>{sbbName(evaluation.chosen) ?? t('blocks.notChosen')}</Box>
              </tr>
            ))}
          </tbody>
        </Box>
      )}
      {access.evaluateChoices(block.id).length > 0 && (
        <Button size="small" variant="contained" onClick={() => setAdding(true)} sx={{ mt: 2 }} data-testid="block-evaluate">{t('blocks.evaluateFor')}</Button>
      )}
      {adding && <EvaluateDialog row={row} onClose={(made) => { setAdding(false); if (made !== undefined) onEvaluate(made) }} />}
    </Box>
  )
}

/** *Evaluate for a scope…*: the scope that is choosing, the contexts that apply there, and whose ratings to start from. */
function EvaluateDialog({ row, onClose }: { row: BlockRow; onClose: (made?: string) => void }) {
  const access = useBlocks()
  const { t } = useStrings()
  const choices = access?.evaluateChoices(row.block.id) ?? []
  const before = access?.evaluationsOf(row.block.id) ?? []
  const [scope, setScope] = useState(choices[0]?.path ?? '')
  const [contexts, setContexts] = useState<string[]>([])
  const [copyFrom, setCopyFrom] = useState('')
  const [busy, setBusy] = useState(false)
  if (!access) return null
  const start = () => {
    setBusy(true)
    void access.evaluate(row.block.id, scope, contexts, copyFrom === '' ? undefined : copyFrom).then((made) => onClose(made ? scope : undefined))
  }
  const toggle = (id: string, on: boolean) => setContexts((held) => (on ? [...held, id] : held.filter((one) => one !== id)))
  return (
    <FieldsDialog open onClose={() => onClose()} maxWidth="sm" fullWidth>
      <DialogTitle>{t('blocks.evaluateFor')}</DialogTitle>
      <DialogContent sx={{ display: 'grid', gap: 2, pt: '8px !important' }}>
        <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>{t('blocks.evaluateIntro')}</Typography>
        <TextField select label={t('blocks.colScope')} value={scope} onChange={(event) => setScope(event.target.value)} slotProps={{ htmlInput: { 'data-testid': 'evaluate-scope' }, inputLabel: { shrink: true }, select: { displayEmpty: true } }}>
          {scopeMenuItems(choices, { topics: t('blocks.placeTopics'), scopes: t('blocks.placeScopes') })}
        </TextField>
        <Box>
          <Typography sx={{ fontSize: 12, fontWeight: 600, mb: 0.5 }}>{t('blocks.contextsHere')}</Typography>
          {(row.block.contexts ?? []).map((context) => (
            <FormControlLabel
              key={context.id} sx={{ display: 'flex' }}
              control={<Checkbox size="small" checked={contexts.includes(context.id)} onChange={(event) => toggle(context.id, event.target.checked)} />}
              label={context.name}
            />
          ))}
        </Box>
        {before.length > 0 && (
          <TextField select label={t('blocks.copyFrom')} value={copyFrom} onChange={(event) => setCopyFrom(event.target.value)} helperText={t('blocks.copyFromHelp')} slotProps={{ inputLabel: { shrink: true }, select: { displayEmpty: true } }}>
            <MenuItem value="">{t('blocks.copyNothing')}</MenuItem>
            {before.map((one) => <MenuItem key={one.scope} value={one.scope}>{t('blocks.copyRatingsFrom', { scope: access.scopeLabel(one.scope) })}</MenuItem>)}
          </TextField>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={() => onClose()}>{t('common.cancel')}</Button>
        <Button variant="contained" disabled={busy || choices.length === 0} onClick={start} data-testid="evaluate-start">{t('blocks.evaluateStart')}</Button>
      </DialogActions>
    </FieldsDialog>
  )
}
