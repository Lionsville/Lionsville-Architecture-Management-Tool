// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import { translator } from '../i18n'
import { viewActions } from './viewActions'

const t = translator('en')

describe('what can be done to a view, said once', () => {
  it('lists every act in one order, delete last and destructive', () => {
    const all = viewActions({ canOpen: true, canRename: true, canConfigure: true, canDuplicate: true, canDuplicateAsOf: true, canHistory: true, canDelete: true }, t)
    expect(all.map((one) => one.id)).toEqual(['open', 'rename', 'settings', 'duplicate', 'duplicateAsOf', 'history', 'delete'])
    expect(all.map((one) => one.label)).toEqual(['Open', 'Rename view…', 'Board settings…', 'Duplicate view', 'Duplicate as of…', 'History…', 'Delete view…'])
    expect(all.filter((one) => one.danger).map((one) => one.id)).toEqual(['delete'])
  })

  it('offers only what the place asking can do, and a dated copy only beside a plain one', () => {
    expect(viewActions({ canOpen: true, canRename: true, canDelete: true }, t).map((one) => one.id)).toEqual(['open', 'rename', 'delete'])
    expect(viewActions({ canDuplicateAsOf: true }, t)).toEqual([])
    expect(viewActions({}, t)).toEqual([])
  })

  it('says view in every language, never diagram', () => {
    for (const language of ['en', 'nl', 'de'] as const) {
      const words = viewActions({ canRename: true, canDuplicate: true, canDelete: true }, translator(language)).map((one) => one.label).join(' ')
      expect(words).not.toMatch(/diagram/i)
    }
  })
})
