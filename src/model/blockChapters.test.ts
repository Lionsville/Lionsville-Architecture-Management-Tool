// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import { chapterBody, requirementHeading, withCapability, withChapterBody, withChapterRenamed } from './blockChapters'

const DOCUMENT = [
  'What the gateway is for.',
  '',
  '## Many partners',
  '',
  'Hundreds of small senders.',
  '',
  '## Requirements',
  '',
  '### Routes by content',
  '',
  'Reads the message, not only its envelope.',
  '',
  '```',
  '### not a heading',
  '```',
  '',
  '### Keeps an audit trail',
  '',
  'Seven years.',
  '',
].join('\n')

describe('a chapter of a block\'s document', () => {
  it('is headed by the capability\'s words, a level under a context\'s', () => {
    expect(requirementHeading({ text: ' Routes by content ' })).toBe('### Routes by content')
  })

  it('is read from its heading to the next of its level or above, a fenced line never a heading', () => {
    expect(chapterBody(DOCUMENT, '### Routes by content')).toBe('Reads the message, not only its envelope.\n\n```\n### not a heading\n```')
    expect(chapterBody(DOCUMENT, '### Keeps an audit trail')).toBe('Seven years.')
    expect(chapterBody(DOCUMENT, '## Many partners')).toBe('Hundreds of small senders.')
    expect(chapterBody(DOCUMENT, '### not a heading')).toBeUndefined()
    expect(chapterBody(DOCUMENT, '### Nobody wrote this')).toBeUndefined()
  })

  it('is written over where it stands, and the rest is as it was', () => {
    const next = withChapterBody(DOCUMENT, '### Routes by content', 'By type and by sender.\n\n![a picture](image:routes)')
    expect(chapterBody(next, '### Routes by content')).toBe('By type and by sender.\n\n![a picture](image:routes)')
    expect(chapterBody(next, '### Keeps an audit trail')).toBe('Seven years.')
    expect(chapterBody(next, '## Many partners')).toBe('Hundreds of small senders.')
    expect(next.startsWith('What the gateway is for.\n\n## Many partners')).toBe(true)
  })

  it('is added at the end of the chapter it belongs under, which is made where the document has none', () => {
    const added = withChapterBody(DOCUMENT, '### Scales out', 'A node more, not a larger one.', '## Requirements')
    expect(added.endsWith('### Keeps an audit trail\n\nSeven years.\n\n### Scales out\n\nA node more, not a larger one.\n')).toBe(true)
    const before = '## Requirements\n\n### One\n\nFirst.\n\n## After\n\nLast.\n'
    expect(withChapterBody(before, '### Two', 'Second.', '## Requirements')).toBe('## Requirements\n\n### One\n\nFirst.\n\n### Two\n\nSecond.\n\n## After\n\nLast.\n')
    expect(withChapterBody('About it.\n', '### One', 'First.', '## Requirements')).toBe('About it.\n\n## Requirements\n\n### One\n\nFirst.\n')
    expect(withChapterBody('', '### One', 'First.', '## Requirements')).toBe('## Requirements\n\n### One\n\nFirst.\n')
  })

  it('goes with its heading where its body is emptied, and nothing is added for an empty one', () => {
    const without = withChapterBody(DOCUMENT, '### Keeps an audit trail', '  ')
    expect(chapterBody(without, '### Keeps an audit trail')).toBeUndefined()
    expect(without.endsWith('```\n### not a heading\n```\n')).toBe(true)
    expect(withChapterBody(DOCUMENT, '### Nobody wrote this', '', '## Requirements')).toBe(DOCUMENT)
  })

  it('keeps its body when its heading is said anew', () => {
    const renamed = withChapterRenamed(DOCUMENT, '### Routes by content', '### Routes on content')
    expect(chapterBody(renamed, '### Routes by content')).toBeUndefined()
    expect(chapterBody(renamed, '### Routes on content')).toBe(chapterBody(DOCUMENT, '### Routes by content'))
    expect(withChapterRenamed(DOCUMENT, '### Nobody wrote this', '### Still nobody')).toBe(DOCUMENT)
  })
})

describe('a capability edited', () => {
  const held = {
    capabilities: [
      { id: 'cap-1', text: 'Routes by content', function: 'fn-1' },
      { id: 'cap-2', text: 'Keeps an audit trail', must: true as const },
    ],
    description: DOCUMENT,
  }

  it('changes its line and leaves the document out of the patch where nothing of it moves', () => {
    const patch = withCapability(held, 'cap-2', { text: 'Keeps an audit trail', must: false }, '## Requirements')
    expect(patch).toEqual({ capabilities: [held.capabilities[0], { id: 'cap-2', text: 'Keeps an audit trail' }] })
  })

  it('carries its chapter to its new words, and keeps what the editor does not ask about', () => {
    const aspect = { scope: '', id: 'pr-1', number: 2 }
    const patch = withCapability(held, 'cap-1', { text: 'Routes on content', must: true, aspect }, '## Requirements')
    expect(patch.capabilities[0]).toEqual({ id: 'cap-1', text: 'Routes on content', must: true, function: 'fn-1', aspect })
    expect(chapterBody(patch.description!, '### Routes on content')).toBe(chapterBody(DOCUMENT, '### Routes by content'))
  })

  it('writes its chapter, under the heading handed in where the document had no place for it', () => {
    const patch = withCapability({ capabilities: [{ id: 'cap-1', text: 'Scales out' }] }, 'cap-1', { text: 'Scales out', must: false, body: 'A node more.' }, '## Requirements')
    expect(patch.description).toBe('## Requirements\n\n### Scales out\n\nA node more.\n')
  })
})
