// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { keepTheme, readKeptTheme } from './keptTheme'
import { readsDark } from '../../src/platform/theme'

const place = () => join(mkdtempSync(join(tmpdir(), 'kept-theme-')), 'theme.json')

describe('the theme main keeps for the next window', () => {
  it('reads back what it kept, and nothing where nothing was or what was there is not a mode', async () => {
    const path = place()
    expect(readKeptTheme(path)).toBeUndefined()
    await keepTheme(path, 'light')
    expect(readKeptTheme(path)).toBe('light')
    writeFileSync(path, '{"themeMode":"purple"}')
    expect(readKeptTheme(path)).toBeUndefined()
    writeFileSync(path, '{half')
    expect(readKeptTheme(path)).toBeUndefined()
  })

  it('reads dark for dark, light for light, and the system for the rest', () => {
    expect(readsDark('dark', false)).toBe(true)
    expect(readsDark('light', true)).toBe(false)
    expect(readsDark('system', true)).toBe(true)
    expect(readsDark(undefined, false)).toBe(false)
  })
})
