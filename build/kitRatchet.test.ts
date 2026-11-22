// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A screen composes the kit (ADR-0045). `kitRatchet.ts` says what is counted;
 * this holds the tree to `kitRatchetList.ts`, every file to exactly its entry,
 * so the list only comes down.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { differences, lowered, measure, measureTree, totalsLine, written } from './kitRatchet'
import * as list from './kitRatchetList'

const root = fileURLToPath(new URL('..', import.meta.url))

describe('the kit ratchet', () => {
  it('holds every file outside the kit to exactly its entry, and an unlisted one to nothing', () => {
    const measured = measureTree(root, list)
    // Printed once a run, so the way down is seen.
    console.log(totalsLine(measured))
    expect(differences(list.HELD, measured)).toEqual([])
  })

  it('counts each name imported from the library, types and re-exports included', () => {
    expect(measure("import Box from '@mui/material/Box'\n").names).toBe(1)
    expect(measure("import { Box, Stack, type SxProps } from '@mui/material'\n").names).toBe(3)
    expect(measure("import type { Theme } from '@mui/material/styles'\n").names).toBe(1)
    expect(measure("import * as icons from '@mui/icons-material'\n").names).toBe(1)
    expect(measure("import styled, { css } from '@emotion/styled'\n").names).toBe(2)
    expect(measure("import '@emotion/react'\n").names).toBe(1)
    expect(measure("export { Box, Stack } from '@mui/material'\n").names).toBe(2)
    expect(measure("const lazy = import('@mui/material/Dialog')\n").names).toBe(1)
    expect(measure("import { Box } from './kit/Box'\nimport React from 'react'\n").names).toBe(0)
  })

  it('counts an sx prop, and not a string, a comment or a key of that name', () => {
    expect(measure('const a = <div sx={{ p: 1 }}><span sx={{}} /></div>\n').sx).toBe(2)
    expect(measure("// <Box sx={{}} />\nconst s = '<Box sx={{ p: 1 }} />'\nconst o = { sx: 1 }\n").sx).toBe(0)
    expect(measure("/* import Box from '@mui/material/Box' */\nconst s = \"from '@mui/material'\"\n").names).toBe(0)
  })

  it('says over and under, naming the file and both numbers', () => {
    const held = { 'src/a.tsx': [2, 3] as const, 'src/b.tsx': [1, 1] as const }
    expect(differences(held, {
      'src/a.tsx': { names: 2, sx: 4 },
      'src/b.tsx': { names: 0, sx: 1 },
      'src/c.tsx': { names: 1, sx: 0 },
    })).toEqual([
      'src/a.tsx: 2 imported names, 4 sx props, held to 2 and 3. This file grew; compose the kit',
      'src/b.tsx: 0 imported names, 1 sx props, held to 1 and 1. This file shrank: lower its entry',
      'src/c.tsx: 1 imported names, 0 sx props, held to 0 and 0. This file grew; compose the kit',
    ])
    expect(differences(held, { 'src/a.tsx': { names: 2, sx: 3 } })).toEqual([
      'src/b.tsx: 0 imported names, 0 sx props, held to 1 and 1. This file shrank: lower its entry',
    ])
  })

  it('writes the list downward only: lowered and taken off, never raised or added', () => {
    const held = { 'src/a.tsx': [2, 3] as const, 'src/b.tsx': [1, 1] as const, 'src/c.tsx': [4, 0] as const }
    const { held: next, refused } = lowered(held, {
      'src/a.tsx': { names: 1, sx: 3 },
      'src/c.tsx': { names: 5, sx: 0 },
      'src/d.tsx': { names: 0, sx: 1 },
    })
    expect(next).toEqual({ 'src/a.tsx': [1, 3], 'src/c.tsx': [4, 0] })
    expect(refused).toEqual([
      'src/c.tsx: 5 imported names, 0 sx props, held to 4 and 0: not raised. Compose the kit',
      'src/d.tsx: 0 imported names, 1 sx props, and not on the list: not added. Compose the kit',
    ])
  })

  it('rewrites the HELD block alone, sorted, one file a line', () => {
    const text = '// header\nexport const SOURCES = [\'src\']\n\nexport const HELD: X = {\n  \'src/z.tsx\': [9, 9],\n}\n// after\n'
    expect(written(text, { 'src/b.tsx': [1, 0], 'src/a.tsx': [0, 2] })).toBe(
      '// header\nexport const SOURCES = [\'src\']\n\nexport const HELD: X = {\n  \'src/a.tsx\': [0, 2],\n  \'src/b.tsx\': [1, 0],\n}\n// after\n',
    )
    expect(written(text, {})).toBe('// header\nexport const SOURCES = [\'src\']\n\nexport const HELD: X = {\n}\n// after\n')
    const file = fileURLToPath(new URL('./kitRatchetList.ts', import.meta.url))
    expect(written(readFileSync(file, 'utf8'), list.HELD)).toBe(readFileSync(file, 'utf8'))
  })
})
