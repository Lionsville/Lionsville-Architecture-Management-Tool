/**
 * Where a record should be answered for — the chooser in front of the four
 * gestures (ADR-0012 §10).
 *
 * Three inputs and no arithmetic: which gesture, which scope, and — for a
 * transfer — whether this scope goes on drawing the thing. What each gesture
 * can be offered and where it could send the record is the hook's
 * (`useGestures`), which asks `projects/gestures.ts`; what it would actually
 * write is worked out afterwards, and the confirmation that follows is the
 * shared `ConfirmDialog`.
 *
 * The order of the list is the order of ADR-0012's own table, so a person who
 * has read the manual meets the same four words in the same order.
 */
import { useEffect, useState } from 'react'
import Button from '@mui/material/Button'
import Checkbox from '@mui/material/Checkbox'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import FormControlLabel from '@mui/material/FormControlLabel'
import MenuItem from '@mui/material/MenuItem'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import type { StringKey, Translate } from '../../i18n'
import type { ElementId } from '../../model'
import { GESTURES } from '../../projects/gestures'
import type { GestureKind, GestureRequest } from '../../projects/gestures'
import type { ScopePath } from '../../projects/scopePath'

/** The four, named and explained. A `Record`, so a fifth arrives with words. */
const GESTURE_LABEL: Record<GestureKind, StringKey> = {
  link: 'gesture.link',
  promote: 'gesture.promote',
  demote: 'gesture.demote',
  transfer: 'gesture.transfer',
}

const GESTURE_WHAT: Record<GestureKind, StringKey> = {
  link: 'gesture.linkWhat',
  promote: 'gesture.promoteWhat',
  demote: 'gesture.demoteWhat',
  transfer: 'gesture.transferWhat',
}

export type MoveRecordDialogProps = {
  /** The record being moved, or nothing when the dialog is shut. */
  target?: { id: ElementId; name: string }
  /** Which gestures are on offer for it, in ADR-0012's own order. */
  offers: readonly GestureKind[]
  /** Where one of them could send it. */
  targets: (gesture: GestureKind) => readonly ScopePath[]
  /** What to call a scope: its path, or the word for the organisation. */
  scopeLabel: (path: ScopePath) => string
  onCancel: () => void
  onMove: (request: Omit<GestureRequest, 'scope'>) => void
  busy?: boolean
  s: Translate
}

export function MoveRecordDialog({
  target, offers, targets, scopeLabel, onCancel, onMove, busy = false, s,
}: MoveRecordDialogProps) {
  const order = GESTURES.filter((gesture) => offers.includes(gesture))
  const [gesture, setGesture] = useState<GestureKind | ''>('')
  const [to, setTo] = useState<ScopePath | undefined>(undefined)
  const [keepStandIn, setKeepStandIn] = useState(true)

  // Reset whenever another record is asked about: a dialog that opened on the
  // last answer would move the wrong thing on a second Enter.
  // The offers are derived from the id, so following the first of them is
  // following both — and following the array itself would reset the fields on
  // every render, because it is a fresh array each time.
  const id = target?.id
  const first = order[0]
  useEffect(() => {
    setGesture(first ?? '')
    setTo(undefined)
    setKeepStandIn(true)
  }, [id, first])

  if (!target) return null
  const choices = gesture ? targets(gesture) : []
  // *Link* needs no target: with none named, a record yields to the definition
  // the tree already answers with.
  const ready = gesture !== '' && (gesture === 'link' || to !== undefined)

  return (
    <Dialog open onClose={onCancel} maxWidth="xs" fullWidth>
      <DialogTitle>{s('gesture.title', { name: target.name })}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 0.5 }}>
          <TextField
            select
            size="small"
            label={s('gesture.what')}
            value={gesture}
            onChange={(event) => {
              setGesture(event.target.value as GestureKind)
              setTo(undefined)
            }}
            slotProps={{ htmlInput: { 'data-testid': 'gesture-kind' } }}
          >
            {order.map((one) => (
              <MenuItem key={one} value={one}>{s(GESTURE_LABEL[one])}</MenuItem>
            ))}
          </TextField>
          {gesture !== '' && (
            <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
              {s(GESTURE_WHAT[gesture])}
            </Typography>
          )}
          {gesture !== '' && choices.length > 0 && (
            <TextField
              select
              size="small"
              label={s('gesture.to')}
              value={to ?? ''}
              onChange={(event) => setTo(event.target.value)}
              slotProps={{ htmlInput: { 'data-testid': 'gesture-to' } }}
            >
              {choices.map((path) => (
                <MenuItem key={path} value={path}>{scopeLabel(path)}</MenuItem>
              ))}
            </TextField>
          )}
          {gesture === 'transfer' && (
            <FormControlLabel
              control={(
                <Checkbox
                  size="small"
                  checked={keepStandIn}
                  onChange={(event) => setKeepStandIn(event.target.checked)}
                  slotProps={{ input: { 'data-testid': 'gesture-keep' } as never }}
                />
              )}
              label={(
                <span>
                  <Typography component="span" sx={{ fontSize: 13 }}>{s('gesture.keepStandIn')}</Typography>
                  <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
                    {s('gesture.keepStandInHelp')}
                  </Typography>
                </span>
              )}
            />
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>{s('common.cancel')}</Button>
        <Button
          variant="contained"
          disabled={!ready || busy}
          data-testid="gesture-go"
          onClick={() => {
            if (gesture === '') return
            onMove({
              gesture,
              id: target.id,
              ...(to !== undefined ? { to } : {}),
              ...(gesture === 'transfer' ? { keepStandIn } : {}),
            })
          }}
        >
          {s(gesture === 'link' ? 'gesture.link' : 'gesture.go')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
