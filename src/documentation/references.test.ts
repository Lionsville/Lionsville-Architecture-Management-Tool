// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/** What a document refers to, and the words that refer to it (ADR-0043 §9, §10). */
import { describe, expect, it } from 'vitest'
import {
  completionAt, findReferables, insertReferable, parseRef, principleOfRef, principleRef, refFence, refKind,
} from './references'
import type { Referable } from './references'

const ref = (kind: Referable['kind'], label: string, block = true): Referable => ({ kind, key: label, label, markdown: block ? `\`\`\`ref\n${kind}: ${label}\n\`\`\`` : `[[${label}]]`, block })

describe('the ref fence', () => {
  it('is written field by field, a field said empty left out, and read back', () => {
    const fence = refFence([['evaluation', 'blk-gw'], ['scope', 'sales'], ['at', undefined]])
    expect(fence).toBe('```ref\nevaluation: blk-gw\nscope: sales\n```')
    expect(parseRef('evaluation: blk-gw\nscope: sales\nnonsense\nscope: other\n: nothing')).toEqual({ evaluation: 'blk-gw', scope: 'sales' })
  })

  it('names its kind by the first field that is one, never a view or an element', () => {
    expect(refKind({ scope: 'x', decision: 'adr-1' })).toBe('decision')
    expect(refKind({ principle: 'pr-1', aspect: '2' })).toBe('principle')
    expect(refKind({ view: 'l7' })).toBeUndefined()
  })

  it('names a principle by its scope and id, the bare id at the organisation', () => {
    expect(principleRef('', 'pr-1')).toBe('pr-1')
    expect(principleRef('topics/security', 'pr-2')).toBe('topics/security/pr-2')
    expect(principleOfRef('topics/security/pr-2')).toEqual({ scope: 'topics/security', id: 'pr-2' })
    expect(principleOfRef('pr-1')).toEqual({ scope: '', id: 'pr-1' })
  })
})

describe('finding and putting in', () => {
  const all = [ref('decision', 'Buy a yard system'), ref('element', 'Yard system', false), ref('view', 'Landscape'), ref('principle', 'Reuse first')]

  it('narrows the catalogue by the words typed, kinds in their order', () => {
    expect(findReferables(all, 'yard').map((one) => one.kind)).toEqual(['element', 'decision'])
    expect(findReferables(all, '', 2).map((one) => one.label)).toEqual(['Landscape', 'Yard system'])
  })

  it('opens on [[ or on @ after a space or at a line\'s start, with the words after it', () => {
    expect(completionAt('See [[Yar', 9)).toEqual({ start: 4, query: 'Yar', trigger: '[[' })
    expect(completionAt('Ask @reu', 8)).toEqual({ start: 4, query: 'reu', trigger: '@' })
    expect(completionAt('@', 1)).toEqual({ start: 0, query: '', trigger: '@' })
    expect(completionAt('mail me at a@b', 14)).toBeUndefined()
    expect(completionAt('Done [[Yard]] ok', 16)).toBeUndefined()
    expect(completionAt('[[line\nnext', 11)).toBeUndefined()
  })

  it('puts an element in the sentence and a fence on lines of its own', () => {
    expect(insertReferable('See [[Yar today', 4, 9, ref('element', 'Yard system', false))).toEqual({ text: 'See [[Yard system]] today', caret: 19 })
    const block = insertReferable('Before @dec after', 7, 11, ref('decision', 'D'))
    expect(block.text).toBe('Before \n\n```ref\ndecision: D\n```\n\n after')
    expect(insertReferable('', 0, 0, ref('decision', 'D')).text).toBe('```ref\ndecision: D\n```\n\n')
  })
})
