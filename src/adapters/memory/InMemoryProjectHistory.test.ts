import { describe, expect, it } from 'vitest'
import { InMemoryProjectHistory } from './InMemoryProjectHistory'

const path = 'acme/landscape'
const entry = (id: string, touched: string[]) => ({ id, subject: id, at: 1, author: 'me', touched })

describe('the in-memory history', () => {
  it('lists everything without a scope, and only what touched a path with one', async () => {
    const history = new InMemoryProjectHistory([
      entry('c', ['acme/landscape/docs/billing.md']),
      entry('b', ['acme/landscape/decisions/0007-two-writers.md']),
      entry('a', ['acme/landscape/decisions/0007-one-writer.md', 'acme/landscape/model.json']),
    ])
    expect((await history.entries()).map((held) => held.id)).toEqual(['c', 'b', 'a'])
    expect((await history.entries(50, [{ path, paths: ['docs/billing.md'] }])).map((held) => held.id)).toEqual(['c'])
    expect((await history.entries(50, [{ path, paths: ['decisions/0007-*.md'] }])).map((held) => held.id)).toEqual(['b', 'a'])
    expect(await history.entries(50, [{ path: 'other/p', paths: ['model.json'] }])).toEqual([])
    // Several places, one answer: an element's page is filed in every scope
    // that holds the id (ADR-0012 §7).
    expect((await history.entries(50, [
      { path, paths: ['docs/billing.md'] },
      { path: 'acme/retail', paths: ['docs/billing.md'] },
    ])).map((held) => held.id)).toEqual(['c'])
  })

  it('is keeping a history exactly when it has one, until started', async () => {
    const empty = new InMemoryProjectHistory()
    expect(await empty.keeping()).toBe(false)
    await empty.start()
    expect(await empty.keeping()).toBe(true)
    expect(empty.calls.started).toBe(1)
  })
})
