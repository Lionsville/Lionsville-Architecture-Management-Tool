// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import {
  BROWSER_STORAGE, IN_MEMORY, sourceIsReadOnly, sourceKey, sourceProviderKind,
} from './workingSource'
import type { WorkingSource } from './workingSource'

/** A source of a kind this tree knows nothing about, which is the whole point. */
const registered: WorkingSource = {
  kind: 'registered', provider: 'elsewhere', name: 'Elsewhere', key: 'one',
}

describe('sourceKey', () => {
  it('tells two folders apart by root, not by name', () => {
    expect(sourceKey({ kind: 'folder', name: 'Acme', root: '/a/acme' }))
      .not.toBe(sourceKey({ kind: 'folder', name: 'Acme', root: '/b/acme' }))
    expect(sourceKey({ kind: 'folder', name: 'Acme', root: '/a/acme' }))
      .toBe(sourceKey({ kind: 'folder', name: 'renamed', root: '/a/acme' }))
  })

  it('keeps a folder apart from both fallbacks, and the fallbacks from each other', () => {
    const keys = [sourceKey({ kind: 'folder', name: 'x', root: '/x' }), sourceKey(BROWSER_STORAGE), sourceKey(IN_MEMORY)]
    expect(new Set(keys).size).toBe(3)
  })

  it('tells two registered sources apart by provider as well as by key', () => {
    const mine = { ...registered, key: 'one' }
    const theirs = { ...registered, provider: 'other', key: 'one' } as const
    expect(sourceKey(mine)).not.toBe(sourceKey(theirs))
    expect(sourceKey({ ...registered, name: 'renamed' })).toBe(sourceKey(registered))
  })

  it('keeps a registered source apart from the three that ship', () => {
    const keys = [
      sourceKey({ kind: 'folder', name: 'x', root: '/x' }),
      sourceKey(BROWSER_STORAGE), sourceKey(IN_MEMORY), sourceKey(registered),
    ]
    expect(new Set(keys).size).toBe(4)
  })
})

describe('sourceIsReadOnly', () => {
  it('is false for all three built-ins, which is what they always were', () => {
    expect(sourceIsReadOnly({ kind: 'folder', name: 'x', root: '/x' })).toBe(false)
    expect(sourceIsReadOnly(BROWSER_STORAGE)).toBe(false)
    expect(sourceIsReadOnly(IN_MEMORY)).toBe(false)
  })

  it('is what a registered source says, and writable when it says nothing', () => {
    expect(sourceIsReadOnly(registered)).toBe(false)
    expect(sourceIsReadOnly({ ...registered, readOnly: true })).toBe(true)
  })
})

describe('sourceProviderKind', () => {
  it('is the kind itself for the built-ins and the provider for a registered one', () => {
    expect(sourceProviderKind({ kind: 'folder', name: 'x', root: '/x' })).toBe('folder')
    expect(sourceProviderKind(BROWSER_STORAGE)).toBe('browserStorage')
    expect(sourceProviderKind(IN_MEMORY)).toBe('memory')
    expect(sourceProviderKind(registered)).toBe('elsewhere')
  })
})
