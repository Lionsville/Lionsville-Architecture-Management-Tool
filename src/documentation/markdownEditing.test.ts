// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/** What a writer's keys and buttons make of the text. A `|` in a case is the caret, two of them a selection; `¦` where the text has bars of its own. */
import { describe, expect, it } from 'vitest'
import {
  TABLE_SNIPPET, continueOnEnter, cycleHeading, headingOfCaret, headingsAt, inFence, insertBlock, insertInline, insertLink,
  linkOnPaste, missingSections, slashAt, tabIn, templateSections, toggleInline, toggleLineMark, wordCount,
} from './markdownEditing'
import type { Edit, Selected } from './markdownEditing'

function at(marked: string): Selected {
  // A table's own bars are bars: the caret there is written ¦.
  const mark = marked.includes('¦') ? '¦' : '|'
  const start = marked.indexOf(mark)
  const end = marked.indexOf(mark, start + 1)
  if (end < 0) return { text: marked.replace(mark, ''), start, end: start }
  return { text: marked.replace(mark, '').replace(mark, ''), start, end: end - 1 }
}

function shown(edit: Edit | undefined): string | undefined {
  if (!edit) return undefined
  const { text, start, end } = edit
  return start === end
    ? `${text.slice(0, start)}‸${text.slice(start)}`
    : `${text.slice(0, start)}‸${text.slice(start, end)}‸${text.slice(end)}`
}

describe('marks on a selection', () => {
  it('wraps, unwraps from inside and out, and with nothing selected lands between', () => {
    expect(shown(toggleInline(at('a |b| c'), '**'))).toBe('a **‸b‸** c')
    expect(shown(toggleInline(at('a **|b|** c'), '**'))).toBe('a ‸b‸ c')
    expect(shown(toggleInline(at('a |**b**| c'), '**'))).toBe('a ‸b‸ c')
    expect(shown(toggleInline(at('a|'), '_'))).toBe('a_‸_')
  })

  it('makes a link with the address ready to type over, or the words where none were selected', () => {
    expect(shown(insertLink(at('|see|'), 'words'))).toBe('[see](‸https://‸)')
    expect(shown(insertLink(at('|'), 'words'))).toBe('[‸words‸](https://)')
  })

  it('links selected words with a pasted address, and leaves any other paste alone', () => {
    expect(shown(linkOnPaste(at('|see| it'), ' https://example.org/a?b=1 '))).toBe('[see](https://example.org/a?b=1)‸ it')
    expect(shown(linkOnPaste(at('|see|'), 'mailto:a@b.nl'))).toBe('[see](mailto:a@b.nl)‸')
    expect(linkOnPaste(at('|see|'), 'just words')).toBeUndefined()
    expect(linkOnPaste(at('see|'), 'https://example.org')).toBeUndefined()
    expect(linkOnPaste(at('|one\ntwo|'), 'https://example.org')).toBeUndefined()
    expect(linkOnPaste(at('[|see|](x)'), 'https://example.org')).toBeUndefined()
    expect(linkOnPaste(at('|https://old.org|'), 'https://example.org')).toBeUndefined()
  })
})

describe('marks on lines', () => {
  it('puts a mark on a line and takes it off again', () => {
    expect(shown(toggleLineMark(at('one|'), 'bullet'))).toBe('- one‸')
    expect(shown(toggleLineMark(at('- one|'), 'bullet'))).toBe('one‸')
    expect(shown(toggleLineMark(at('- one|'), 'task'))).toBe('- [ ] one‸')
    expect(shown(toggleLineMark(at('- [x] one|'), 'bullet'))).toBe('- one‸')
    expect(shown(toggleLineMark(at('> one|'), 'quote'))).toBe('one‸')
  })

  it('numbers selected lines from one, skipping the empty ones', () => {
    expect(shown(toggleLineMark(at('|a\n\nb|\nc'), 'number'))).toBe('‸1. a\n\n2. b‸\nc')
  })

  it('keeps an indent', () => {
    expect(toggleLineMark(at('  a|'), 'bullet').text).toBe('  - a')
  })

  it('moves a heading through its levels', () => {
    expect(cycleHeading(at('a|')).text).toBe('## a')
    expect(cycleHeading(at('## a|')).text).toBe('### a')
    expect(cycleHeading(at('### a|')).text).toBe('a')
    expect(cycleHeading(at('# a|')).text).toBe('## a')
  })
})

describe('blocks', () => {
  it('stand on lines of their own, with their first cell selected', () => {
    expect(shown(insertBlock(at('a|'), TABLE_SNIPPET))).toBe('a\n\n| ‸Heading‸ | Heading |\n|---|---|\n|  |  |\n')
    expect(insertBlock(at('|\nb'), '---').text).toBe('---\n\nb')
    expect(insertBlock(at('a\n\n|\n\nb'), '---').text).toBe('a\n\n---\n\nb')
  })

  it('go inline where they are a mark, with the caret after them', () => {
    expect(shown(insertInline(at('|'), '## '))).toBe('## ‸')
  })

  it('open with / at a line’s start or after its mark, never in a sentence or a fence', () => {
    expect(slashAt('/ta', 3)).toEqual({ start: 0, query: 'ta' })
    expect(slashAt('a\n- /', 5)).toEqual({ start: 4, query: '' })
    expect(slashAt('and /or', 7)).toBeUndefined()
    expect(slashAt('/a/b', 4)).toBeUndefined()
    expect(slashAt('```\n/x', 6)).toBeUndefined()
  })
})

