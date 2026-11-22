// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/** Folds for the session: one turned, a way opened, and each tree's kept under its own key and never shared. */
import { describe, expect, it } from 'vitest'
import { SessionFolds, foldKey, opened, toggled } from './sessionFolds'

describe('folds for the session', () => {
  it('turns one fold, leaving the set it was given as it was', () => {
    const held = new Set(['a'])
    expect([...toggled(held, 'b')]).toEqual(['a', 'b'])
    expect([...toggled(held, 'a')]).toEqual([])
    expect([...held]).toEqual(['a'])
  })

  it('opens the way to something, and answers the same set where nothing on the way was folded', () => {
    const held: ReadonlySet<string> = new Set(['a', 'b', 'c'])
    expect([...opened(held, ['a', 'c', 'x'])]).toEqual(['b'])
    expect(opened(held, ['x'])).toBe(held)
  })

  it('keeps each tree\'s folds under its key, a copy each way, and nothing for a tree never opened', () => {
    const folds = new SessionFolds()
    const chart = foldKey('shipping', 'oc-1', 'chart')
    const kept = new Set(['pf'])
    folds.keep(chart, kept)
    kept.add('tt')
    expect([...folds.recall(chart)!]).toEqual(['pf'])
    // The same view's id in another scope, and its outline, are other trees.
    expect(folds.recall(foldKey('', 'oc-1', 'chart'))).toBeUndefined()
    expect(folds.recall(foldKey('shipping', 'oc-1', 'outline'))).toBeUndefined()
  })
})
