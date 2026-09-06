import { describe, expect, it } from 'vitest'
import { hasDocumentation, shortDescription } from './documentation'
import { BUDGET, heapGrowthMb, measure } from '../model/testing/measure'
import { syntheticModel } from '../model/testing/synthetic'

/**
 * What a board's worth of nodes costs in description reading.
 *
 * Every card asks what its element's page says — the one line it draws, and
 * whether there is more behind it — and both answers used to walk the whole
 * markdown, twice per card, on every render. The cold number here is what that
 * cost for a board of six hundred cards with two kilobytes of prose each; the
 * warm one is what it costs once each description has been read.
 *
 * No budget on either. The rendering path they sit in has no budget of its own
 * yet — that is the derive's, and this is below it — so these two lines are
 * here to be read, and to make it obvious if the gap between them ever closes.
 */

const model = syntheticModel('large')
const cards = model.elements.slice(0, 600)

describe('reading what a card says', () => {
  it('reads six hundred descriptions', () => {
    // A different suffix per run, so nothing is answered from memory. Not
    // `prepare`, because building six hundred strings is the same order of work
    // as reading them and would drown the measurement it is preparing for.
    let run = 0
    const fresh = () => cards.map((e) => `${e.description}\n\nRun ${run}.`)
    let texts = fresh()
    measure('documentation: 600 descriptions, never read before', () => {
      for (const text of texts) {
        shortDescription(text)
        hasDocumentation(text)
      }
    }, { runs: 5, warmup: 0, prepare: () => { run += 1; texts = fresh() } })

    measure('documentation: the same 600, read again', () => {
      for (const element of cards) {
        shortDescription(element.description)
        hasDocumentation(element.description)
      }
    })
  })
})

describe('the bound on what it remembers', () => {
  it('does not grow with the number of descriptions it has read', () => {
    // Ten times the bound, each one a page nobody will ask for again. The reader
    // holds the last two thousand and forgets the rest; without the bound this
    // would hold forty megabytes of prose for the life of the session, and go on
    // holding more.
    const grown = heapGrowthMb('documentation: 20,000 descriptions read, heap growth', () => {
      for (let n = 0; n < 20_000; n++) {
        const text = `# Page ${n}\n\n${cards[n % cards.length].description}`
        shortDescription(text)
        hasDocumentation(text)
      }
    })
    expect(grown).toBeLessThan(BUDGET.cacheHeapMb)
  })
})
