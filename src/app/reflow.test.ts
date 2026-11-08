// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Reflow (WCAG 2.1, 1.4.10): at 320 CSS pixels — a 1280-pixel window at
 * 400 % — the bars across the top of a screen take a second row rather than
 * running off its side or drawing their labels over each other, which is
 * what every one of them did.
 *
 * jsdom lays nothing out, so this is held in the source: a page's top bar
 * (`data-testid="…-topbar"`) that a page still writes in its own `sx` is a
 * bar across the width of the window, and every such bar wraps. The quiet buttons in the two
 * shell bars keep their width, so it is the bar that wraps and not a label
 * that is squeezed out from under its own button.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'
import { QUIET, WRAPS } from './ShellToolbar'

/** A page's top bar, written by the page itself rather than by the kit. */
const OWN_BAR = /data-testid="[a-z-]+-topbar"/

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
        if (!OWN_BAR.test(line) || !lines.slice(index, index + 4).join('\n').includes('sx={{')) return
        const at = `${relative(root, path)}:${index + 1}`
        bars.push(at)
        const around = lines.slice(Math.max(0, index - 12), index + 8).join('\n')
        if (!/flexWrap: 'wrap'|\.\.\.WRAPS/.test(around)) unwrapped.push(at)
      })
    }
    // The frame's two rows wrap in the kit; these are the bars still written by their own pages.
    expect(bars.length).toBeGreaterThanOrEqual(2)
    expect(unwrapped).toEqual([])
  })

  it('keeps a quiet button its width, so the bar wraps instead of the label spilling', () => {
    expect(QUIET).toMatchObject({ flexShrink: 0, whiteSpace: 'nowrap' })
    expect(WRAPS).toMatchObject({ flexWrap: 'wrap' })
  })
})
