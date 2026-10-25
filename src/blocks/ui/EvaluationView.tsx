// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * One scope's evaluation of a building block (ADR-0043 §4–§7): the usage
 * contexts that apply there, the solutions it weighs, the grid with the fit,
 * the solution chosen once a decision is accepted, and *Propose a
 * decision…* — a decision kept in that scope that chooses one option, with
 * each option's fit in its body. Every change is a step in that scope, under
 * its rights; the block's own fields are not changed from here.
 */
import { useState } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import Link from '@mui/material/Link'
import MenuItem from '@mui/material/MenuItem'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { useStrings } from '../../i18n/LanguageContext'
import { percent, ranking } from '../../model/evaluation'
import type { Evaluation } from '../../model/evaluation'
import { ConfirmDialog } from '../../widgets/ConfirmDialog'
import { FieldsDialog } from '../../widgets/CompactForms'
import { useBlocks } from './BlocksContext'
import type { BlockRow } from './BlocksContext'
import { EvaluationGrid } from './EvaluationGrid'

const LABEL = { fontSize: 12, fontWeight: 600, mb: 0.5 } as const

const toggled = (list: readonly string[], item: string) => (list.includes(item) ? list.filter((one) => one !== item) : [...list, item])

/** The chips a person turns on and off: the contexts that apply here, or the solutions weighed. */
function Choices({ items, on, onToggle, readOnly, testId }: {
  items: readonly { id: string; name: string }[]; on: readonly string[]; onToggle: (id: string) => void; readOnly: boolean; testId: string
}) {
  return (
    <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mb: 2 }}>
      {items.map((item) => {
        const picked = on.includes(item.id)
        return (
          <Chip
            key={item.id} label={item.name} color={picked ? 'primary' : 'default'} variant={picked ? 'filled' : 'outlined'}
            {...(readOnly ? {} : { onClick: () => onToggle(item.id) })} aria-pressed={picked}
            data-testid={`${testId}-${item.id}`}
          />
        )
      })}
    </Box>
  )
}

export function EvaluationView({ row, scope, onBack, onChapter }: { row: BlockRow; scope: string; onBack: () => void; onChapter: (context: string) => void }) {
  const access = useBlocks()
  const { t } = useStrings()
  const [proposing, setProposing] = useState(false)
  const [removing, setRemoving] = useState(false)
  const { block } = row
  const evaluation = access?.evaluationsOf(block.id).find((one) => one.scope === scope)?.evaluation
  if (!access || !evaluation) return null
  const may = access.mayWrite(scope)
  const save = (next: Evaluation) => access.updateEvaluation(scope, next)
  const chosen = (block.sbbs ?? []).find((one) => one.id === evaluation.chosen)
  return (
    <Box data-testid="evaluation-view">
      <Link component="button" type="button" underline="hover" onClick={onBack} sx={{ fontSize: 12 }}>{t('blocks.backToWhereUsed')}</Link>
      <Typography component="h2" variant="h6" sx={{ fontWeight: 600, mt: 0.5 }}>{t('blocks.evaluationTitle', { block: block.name, scope: access.scopeLabel(scope) })}</Typography>
      <Typography sx={{ fontSize: 13, color: 'text.secondary', mt: 0.5, mb: 2, maxWidth: 760 }}>{t('blocks.evaluationIntro')}</Typography>
      {chosen && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {t('blocks.chosenHere', { name: chosen.name })}
          {evaluation.decidedBy && <> · <Link component="button" type="button" onClick={() => access.openDecision(scope, evaluation.decidedBy!)}>{t('blocks.openDecision')}</Link></>}
        </Alert>
      )}
      <Typography sx={LABEL}>{t('blocks.contextsHere')}</Typography>
      <Choices items={block.contexts ?? []} on={evaluation.contexts} readOnly={!may} testId="evaluation-context" onToggle={(id) => save({ ...evaluation, contexts: toggled(evaluation.contexts, id) })} />
      <Box sx={{ display: 'flex', gap: 1, mt: -1.5, mb: 2 }}>
        {(block.contexts ?? []).filter((one) => evaluation.contexts.includes(one.id)).map((one) => (
          <Link key={one.id} component="button" type="button" underline="hover" onClick={() => onChapter(one.id)} sx={{ fontSize: 11 }}>{t('blocks.chapterOf', { name: one.name })}</Link>
        ))}
      </Box>
      <Typography sx={LABEL}>{t('blocks.optionsHere')}</Typography>
      <Choices
        items={(block.sbbs ?? []).filter((one) => one.status !== 'retired' || evaluation.options.includes(one.id))} on={evaluation.options}
        readOnly={!may} testId="evaluation-option"
        onToggle={(id) => save({ ...evaluation, options: toggled(evaluation.options, id), ...(evaluation.chosen === id ? { chosen: undefined, decidedBy: undefined } : {}) })}
      />
      {evaluation.contexts.length === 0 && <Alert severity="info" sx={{ mb: 2 }}>{t('blocks.pickContextFirst')}</Alert>}
      <EvaluationGrid block={block} evaluation={evaluation} {...(may ? { onChange: save } : {})} />
      {may && (
        <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
          <Button size="small" color="error" onClick={() => setRemoving(true)} data-testid="evaluation-remove">{t('blocks.removeEvaluation')}</Button>
          <Box sx={{ flex: 1 }} />
          <Button size="small" variant="contained" disabled={evaluation.options.length === 0 || evaluation.contexts.length === 0} onClick={() => setProposing(true)} data-testid="block-propose">{t('blocks.propose')}</Button>
        </Box>
      )}
      {proposing && <ProposeDialog row={row} scope={scope} evaluation={evaluation} onClose={() => setProposing(false)} />}
      <ConfirmDialog
        open={removing} title={t('blocks.removeEvaluationTitle', { scope: access.scopeLabel(scope) })} body={t('blocks.removeEvaluationBody')}
        confirmLabel={t('blocks.remove')} cancelLabel={t('common.cancel')} onCancel={() => setRemoving(false)}
        onConfirm={() => { setRemoving(false); access.removeEvaluation(scope, evaluation.id); onBack() }}
      />
    </Box>
  )
}

