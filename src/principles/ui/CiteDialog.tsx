// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * *Cite…* (ADR-0041): a principle in force here, an aspect where one is
 * meant, the stance the record's kind may take, and a reason — required to
 * depart, and a departure is refused on a fixed principle, said before it is
 * asked rather than after.
 */
import { useMemo, useState } from 'react'
import Alert from '@mui/material/Alert'
import Autocomplete from '@mui/material/Autocomplete'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import MenuItem from '@mui/material/MenuItem'
import TextField from '@mui/material/TextField'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { useStrings } from '../../i18n/LanguageContext'
import { FieldsDialog } from '../../widgets/CompactForms'
import { CITABLE, citationRefusal, formatAspectNumber, formatPrincipleNumber } from '../principle'
import type { CitationStance, CitingRecord, PrincipleRef } from '../principle'
import type { PrincipleInForce } from '../suggest'
import { usePrinciples } from './PrinciplesContext'
import { REFUSAL_WORD, REGIME_WORD, STANCE_TIP, STANCE_WORD } from './words'

export function CiteDialog({ open, about, here, initial, onClose }: {
  open: boolean
  about: CitingRecord
  here: string
  initial: { ref?: PrincipleRef; aspect?: number; stance?: CitationStance }
  onClose: () => void
}) {
  const access = usePrinciples()
  const { t } = useStrings()
  const options = useMemo(() => (access?.inForce(here) ?? []).filter((one) => one.principle.status !== 'retired' && !one.principle.mergedInto), [access, here])
  const [picked, setPicked] = useState<PrincipleInForce | null>(
    () => options.find((one) => initial.ref && one.scope === initial.ref.scope && one.principle.id === initial.ref.id) ?? null,
  )
  const [aspect, setAspect] = useState<number | ''>(initial.aspect ?? '')
  const stances = CITABLE[about.kind]
  const [stance, setStance] = useState<CitationStance>(initial.stance ?? stances[0]!)
  const [reason, setReason] = useState('')
  const [said, setSaid] = useState<string | undefined>(undefined)
  if (!access) return null
  const fixed = picked?.principle.regime === 'fixed'
  const refusal = picked ? citationRefusal(picked.principle, about.kind, stance, reason) : undefined
  const submit = () => {
    if (!picked) return
    const refused = access.cite({
      about, scope: here, principle: { scope: picked.scope, id: picked.principle.id },
      ...(aspect !== '' ? { aspect } : {}), stance, ...(reason.trim() ? { reason: reason.trim() } : {}),
    })
    if (refused) { setSaid(t(REFUSAL_WORD[refused], { number: formatPrincipleNumber(picked.principle.number) })); return }
    onClose()
  }
  const sourceLine = (one: PrincipleInForce) => {
    const from = access.sourceOf(here, one.scope)
    return from.kind === 'here' ? '' : from.kind === 'topic' ? t('principles.fromTopic', { scope: access.scopeLabel(from.scope) }) : t('principles.from', { scope: access.scopeLabel(from.scope) })
  }
  return (
    <FieldsDialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{t('principles.citeTitle')}</DialogTitle>
      <DialogContent sx={{ display: 'grid', gap: 2, pt: '8px !important' }}>
        <Autocomplete
          options={options}
          value={picked}
          onChange={(_event, next) => { setPicked(next); setAspect(''); setSaid(undefined) }}
          getOptionLabel={(one) => `${formatPrincipleNumber(one.principle.number)} ${one.principle.title}`}
          isOptionEqualToValue={(a, b) => a.scope === b.scope && a.principle.id === b.principle.id}
          groupBy={(one) => sourceLine(one) || t('principles.hereGroup')}
          renderInput={(params) => <TextField {...params} autoFocus label={t('principles.principleField')} />}
          renderOption={(props, one) => (
            <li {...props} key={`${one.scope}/${one.principle.id}`}>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'baseline', width: '100%' }}>
                <Box component="span" sx={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 12, color: 'text.secondary' }}>{formatPrincipleNumber(one.principle.number)}</Box>
                <Box component="span" sx={{ flex: 1 }}>{one.principle.title}</Box>
                <Box component="span" sx={{ fontSize: 11, color: 'text.secondary' }}>{t(REGIME_WORD[one.principle.regime])}</Box>
              </Box>
            </li>
          )}
          data-testid="cite-principle"
        />
        {picked && picked.principle.aspects.length > 0 && (
          <TextField
            select label={t('principles.aspectField')} value={aspect} onChange={(event) => setAspect(event.target.value === '' ? '' : Number(event.target.value))}
            slotProps={{ inputLabel: { shrink: true }, select: { displayEmpty: true } }}
          >
            <MenuItem value="">{t('principles.wholePrinciple')}</MenuItem>
            {picked.principle.aspects.map((one) => (
              <MenuItem key={one.id} value={one.number}>
                <Box component="span" sx={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 12, color: 'text.secondary', mr: 1 }}>{formatAspectNumber(picked.principle.number, one.number)}</Box>
                {one.text}
              </MenuItem>
            ))}
          </TextField>
        )}
        <Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>{t('principles.stanceField')}</Typography>
          <ToggleButtonGroup exclusive size="small" value={stance} onChange={(_event, next: CitationStance | null) => { if (next) { setStance(next); setSaid(undefined) } }} aria-label={t('principles.stanceField')}>
            {stances.map((one) => (
              <Tooltip key={one} title={t(STANCE_TIP[one])} describeChild>
                <ToggleButton value={one} data-testid={`cite-stance-${one}`} sx={{ textTransform: 'none', px: 1.5 }}>{t(STANCE_WORD[one])}</ToggleButton>
              </Tooltip>
            ))}
          </ToggleButtonGroup>
        </Box>
        {stance === 'deviates' && fixed && picked && (
          <Alert severity="warning" data-testid="cite-fixed">{t('principles.refusedFixed', { number: formatPrincipleNumber(picked.principle.number) })}</Alert>
        )}
        {(stance === 'deviates' || about.kind === 'observation') && !(stance === 'deviates' && fixed) && (
          <TextField
            label={stance === 'deviates' ? t('principles.reasonRequired') : t('principles.reasonField')}
            value={reason} onChange={(event) => setReason(event.target.value)} multiline minRows={2}
            required={stance === 'deviates'} data-testid="cite-reason"
          />
        )}
        {said && <Alert severity="error">{said}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button variant="contained" onClick={submit} disabled={!picked || refusal !== undefined} data-testid="cite-submit">{t('principles.citeSubmit')}</Button>
      </DialogActions>
    </FieldsDialog>
  )
}
