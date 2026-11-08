// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What closing the window would lose, told to the host as one answer: the
 * document's work, an editor's, and a write outside the open scope still under
 * way (`writeRefusals`). Each changes on its own, and any one saying *no* must
 * not take back what another said.
 */
import { useCallback, useEffect, useMemo, useRef } from 'react'
import type { FrameStore } from './frameStore'
import type { WritesUnderway } from '../writeRefusals'

export function useHostWithOwnWork<H extends { onUnsavedWork?: (unsaved: boolean) => void }>(
  host: H, frame: FrameStore, writes?: Pick<WritesUnderway, 'underway' | 'watchUnderway'>,
): H {
  const report = host.onUnsavedWork
  const documentHolds = useRef(false)
  const told = useRef(false)
  const tell = useCallback(() => {
    const state = frame.get().work?.state
    const holds = documentHolds.current || state === 'dirty' || state === 'saving' || state === 'failed' || (writes?.underway() ?? 0) > 0
    if (holds === told.current) return
    told.current = holds
    report?.(holds)
  }, [frame, report, writes])
  useEffect(() => frame.subscribe(tell), [frame, tell])
  useEffect(() => writes?.watchUnderway(tell), [writes, tell])
  // The window's own close, where the host's word has not reached it yet: a write under way holds it, as the session's does.
  useEffect(() => {
    if (!writes) return undefined
    const onLeaving = (event: BeforeUnloadEvent) => { if (writes.underway() > 0) event.preventDefault() }
    window.addEventListener('beforeunload', onLeaving)
    return () => window.removeEventListener('beforeunload', onLeaving)
  }, [writes])
  return useMemo(() => (report ? { ...host, onUnsavedWork: (unsaved: boolean) => { documentHolds.current = unsaved; tell() } } : host), [host, report, tell])
}
