import { describe, expect, it, vi } from 'vitest'
import { fromArrays } from '../../model/normalised'
import { SAMPLE_SCOPE, describeCommandChannel, sampleHead } from '../../ports/CommandChannel.contract'
import { InMemoryCommandChannel } from './InMemoryCommandChannel'

describeCommandChannel('memory', ({ seed, keep }) => {
  const channel = new InMemoryCommandChannel({ seed, keep })
  return { connect: (by) => channel.connect(by) }
})

describe('InMemoryCommandChannel', () => {
  const step = (over = {}) => ({
    scope: SAMPLE_SCOPE,
    stepId: 'one',
    base: 0,
    command: { type: 'element.create' as const, element: { id: 'billing', kind: 'application' as const, name: 'Billing', lifecycle: 'live' as const, isManaged: true, aspects: {} } },
    at: 0,
    ...over,
  })

  it('is one way in itself, under the name it was made with', async () => {
    const channel = new InMemoryCommandChannel({ by: 'me', seed: [{ scope: SAMPLE_SCOPE, model: sampleHead() }] })
    const seen = vi.fn()
    channel.subscribe(SAMPLE_SCOPE, 0, seen, vi.fn())
    await channel.publish(step())
    expect(seen).toHaveBeenCalledWith(expect.objectContaining({ by: 'me', seq: 1 }))
  })

  /** Seeding takes either shape, because a caller has whichever it has. */
  it('starts from a head given as arrays or indexed', async () => {
    const arrays = new InMemoryCommandChannel({ seed: [{ scope: SAMPLE_SCOPE, model: sampleHead() }] })
    const already = new InMemoryCommandChannel({ seed: [{ scope: SAMPLE_SCOPE, model: fromArrays(sampleHead()) }] })
    expect(arrays.head(SAMPLE_SCOPE)).toStrictEqual(already.head(SAMPLE_SCOPE))
    expect(arrays.head(SAMPLE_SCOPE).elements.crews.name).toBe('Crews')
  })

  /** A scope nobody seeded is not an error; it is a scope with nothing in it. */
  it('starts an unseeded scope from nothing', async () => {
    const channel = new InMemoryCommandChannel()
    expect(await channel.publish(step({ scope: 'somewhere/else' }))).toEqual({ seq: 1 })
    expect(channel.head('somewhere/else').elements.billing.name).toBe('Billing')
  })

  /** The head is the steps applied in order, which is the claim being made. */
  it('keeps a head that is what the sequenced steps make', async () => {
    const channel = new InMemoryCommandChannel({ seed: [{ scope: SAMPLE_SCOPE, model: sampleHead() }] })
    await channel.publish(step())
    await channel.publish(step({ stepId: 'two', command: { type: 'element.update', id: 'crews', patch: { name: 'Crew planning' } } }))
    expect(channel.head(SAMPLE_SCOPE).elements.crews.name).toBe('Crew planning')
    expect(channel.head(SAMPLE_SCOPE).order.elements).toEqual(['crews', 'depot', 'billing'])
  })

  /** Each scope is put in order on its own: the port is per scope. */
  it('sequences each scope apart from the others', async () => {
    const channel = new InMemoryCommandChannel({
      seed: [{ scope: SAMPLE_SCOPE, model: sampleHead() }, { scope: 'acme/other', model: sampleHead() }],
    })
    expect(await channel.publish(step())).toEqual({ seq: 1 })
    expect(await channel.publish(step({ scope: 'acme/other', stepId: 'two' }))).toEqual({ seq: 1 })
    expect(await channel.publish(step({ stepId: 'three', command: { type: 'element.update', id: 'crews', patch: { name: 'Crew planning' } } })))
      .toEqual({ seq: 2 })
    expect(channel.head('acme/other').elements.crews.name).toBe('Crews')
  })

  /**
   * A handler that stops its own subscription must not take the broadcast
   * down with it — the sender is a subscriber too and is often the one that
   * stops on hearing its own step back.
   */
  it('goes on telling everybody when a subscriber stops inside its handler', async () => {
    const channel = new InMemoryCommandChannel({ seed: [{ scope: SAMPLE_SCOPE, model: sampleHead() }] })
    const second = vi.fn()
    const stop = channel.subscribe(SAMPLE_SCOPE, 0, () => stop(), vi.fn())
    channel.subscribe(SAMPLE_SCOPE, 0, second, vi.fn())
    await channel.publish(step())
    expect(second).toHaveBeenCalledTimes(1)
  })
})
