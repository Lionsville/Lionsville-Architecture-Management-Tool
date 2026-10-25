// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The catalogue's two forms (ADR-0042 §3): a new topic — its name, the topic
 * it is under or none, and the scopes it is relevant to from today — and a
 * topic's own fields, the topic it is filed under among them.
 */
import { useState } from 'react'
import Autocomplete from '@mui/material/Autocomplete'
import Button from '@mui/material/Button'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import MenuItem from '@mui/material/MenuItem'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { useStrings } from '../../i18n/LanguageContext'
import { isWithinScope } from '../../projects/scopePath'
import { FieldsDialog } from '../../widgets/CompactForms'
import type { TopicSummary, TopicsAccess } from './TopicsContext'

/** The topics a topic may be filed under: none of its own subtree. */
function underChoices(access: TopicsAccess, topic?: string): readonly TopicSummary[] {
  return access.list().filter((one) => topic === undefined || !isWithinScope(one.id, topic))
}

export function EditTopicDialog({ topic, access, onClose }: { topic: TopicSummary; access: TopicsAccess; onClose: () => void }) {
  const { t } = useStrings()
  const [name, setName] = useState(topic.name)
  const [description, setDescription] = useState(topic.description ?? '')
  const [under, setUnder] = useState(topic.parent ?? '')
  const save = () => {
    access.update(topic.id, { name, description, ...(under !== (topic.parent ?? '') ? { parent: under } : {}) })
    onClose()
  }
  return (
    <FieldsDialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{t('topics.editTitle', { name: topic.name })}</DialogTitle>
      <DialogContent sx={{ display: 'grid', gap: 2, pt: '8px !important' }}>
        <TextField autoFocus label={t('topics.name')} value={name} onChange={(event) => setName(event.target.value)} />
        <TextField label={t('topics.description')} value={description} onChange={(event) => setDescription(event.target.value)} multiline minRows={2} />
        <TextField select label={t('topics.under')} value={under} onChange={(event) => setUnder(event.target.value)} slotProps={{ inputLabel: { shrink: true }, select: { displayEmpty: true } }}>
          <MenuItem value="">{t('topics.underNone')}</MenuItem>
          {underChoices(access, topic.id).map((one) => <MenuItem key={one.id} value={one.id}>{one.name}</MenuItem>)}
        </TextField>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button variant="contained" disabled={!name.trim()} onClick={save}>{t('topics.save')}</Button>
      </DialogActions>
    </FieldsDialog>
  )
}

export function NewTopicDialog({ access, parent, onClose }: { access: TopicsAccess; parent?: string; onClose: (id?: string) => void }) {
  const { t } = useStrings()
  const [name, setName] = useState('')
  const [under, setUnder] = useState(parent ?? '')
  const [places, setPlaces] = useState<{ path: string; name: string }[]>([])
  const [busy, setBusy] = useState(false)
  const make = () => {
    setBusy(true)
    void access.create(name, under || undefined, places.map((one) => one.path)).then((made) => onClose(made))
  }
  return (
    <FieldsDialog open onClose={() => onClose()} maxWidth="sm" fullWidth>
      <DialogTitle>{under ? t('topics.newSubtopic') : t('topics.new')}</DialogTitle>
      <DialogContent sx={{ display: 'grid', gap: 2, pt: '8px !important' }}>
        <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>{t('topics.newIntro')}</Typography>
        <TextField autoFocus label={t('topics.name')} value={name} onChange={(event) => setName(event.target.value)} slotProps={{ htmlInput: { 'data-testid': 'topic-name' } }} />
        <TextField select label={t('topics.under')} value={under} onChange={(event) => setUnder(event.target.value)} slotProps={{ inputLabel: { shrink: true }, select: { displayEmpty: true } }}>
          <MenuItem value="">{t('topics.underNone')}</MenuItem>
          {underChoices(access).map((one) => <MenuItem key={one.id} value={one.id}>{one.name}</MenuItem>)}
        </TextField>
        <Autocomplete
          multiple options={access.scopeChoices() as { path: string; name: string }[]} value={places} onChange={(_event, next) => setPlaces(next)}
          getOptionLabel={(one) => one.name} isOptionEqualToValue={(a, b) => a.path === b.path}
          renderInput={(params) => <TextField {...params} label={t('topics.relevantTo')} />}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={() => onClose()}>{t('common.cancel')}</Button>
        <Button variant="contained" disabled={!name.trim() || busy} onClick={make} data-testid="topic-create">{t('topics.create')}</Button>
      </DialogActions>
    </FieldsDialog>
  )
}
