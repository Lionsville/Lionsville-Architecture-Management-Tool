// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import { ignorePatterns, workingSetRule } from './workingSet'

describe('which of a browser folder’s files its history is kept of', () => {
  it('honours a .gitignore’s simple lines and lets the rest go', () => {
    const text = '# built\n\nbuild/\n*.tmp\n/drafts\nacme/cache\n!keep.tmp\ndocs/**\nfile\\#\n[ab].md\nreport-?.pdf\n'
    expect(ignorePatterns(text)).toHaveLength(5)
    const rule = workingSetRule(text, [])
    expect(rule.skipsFolder('acme/build')).toBe(true)
    expect(rule.skipsFile('acme/build')).toBe(false)
    expect(rule.skipsFile('acme/notes.tmp')).toBe(true)
    expect(rule.skipsFile('acme/keep.tmp')).toBe(true)
    expect(rule.skipsFolder('drafts')).toBe(true)
    expect(rule.skipsFolder('acme/drafts')).toBe(false)
    expect(rule.skipsFolder('acme/cache')).toBe(true)
    expect(rule.skipsFolder('globex/acme/cache')).toBe(false)
    expect(rule.skipsFile('report-1.pdf')).toBe(true)
    expect(rule.skipsFile('report-10.pdf')).toBe(false)
    expect(rule.skipsFile('a.md')).toBe(false)
    const takenBack = workingSetRule('images/*\n!images/keep.png\n', [])
    expect(takenBack.skipsFile('images/keep.png')).toBe(true)
  })

  it('leaves out litter, .git and node_modules without any .gitignore, but not what is kept', () => {
    const rule = workingSetRule(undefined, ['tools/node_modules/kept/index.js', 'acme/build/out.txt'])
    expect(['acme/.DS_Store', 'Thumbs.db', 'acme/desktop.ini'].map(rule.skipsFile)).toEqual([true, true, true])
    expect(['.git', 'acme/.git', 'node_modules', 'tools/node_modules/kept'].map(rule.skipsFolder)).toEqual([true, true, true, false])
    expect(rule.skipsFile('tools/node_modules/kept/index.js')).toBe(false)
    expect(rule.skipsFile('tools/node_modules/kept/other.js')).toBe(true)
    const ignoring = workingSetRule('build/\n', ['acme/build/out.txt'])
    expect(ignoring.skipsFolder('acme/build')).toBe(false)
    expect(ignoring.skipsFile('acme/build/out.txt')).toBe(false)
    expect(ignoring.skipsFile('acme/build/new.txt')).toBe(true)
  })
})
