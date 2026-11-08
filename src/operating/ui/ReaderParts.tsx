// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What the readers share: everything a reader is handed, the words a person
 * wrote, the tick, the fold, and a role's or a type's days.
 */
import { useState } from 'react'
import type { ComponentProps, ReactNode } from 'react'
import type { Command } from '../../model/commands'
import type { BasedOn, Role, UnitType } from '../../model/operatingModel'
import { useStrings } from '../../i18n'
import type { MarkdownEditor as MarkdownEditorShape } from '../../documentation/ui/MarkdownEditor'
import { lazyPart } from '../../widgets/lazyPart'
import { Button } from '../../widgets/kit/Button'
import { DateInput, PropertyRow, PropertyRows } from '../../widgets/kit/Field'
import { setDay, setSuccessors } from '../edit'
import type { OperatingItem, OperatingModel } from '../edit'
import { entryOf } from '../library'
import { libraryById } from '../libraries'
import type { OrganisationFacts } from '../organisationFacts'
import type { LineChange, RefuseLine } from './lineChange'
import '../../widgets/kit/hidden.css'

const MarkdownEditor = lazyPart<ComponentProps<typeof MarkdownEditorShape>>(
  () => import('../../documentation/ui/MarkdownEditor').then((held) => held.MarkdownEditor),
)

/** What every reader on the page is handed. */
export type ReaderParts = {
  model: OperatingModel
  readOnly: boolean
  dispatch(command: Command): void
  onSelect(id: string | undefined): void
  onRemove(id: string): void
  facts: OrganisationFacts | undefined
  refuseLine: RefuseLine | undefined
  renderMarkdown: ((text: string) => ReactNode) | undefined
  /** What the host says beside an item: for one that ends, the people it leaves to decide. */
  aside: ReactNode
  onOpenHistory: (() => void) | undefined
  /** Goes to a unit's place in the organisation. */
  onOpenUnit: ((unit: { id: string; scope: string }) => void) | undefined
  /** Goes to the organisation chart. */
  onOpenChart: (() => void) | undefined
}

export type { LineChange }

/** Words a person wrote: read as text, written in the one editor. Nothing is a form until it is pressed. */
export function Prose({ label, value, onChange, readOnly, render, testId }: {
  label: string; value: string; onChange(next: string): void; readOnly: boolean; render: ((text: string) => ReactNode) | undefined; testId?: string
}) {
  const { t } = useStrings()
  const [writing, setWriting] = useState(false)
  if (writing && !readOnly) {
    return (
      <div className="op-prose" data-testid={testId}>
        <MarkdownEditor
          value={value} onChange={onChange} onBlur={() => setWriting(false)} label={label} autoFocus maxRows={12}
          {...(render ? { renderPreview: render } : {})}
        />
      </div>
    )
  }
  if (readOnly) return value ? <div className="op-prose" data-testid={testId}>{render ? render(value) : value}</div> : null
  return (
    <div className="op-prose" data-testid={testId}>
      {/* The name read out holds the words shown, so a person who says what they see can press it (WCAG 2.5.3). */}
      <button type="button" className="op-prose__read" onClick={() => setWriting(true)}>
        {value && <span className="kit-hidden">{t('operating.write', { label })}: </span>}
        {value ? (render ? render(value) : value) : <span className="op-quiet">{t('operating.writeEmpty', { label })}</span>}
      </button>
    </div>
  )
}

export function Tick({ checked, disabled, onChange, children, testId }: { checked: boolean; disabled?: boolean; onChange(on: boolean): void; children: ReactNode; testId?: string }) {
  return (
    <label className="op-tick">
      <input type="checkbox" checked={checked} disabled={disabled} data-testid={testId} onChange={(event) => onChange(event.target.checked)} />
      <span>{children}</span>
    </label>
  )
}

/** What is rare, folded away. */
export function Fold({ label, children, testId }: { label: string; children: ReactNode; testId?: string }) {
  return (
    <details className="op-fold" data-testid={testId}>
      <summary>{label}</summary>
      {children}
    </details>
  )
}

/** A unit type's or a role's days and what follows it (ADR-0036 §6). Each change is one step. */
export function OverTime({ kind, item, others, readOnly, dispatch }: {
  kind: 'unitType' | 'role'; item: UnitType | Role; others: readonly { id: string; name: string }[]; readOnly: boolean; dispatch(command: Command): void
}) {
  const { t } = useStrings()
  const candidates = others.filter((one) => one.id !== item.id)
  const successors = item.successors ?? []
  const day = (field: 'from' | 'until') => ({
    value: item[field] ?? '', empty: t('operating.noDay'), edit: ((editor: { value: string; onChange(value: string): void; commit(value?: string): void; ties: object }) => (
      <DateInput {...editor.ties} data-fit data-testid={`operating-${field}`} value={editor.value} onChange={editor.onChange} onBlur={() => editor.commit()} />
    )),
    onCommit: (value: string) => dispatch(setDay(kind, item.id, field, value)),
  })
  return (
    <div data-testid="operating-over-time">
      <PropertyRows readOnly={readOnly}>
        <PropertyRow label={t('operating.from')} {...day('from')} />
        <PropertyRow label={t('operating.until')} {...day('until')} />
      </PropertyRows>
      {candidates.length > 0 && (
        <Fold label={t('operating.successorsCount', { count: successors.length })}>
          {candidates.map((one) => (
            <Tick
              key={one.id} checked={successors.includes(one.id)} disabled={readOnly} testId={`operating-successor-${one.id}`}
              onChange={(on) => dispatch(setSuccessors(kind, item.id, on ? [...successors, one.id] : successors.filter((id) => id !== one.id)))}
            >
              {one.name}
            </Tick>
          ))}
        </Fold>
      )}
      <p className="op-small">{t('operating.overTimeHint')}</p>
    </div>
  )
}

/** Where an item came from: a library's entry, or the organisation's own. */
export function SourceWord({ basedOn }: { basedOn: BasedOn | undefined }) {
  const { t } = useStrings()
  if (!basedOn) return <span className="op-small">{t('operating.ownItem')}</span>
  const library = libraryById(basedOn.library)
  const entry = library && entryOf(library, basedOn.entry)
  const language = basedOn.language === 'nl' || basedOn.language === 'de' ? basedOn.language : 'en'
  return <span className="op-small">{t('operating.basedOn', { library: library?.name ?? basedOn.library, entry: entry?.item.name[language] ?? basedOn.entry })}</span>
}

/** The end of every reader: history, the host's aside, and removing it. */
export function ReaderFoot({ item, parts }: { item: OperatingItem; parts: ReaderParts }) {
  const { t } = useStrings()
  return (
    <>
      {parts.aside}
      {parts.onOpenHistory && (
        <div className="op-fold">
          <button type="button" className="op-link" data-testid="operating-history" onClick={parts.onOpenHistory}>{t('operating.history')}</button>
        </div>
      )}
      {!parts.readOnly && (
        <div className="op-actions">
          <Button variant="danger" size="small" data-testid="operating-remove" onClick={() => parts.onRemove(item.item.id)}>{t('operating.remove')}</Button>
        </div>
      )}
    </>
  )
}
