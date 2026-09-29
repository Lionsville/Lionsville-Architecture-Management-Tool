// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import { sourceIsReadOnly, sourceKey, sourceProviderKind } from './workingSource'
import type { WorkingSource } from './workingSource'

/** A source of a kind this tree knows nothing about, which is the whole point. */
const elsewhere: WorkingSource = { provider: 'elsewhere', name: 'Elsewhere', key: 'one' }

describe('sourceKey', () => {
  it('tells two places of one provider apart by key, not by name', () => {
    expect(sourceKey({ provider: 'place', name: 'Acme', key: '/a/acme' }))
      .not.toBe(sourceKey({ provider: 'place', name: 'Acme', key: '/b/acme' }))
    expect(sourceKey({ provider: 'place', name: 'Acme', key: '/a/acme' }))
      .toBe(sourceKey({ provider: 'place', name: 'renamed', key: '/a/acme' }))
  })

  it('tells two providers apart by provider as well as by key', () => {
    expect(sourceKey(elsewhere)).not.toBe(sourceKey({ ...elsewhere, provider: 'other' }))
    expect(sourceKey({ ...elsewhere, name: 'renamed' })).toBe(sourceKey(elsewhere))
  })
})

describe('sourceIsReadOnly', () => {
  it('is what the source says, and writable when it says nothing', () => {
    expect(sourceIsReadOnly(elsewhere)).toBe(false)
    expect(sourceIsReadOnly({ ...elsewhere, readOnly: true })).toBe(true)
  })
})

describe('sourceProviderKind', () => {
  it('is the provider that answers for it', () => {
    expect(sourceProviderKind(elsewhere)).toBe('elsewhere')
  })
})
