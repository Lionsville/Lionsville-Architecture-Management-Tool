// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The help holds a section for every function, in every language, and nothing
 * that points nowhere. The commands table's own test holds the menus to it
 * (`app/frame/commandsTable.help.test.ts`).
 */
import { afterEach, describe, expect, it } from 'vitest'
import { LANGUAGE_CODES } from '../i18n/languages'
import { CONTROL_NAMES } from '../platform/controlNames'
import { readHelpAddress } from '../platform/helpAddress'
import { readInline, readMarkdown } from './markdown'
import { CHAPTERS } from './outline'
import { forgetHelpChapters, helpOutline, loadHelpText, registerHelpChapters } from './registry'
import { helpIndex, searchHelp } from './helpSearch'
import { TEXT as EN } from './text/en'
import { TEXT as NL } from './text/nl'
import { TEXT as DE } from './text/de'

const sections = CHAPTERS.flatMap((chapter) => chapter.sections)
const ids = sections.map((one) => one.id)

describe('the outline', () => {
  it('names every section once, and never as a chapter', () => {
    expect(new Set(ids).size).toBe(ids.length)
    const chapters = CHAPTERS.map((chapter) => chapter.id)
    expect(chapters.filter((id) => ids.includes(id))).toEqual([])
  })

  it('names only controls that are on screen', () => {
    const known = new Set<string>(CONTROL_NAMES)
    expect(sections.flatMap((one) => one.controls ?? []).filter((name) => !known.has(name))).toEqual([])
  })

  it('points only at sections it has', () => {
    expect(sections.flatMap((one) => (one.seeAlso ?? []).filter((id) => !ids.includes(id)).map((id) => `${one.id} → ${id}`))).toEqual([])
  })

  it('every id is an address the help can be opened at', () => {
    for (const id of [...ids, ...CHAPTERS.map((chapter) => chapter.id)]) {
      expect(readHelpAddress('', `#${id}`).section).toBe(id)
    }
  })
})

describe('every language', () => {
  const tables = { en: EN, nl: NL, de: DE }

  it.each(LANGUAGE_CODES)('%s has a section for every function in the outline, and none beside it', (language) => {
    const text = tables[language]
    expect(ids.filter((id) => !text.sections[id])).toEqual([])
    expect(Object.keys(text.sections).filter((id) => !ids.includes(id))).toEqual([])
  })

  it.each(LANGUAGE_CODES)('%s says every part of every section, with as many steps as English', (language) => {
    const text = tables[language]
    for (const id of ids) {
      const [name, what, where, steps, example, keys] = text.sections[id]
      for (const part of [name, what, where, example, ...steps]) expect(part.trim(), `${language} ${id}`).not.toBe('')
      expect(steps.length, `${language} ${id}`).toBe(EN.sections[id][3].length)
      expect(keys === undefined, `${language} ${id} keys`).toBe(EN.sections[id][5] === undefined)
    }
  })

  it.each(LANGUAGE_CODES)('%s has every chapter\'s title and words, and the manual\'s background for each', (language) => {
    const text = tables[language]
    for (const chapter of CHAPTERS) {
      expect(text.chapters[chapter.id]?.title, `${language} ${chapter.id}`).toBeTruthy()
      expect(text.chapters[chapter.id]?.worked?.steps.length).toBe(EN.chapters[chapter.id].worked?.steps.length)
      expect((text.background[chapter.id] ?? []).length).toBe((EN.background[chapter.id] ?? []).length)
    }
  })

  /** A translation that is the English word for word is a section nobody translated. */
  it.each(['nl', 'de'] as const)('%s is translated, not copied', (language) => {
    const same = ids.filter((id) => tables[language].sections[id][1] === EN.sections[id][1])
    expect(same).toEqual([])
  })

  /** The help is public, and says nothing of where a build composed from this one keeps work. */
  it('names no server, environment or sign-in in core\'s help', () => {
    const said = Object.values(tables).flatMap((text) => Object.values(text.sections).flat(2) as string[])
    expect(said.filter((one) => /\b(server|environment|sign(ed)? in)\b/i.test(one))).toEqual([])
  })
})

describe('search', () => {
  const index = helpIndex(CHAPTERS, EN)

  it('finds a section by its name first, then by its words', () => {
    const hits = searchHelp(index, 'go back')
    expect(hits[0].id).toBe('frame.back')
  })

  it('needs every word, and folds case and accents', () => {
    expect(searchHelp(helpIndex(CHAPTERS, DE), 'ubersicht').length).toBeGreaterThan(0)
    expect(searchHelp(index, 'zzzz nothing')).toEqual([])
  })

  it('finds the manual\'s background by its words', () => {
    expect(searchHelp(index, 'stand-in').some((hit) => hit.id.includes('~'))).toBe(true)
  })
})

describe('the markdown it reads', () => {
  it('reads paragraphs, lists, tables and code, and keeps text as text', () => {
    const blocks = readMarkdown('A **b** `c`\n\n- one\n- two\n\n| K | D |\n|---|---|\n| x | y |\n\n```\ncode\n```')
    expect(blocks.map((block) => block.kind)).toEqual(['p', 'ul', 'table', 'code'])
    expect(readInline('<b>no</b>')).toEqual([{ kind: 'text', text: '<b>no</b>' }])
  })

  it('links only what leaves the page for the web, and a relative link is its words', () => {
    expect(readInline('[site](https://a.example)')[0]).toMatchObject({ kind: 'link', href: 'https://a.example' })
    expect(readInline('[readme](../README.md)')).toEqual([{ kind: 'text', text: 'readme' }])
  })
})

describe('chapters a host adds', () => {
  afterEach(() => forgetHelpChapters())

  it('come after core\'s, and their words load with core\'s', async () => {
    registerHelpChapters({
      chapters: [{ id: 'extra', sections: [{ id: 'extra.one' }] }],
      text: () => Promise.resolve({ chapters: { extra: { title: 'Extra', intro: 'More.' } }, sections: { 'extra.one': ['One', 'w', 'f', ['s'], 'e'] }, background: {} }),
    })
    expect(helpOutline().at(-1)?.id).toBe('extra')
    const text = await loadHelpText('en')
    expect(text.sections['extra.one'][0]).toBe('One')
    expect(text.sections['frame.back']).toBeDefined()
  })

  it('may not take an address core uses', () => {
    expect(() => registerHelpChapters({ chapters: [{ id: 'board', sections: [] }], text: () => Promise.resolve(EN) })).toThrow(/board/)
  })
})
