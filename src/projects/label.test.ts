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
  it('is a space and a slug, and nothing else', () => {
    expect(isSpacedLabel('3f2a-9c/shown-to-the-board')).toBe(true)
    for (const name of ['board', 'release/1.0', '--force', 's-1/--force', 's-1/Board', 'a/b/c', '/x']) {
      expect(isSpacedLabel(name), name).toBe(false)
    }
  })
})
