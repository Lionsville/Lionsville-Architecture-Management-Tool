// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What closing the window would lose, told to the host as one answer: the
 * document's work and an editor's. Each changes on its own, and either saying *no*
 * must not take back what the other said.
 */
import { useCallback, useEffect, useMemo, useRef } from 'react'
import type { FrameStore } from './frameStore'

export function useHostWithOwnWork<H extends { onUnsavedWork?: (unsaved: boolean) => void }>(host: H, frame: FrameStore): H {
  const report = host.onUnsavedWork
  const documentHolds = useRef(false)
  const told = useRef(false)
  const tell = useCallback(() => {
    const state = frame.get().work?.state
    const holds = documentHolds.current || state === 'dirty' || state === 'saving' || state === 'failed'
    if (holds === told.current) return
    told.current = holds
    report?.(holds)
  }, [frame, report])
  useEffect(() => frame.subscribe(tell), [frame, tell])
  return useMemo(() => (report ? { ...host, onUnsavedWork: (unsaved: boolean) => { documentHolds.current = unsaved; tell() } } : host), [host, report, tell])
}
