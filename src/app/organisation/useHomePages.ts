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
  open: (page: OrgPage, select?: string, evaluation?: string, finding?: string) => void
  close: () => void
}

/** The technology register is the register's two tabs now: asked for by its old name, it lands there. */
function landsOn(request: OrgPageRequest): OrgPageRequest {
  return request.page === 'technologyRegister' ? { ...request, page: 'register', tab: 'services' } : request
}

export function useHomePages(
  request: OrgPageRequest | undefined, onPageChange: ((page: OrgPage | undefined, record?: string) => void) | undefined,
): HomePagesState {
  const [openPage, setOpenPage] = useState<OrgPage | undefined>(undefined)
  const [asked, setAsked] = useState<OrgPageRequest | undefined>(request && landsOn(request))
  // A request for a page or for none (ADR-0019), and the answer back: which one
  // is up, said on every change and taken back when the screen goes.
  useEffect(() => {
    if (!request) return
    const held = landsOn(request)
    setOpenPage(held.page === 'home' ? undefined : held.page)
    setAsked(held)
  }, [request])
  // The block on screen is part of the place, so a reload stays on it.
  const record = openPage === 'blocks' && asked?.page === 'blocks' ? asked.select : undefined
  useEffect(() => { onPageChange?.(openPage, record) }, [onPageChange, openPage, record])
  useEffect(() => () => onPageChange?.(undefined), [onPageChange])
  const open = useCallback((page: OrgPage, select?: string, evaluation?: string, finding?: string) => {
    const held = landsOn({ page, nonce: 0, ...(select !== undefined ? { select } : {}), ...(evaluation !== undefined ? { evaluation } : {}), ...(finding !== undefined ? { finding } : {}) })
    setOpenPage(held.page === 'home' ? undefined : held.page)
    setAsked((was) => ({ ...held, nonce: (was?.nonce ?? 0) + 1 }))
  }, [])
  const close = useCallback(() => setOpenPage(undefined), [])
  return { openPage, asked, open, close }
}
