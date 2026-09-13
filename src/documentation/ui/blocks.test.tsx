/**
 * The registry, and the one property it exists to keep.
 *
 * A fence nobody claims must come back as `undefined` so the renderer prints
 * it — that is what makes a document written against a newer build open in an
 * older one with its blocks as text instead of as nothing.
 */
import { describe, expect, it } from 'vitest'
import { BLOCKS, blockFor, blockNameOf } from './blocks'

describe('blockNameOf', () => {
  it('reads the language off a fence', () => {
    expect(blockNameOf('language-mermaid')).toBe('mermaid')
    expect(blockNameOf('language-business-case')).toBe('business-case')
  })

  it('finds it among other classes, in any position', () => {
    expect(blockNameOf('highlight language-mermaid other')).toBe('mermaid')
  })

  it('has nothing to say about inline code', () => {
    expect(blockNameOf(undefined)).toBeUndefined()
    expect(blockNameOf('')).toBeUndefined()
    expect(blockNameOf('some-other-class')).toBeUndefined()
  })
})

describe('blockFor', () => {
  it('answers with a renderer for a name in the table', () => {
    expect(blockFor('language-mermaid')).toBe(BLOCKS.get('mermaid'))
    expect(blockFor('language-business-case')).toBe(BLOCKS.get('business-case'))
    expect(blockFor('language-bpmn')).toBe(BLOCKS.get('bpmn'))
  })

  it('answers with nothing for a fence this build cannot draw', () => {
    expect(blockFor('language-js')).toBeUndefined()
    expect(blockFor('language-something-from-a-later-version')).toBeUndefined()
    expect(blockFor(undefined)).toBeUndefined()
  })

  it('does not reach a name that is not its own', () => {
    // On a plain object `BLOCKS['constructor']` is a function, and the renderer
    // would mount it. The lookup key comes out of a document; it may not reach
    // a prototype.
    expect(blockFor('language-constructor')).toBeUndefined()
    expect(blockFor('language-toString')).toBeUndefined()
  })
})
