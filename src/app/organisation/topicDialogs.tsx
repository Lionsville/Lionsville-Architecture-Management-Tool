// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A new topic (ADR-0042 §3): its name, the topic it is under or none, and the
 * scopes it is relevant to from today. Offered from a home's chooser, so it stays in
 * the first download; a topic's own fields are in `TopicEditDialog`.
 */
import { useState } from 'react'
import { AutocompleteBox, FieldBox } from '../../widgets/kit/FieldBox'
import { useStrings } from '../../i18n/LanguageContext'
import { isWithinScope } from '../../projects/scopePath'
import { Dialog } from '../../widgets/kit/Dialog'
import { SelectField, TextField } from '../../widgets/kit/Field'
import { renderScopeOption } from '../../widgets/ScopeChoices'
import type { ScopeChoice } from '../../widgets/ScopeChoices'
import type { TopicsAccess } from './TopicsContext'

/** The topics a topic may be filed under: none of its own subtree. */
export function underChoices(access: TopicsAccess, none: string, topic?: string) {
  return [
    { value: '', label: none },
    ...access.list().filter((one) => topic === undefined || !isWithinScope(one.id, topic)).map((one) => ({ value: one.id, label: one.name })),
  ]
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
      actions={{
        cancel: { onClick: () => onClose(), label: t('common.cancel') },
        outcome: { disabled: !name.trim() || busy, onClick: make, 'data-testid': 'topic-create', label: t('topics.create') },
      }}
    >
      <p>{t('topics.newIntro')}</p>
      <TextField autoFocus label={t('topics.name')} value={name} onChange={setName} data-testid="topic-name" />
      <SelectField label={t('topics.under')} value={under} onChange={setUnder} options={underChoices(access, t('topics.underNone'))} />
      <AutocompleteBox
        multiple options={access.scopeChoices() as ScopeChoice[]} value={places} onChange={(_event, next) => setPlaces(next)}
        getOptionLabel={(one) => one.name} isOptionEqualToValue={(a, b) => a.path === b.path} renderOption={renderScopeOption}
        renderInput={(params) => <FieldBox {...params} label={t('topics.relevantTo')} />}
      />
    </Dialog>
  )
}
