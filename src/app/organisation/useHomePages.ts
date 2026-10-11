// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Which of a home's pages is up over its cards — the registers, the people
 * register, the Checks page — and what it was asked to pick (ADR-0019,
 * ADR-0033): one at a time, opened from a card or a count here, or asked for
 * by an agent, a provider or Back. State here and not in the shell, because
 * none of them is the home's own document; the shell is told which is up on
 * every change and when the screen goes, so it can say where the app is.
 *
 * A page opened here may be asked to pick something on it — a person, a
 * check — as an agent's request may: the request the page reads is the last
 * of either.
 */
import { useCallback, useEffect, useState } from 'react'
import type { OrgPage, OrgPageRequest } from '../useShellAgent'

export type HomePagesState = {
  /** The page up, or none. */
  openPage: OrgPage | undefined
  /** The last request a page reads what to pick from: the shell's, or a press here. */
  asked: OrgPageRequest | undefined
  open: (page: OrgPage, select?: string) => void
  close: () => void
}

export function useHomePages(
  request: OrgPageRequest | undefined, onPageChange: ((page: OrgPage | undefined) => void) | undefined,
): HomePagesState {
  const [openPage, setOpenPage] = useState<OrgPage | undefined>(undefined)
  const [asked, setAsked] = useState<OrgPageRequest | undefined>(request)
  // A request for a page or for none (ADR-0019), and the answer back: which one
  // is up, said on every change and taken back when the screen goes.
  useEffect(() => {
    if (!request) return
    setOpenPage(request.page === 'home' ? undefined : request.page)
    setAsked(request)
  }, [request])
  useEffect(() => { onPageChange?.(openPage) }, [onPageChange, openPage])
  useEffect(() => () => onPageChange?.(undefined), [onPageChange])
  const open = useCallback((page: OrgPage, select?: string) => {
    setOpenPage(page)
    setAsked((was) => ({ page, nonce: (was?.nonce ?? 0) + 1, ...(select !== undefined ? { select } : {}) }))
  }, [])
  const close = useCallback(() => setOpenPage(undefined), [])
  return { openPage, asked, open, close }
}
