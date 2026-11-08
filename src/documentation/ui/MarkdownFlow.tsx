// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * One document written in several parts, with one bar.
 *
 * Each part is a `MarkdownEditor` of the `flow` variant and keeps everything of its
 * own: its text, its undo, its completions. The bar is the one a pane draws, and the
 * part in use lends itself to it (a portal into the seat this holds), so a button
 * means the part the caret is in and there is never a row of tools per heading. The
 * first part holds the seat until another is pressed, so the bar is there from the
 * start and does not appear under the pointer.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useStrings } from '../../i18n/LanguageContext'
import { refusePress, useReadOnlyPreview } from './quietPreview'
import './MarkdownDocument.css'

type Flow = {
  slot: HTMLElement | null
  setSlot: (slot: HTMLElement | null) => void
  seated: string | undefined
  seat: (id: string, always: boolean) => void
  leave: (id: string) => void
}

const FlowContext = createContext<Flow | undefined>(undefined)

export function MarkdownFlow({ children }: { children: ReactNode }) {
  const [slot, setSlot] = useState<HTMLElement | null>(null)
  const [seated, setSeated] = useState<string | undefined>(undefined)
  const seat = useCallback((id: string, always: boolean) => setSeated((held) => (always || held === undefined ? id : held)), [])
  const leave = useCallback((id: string) => setSeated((held) => (held === id ? undefined : held)), [])
  const flow = useMemo(() => ({ slot, setSlot, seated, seat, leave }), [slot, seated, seat, leave])
  return <FlowContext.Provider value={flow}>{children}</FlowContext.Provider>
}

/** The one bar, staying in view as the document scrolls, and how long the whole document is. */
export function MarkdownFlowBar({ words }: { words: number }) {
  const { t } = useStrings()
  const flow = useContext(FlowContext)
  return (
    <div className="md-flow-bar" data-testid="md-flow-bar">
      <div className="md-flow-bar__seat" ref={flow?.setSlot} />
      <span className="md-editor__count" data-testid="md-word-count">{words === 1 ? t('md.oneWord') : t('md.words', { count: words })}</span>
    </div>
  )
}

/** What a part knows of the bar: where it goes, and whether it is this part's now. */
export function useFlowSeat(id: string, on: boolean): { slot: HTMLElement | null; mine: boolean; claim: () => void } | undefined {
  const flow = useContext(FlowContext)
  const held = on ? flow : undefined
  const seat = held?.seat
  const leave = held?.leave
  useEffect(() => {
    seat?.(id, false)
    return () => leave?.(id)
  }, [id, seat, leave])
  if (!held) return undefined
  return { slot: held.slot, mine: held.seated === id, claim: () => held.seat(id, true) }
}

export type FlowView = 'write' | 'side' | 'preview'

/**
 * A document being written and how it will read: one of them, or the two beside
 * each other. Beside each other they must not look alike, since both say the same
 * words in the same sizes: the one written is a field, raised and bordered and
 * ringed while the caret is in it, and the one read is the page, under a Preview
 * heading level with the bar, past a rule. Written is kept while it is not shown,
 * because each part's undo and caret live in its text box.
 */
export function MarkdownFlowBeside({ view, writing, reading, 'data-testid': testId }: {
  view: FlowView
  writing: ReactNode
  reading: ReactNode
  /** On what is read. */
  'data-testid'?: string
}) {
  const { t } = useStrings()
  const read = useRef<HTMLDivElement>(null)
  useReadOnlyPreview(read, view)
  return (
    <div className="md-beside" data-view={view}>
      <div className="md-beside__write" hidden={view === 'preview'}>{writing}</div>
      {view !== 'write' && (
        <div className="md-beside__read" ref={read} data-testid={testId} onClickCapture={refusePress} onKeyDownCapture={refusePress} onAuxClickCapture={refusePress}>
          {view === 'side' && <div className="md-beside__head">{t('md.preview')}</div>}
          {reading}
        </div>
      )}
    </div>
  )
}
