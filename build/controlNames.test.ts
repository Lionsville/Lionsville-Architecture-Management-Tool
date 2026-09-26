// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The stable control names (`src/platform/controlNames.ts`), read off the
 * source rather than the screen.
 *
 * `src/app/App.controlNames.test.tsx` walks the app and finds every name on
 * the list; this is the other direction, which a walk cannot see: a name
 * written on a control and never put on the list is a promise nobody made,
 * and one written twice on the list is a list that has stopped being read.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { CONTROL_NAME_ATTRIBUTE, CONTROL_NAMES, controlSelector } from '../src/platform/controlNames'

const src = fileURLToPath(new URL('../src', import.meta.url))

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return sources(path)
    return entry.name.endsWith('.tsx') && !entry.name.includes('.test.') ? [path] : []
  })
}

/** Every name written as a literal: on the attribute, or handed to a component that puts it there. */
function written(): Map<string, string> {
  const found = new Map<string, string>()
  const literal = new RegExp(`(?:${CONTROL_NAME_ATTRIBUTE}|named)="([^"]+)"|named: '([^']+)'`, 'g')
  for (const file of sources(src)) {
    for (const match of readFileSync(file, 'utf8').matchAll(literal)) {
      found.set(match[1] ?? match[2], file.slice(src.length + 1))
    }
  }
  return found
}

describe('the stable control names, in the source', () => {
  it('writes on a control only names that are on the list', () => {
    const listed = new Set<string>(CONTROL_NAMES)
    const stray = [...written()].filter(([name]) => !listed.has(name) && !CONTROL_NAMES.some((one) => one.startsWith(`${name}.`)))
    expect(stray).toEqual([])
    // Not vacuous: the scan does find the names written as literals.
    expect(written().has('board.palette')).toBe(true)
  })

  it('lists each name once, in the one shape', () => {
    expect(new Set(CONTROL_NAMES).size).toBe(CONTROL_NAMES.length)
    for (const name of CONTROL_NAMES) expect(name).toMatch(/^[a-z][A-Za-z]*(\.[a-z][A-Za-z]*)+$/)
  })

  it('selects a control by its name', () => {
    expect(controlSelector('board.palette')).toBe('[data-guide="board.palette"]')
  })
})
