// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Reflow (WCAG 2.1, 1.4.10): at 320 CSS pixels — a 1280-pixel window at
 * 400 % — the bars across the top of a screen take a second row rather than
 * running off its side or drawing their labels over each other, which is
 * what every one of them did.
 *
 * jsdom lays nothing out, so this is held in the source: a bar that covers
 * the width of the window is the one that says which of its parts may not
 * drag the window (`'& button, & a, & input'`, see `core/CLAUDE.md` on
 * `windowChrome`), and every such bar wraps. The quiet buttons in the two
 * shell bars keep their width, so it is the bar that wraps and not a label
 * that is squeezed out from under its own button.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'
import { QUIET, WRAPS } from './ShellToolbar'

const DRAG_RULE = "'& button, & a, & input': { WebkitAppRegion: 'no-drag' }"

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return sources(path)
    return /\.tsx$/.test(name) && !/\.test\.tsx$/.test(name) ? [path] : []
  })
}

describe('a bar across the window, out of width', () => {
  it('wraps, in every screen that has one', () => {
    const root = join(__dirname, '..', '..')
    const bars: string[] = []
    const unwrapped: string[] = []
    for (const path of sources(join(root, 'src'))) {
      const lines = readFileSync(path, 'utf8').split('\n')
      lines.forEach((line, index) => {
        if (!line.includes(DRAG_RULE)) return
        const at = `${relative(root, path)}:${index + 1}`
        bars.push(at)
        const around = lines.slice(Math.max(0, index - 12), index + 8).join('\n')
        if (!/flexWrap: 'wrap'|\.\.\.WRAPS/.test(around)) unwrapped.push(at)
      })
    }
    expect(bars.length).toBeGreaterThanOrEqual(13)
    expect(unwrapped).toEqual([])
  })

  it('keeps a quiet button its width, so the bar wraps instead of the label spilling', () => {
    expect(QUIET).toMatchObject({ flexShrink: 0, whiteSpace: 'nowrap' })
    expect(WRAPS).toMatchObject({ flexWrap: 'wrap' })
  })
})
