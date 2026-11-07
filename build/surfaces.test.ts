// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What floats over a page comes from the kit's `Surface.tsx`, which keeps a press
 * inside it from reaching what lies beneath. A rule a surface gets from the wrapper
 * it is made of only holds while every surface is made of it, and the one written
 * next is the one that forgets: React sends a press on through the portal, and no
 * test of that screen would show it.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const src = fileURLToPath(new URL('../src', import.meta.url))
const THE_ONE_PLACE = 'widgets/kit/Surface.tsx'

/** A default import of one, or a named one from MUI's index. `import type` is no surface. */
const RAW = /^import (?!type\b)[^\n]*from '@mui\/material\/(?:Menu|Popover|Popper)'|^import (?!type\b)\{[^}]*\b(?:Menu|Popover|Popper)\b[^}]*\} from '@mui\/material'/m

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return sources(path)
    return /\.tsx?$/.test(entry.name) && !entry.name.includes('.test.') ? [path] : []
  })
}

describe('surfaces', () => {
  it('has no MUI Menu, Popover or Popper outside the kit\'s one place', () => {
    const raw = sources(src).map((path) => relative(src, path)).filter((file) => file !== THE_ONE_PLACE && RAW.test(readFileSync(join(src, file), 'utf8')))
    expect(raw).toEqual([])
  })

  it('reads an import of one, and not a type or a menu item', () => {
    expect(RAW.test("import Menu from '@mui/material/Menu'")).toBe(true)
    expect(RAW.test("import { Popover, Box } from '@mui/material'")).toBe(true)
    expect(RAW.test("import type { MenuProps } from '@mui/material/Menu'")).toBe(false)
    expect(RAW.test("import MenuItem from '@mui/material/MenuItem'")).toBe(false)
  })
})