/** The decision one scope's evaluation becomes: the option it chooses, each option's fit, kept in that scope. */
function ProposeDialog({ row, scope, evaluation, onClose }: { row: BlockRow; scope: string; evaluation: Evaluation; onClose: () => void }) {
  const access = useBlocks()
  const { t } = useStrings()
  const ranked = ranking(row.block, evaluation)
  const [option, setOption] = useState(ranked.find((one) => one.fit.failsMust.length === 0)?.sbb.id ?? ranked[0]?.sbb.id ?? '')
  const [made, setMade] = useState<string | undefined>(undefined)
  const [busy, setBusy] = useState(false)
  if (!access) return null
  const fitWords = (fit: (typeof ranked)[number]['fit']) => (fit.failsMust.length ? t('blocks.failsMust') : fit.fit !== undefined ? t('blocks.percent', { value: percent(fit.fit) }) : '—')
  const propose = () => {
    setBusy(true)
    void access.propose(scope, row.block.id, option).then((id) => { setBusy(false); setMade(id) })
  }
  return (
    <FieldsDialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{t('blocks.proposeTitle')}</DialogTitle>
      <DialogContent sx={{ display: 'grid', gap: 2, pt: '8px !important' }}>
        {made ? <Alert severity="success">{t('blocks.proposed')}</Alert> : (
          <>
            <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>{t('blocks.proposeIntro', { scope: access.scopeLabel(scope) })}</Typography>
            <TextField select label={t('blocks.chooseSbb')} value={option} onChange={(event) => setOption(event.target.value)} slotProps={{ htmlInput: { 'data-testid': 'propose-option' } }}>
              {ranked.map(({ sbb, fit }) => <MenuItem key={sbb.id} value={sbb.id}>{sbb.name} — {fitWords(fit)}</MenuItem>)}
            </TextField>
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{made ? t('common.close') : t('common.cancel')}</Button>
        {made
          ? <Button variant="contained" onClick={() => access.openDecision(scope, made)} data-testid="propose-open">{t('blocks.openDecision')}</Button>
          : <Button variant="contained" disabled={busy || !option} onClick={propose} data-testid="propose-submit">{t('blocks.proposeSubmit')}</Button>}
      </DialogActions>
    </FieldsDialog>
  )
}
