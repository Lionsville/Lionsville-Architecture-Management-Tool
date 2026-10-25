// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A principle written or changed (ADR-0041): the title and statement, fixed
 * or flexible, its status — a candidate with its question — the groups it
 * sits in, picked or made on the spot, and its aspects as a plain numbered
 * list. A change to an accepted principle's statement or aspects asks for a
 * note first, and lands as a sharpening, so older citations can say they
 * predate it. The groups made here land with the principle, in one step.
 *
 * Escape and a press beside it do not close it: a principle half written is
 * lost that way, and the group picker's own Escape would close it otherwise.
 */
import { useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import MenuItem from '@mui/material/MenuItem'
import TextField from '@mui/material/TextField'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Typography from '@mui/material/Typography'
import type { Translate } from '../../i18n'
import { useStrings } from '../../i18n/LanguageContext'
import { FieldsDialog } from '../../widgets/CompactForms'
import { formatPrincipleNumber, PRINCIPLE_REGIMES, PRINCIPLE_STATUSES } from '../../model/principle'
import type { Principle, PrincipleRegime, PrincipleStatus } from '../../model/principle'
import { draftOf, draftReady, draftSharpens, withNewAspect } from '../draft'
import type { PrincipleDraft } from '../draft'
import { AspectList, GroupPicker } from './editorParts'
import { usePrinciples } from './PrinciplesContext'
import { REGIME_WORD, STATUS_WORD } from './words'

let made = 0

export function PrincipleEditor({ open, scope, principle, onClose }: {
  open: boolean
  scope: string
  principle?: Principle
  /** Closed: with the id of the principle made or changed, or nothing on cancel. */
  onClose: (id?: string) => void
}) {
  const access = usePrinciples()
  const { t } = useStrings()
  const [draft, setDraft] = useState<PrincipleDraft>(() => draftOf(principle))
  const [note, setNote] = useState('')
  const [askingNote, setAskingNote] = useState(false)
  const [refusal, setRefusal] = useState<string>()
  if (!access) return null
  const change = (patch: Partial<PrincipleDraft>) => setDraft((held) => ({ ...held, ...patch }))
  const sharpening = draftSharpens(draft, principle, access.today())
  const save = () => {
    if (sharpening && !askingNote) { setAskingNote(true); return }
    const saved = access.save(scope, draft, principle, sharpening ? note.trim() : undefined)
    if ('refused' in saved) { setRefusal(saved.refused); return }
    onClose(saved.id)
  }
  const ready = draftReady(draft) && (!askingNote || note.trim() !== '')
  return (
    <FieldsDialog open={open} onClose={(_event, reason) => { if (reason !== 'escapeKeyDown' && reason !== 'backdropClick') onClose() }} maxWidth="md" fullWidth>
      <DialogTitle>{principle ? t('principles.editTitle', { number: formatPrincipleNumber(principle.number) }) : t('principles.newTitle')}</DialogTitle>
      <DialogContent sx={{ display: 'grid', gap: 2, pt: '8px !important' }}>
        {askingNote ? (
          <>
            <Typography sx={{ fontSize: 14 }}>{t('principles.sharpenIntro')}</Typography>
            <TextField autoFocus label={t('principles.sharpenNote')} value={note} onChange={(event) => setNote(event.target.value)} multiline minRows={2} required data-testid="principle-sharpen-note" />
          </>
        ) : (
          <DraftFields draft={draft} change={change} scope={scope} number={principle?.number} t={t} />
        )}
        {refusal && <Typography role="alert" color="error" sx={{ fontSize: 13 }} data-testid="principle-refused">{t(refusal as Parameters<Translate>[0])}</Typography>}
      </DialogContent>
      <DialogActions>
        <Button onClick={() => (askingNote ? setAskingNote(false) : onClose())}>{askingNote ? t('principles.back') : t('common.cancel')}</Button>
        <Button variant="contained" onClick={save} disabled={!ready} data-testid="principle-save">
          {askingNote ? t('principles.sharpenSave') : principle ? t('principles.save') : t('principles.propose')}
        </Button>
      </DialogActions>
    </FieldsDialog>
  )
}

/** Everything the draft says, as fields: the words, the regime and status, the groups, the aspects and the rest. */
function DraftFields({ draft, change, scope, number, t }: {
  draft: PrincipleDraft
  change: (patch: Partial<PrincipleDraft>) => void
  scope: string
  number: number | undefined
  t: Translate
}) {
  const access = usePrinciples()
  const groups = access?.own(scope).groups ?? []
  const setAspect = (id: string, patch: Partial<PrincipleDraft['aspects'][number]>) => change({ aspects: draft.aspects.map((one) => (one.id === id ? { ...one, ...patch } : one)) })
  return (
    <>
      <TextField autoFocus label={t('principles.titleField')} value={draft.title} onChange={(event) => change({ title: event.target.value })} required data-testid="principle-title" />
      <TextField label={t('principles.statementField')} value={draft.statement} onChange={(event) => change({ statement: event.target.value })} multiline minRows={2} required helperText={t('principles.statementHelp')} data-testid="principle-statement" />
      <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap', alignItems: 'center' }}>
        <Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>{t('principles.regimeField')}</Typography>
          <ToggleButtonGroup exclusive size="small" value={draft.regime} onChange={(_event, next: PrincipleRegime | null) => { if (next) change({ regime: next }) }} aria-label={t('principles.regimeField')}>
            {PRINCIPLE_REGIMES.map((one) => <ToggleButton key={one} value={one} data-testid={`principle-regime-${one}`} sx={{ textTransform: 'none', px: 1.5 }}>{t(REGIME_WORD[one])}</ToggleButton>)}
          </ToggleButtonGroup>
        </Box>
        <TextField select size="small" label={t('principles.statusField')} value={draft.status} onChange={(event) => change({ status: event.target.value as PrincipleStatus })} sx={{ width: 180 }} data-testid="principle-status">
          {PRINCIPLE_STATUSES.map((one) => <MenuItem key={one} value={one}>{t(STATUS_WORD[one])}</MenuItem>)}
        </TextField>
      </Box>
      <Typography sx={{ fontSize: 12, color: 'text.secondary', mt: -1 }}>{t(draft.regime === 'fixed' ? 'principles.regimeFixedSentence' : 'principles.regimeFlexibleSentence')}</Typography>
      {draft.status === 'candidate' && (
        <TextField label={t('principles.questionField')} value={draft.question} onChange={(event) => change({ question: event.target.value })} helperText={t('principles.questionHelp')} />
      )}
      <GroupPicker groups={groups} picked={draft.groups} made={draft.newGroups} onChange={(picked, names) => change({ groups: picked, newGroups: names })} t={t} />
      <AspectList
        number={number} aspects={draft.aspects} t={t}
        onAdd={() => { made += 1; change(withNewAspect(draft, `as-${Date.now().toString(36)}-${made}`)) }}
        onChange={setAspect}
        onRemove={(id) => change({ aspects: draft.aspects.filter((one) => one.id !== id) })}
      />
      <TextField label={t('principles.rationale')} value={draft.rationale} onChange={(event) => change({ rationale: event.target.value })} multiline minRows={2} />
      <TextField label={t('principles.implications')} value={draft.implications} onChange={(event) => change({ implications: event.target.value })} multiline minRows={2} />
      <TextField label={t('principles.keywords')} value={draft.keywords} onChange={(event) => change({ keywords: event.target.value })} helperText={t('principles.keywordsHelp')} />
    </>
  )
}
