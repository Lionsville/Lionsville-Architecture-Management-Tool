// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The catalogue's two forms (ADR-0042 §3): a new topic — its name, the topic
 * it is under or none, and the scopes it is relevant to from today — and a
 * topic's own fields, the topic it is filed under among them.
 */
import { useState } from 'react'
import Autocomplete from '@mui/material/Autocomplete'
import MuiTextField from '@mui/material/TextField'
import { useStrings } from '../../i18n/LanguageContext'
import { MarkdownEditor } from '../../documentation/ui/MarkdownEditor'
import { renderMarkdown } from '../../documentation/ui/renderMarkdown'
import { isWithinScope } from '../../projects/scopePath'
import { Button } from '../../widgets/kit/Button'
import { Dialog } from '../../widgets/kit/Dialog'
import { SelectField, TextField } from '../../widgets/kit/Field'
import { renderScopeOption } from '../../widgets/ScopeChoices'
import type { ScopeChoice } from '../../widgets/ScopeChoices'
import type { TopicSummary, TopicsAccess } from './TopicsContext'

/** The topics a topic may be filed under: none of its own subtree. */
function underChoices(access: TopicsAccess, none: string, topic?: string) {
  return [
    { value: '', label: none },
    ...access.list().filter((one) => topic === undefined || !isWithinScope(one.id, topic)).map((one) => ({ value: one.id, label: one.name })),
  ]
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
    <Dialog
      open size="m" title={t('topics.editTitle', { name: topic.name })} onClose={onClose}
      actions={(
        <>
          <Button variant="plain" onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="primary" disabled={!name.trim()} onClick={save}>{t('topics.save')}</Button>
        </>
      )}
    >
      <TextField autoFocus label={t('topics.name')} value={name} onChange={setName} />
      <MarkdownEditor label={t('topics.description')} value={description} onChange={setDescription} minRows={2} renderPreview={renderMarkdown} />
      <SelectField label={t('topics.under')} value={under} onChange={setUnder} options={underChoices(access, t('topics.underNone'), topic.id)} />
    </Dialog>
  )
}

/** A new topic, under `parent` where one is said; `name` and `relevantTo` start the form where it is opened from somewhere that knows them. */
export function NewTopicDialog({ access, parent, name: named = '', relevantTo = [], onClose }: {
  access: TopicsAccess; parent?: string; name?: string; relevantTo?: readonly string[]; onClose: (id?: string) => void
}) {
  const { t } = useStrings()
  const [name, setName] = useState(named)
  const [under, setUnder] = useState(parent ?? '')
  const [places, setPlaces] = useState<ScopeChoice[]>(() => access.scopeChoices().filter((one) => relevantTo.includes(one.path)))
  const [busy, setBusy] = useState(false)
  const make = () => {
    setBusy(true)
    void access.create(name, under || undefined, places.map((one) => one.path)).then((made) => onClose(made))
  }
  return (
    <Dialog
      open size="m" title={under ? t('topics.newSubtopic') : t('topics.new')} onClose={() => onClose()}
      actions={(
        <>
          <Button variant="plain" onClick={() => onClose()}>{t('common.cancel')}</Button>
          <Button variant="primary" disabled={!name.trim() || busy} onClick={make} data-testid="topic-create">{t('topics.create')}</Button>
        </>
      )}
    >
      <p>{t('topics.newIntro')}</p>
      <TextField autoFocus label={t('topics.name')} value={name} onChange={setName} data-testid="topic-name" />
      <SelectField label={t('topics.under')} value={under} onChange={setUnder} options={underChoices(access, t('topics.underNone'))} />
      <Autocomplete
        multiple options={access.scopeChoices() as ScopeChoice[]} value={places} onChange={(_event, next) => setPlaces(next)}
        getOptionLabel={(one) => one.name} isOptionEqualToValue={(a, b) => a.path === b.path} renderOption={renderScopeOption}
        renderInput={(params) => <MuiTextField {...params} label={t('topics.relevantTo')} />}
      />
    </Dialog>
  )
}
