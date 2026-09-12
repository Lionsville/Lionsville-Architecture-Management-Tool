import { describe, expect, it } from 'vitest'
import { interchangeSaved } from './interchangeNotice'
import { translator } from '../i18n'
import { EN } from './strings/en'

/**
 * The sentence a person gets back when the exchange document is smaller than
 * the project they exported (ADR-0012 §11). The counting is pinned in
 * `model/interchange.test.ts`; this is about what the words say — in the real
 * table, so a label that moved module is a failure here rather than a `{left}`
 * on somebody's screen.
 */
const s = translator('en')

describe('interchangeSaved', () => {
  it('says the plain thing when the document carries everything', () => {
    const said = interchangeSaved({ relations: [], elements: [] }, s)
    expect(said).toBe(EN['shell.savedInterchange'])
  })

  it('names what stayed behind, by count and by what it was', () => {
    const said = interchangeSaved({
      relations: [{ type: 'supports', count: 4 }, { type: 'assigned', count: 1 }],
      elements: [{ kind: 'function', count: 9 }],
    }, s)
    expect(said).toContain('4 × Supports')
    expect(said).toContain('1 × Assigned')
    expect(said).toContain('9 × Function')
  })

  it('is one sentence, not one per thing left behind', () => {
    const said = interchangeSaved({
      relations: [{ type: 'serves', count: 2 }],
      elements: [{ kind: 'step', count: 3 }],
    }, s)
    expect(said.split('\n')).toHaveLength(1)
    expect(said).toContain('2 × Serves, 3 × Step')
  })
})
