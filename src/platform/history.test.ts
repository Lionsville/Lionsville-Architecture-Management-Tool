import { describe, expect, it } from 'vitest'
import { labelSlug } from './history'

describe('labelSlug', () => {
  it('turns a label into a name a ref may have', () => {
    expect(labelSlug('Shown to the board')).toBe('shown-to-the-board')
    expect(labelSlug('  Release 1.2 — final  ')).toBe('release-1-2-final')
    expect(labelSlug('Réunion/été')).toBe('reunion-ete')
  })

  it('keeps nothing git would refuse, including a leading hyphen', () => {
    expect(labelSlug('--delete-all')).toBe('delete-all')
    expect(labelSlug('a..b @{ c.lock')).toBe('a-b-c-lock')
  })

  it('is empty when nothing survives', () => {
    expect(labelSlug('')).toBe('')
    expect(labelSlug('—…!')).toBe('')
  })
})
