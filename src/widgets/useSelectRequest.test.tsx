// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { useSelectRequest } from './useSelectRequest'
import type { SelectRequest } from './useSelectRequest'

afterEach(() => cleanup())

function harness() {
  const chosen: string[] = []
  function Page({ request, drawn }: { request?: SelectRequest; drawn?: readonly string[] }) {
    useSelectRequest(request, drawn && ((id) => drawn.includes(id)), (id) => chosen.push(id))
    return null
  }
  return { chosen, Page }
}

describe('useSelectRequest', () => {
  it('selects what the page draws, once per request', () => {
    const { chosen, Page } = harness()
    const view = render(<Page request={{ id: 'billing', nonce: 1 }} drawn={['billing']} />)
    view.rerender(<Page request={{ id: 'billing', nonce: 1 }} drawn={['billing', 'crm']} />)
    expect(chosen).toEqual(['billing'])
    // The same thing asked for again is a new request.
    view.rerender(<Page request={{ id: 'billing', nonce: 2 }} drawn={['billing', 'crm']} />)
    expect(chosen).toEqual(['billing', 'billing'])
  })

  it('selects nothing where the page does not draw it', () => {
    const { chosen, Page } = harness()
    render(<Page request={{ id: 'ghost', nonce: 1 }} drawn={['billing']} />)
    expect(chosen).toEqual([])
  })

  it('waits for the page to say what it draws', () => {
    const { chosen, Page } = harness()
    const view = render(<Page request={{ id: 'billing', nonce: 1 }} />)
    expect(chosen).toEqual([])
    view.rerender(<Page request={{ id: 'billing', nonce: 1 }} drawn={['billing']} />)
    expect(chosen).toEqual(['billing'])
  })

  it('does nothing with no request', () => {
    const { chosen, Page } = harness()
    render(<Page drawn={['billing']} />)
    expect(chosen).toEqual([])
  })
})
