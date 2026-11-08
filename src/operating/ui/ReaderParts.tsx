// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What the readers share: everything a reader is handed, the words a person
 * wrote, the tick, the fold, and a role's or a type's days.
 */
import { useState } from 'react'
import type { ComponentProps, ReactElement, ReactNode } from 'react'
import type { Command } from '../../model/commands'
import type { BasedOn, Role, UnitType } from '../../model/operatingModel'
import { useStrings } from '../../i18n'
import type { MarkdownEditor as MarkdownEditorShape } from '../../documentation/ui/MarkdownEditor'
import { lazyPart } from '../../widgets/lazyPart'
import { PencilIcon } from '../../widgets/icons'
import { DateInput, PropertyRow, PropertyRows } from '../../widgets/kit/Field'
import type { MenuEntry } from '../../widgets/kit/Menu'
import { RecordActions } from '../../widgets/kit/RecordActions'
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

/**
 * A reader in its three parts, which the frame it is read in places: the large
 * preview puts the facts in its column beside the text and the foot in its bar,
 * the panel beside the structure or the grid stacks them. One reader, so a record
 * reads the same wherever it is opened.
 */
export type ReaderLayout = { readonly body: ReactNode; readonly facts?: ReactNode; readonly foot?: ReactNode }
export type ReaderFrame = (layout: ReaderLayout) => ReactElement

/** The panel's way, and a reader's on its own: the facts first, then the text, then the foot. */
export const stackedFrame: ReaderFrame = ({ body, facts, foot }) => (
  <>
    {facts && <div className="op-facts">{facts}</div>}
    {body}
    {foot}
  </>
)

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
        <span className="op-prose__pen" aria-hidden="true"><PencilIcon size={12} /></span>
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

/**
 * The foot every reader on the page ends with, whichever frame it is in (the panel
 * beside the structure and the grid, the preview over roles and exceptions): what
 * is done next at the start, and what takes the thing away alone at the far end,
 * where no other press lands on it.
 */
export function ReaderActions({ children, away }: { children?: ReactNode; away?: ReactNode }) {
  if (!children && !away) return null
  return (
    <div className="op-foot" data-testid="operating-reader-foot">
      {children}
      {away && <span className="op-foot__away">{away}</span>}
    </div>
  )
}

/**
 * The head of a reader, the panel's and the preview's alike, as every record's:
 * ✎ Edit, which opens the name for typing (the rest is written where it is read),
 * then ⋯ with History… and, last in the danger ink, deleting the thing — never a
 * button of its own at the foot. A reader who may not change it keeps History….
 */
export function ReaderMore({ item, parts, onEdit }: { item: OperatingItem | undefined; parts: ReaderParts; onEdit?: () => void }) {
  const { t } = useStrings()
  if (!item) return null
  const history = parts.onOpenHistory
  const more: MenuEntry[] = [
    ...(history ? [{ label: t('operating.historyMore'), 'data-testid': 'operating-history', onSelect: history }] : []),
    ...(parts.readOnly ? [] : [{ label: t('operating.deleteFromModel'), final: true, 'data-testid': 'operating-remove', onSelect: () => parts.onRemove(item.item.id) }]),
  ]
  return (
    <RecordActions
      {...(onEdit && !parts.readOnly ? { edit: { onPress: onEdit, tip: t('operating.editTip'), testId: 'operating-edit' } } : {})}
      more={more} moreLabel={t('operating.more')}
    />
  )
}

/**
 * The end of a reader: its history at the start where its head has none, and what takes it away, where it has a
 * word of its own, at the far end. Nothing at all where it has neither, so a preview draws no empty foot bar.
 */
export function readerFoot(parts: ReaderParts, { away, history = false }: { away?: ReactNode; history?: boolean } = {}): ReactNode {
  if (!away && !(history && parts.onOpenHistory)) return undefined
  return <ReaderFoot parts={parts} away={away} history={history} />
}

function ReaderFoot({ parts, away, history }: { parts: ReaderParts; away: ReactNode; history: boolean }) {
  const { t } = useStrings()
  return (
    <ReaderActions away={away}>
      {history && parts.onOpenHistory && <button type="button" className="op-link" data-testid="operating-history" onClick={parts.onOpenHistory}>{t('operating.history')}</button>}
    </ReaderActions>
  )
}
