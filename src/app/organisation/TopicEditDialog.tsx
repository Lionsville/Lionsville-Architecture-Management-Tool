// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A topic's own fields (ADR-0042 §3), the topic it is filed under among them: reached
 * from its reader, so the editor's script arrives with that.
 */
import { useState } from 'react'
import { useStrings } from '../../i18n/LanguageContext'
import { MarkdownEditor } from '../../documentation/ui/MarkdownEditor'
import { renderMarkdown } from '../../documentation/ui/renderMarkdown'
import { Button } from '../../widgets/kit/Button'
import { Dialog } from '../../widgets/kit/Dialog'
import { SelectField, TextField } from '../../widgets/kit/Field'
import type { TopicSummary, TopicsAccess } from './TopicsContext'
import { underChoices } from './topicDialogs'

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
