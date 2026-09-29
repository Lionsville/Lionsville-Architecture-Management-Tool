// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import { isSpacedLabel, labelSlug } from './label'

describe('labelSlug', () => {
  it('turns a label into a name any source may keep it under', () => {
    expect(labelSlug('Shown to the board')).toBe('shown-to-the-board')
    expect(labelSlug('  Release 1.2 — final  ')).toBe('release-1-2-final')
    expect(labelSlug('Réunion/été')).toBe('reunion-ete')
  })

  it('keeps nothing but letters, digits and inner hyphens', () => {
    expect(labelSlug('--delete-all')).toBe('delete-all')
    expect(labelSlug('a..b @{ c.lock')).toBe('a-b-c-lock')
  })

  it('is empty when nothing survives', () => {
    expect(labelSlug('')).toBe('')
    expect(labelSlug('—…!')).toBe('')
  })
})

describe('isSpacedLabel', () => {
  it('is an identity’s space and a slug, and nothing a person would name a tag', () => {
    expect(isSpacedLabel('3f2a9c1e-0b4d-4e8a-9f6b-1c2d3e4f5a6b/shown-to-the-board')).toBe(true)
    expect(isSpacedLabel('f-1x9kz0/board')).toBe(true)
    for (const name of ['board', 'release/final', 'v2/rc-1', 'release/1.0', '--force', 'f-1x9kz0/--force', 'f-1x9kz0/Board', 'a/b/c', '/x', 's-1/board']) {
      expect(isSpacedLabel(name), name).toBe(false)
    }
  })
})
