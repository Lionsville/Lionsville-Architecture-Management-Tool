// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * No file and no module of the program imports itself round a loop.
 *
 * `cycles.ts` says why a loop matters and how the graph is read. What is
 * asserted here is the tree as it stands, and the reading itself on a few
 * lines where the difference between a type and a value is the whole point.
 */
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { cycles, importGraph, moduleGraph, moduleOf, runtimeImports } from './cycles'

const root = fileURLToPath(new URL('..', import.meta.url))

// Every file of the program parsed, twice: seconds on a machine running the
// rest of the suite beside it.
describe('the import graph', { timeout: 60_000 }, () => {
  const files = importGraph(root, ['src', 'electron'])

  it('has no loop between files', () => {
    expect(cycles(files)).toEqual([])
  })

  it('has no loop between modules, once the composed string table is set aside', () => {
    expect(cycles(moduleGraph(files))).toEqual([])
  })

  it('has one loop of types between modules, the one the matrix allows both ways, and no other', () => {
    expect(cycles(moduleGraph(importGraph(root, ['src', 'electron'], true)))).toEqual([['ports', 'projects']])
  })

  it('reads a file graph large enough to be the program, and not the tests', () => {
    expect(files.size).toBeGreaterThan(400)
    expect([...files.keys()].some((file) => /\.test\.tsx?$/.test(file))).toBe(false)
  })
})

describe('what a file imports at run time', () => {
  it('keeps a value, a default, a namespace, a bare import and a re-export', () => {
    const text = [
      "import { apply } from './reducer'",
      "import React from 'react'",
      "import * as keys from './keys'",
      "import './polyfill'",
      "export { crumbsFor } from './ShellToolbar'",
      "export * from './model'",
    ].join('\n')
    expect(runtimeImports('a.ts', text)).toEqual(['./reducer', 'react', './keys', './polyfill', './ShellToolbar', './model'])
  })

  it('drops what the compiler erases: a type import, and one whose every name is a type', () => {
    const text = [
      "import type { Model } from './types'",
      "import { type Command, type Step } from './commands'",
      "export type { Crumb } from './ShellToolbar'",
      "export { type Row } from './rows'",
      "import { type Kind, kinds } from './kinds'",
    ].join('\n')
    expect(runtimeImports('a.ts', text)).toEqual(['./kinds'])
    expect(runtimeImports('a.ts', text, true)).toEqual(['./types', './commands', './ShellToolbar', './rows', './kinds'])
  })

  it('finds a loop, and names every file in it', () => {
    const graph = new Map([['a', ['b']], ['b', ['c']], ['c', ['a']], ['d', ['a']]])
    expect(cycles(graph)).toEqual([['a', 'b', 'c']])
  })

  it('puts platform/node in a row of its own, as the matrix does', () => {
    expect(moduleOf('src/platform/node/git.ts')).toBe('platform/node')
    expect(moduleOf('src/platform/errors.ts')).toBe('platform')
    expect(moduleOf('electron/main/files.ts')).toBe('electron/main')
  })
})