describe('Enter', () => {
  it('goes on with a list, counting and unticking', () => {
    expect(shown(continueOnEnter(at('- a|')))).toBe('- a\n- ‸')
    expect(shown(continueOnEnter(at('  * a|')))).toBe('  * a\n  * ‸')
    expect(shown(continueOnEnter(at('9. a|')))).toBe('9. a\n10. ‸')
    expect(shown(continueOnEnter(at('- [x] a|')))).toBe('- [x] a\n- [ ] ‸')
    expect(shown(continueOnEnter(at('> a|')))).toBe('> a\n> ‸')
  })

  it('splits an item at the caret', () => {
    expect(shown(continueOnEnter(at('- a|b')))).toBe('- a\n- ‸b')
  })

  it('ends a list on an empty item', () => {
    expect(shown(continueOnEnter(at('- a\n- |')))).toBe('- a\n‸')
    expect(shown(continueOnEnter(at('1. |')))).toBe('‸')
  })

  it('starts a row of a table with as many cells, and ends the table on an empty row', () => {
    expect(shown(continueOnEnter(at('| a | b |\n|---|---|\n| 1 | 2 |¦')))).toBe('| a | b |\n|---|---|\n| 1 | 2 |\n| ‸ |  |')
    expect(shown(continueOnEnter(at('| 1 |\n|  |¦')))).toBe('| 1 |\n‸')
    expect(continueOnEnter(at('| a¦ | b |'))).toBeUndefined()
  })

  it('is an ordinary new line anywhere else, and with a selection, and in a fence', () => {
    expect(continueOnEnter(at('plain|'))).toBeUndefined()
    expect(continueOnEnter(at('- |a|'))).toBeUndefined()
    expect(continueOnEnter(at('```\n- a|'))).toBeUndefined()
  })
})

describe('Tab', () => {
  it('moves a list item in and out', () => {
    expect(shown(tabIn(at('- a|'), false))).toBe('  - a‸')
    expect(shown(tabIn(at('  - a|'), true))).toBe('- a‸')
    expect(shown(tabIn(at('|- a\n- b|'), false))).toBe('‸  - a\n  - b‸')
  })

  it('goes from cell to cell in a table, and leaves at its ends', () => {
    expect(shown(tabIn(at('| a¦ | b |'), false))).toBe('| a | ‸b‸ |')
    expect(shown(tabIn(at('| a | b¦ |'), true))).toBe('| ‸a‸ | b |')
    expect(tabIn(at('| a | b¦ |'), false)).toBeUndefined()
  })

  it('is two spaces in a fence', () => {
    expect(shown(tabIn(at('```\na|\n```'), false))).toBe('```\n  a‸\n```')
    expect(inFence('```\na', 4)).toBe(true)
  })

  it('leaves the field everywhere else, so the keyboard is never kept in here', () => {
    expect(tabIn(at('plain|'), false)).toBeUndefined()
    expect(tabIn(at('plain|'), true)).toBeUndefined()
    expect(tabIn(at('- a|'), true)).toBeUndefined()
  })
})

describe('reading the text', () => {
  it('counts what reads as words', () => {
    expect(wordCount('')).toBe(0)
    expect(wordCount('## A title\n\n- **one** two\n- [ ] three\n\n1. four')).toBe(6)
    expect(wordCount('```\nnot these\n```\nthese')).toBe(1)
    expect(wordCount('| a | b |\n|---|---|\n| c | d |')).toBe(4)
    expect(wordCount('[link words](https://example.org) — x')).toBe(3)
  })

  it('finds the headings and where they start, outside fences', () => {
    const text = '# One\n```\n# not\n```\n## Two **b**\n'
    expect(headingsAt(text)).toEqual([
      { level: 1, text: 'One', at: 0 },
      { level: 2, text: 'Two b', at: text.indexOf('## Two') },
    ])
    expect(headingOfCaret(headingsAt(text), 2)).toBe(0)
    expect(headingOfCaret(headingsAt(text), text.length)).toBe(1)
    expect(headingOfCaret([], 3)).toBe(-1)
  })

  it('splits a template into sections, and says which a text lacks', () => {
    const template = '| a | |\n\n## Purpose\n\nwhy\n\n## Data\n'
    expect(templateSections(template).map((one) => one.title)).toEqual(['Purpose', 'Data'])
    expect(missingSections(template, '## purpose\n').map((one) => one.body)).toEqual(['## Data'])
  })
})
