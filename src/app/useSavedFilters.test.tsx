// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * The observation filters a person saved are a preference (ADR-0032 §8,
 * ADR-0005): read from the blob the boot read, kept in the shell so a page
 * opened again sees what was saved since, and written back as a patch that
 * leaves the rest of the blob alone.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render } from '@testing-library/react'
import { NO_FILTERS, SAVED_FILTERS_KEY } from '../observations/filter'
import type { SavedFilters } from '../observations/filter'
import { useShellPreferences } from './useShellPreferences'
import { useSavedFilters } from './useShellServices'

afterEach(() => cleanup())

function mount(initial: unknown) {
  const written: Record<string, unknown>[] = []
  let saved!: SavedFilters
  function Host() {
    const prefs = useShellPreferences({
      store: { write: (blob) => { written.push(structuredClone(blob)); return Promise.resolve() } },
      initial,
      onWriteFailed: vi.fn(),
      browserLanguages: ['en'],
    })
    saved = useSavedFilters(prefs)
    return null
  }
  render(<Host />)
  return { written, saved: () => saved }
}

describe('useSavedFilters', () => {
  it('starts from what the blob holds, and nothing where it holds nothing usable', () => {
    const kept = { name: 'Batch owner', filters: { ...NO_FILTERS, roots: 'owns' } }
    expect(mount({ [SAVED_FILTERS_KEY]: [kept] }).saved().list).toEqual([kept])
    expect(mount({ [SAVED_FILTERS_KEY]: 'junk' }).saved().list).toEqual([])
  })

  it('writes a changed list into the blob, beside what was there', () => {
    const { written, saved } = mount({ language: 'nl', mystery: 1 })
    const next = [{ name: 'Partners', filters: { ...NO_FILTERS, search: 'partner' } }]
    act(() => saved().onChange(next))
    expect(saved().list).toEqual(next)
    expect(written.at(-1)).toEqual({ language: 'nl', mystery: 1, [SAVED_FILTERS_KEY]: next })
  })
})
