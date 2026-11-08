// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What stands at the top of the window says so through the kit's one seam,
 * `widgets/kit/windowArea.ts`, and nothing else does it its own way.
 *
 * On the desktop the macOS traffic lights sit over the page's top-left corner
 * and the page's top bar is what the window is dragged by; in full screen
 * neither holds, and on Windows, Linux and in a browser tab neither ever did.
 * A surface that covers the window and forgets this puts its first press under
 * the lights, or under the frame's drag strip, where a click moves the window
 * instead of pressing anything — and no test of that screen in jsdom would
 * show it, because jsdom has no window and no lights. So it is read here:
 *
 * - an app region is written in `windowArea.css` and nowhere else, so an
 *   offset or a drag strip of a screen's own cannot drift from the window's;
 * - a dialog that fills the window, or an element fixed over all of it, wears
 *   the window's bar (`WINDOW_BAR`) or its cover (`WINDOW_COVER`), unless it is
 *   listed below with why it needs neither.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const src = fileURLToPath(new URL('../src', import.meta.url))
const THE_ONE_PLACE = 'widgets/kit/windowArea.css'

/** Surfaces that cover the window and need no bar of their own, and why. */
const COVERS_WITHOUT_A_BAR: Record<string, string> = {
  // In the app a page is a place in the frame's column, under row one; the
  // dialog is what is left for a page drawn with no frame, a test of it alone.
  'widgets/PageDialog.tsx': 'a place under the frame\'s rows',
  // A line drawn from the guide to its control, pressed through.
  'widgets/kit/GuideDock.css': 'pointer-events: none',
}

/** A component that wears the cover for a stylesheet's rule that fills the window. */
const WORN_BY: Record<string, string> = {
  'business/ui/SheetPoster.css': 'business/ui/SheetPage.tsx',
}

const APP_REGION = /-webkit-app-region|WebkitAppRegion|\bapp-region\b/
/** `fullScreen` said to a dialog as a prop: the attribute, not a word in a comment. */
const FULL_SCREEN = /^\s*fullScreen\s*$|<\w+[^>]*\sfullScreen[\s/>={]/m
/** A rule fixed over the whole window. */
const FIXED_OVER_ALL = /position:\s*'?fixed'?[^}\n]*inset:\s*0\b|inset:\s*0\b[^}\n]*position:\s*'?fixed'?/
const WEARS = /\bWINDOW_(?:BAR|COVER)\b|kit-window-(?:bar|cover)/

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return sources(path)
    return /\.(tsx?|css)$/.test(entry.name) && !entry.name.includes('.test.') ? [path] : []
  })
}

const files = sources(src).map((path) => ({ file: relative(src, path), text: readFileSync(path, 'utf8') }))

describe('the window\'s corner', () => {
  it('writes an app region in the kit\'s one place and nowhere else', () => {
    expect(files.filter(({ file, text }) => file !== THE_ONE_PLACE && APP_REGION.test(text)).map(({ file }) => file)).toEqual([])
  })

  it('has every surface that covers the window wear the window\'s bar or its cover', () => {
    const covering = files.filter(({ text }) => FULL_SCREEN.test(text) || FIXED_OVER_ALL.test(text))
    const forgot = covering.filter(({ file, text }) => {
      if (COVERS_WITHOUT_A_BAR[file]) return false
      const wearer = WORN_BY[file]
      const worn = wearer ? files.find((one) => one.file === wearer)?.text ?? '' : text
      return !WEARS.test(worn)
    })
    expect(forgot.map(({ file }) => file)).toEqual([])
  })

  it('lists nothing that no longer covers the window', () => {
    const listed = [...Object.keys(COVERS_WITHOUT_A_BAR), ...Object.keys(WORN_BY)]
    const stale = listed.filter((file) => {
      const found = files.find((one) => one.file === file)
      return !found || !(FULL_SCREEN.test(found.text) || FIXED_OVER_ALL.test(found.text))
    })
    expect(stale).toEqual([])
  })

  it('reads a dialog filling the window and a rule fixed over it, and not a mention of either', () => {
    expect(FULL_SCREEN.test('    <MuiDialog\n      open={open}\n      fullScreen\n')).toBe(true)
    expect(FULL_SCREEN.test('<Dialog fullScreen open>')).toBe(true)
    expect(FULL_SCREEN.test("export type P = Omit<DialogProps, 'fullScreen'>")).toBe(false)
    expect(FIXED_OVER_ALL.test('.x { position: fixed; inset: 0; z-index: 2 }')).toBe(true)
    expect(FIXED_OVER_ALL.test("sx={{ position: 'fixed', inset: 0 }}")).toBe(true)
    expect(FIXED_OVER_ALL.test('.x { position: absolute; inset: 0 }')).toBe(false)
    expect(FIXED_OVER_ALL.test('.x { position: fixed; right: 0 }')).toBe(false)
  })
})
