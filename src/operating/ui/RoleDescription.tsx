// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What a role is, at length (ADR-0052): read as a document, its first part where
 * it is long so the role's duties stay in reach, and written in the full window as
 * every long text of the app is. Purpose stays the short sentence above it.
 */
import { useRef, useState } from 'react'
import type { ComponentProps } from 'react'
import type { Role } from '../../model/operatingModel'
import { useStrings } from '../../i18n'
import type { StringKey } from '../../i18n'
import type { MarkdownEditor as MarkdownEditorShape } from '../../documentation/ui/MarkdownEditor'
import { MarkdownDocument } from '../../documentation/ui/MarkdownDocument'
import type { UnkeptPart } from '../../platform/sourceProvider'
import { Clamped } from '../../widgets/kit/Clamped'
import { FocusedWindow, useWritingView } from '../../widgets/kit/FocusedWindow'
import { PanelSection } from '../../widgets/kit/Panel'
import { lazyPart } from '../../widgets/lazyPart'
import { useUnkept } from '../../widgets/unkept'
import { editRole } from '../edit'
import type { ReaderParts } from './ReaderParts'

const PART: UnkeptPart = 'role.description'

const MarkdownEditor = lazyPart<ComponentProps<typeof MarkdownEditorShape>>(
  () => import('../../documentation/ui/MarkdownEditor').then((held) => held.MarkdownEditor),
)

export function RoleDescription({ role, parts }: { role: Role; parts: ReaderParts }) {
  const { t } = useStrings()
  const unkept = useUnkept(PART)
  const [writing, setWriting] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const done = () => {
    setWriting(false)
    // The press that opened the window may be another one now: a first description turns *Describe the role* into *Edit*.
    setTimeout(() => { if (document.activeElement === document.body) root.current?.querySelector('button')?.focus() }, 0)
  }
  const text = role.description ?? ''
  const writes = !parts.readOnly && unkept === undefined
  if (!text && parts.readOnly) return null
  const edit = (label: string) => <button type="button" className="op-link" data-testid="operating-role-description-edit" onClick={() => setWriting(true)}>{label}</button>
  return (
    <div className="op-describe" ref={root} data-testid="operating-role-description" data-guide="operating.roleDescription">
      <PanelSection title={t('operating.description')} aside={writes && text ? edit(t('operating.descriptionEdit')) : undefined}>
        {text
          ? <Clamped key={role.id}><MarkdownDocument>{parts.renderMarkdown ? parts.renderMarkdown(text) : text}</MarkdownDocument></Clamped>
          : writes ? edit(t('operating.descriptionAdd')) : undefined}
        {unkept !== undefined && !parts.readOnly && <p className="op-small" data-testid="operating-role-description-unkept">{t(unkept as StringKey)}</p>}
      </PanelSection>
      {writing && writes && <DescriptionWindow role={role} parts={parts} text={text} onDone={done} />}
    </div>
  )
}

/** The full window: nothing is kept but by Save, which is one step. */
function DescriptionWindow({ role, parts, text, onDone }: { role: Role; parts: ReaderParts; text: string; onDone(): void }) {
  const { t } = useStrings()
  const { view, views } = useWritingView()
  const [draft, setDraft] = useState(text)
  const changed = draft.trim() !== text.trim()
  const keep = () => {
    if (changed) parts.dispatch(editRole(role.id, 'description', draft.trim() ? draft : ''))
    onDone()
  }
  return (
    <FocusedWindow open title={t('operating.editingDescription', { name: role.name })} views={views} changed={changed} onSave={keep} onCancel={onDone}>
      <div className="op-write">
        <MarkdownEditor
          variant="pane" autoFocus value={draft} onChange={setDraft} label={t('operating.description')} shownAs={view}
          {...(parts.renderMarkdown ? { renderPreview: parts.renderMarkdown } : {})}
        />
      </div>
    </FocusedWindow>
  )
}
