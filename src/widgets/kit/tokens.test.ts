// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import { coloursOf, DARK, LIGHT, px, SCALE, tokenVar, tokenVariables } from './tokens'
import type { ColourToken } from './tokens'

describe('the tokens', () => {
  it('says every colour in both modes', () => {
    expect(Object.keys(DARK).sort()).toEqual(Object.keys(LIGHT).sort())
  })

  it('resolves every alias to a value, in both modes', () => {
    for (const mode of ['light', 'dark'] as const) {
      for (const [token, value] of Object.entries(coloursOf(mode))) {
        expect(value, `${mode} ${token}`).not.toContain('var(')
      }
    }
    expect(coloursOf('light')['status-risk']).toBe(LIGHT.bad)
    expect(coloursOf('dark')['line-uses']).toBe(DARK['line-ink'])
  })

  it('names only tokens that exist when one names another', () => {
    const known = new Set([...Object.keys(LIGHT), ...Object.keys(SCALE)])
    for (const table of [LIGHT, DARK, SCALE]) {
      for (const value of Object.values(table)) {
        const named = /^var\(--([a-z0-9-]+)\)$/.exec(value)?.[1]
        if (named) expect(known, named).toContain(named)
      }
    }
  })

  it('keeps an alias an alias as a variable, so an accent reaches what names it', () => {
    const variables = tokenVariables('light')
    expect(variables['--line-reports-to']).toBe('var(--accent)')
    expect(variables['--ground']).toBe(LIGHT.ground)
    expect(variables['--row-h']).toBe('28px')
    const shaded = tokenVariables('dark', { light: {}, dark: { accent: '#abcdef' } })
    expect(shaded['--accent']).toBe('#abcdef')
    expect(shaded['--ground']).toBe(DARK.ground)
  })

  it('reads a token as CSS and a measure as a number', () => {
    const token: ColourToken = 'ink-2'
    expect(tokenVar(token)).toBe('var(--ink-2)')
    expect(px('row-h')).toBe(28)
    expect(px('t-label')).toBe(13)
  })
})
