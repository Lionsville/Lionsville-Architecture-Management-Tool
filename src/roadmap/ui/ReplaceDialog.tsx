/**
 * Replace… — the three inputs a replacement needs (ADR-0010).
 *
 * What arrives (a new application in the image of this one, or one that
 * already exists), whether this one goes or only sheds part of itself, what
 * else retires into the same thing, and the two days: the shadow run's start
 * and the cutover. Everything else the gesture writes is derived from those
 * by `model/replacement.ts`, and which interface moves when is deliberately
 * not asked here — that is the work, and the plan's page is where it is done.
 *
 * The dialog answers with a request and writes nothing; the caller supplies
 * the words and dispatches the transaction.
 */
import { useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import FormControlLabel from '@mui/material/FormControlLabel'
import MenuItem from '@mui/material/MenuItem'
import Radio from '@mui/material/Radio'
import RadioGroup from '@mui/material/RadioGroup'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { isDay } from '../../model'
import type { DesignElement, DesignModel, ElementId, ReplacementRequest } from '../../model'
import { useStrings } from '../../i18n'

/** What the dialog answers with: the request minus the words, which are the caller's. */
export type ReplaceAnswer = Omit<ReplacementRequest, 'words'>

export type ReplaceDialogProps = {
  /** The element the gesture starts from; absent closes the dialog. */
  subject: DesignElement | undefined
  model: DesignModel
  onCancel(): void
  onConfirm(answer: ReplaceAnswer): void
}

export function ReplaceDialog({ subject, model, onCancel, onConfirm }: ReplaceDialogProps) {
  const { t } = useStrings()
  const [arrives, setArrives] = useState<'new' | 'existing'>('new')
  const [name, setName] = useState('')
  const [existingId, setExistingId] = useState('')
  const [shape, setShape] = useState<'goes' | 'stays'>('goes')
  const [also, setAlso] = useState<ElementId[]>([])
  const [adding, setAdding] = useState('')
  const [shadowFrom, setShadowFrom] = useState('')
  const [cutover, setCutover] = useState('')

  // Each opening starts afresh from the subject: its name suggests the new
  // one's, and nothing from the last replacement carries over.
  useEffect(() => {
    if (!subject) return
    setArrives('new')
    setName(t('replace.newName', { name: subject.name }))
    setExistingId('')
    setShape('goes')
    setAlso([])
    setAdding('')
    setShadowFrom('')
    setCutover('')
  }, [subject, t])

  if (!subject) return null

  const others = model.elements
    .filter((element) => element.id !== subject.id && element.kind === subject.kind && !also.includes(element.id))
    .sort((a, b) => a.name.localeCompare(b.name))
  const nameOf = (id: ElementId) => model.elements.find((element) => element.id === id)?.name ?? id
  const target = arrives === 'new' ? name.trim() : existingId
  const datesInOrder = isDay(shadowFrom) && isDay(cutover) && shadowFrom <= cutover
  const ready = Boolean(target) && datesInOrder

  const confirm = () => {
    if (!ready) return
    onConfirm({
      from: [
        { elementId: subject.id, role: shape === 'goes' ? 'retires' : 'changes' },
        ...also.map((elementId) => ({ elementId, role: 'retires' as const })),
      ],
      to: arrives === 'new' ? { name: name.trim() } : { elementId: existingId },
      shadowFrom,
      cutover,
    })
  }

  return (
    <Dialog open onClose={onCancel} maxWidth="sm" fullWidth>
      <DialogTitle>{t('replace.title', { name: subject.name })}</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>{t('replace.arrives')}</Typography>
          <RadioGroup value={arrives} onChange={(e) => setArrives(e.target.value as 'new' | 'existing')}>
            <FormControlLabel value="new" control={<Radio size="small" />} label={t('replace.newApplication')} />
            {arrives === 'new' && (
              <TextField
                size="small" autoFocus label={t('common.name')} value={name} sx={{ ml: 4, mb: 1 }}
                onChange={(e) => setName(e.target.value)}
              />
            )}
            <FormControlLabel value="existing" control={<Radio size="small" />} label={t('replace.existing')} />
            {arrives === 'existing' && (
              <TextField
                select size="small" label={t('replace.which')} value={existingId} sx={{ ml: 4, mb: 1 }}
                slotProps={{ htmlInput: { 'aria-label': t('replace.which') } }}
                onChange={(e) => setExistingId(e.target.value)}
              >
                {others.map((element) => <MenuItem key={element.id} value={element.id}>{element.name}</MenuItem>)}
              </TextField>
            )}
          </RadioGroup>
        </Box>

        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>{t('replace.shape')}</Typography>
          <RadioGroup value={shape} onChange={(e) => setShape(e.target.value as 'goes' | 'stays')}>
            <FormControlLabel value="goes" control={<Radio size="small" />} label={t('replace.goes', { name: subject.name })} />
            <FormControlLabel value="stays" control={<Radio size="small" />} label={t('replace.stays', { name: subject.name })} />
          </RadioGroup>
        </Box>

        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>{t('replace.also')}</Typography>
          {also.map((id) => (
            <Box key={id} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography sx={{ fontSize: 13, flex: 1 }}>{nameOf(id)}</Typography>
              <Button size="small" onClick={() => setAlso((list) => list.filter((one) => one !== id))}>{t('plan.remove')}</Button>
            </Box>
          ))}
          {others.filter((element) => element.id !== existingId).length > 0 && (
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mt: 0.5 }}>
              <TextField
                select size="small" label={t('plan.addElement')} value={adding} sx={{ flex: 1 }}
                slotProps={{ htmlInput: { 'aria-label': t('replace.alsoField') } }}
                onChange={(e) => setAdding(e.target.value)}
              >
                {others.filter((element) => element.id !== existingId).map((element) => (
                  <MenuItem key={element.id} value={element.id}>{element.name}</MenuItem>
                ))}
              </TextField>
              <Button size="small" disabled={!adding} onClick={() => { setAlso((list) => [...list, adding]); setAdding('') }}>
                {t('plan.add')}
              </Button>
            </Box>
          )}
        </Box>

        <Box sx={{ display: 'flex', gap: 1 }}>
          <TextField
            type="date" size="small" fullWidth label={t('replace.shadowFrom')} value={shadowFrom}
            slotProps={{ inputLabel: { shrink: true }, htmlInput: { 'aria-label': t('replace.shadowFrom') } }}
            onChange={(e) => setShadowFrom(e.target.value)}
          />
          <TextField
            type="date" size="small" fullWidth label={t('replace.cutover')} value={cutover}
            slotProps={{ inputLabel: { shrink: true }, htmlInput: { 'aria-label': t('replace.cutover') } }}
            onChange={(e) => setCutover(e.target.value)}
            error={isDay(shadowFrom) && isDay(cutover) && !datesInOrder}
          />
        </Box>
        <Typography variant="caption" color="text.secondary">{t('replace.help')}</Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>{t('common.cancel')}</Button>
        <Button variant="contained" disabled={!ready} onClick={confirm}>{t('replace.start')}</Button>
      </DialogActions>
    </Dialog>
  )
}
