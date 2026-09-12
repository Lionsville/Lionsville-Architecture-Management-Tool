/**
 * A path of its own: the three things a lane needs (ADR-0012 §4).
 *
 * Whose path it is, whether they are part of this organisation, and where it
 * forks. The third is not decoration: a lane is derived from the steps that
 * name it (`business/lanes.ts`) and nothing stores one, so a lane with no
 * steps is a lane nobody can see. Asking for the phase up front is what makes
 * the row appear the moment the dialog closes, instead of leaving a person
 * looking for the thing they just made.
 *
 * The actor is either one the organisation already holds or a name typed
 * here, which is the same choice *Replace…* offers for an application and for
 * the same reason: the rail is rarely complete the first time somebody draws
 * a journey, and making them leave to add a stakeholder loses the thought.
 *
 * The dialog answers with a request and writes nothing.
 */
import { useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Checkbox from '@mui/material/Checkbox'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import FormControlLabel from '@mui/material/FormControlLabel'
import MenuItem from '@mui/material/MenuItem'
import TextField from '@mui/material/TextField'
import type { DesignElement, DesignModel } from '../../model'
import { useStrings } from '../../i18n'
import type { NewLane } from './FunctionInspector'

/** The option that means "not one of these" — never a valid element id. */
const SOMEBODY_NEW = ''

export type LaneDialogProps = {
  model: DesignModel
  /** The journey's phases, in its own order; the first is where a lane starts. */
  phases: readonly DesignElement[]
  onCancel(): void
  onConfirm(lane: NewLane): void
}

export function LaneDialog({ model, phases, onCancel, onConfirm }: LaneDialogProps) {
  const { t } = useStrings()
  const actors = model.elements.filter((element) => element.kind === 'actor')
  const [actorId, setActorId] = useState<string>(actors[0]?.id ?? SOMEBODY_NEW)
  const [name, setName] = useState('')
  const [outside, setOutside] = useState(false)
  const [phaseId, setPhaseId] = useState(phases[0]?.id ?? '')

  const fresh = actorId === SOMEBODY_NEW
  const ready = phaseId !== '' && (fresh ? name.trim() !== '' : true)

  const confirm = () => {
    if (!ready) return
    onConfirm({
      ...(fresh ? { name: name.trim(), ...(outside ? { outside: true as const } : {}) } : { actorId }),
      phaseId,
      stepName: t('sheet.nameStep'),
    })
  }

  return (
    <Dialog open onClose={onCancel} maxWidth="xs" fullWidth>
      <DialogTitle>{t('sheet.laneTitle')}</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
        <TextField
          select size="small" fullWidth
          label={t('sheet.laneWho')}
          value={actorId}
          slotProps={{ htmlInput: { 'aria-label': t('sheet.laneWho') } }}
          onChange={(e) => setActorId(e.target.value)}
        >
          {actors.map((actor) => (
            <MenuItem key={actor.id} value={actor.id}>{actor.name}</MenuItem>
          ))}
          <MenuItem value={SOMEBODY_NEW}>{t('sheet.laneSomebodyNew')}</MenuItem>
        </TextField>

        {fresh && (
          <Box>
            <TextField
              size="small" fullWidth autoFocus
              label={t('sheet.laneName')}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <FormControlLabel
              sx={{ mt: 0.5 }}
              control={(
                <Checkbox
                  size="small"
                  checked={outside}
                  onChange={(e) => setOutside(e.target.checked)}
                />
              )}
              label={t('sheet.outsideOrganisation')}
            />
          </Box>
        )}

        <TextField
          select size="small" fullWidth
          label={t('sheet.laneWhere')}
          value={phaseId}
          slotProps={{ htmlInput: { 'aria-label': t('sheet.laneWhere') } }}
          onChange={(e) => setPhaseId(e.target.value)}
        >
          {phases.map((phase) => (
            <MenuItem key={phase.id} value={phase.id}>{phase.name}</MenuItem>
          ))}
        </TextField>
      </DialogContent>
      <DialogActions>
        <Button size="small" onClick={onCancel}>{t('common.cancel')}</Button>
        <Button size="small" variant="contained" disabled={!ready} onClick={confirm}>
          {t('sheet.laneAdd')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
