// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV
// @vitest-environment jsdom

/**
 * The help page's boot: the theme the address says, or the system's followed
 * while the page is open, painted on the root before the document is drawn.
 */
import { act, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { bootHelp } from './boot'

/** A system that prefers dark, or not, and says when that changes. */
function system(dark: boolean) {
  const listeners: (() => void)[] = []
  const query = {
    matches: dark,
    addEventListener: vi.fn((_type: string, listener: () => void) => { listeners.push(listener) }),
  }
  vi.stubGlobal('matchMedia', () => query)
  return { query, turn: (to: boolean) => { query.matches = to; for (const listener of listeners) listener() } }
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
  window.history.replaceState(null, '', '/')
})

describe('the help page as it boots', () => {
  it('draws nothing where the page has no place for it', () => {
    system(false)
    expect(() => bootHelp(null)).not.toThrow()
    expect(document.documentElement.dataset.mode).toBeUndefined()
  })

  it('paints the theme the address says, and does not follow the system', async () => {
    const { query } = system(false)
    window.history.replaceState(null, '', '/help/?theme=dark&lang=de')
    const at = document.createElement('div')
    document.body.append(at)
    await act(async () => { bootHelp(at) })
    expect(document.documentElement.dataset.mode).toBe('dark')
    expect(document.documentElement.style.colorScheme).toBe('dark')
    expect(query.addEventListener).not.toHaveBeenCalled()
    expect(at.childElementCount).toBeGreaterThan(0)
  })

  it('paints the system\'s theme where the address says none, and follows it', async () => {
    const { turn } = system(true)
    const at = document.createElement('div')
    document.body.append(at)
    await act(async () => { bootHelp(at) })
    expect(document.documentElement.dataset.mode).toBe('dark')
    turn(false)
    expect(document.documentElement.dataset.mode).toBe('light')
  })
})
