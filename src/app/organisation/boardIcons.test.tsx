// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import type { DesignDiagram } from '../../model'
import { BOARD_ICONS, BoardKindIcon } from './boardIcons'

afterEach(() => cleanup())

/**
 * Every kind the model declares, as a value a test can walk. The union has no
 * runtime form, so the list is written out — and `Missing` below makes a kind
 * added to the union and not to this list a type error, so the walk cannot
 * quietly skip it.
 */
const KINDS = ['layer7', 'container', 'sheet', 'map', 'technology', 'drawing'] as const satisfies readonly DesignDiagram['kind'][]
type Missing = Exclude<DesignDiagram['kind'], (typeof KINDS)[number]>
const EVERY_KIND_LISTED: [Missing] extends [never] ? true : Missing = true

describe('the glyph for each kind of board', () => {
  it('lists every kind the model declares', () => {
    expect(EVERY_KIND_LISTED).toBe(true)
    expect(Object.keys(BOARD_ICONS).sort()).toEqual([...KINDS].sort())
  })

  it.each(KINDS)('draws a %s board as a glyph a screen reader skips', (kind) => {
    const { container } = render(<BoardKindIcon kind={kind} />)
    const svg = container.querySelector('svg')
    expect(svg).not.toBeNull()
    expect(svg?.getAttribute('aria-hidden')).toBe('true')
  })

  /** Two kinds with one glyph are two kinds nobody can tell apart at a glance, which is the glyph's whole job. */
  it('gives no two kinds the same glyph', () => {
    expect(new Set(Object.values(BOARD_ICONS)).size).toBe(KINDS.length)
  })
})
