// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What closing the window would lose, told to the host as one answer: the
 * document's work, an editor's, and a write outside the open scope still under
 * way (`writeRefusals`). Each changes on its own, and any one saying *no* must
 * not take back what another said.
 *
 * **And what the place refused**, told apart (`onRefusedWork`): a refused
 * write outside the open scope settled when it was refused, so it counted as
 * nothing and a quit closed over it without a word; and the open scope's
 * refused changes counted as a write still to come, so a quit waited five
 * seconds for a write that had already failed. Neither will land by waiting:
 * the host asks at once. A change still being written is a write, and is
 * waited for first.
 */
import { useCallback, useEffect, useMemo, useRef } from 'react'
import type { FrameStore } from './frameStore'
import type { WriteRefusals, WritesUnderway } from '../writeRefusals'

/** What the host is told: whether closing waits for a write, and how many refused changes it would leave. */
type HostOwnWork = { onUnsavedWork?: (unsaved: boolean) => void; onRefusedWork?: (refused: number) => void }

export function useHostWithOwnWork<H extends HostOwnWork>(
  host: H, frame: FrameStore, writes?: Pick<WritesUnderway, 'underway' | 'watchUnderway'>,
  refusals?: Pick<WriteRefusals, 'list' | 'subscribe'>,
): H {
  const report = host.onUnsavedWork
  const reportRefused = host.onRefusedWork
  const documentHolds = useRef(false)
  const told = useRef(false)
  const toldRefused = useRef(0)
  const tell = useCallback(() => {
    const { work, screen } = frame.get()
    const state = work?.state
    // The open scope's changes the place refused: no write is coming for them, so the document's word is not a write.
    const sessionRefused = screen?.notWritten ? Math.max(1, screen.notWritten.rows().length) : 0
    const holds = (documentHolds.current && sessionRefused === 0) || state === 'dirty' || state === 'saving' || state === 'failed'
      || (writes?.underway() ?? 0) > 0
    const refused = sessionRefused + (refusals?.list().length ?? 0)
    if (refused !== toldRefused.current) { toldRefused.current = refused; reportRefused?.(refused) }
    if (holds === told.current) return
    told.current = holds
    report?.(holds)
  }, [frame, report, reportRefused, writes, refusals])
  useEffect(() => frame.subscribe(tell), [frame, tell])
  useEffect(() => writes?.watchUnderway(tell), [writes, tell])
  useEffect(() => refusals?.subscribe(tell), [refusals, tell])
  // The window's own close, where the host's word has not reached it yet: a write under way holds it, as the session's does.
  useEffect(() => {
    if (!writes) return undefined
    const onLeaving = (event: BeforeUnloadEvent) => { if (writes.underway() > 0) event.preventDefault() }
    window.addEventListener('beforeunload', onLeaving)
    return () => window.removeEventListener('beforeunload', onLeaving)
  }, [writes])
  return useMemo(() => (report ? { ...host, onUnsavedWork: (unsaved: boolean) => { documentHolds.current = unsaved; tell() } } : host), [host, report, tell])
}
