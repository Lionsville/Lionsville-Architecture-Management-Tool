// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/** The arrows walk the tree as it is drawn, and what a fold hides is not walked. */
import { describe, expect, it } from 'vitest'
import type { ChartUnit } from '../../model/orgChart'
import { chartKey, stepInTree } from './chartKeys'

const unit = (id: string, children: ChartUnit[] = []): ChartUnit => ({ id, name: id, serves: [], slots: [], others: [], children, ended: false })
const roots = [unit('a', [unit('b'), unit('c', [unit('d')])]), unit('e')]
const open = new Set<string>()

describe('walking the chart', () => {
  it('goes to a sibling, down and up', () => {
    expect(stepInTree(roots, open, 'a', 'next')).toBe('e')
    expect(stepInTree(roots, open, 'c', 'previous')).toBe('b')
    expect(stepInTree(roots, open, 'c', 'down')).toBe('d')
    expect(stepInTree(roots, open, 'd', 'up')).toBe('c')
  })

  it('stops where the tree ends', () => {
    expect(stepInTree(roots, open, 'a', 'up')).toBeUndefined()
    expect(stepInTree(roots, open, 'e', 'next')).toBeUndefined()
    expect(stepInTree(roots, new Set(['c']), 'c', 'down')).toBeUndefined()
  })

  it('reads the keys in the board\'s grammar', () => {
    const plain = { shiftKey: false, altKey: false, ctrlKey: false, metaKey: false }
    expect(chartKey({ ...plain, key: 'ArrowLeft' })).toBe('previous')
    expect(chartKey({ ...plain, key: 'Enter' })).toBe('pick')
    expect(chartKey({ ...plain, key: 'Enter', shiftKey: true })).toBe('up')
    expect(chartKey({ ...plain, key: 'm' })).toBe('move')
    expect(chartKey({ ...plain, key: 'm', metaKey: true })).toBeUndefined()
  })
})
