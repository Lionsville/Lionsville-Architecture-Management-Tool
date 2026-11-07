// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom

import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, screen } from '@testing-library/react'
import { axeFindings } from '../../app/testing/axe'
import { renderShell } from '../../app/testing/renderShell'
import { Segmented } from './Segmented'

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks() })

const OPTIONS = [{ value: 'overview', label: 'Overview' }, { value: 'names', label: 'Names' }, { value: 'coverage', label: 'Coverage' }]

function Live({ onChange }: { onChange?: (value: string) => void }) {
  const [value, setValue] = useState('names')
  return <Segmented label="Reading" options={OPTIONS} value={value} data-guide="reading" onChange={(next) => { setValue(next); onChange?.(next) }} />
}

/** A window of a given narrowness, whose width can change while the switch is up. */
function windowNarrow(narrow: boolean) {
  const listeners = new Set<() => void>()
  const query = {
    matches: narrow,
    addEventListener: (_: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_: string, listener: () => void) => listeners.delete(listener),
  }
  vi.stubGlobal('matchMedia', () => query)
  window.matchMedia = (() => query) as unknown as typeof window.matchMedia
  return (next: boolean) => { query.matches = next; for (const listener of listeners) listener() }
}

describe('Segmented', () => {
  it('is a radio group with one on, and only that one in the tab order', async () => {
    renderShell(<Live />)
    const group = screen.getByRole('radiogroup', { name: 'Reading' })
    expect(group.dataset.guide).toBe('reading')
    expect(screen.getByRole('radio', { name: 'Names' }).getAttribute('aria-checked')).toBe('true')
    expect(screen.getAllByRole('radio').map((radio) => radio.tabIndex)).toEqual([-1, 0, -1])
    expect(await axeFindings()).toEqual([])
  })

  it('moves and chooses with the arrows', () => {
    const changed = vi.fn()
    renderShell(<Live onChange={changed} />)
    const on = screen.getByRole('radio', { name: 'Names' })
    on.focus()
    fireEvent.keyDown(on, { key: 'ArrowRight' })
    expect(changed).toHaveBeenLastCalledWith('coverage')
    expect(document.activeElement).toBe(screen.getByRole('radio', { name: 'Coverage' }))
    fireEvent.keyDown(document.activeElement as Element, { key: 'ArrowRight' })
    expect(changed).toHaveBeenLastCalledWith('overview')
    changed.mockClear()
    fireEvent.keyDown(document.activeElement as Element, { key: 'x' })
    expect(changed).not.toHaveBeenCalled()
  })

  it('answers a press, and not on the one already on', () => {
    const changed = vi.fn()
    renderShell(<Live onChange={changed} />)
    fireEvent.click(screen.getByRole('radio', { name: 'Names' }))
    expect(changed).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('radio', { name: 'Overview' }))
    expect(changed).toHaveBeenCalledWith('overview')
  })

  it('stays a row below 1024 px where the labels fit', () => {
    windowNarrow(true)
    renderShell(<Live />)
    expect(screen.getByRole('radiogroup')).toBeTruthy()
  })

  it('becomes a menu saying what is on where they do not, and comes back on a wide window', async () => {
    const setNarrow = windowNarrow(true)
    vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(400)
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(200)
    const changed = vi.fn()
    renderShell(<Live onChange={changed} />)
    expect(screen.queryByRole('radiogroup')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Names' }))
    expect(screen.getByRole('menuitemcheckbox', { name: 'Names' }).getAttribute('aria-checked')).toBe('true')
    expect(await axeFindings()).toEqual([])
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Coverage' }))
    expect(changed).toHaveBeenCalledWith('coverage')
    act(() => setNarrow(false))
    expect(screen.getByRole('radiogroup')).toBeTruthy()
  })
})
