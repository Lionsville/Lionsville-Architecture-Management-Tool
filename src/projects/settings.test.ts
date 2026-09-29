// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import { patchSettings } from './settings'

describe('a settings patch', () => {
  it('sets a key, and leaves the others standing', () => {
    expect(patchSettings({ language: 'nl' }, { theme: 'dark' })).toEqual({ language: 'nl', theme: 'dark' })
  })

  it('merges an object into the one it lands on, at any depth', () => {
    const held = { review: { pullOnOpen: true, board: { quorum: 2, chair: 'Ada' } } }
    expect(patchSettings(held, { review: { board: { quorum: 3 } } }))
      .toEqual({ review: { pullOnOpen: true, board: { quorum: 3, chair: 'Ada' } } })
  })

  it('replaces a list, a text or a number whole', () => {
    expect(patchSettings({ tags: ['a', 'b'], name: 'x' }, { tags: ['c'], name: 'y' })).toEqual({ tags: ['c'], name: 'y' })
    expect(patchSettings({ board: { quorum: 2 } }, { board: 'none' })).toEqual({ board: 'none' })
    expect(patchSettings({ board: 'none' }, { board: { quorum: 2 } })).toEqual({ board: { quorum: 2 } })
  })

  it('takes a key out for `null`, at any depth', () => {
    expect(patchSettings({ a: 1, b: { c: 2, d: 3 } }, { a: null, b: { c: null } })).toEqual({ b: { d: 3 } })
  })

  it('changes neither what it was given nor the patch', () => {
    const held = { b: { c: 2 } }
    const patch = { b: { d: [1] } }
    const next = patchSettings(held, patch)
    expect(held).toEqual({ b: { c: 2 } })
    expect(next.b).not.toBe(held.b)
    expect((next.b as { d: number[] }).d).not.toBe(patch.b.d)
  })
})
