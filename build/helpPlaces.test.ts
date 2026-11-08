// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The help opens in context, and the context is right: every place the app
 * opens the help at is one the help has, every page of the app has a row in
 * the one table (`platform/helpPlaces.ts`), every chapter is reached from a
 * screen, and no screen names a place in the help by a string of its own —
 * a scattered id is the one a rename forgets.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { PAGES, PAGE_TABS } from '../src/agent/screen'
import { CHAPTERS } from '../src/help/outline'
import { TEXT as EN } from '../src/help/text/en'
import { GETTING_STARTED } from '../src/help/types'
import { FIRST_RUN_HELP, PANEL_HELP, SCREEN_HELP } from '../src/platform/helpPlaces'

const src = fileURLToPath(new URL('../src', import.meta.url))

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return sources(path)
    return /\.tsx?$/.test(entry.name) && !entry.name.includes('.test.') ? [path] : []
  })
}

/** Every address the help has: Getting started and its steps, the chapters, the sections, each chapter's background topics. */
const ADDRESSES = new Set<string>([
  GETTING_STARTED,
  ...(EN.start?.steps ?? []).map((_, at) => `${GETTING_STARTED}~${at}`),
  ...CHAPTERS.flatMap((chapter) => [
    chapter.id,
    ...chapter.sections.map((one) => one.id),
    ...(EN.background[chapter.id] ?? []).map((_, at) => `${chapter.id}~${at}`),
  ]),
])

const chapterOf = (at: string) => CHAPTERS.find((chapter) => chapter.id === at || at.startsWith(`${chapter.id}~`) || chapter.sections.some((one) => one.id === at))?.id

describe('the help in context', () => {
  const places: [string, string][] = [...Object.entries(SCREEN_HELP), ...Object.entries(PANEL_HELP), ['first run', FIRST_RUN_HELP]]

  it('opens only at places the help has', () => {
    expect(places.filter(([, at]) => !ADDRESSES.has(at)).map(([where, at]) => `${where} → ${at}`)).toEqual([])
  })

  it('has a row for every page of the app, and a tab row only for a tab the page has', () => {
    const table: Record<string, string> = SCREEN_HELP
    expect(PAGES.filter((page) => !(page in table))).toEqual([])
    const tabs = Object.keys(table).filter((key) => key.includes(':')).filter((key) => {
      const [page, tab] = key.split(':')
      return !(PAGE_TABS[page as keyof typeof PAGE_TABS] ?? []).includes(tab)
    })
    expect(tabs).toEqual([])
  })

  it('reaches every chapter from a screen or a panel', () => {
    const reached = new Set(places.map(([, at]) => chapterOf(at)))
    expect(CHAPTERS.map((chapter) => chapter.id).filter((id) => !reached.has(id))).toEqual([])
  })

  it('is named by the table everywhere, never by a string of a screen\'s own', () => {
    const literal = /helpAt=\{?['"`]|<HelpPress[^>]*\bat=\{?['"`]|helpAt\([^,)]+,\s*['"`]|type: 'manual', section: ['"`]/
    const found = sources(src).filter((file) => literal.test(readFileSync(file, 'utf8'))).map((file) => file.slice(src.length + 1))
    expect(found).toEqual([])
  })

  it('names in the table only panels a screen draws', () => {
    const said = sources(src).map((file) => readFileSync(file, 'utf8')).join('\n')
    expect(Object.keys(PANEL_HELP).filter((key) => !said.includes(`PANEL_HELP.${key}`))).toEqual([])
  })
})
