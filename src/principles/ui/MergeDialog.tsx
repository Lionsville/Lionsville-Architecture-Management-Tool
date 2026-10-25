// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * *Merge…* (ADR-0041): this principle absorbs others of its scope that say
 * the same thing, with their aspects, groups, citations and comments; the
 * absorbed are kept as history.
 */
import { useState } from 'react'
import Button from '@mui/material/Button'
import Checkbox from '@mui/material/Checkbox'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import FormControlLabel from '@mui/material/FormControlLabel'
import Typography from '@mui/material/Typography'
import { useStrings } from '../../i18n/LanguageContext'
import { FieldsDialog } from '../../widgets/CompactForms'
import { formatPrincipleNumber } from '../principle'
import type { Principle } from '../principle'
import { usePrinciples } from './PrinciplesContext'

export function MergeDialog({ open, scope, into, onClose }: { open: boolean; scope: string; into: Principle; onClose: () => void }) {
  const access = usePrinciples()
  const { t } = useStrings()
  const [from, setFrom] = useState<string[]>([])
  if (!access) return null
  const others = access.own(scope).principles.filter((one) => one.id !== into.id && !one.mergedInto)
  return (
    <FieldsDialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{t('principles.mergeTitle', { number: formatPrincipleNumber(into.number) })}</DialogTitle>
      <DialogContent>
        <Typography sx={{ fontSize: 13, color: 'text.secondary', mb: 1 }}>{t('principles.mergeIntro')}</Typography>
        {others.map((one) => (
          <FormControlLabel
            key={one.id} sx={{ display: 'flex' }}
            control={<Checkbox size="small" checked={from.includes(one.id)} onChange={(event) => setFrom((held) => (event.target.checked ? [...held, one.id] : held.filter((id) => id !== one.id)))} />}
            label={<Typography sx={{ fontSize: 13 }}>{formatPrincipleNumber(one.number)} {one.title}</Typography>}
          />
        ))}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button variant="contained" disabled={from.length === 0} onClick={() => { access.merge(scope, into.id, from); onClose() }}>{t('principles.mergeSubmit')}</Button>
      </DialogActions>
    </FieldsDialog>
  )
}
