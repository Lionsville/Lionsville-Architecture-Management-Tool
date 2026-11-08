// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/** What one of ⋯'s keys does on the web, where Save is concerned. */
import { describe, expect, it } from 'vitest'
import { menuKey } from './AppFrame'

const save = { key: 's', metaKey: false, ctrlKey: true, shiftKey: false, altKey: false }
const can = { history: true, connect: false, scope: true, example: false }

describe('Save by its key', () => {
  it('is left to a board’s own keymap while one is up, and run elsewhere in a scope', () => {
    expect(menuKey(save, can, { boardUp: true, modal: false }, false)).toBeUndefined()
    expect(menuKey(save, can, { boardUp: false, modal: false }, false)).toEqual({ run: { type: 'save' } })
  })

  it('says the example is not kept wherever it is asked in a visit, on a board too', () => {
    expect(menuKey(save, can, { boardUp: true, modal: false, visiting: true }, false)).toEqual({ refused: 'menu.saveExample' })
    expect(menuKey(save, can, { boardUp: false, modal: false, visiting: true }, false)).toEqual({ refused: 'menu.saveExample' })
  })

  it('says nothing is open with no scope open', () => {
    expect(menuKey(save, { ...can, scope: false }, { boardUp: false, modal: false }, false)).toEqual({ refused: 'menu.saveNothingOpen' })
  })
})
