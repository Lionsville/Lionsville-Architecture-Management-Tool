// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The large preview: what a row is, read in place over its list, opened only by
 * selecting that row. As wide as the record as it really is, a thousand
 * characters and more, so the text reads at full measure with the facts wrapping
 * beside it; as tall as what it holds, up to the window less a margin, so a
 * record of one sentence is not a sentence in an empty sheet. The title and the
 * next step stay put while the body scrolls.
 *
 * What can be done sits where it sits on every record surface (`RecordActions`):
 * at the end of the head, *Open full record*, the other verbs, ✎ Edit and ⋯, then
 * ×; the next step in one band under the title. Nothing of the record's own is in
 * a foot.
 *
 * ‹ › and the arrow keys walk the list, Esc goes back to the row. Which record
 * is up belongs in the address, so a link reaches it and Back lets go of it: the
 * screen owns `currentId`, this reads it and asks to change it with `onSelect`.
 * That is what makes a preview the address is carrying and not a window state,
 * and why it can be open on a record the list no longer shows: then it has no
 * position to say and nowhere to walk, and it still reads.
 *
 * The focus is the List's to hand back, because the row to return to is the one
 * last shown here and not the one the preview was opened from.
 */
import { useEffect, useId, useRef } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import Modal from '@mui/material/Modal'
import { useStrings } from '../../i18n/LanguageContext'
import { BackIcon, CloseIcon, ForwardIcon } from '../icons'
import './Preview.css'

export type PreviewProps = {
  /** The list's order, as drawn, for walking it. */
  readonly ids: readonly string[]
  /** Null is closed. */
  readonly currentId: string | null
  readonly onSelect: (id: string | null) => void
  readonly title: ReactNode
  /** What the record is, said over its title as a panel says it: *Unit type*. */
  readonly kind?: string
  /** What the title says in words, where `title` is not a plain string. */
  readonly titleText?: string
  readonly code?: string
  /** What the count is a count of: *waiting*. The position reads *1 of 17 waiting*. */
  readonly listWord?: string
  /** *Open full record*, in the head, quiet, before what can be done. */
  readonly openFull?: { readonly label?: string; readonly onPress: () => void; readonly testId?: string }
  /** What can be done to the record, at the end of the head before ×: a `RecordActions` (verbs · ✎ Edit · ⋯). */
  readonly actions?: ReactNode
  /** The record's next step: one band under the title, the same place on every surface (`NextStep`). */
  readonly next?: ReactNode
  /** The facts beside the text. They wrap; they are not clipped. */
  readonly facts?: ReactNode
  /** A preview that is not a record's: what can be done with what it shows, in view at its foot. A record's actions are `actions` and `next`. */
  readonly foot?: ReactNode
  readonly children: ReactNode
  readonly dataGuide?: string
}

const WRITES = 'input, textarea, select, [contenteditable="true"]'

export function Preview({ ids, currentId, onSelect, title, kind, code, listWord, openFull, actions, next: nextStep, facts, foot, children, dataGuide }: PreviewProps) {
  const { t } = useStrings()
  const titleId = useId()
  const body = useRef<HTMLDivElement>(null)
  const index = currentId === null ? -1 : ids.indexOf(currentId)
  const previous = index > 0 ? ids[index - 1] : undefined
  const next = index >= 0 && index < ids.length - 1 ? ids[index + 1] : undefined

  // A new record reads from its top, whatever the last one was scrolled to.
  useEffect(() => { body.current?.scrollTo?.({ top: 0 }) }, [currentId])

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    // A menu opened from the foot is a portal: its arrows bubble here through React and walk its own items.
    if (!event.currentTarget.contains(event.target as Node)) return
    if ((event.target as HTMLElement).closest(WRITES)) return
    const to = event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? previous
      : event.key === 'ArrowRight' || event.key === 'ArrowDown' ? next : undefined
    if (to) {
      event.preventDefault()
      onSelect(to)
    }
  }

  return (
    <Modal
      open={currentId !== null}
      onClose={() => onSelect(null)}
      disableRestoreFocus
      slotProps={{ backdrop: { className: 'kit-preview__scrim' } }}
    >
      <div
        className="kit-preview" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}
        onKeyDown={onKeyDown} data-guide={dataGuide}
      >
        <div className="kit-preview__head">
          <button type="button" className="kit-preview__icon" aria-label={t('kit.preview.previous')} disabled={!previous} onClick={() => previous && onSelect(previous)}><BackIcon /></button>
          <button type="button" className="kit-preview__icon" aria-label={t('kit.preview.next')} disabled={!next} onClick={() => next && onSelect(next)}><ForwardIcon /></button>
          {index >= 0 && (
            <span className="kit-preview__position" aria-live="polite">
              {t('kit.preview.position', { at: index + 1, total: ids.length })}{listWord ? ` ${listWord}` : ''}
            </span>
          )}
          {code && <span className="kit-preview__code">{code}</span>}
          <span className="kit-preview__grow" />
          {openFull && <button type="button" className="kit-preview__link" data-testid={openFull.testId} onClick={openFull.onPress}>{openFull.label ?? t('kit.preview.openFull')}</button>}
          {actions}
          <button type="button" className="kit-preview__icon" aria-label={t('common.close')} onClick={() => onSelect(null)}><CloseIcon /></button>
        </div>
        {kind && <div className="kit-preview__kind">{kind}</div>}
        <h2 className="kit-preview__title" id={titleId} data-kinded={kind ? '' : undefined}>{title}</h2>
        {nextStep && <div className="kit-preview__next">{nextStep}</div>}
        <div className="kit-preview__body" ref={body} tabIndex={0} role="region" aria-labelledby={titleId}>
          <div className="kit-preview__text">{children}</div>
          {facts && <div className="kit-preview__facts">{facts}</div>}
        </div>
        {foot && <div className="kit-preview__foot">{foot}</div>}
      </div>
    </Modal>
  )
}

/** One fact beside the text: a label over a value that wraps. */
export function PreviewFact({ label, children }: { readonly label: string; readonly children: ReactNode }) {
  return (
    <div className="kit-preview__fact">
      <div className="kit-preview__factLabel">{label}</div>
      <div>{children}</div>
    </div>
  )
}
