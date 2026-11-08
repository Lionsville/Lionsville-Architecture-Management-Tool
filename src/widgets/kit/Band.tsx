// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A state of the whole window that a person must not miss, and how to leave it:
 * looking at another day, on the way from a finding, an agent at work, read only
 * here. Words first, one way out. It sits in the page's flow and pushes the page
 * down, because a floating one covers what it is talking about.
 *
 * Each state has its own colour and its own mark, so the state is never hue alone.
 * There is never more than one: `BandStack` shows the first and counts the rest.
 */
import { useState } from 'react'
import type { ReactNode } from 'react'
import { useStrings } from '../../i18n/LanguageContext'
import { BackIcon, ForwardIcon } from '../icons'
import { Mark } from './Mark'
import type { MarkKind } from './Mark'
import './Band.css'

export type BandTone = 'looking' | 'finding' | 'agent' | 'readOnly' | 'editing' | 'info' | 'problem'

export type BandProps = {
  readonly tone: BandTone
  /** A mark other than the state's own: the weight of the finding a band carries. */
  readonly mark?: MarkKind
  /** What is true, in a short sentence. */
  readonly title: ReactNode
  readonly detail?: ReactNode
  /** Walking a set: *1 of 10*, with ‹ and ›. */
  readonly position?: {
    readonly at: number
    readonly total: number
    readonly onPrevious?: () => void
    readonly onNext?: () => void
  }
  /** The way out, last. A `Button` or a link. */
  readonly action?: ReactNode
  readonly dataGuide?: string
}

/** The kit's closed family, so the shape says which state it is in a greyscale print too. Read only has a word and no mark of its own. */
const MARK_OF: Partial<Record<BandTone, MarkKind>> = { looking: 'look', finding: 'review', agent: 'agent', editing: 'partial', info: 'none', problem: 'fix' }

export function Band({ tone, mark: said, title, detail, position, action, dataGuide }: BandProps) {
  const { t } = useStrings()
  const mark = said ?? MARK_OF[tone]
  return (
    <div className="kit-band" data-tone={tone} role="status" data-guide={dataGuide}>
      {/* One run of words, the mark at its start: a sentence that wraps keeps its mark beside it, not alone on a line above. */}
      <span className="kit-band__words">
        {mark && <Mark kind={mark} size={12} />}
        <strong className="kit-band__title">{title}</strong>
        {detail && <> <span className="kit-band__detail">{detail}</span></>}
      </span>
      {position && (
        <span className="kit-band__position">
          {t('kit.preview.position', { at: position.at, total: position.total })}
          {position.onPrevious && <button type="button" className="kit-band__step" aria-label={t('kit.preview.previous')} onClick={position.onPrevious}><BackIcon size={12} /></button>}
          {position.onNext && <button type="button" className="kit-band__step" aria-label={t('kit.preview.next')} onClick={position.onNext}><ForwardIcon size={12} /></button>}
        </span>
      )}
      {action && <span className="kit-band__action">{action}</span>}
    </div>
  )
}

export type StackedBand = BandProps & { readonly id: string }

/** Never two: the first band in the order given is drawn, and the rest collapse to a count that opens them. */
export function BandStack({ bands }: { readonly bands: readonly StackedBand[] }) {
  const { t } = useStrings()
  const [open, setOpen] = useState(false)
  const [first, ...rest] = bands
  if (!first) return null
  return (
    <div className="kit-bands">
      <div className="kit-bands__first">
        <Band {...first} />
        {rest.length > 0 && (
          <button type="button" className="kit-bands__more" aria-expanded={open} onClick={() => setOpen(!open)}>
            {t('kit.band.more', { count: rest.length })}
          </button>
        )}
      </div>
      {open && rest.map((band) => <Band key={band.id} {...band} />)}
    </div>
  )
}
