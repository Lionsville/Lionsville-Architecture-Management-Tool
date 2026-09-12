import { describe, expect, it } from 'vitest'
import { journeyOf } from './lanes'
import { actor, journey, phase, step } from './testFixtures'

/**
 * *Ship a consignment*, in four phases, with two lanes beside the common row —
 * the journey ADR-0012 §4 is written about.
 *
 * The common row is the path everybody takes. The **key account** forks at
 * *quote* and rejoins at *deliver*, and does nothing of its own in *pick*, so
 * that phase is a pass-through. The **marketplace partner** fulfils: it has one
 * step, in *pick*, and is drawn nowhere else.
 */
const shipping = () => [
  journey('ship', 'Ship a consignment'),
  phase('order', 'Order', 'ship', { order: 1 }),
  phase('quote', 'Quote', 'ship', { order: 2 }),
  phase('pick', 'Pick', 'ship', { order: 3 }),
  phase('deliver', 'Deliver', 'ship', { order: 4 }),

  step('take-order', 'Take the order', 'order'),
  step('confirm', 'Confirm', 'order'),
  step('standard-rate', 'Apply the standard rate', 'quote'),
  step('pick-goods', 'Pick the goods', 'pick'),
  step('hand-over', 'Hand over', 'deliver'),

  step('negotiate', 'Negotiate the rate', 'quote', { lane: 'key-account' }),
  step('sign-off', 'Sign off the delivery', 'deliver', { lane: 'key-account' }),
  step('partner-fulfils', 'Partner fulfils', 'pick', { lane: 'partner' }),

  actor('key-account', 'Key account'),
  actor('partner', 'Marketplace partner', { outside: true }),
]

const laneBy = (id: string | undefined) =>
  journeyOf(shipping(), 'ship', ['key-account', 'partner'])
    .lanes.find((lane) => lane.actorId === id)!

describe('journeyOf', () => {
  it('reads the phases across the top in the journey’s own order', () => {
    expect(journeyOf(shipping(), 'ship').phases.map((p) => p.id))
      .toEqual(['order', 'quote', 'pick', 'deliver'])
  })

  it('puts the common row first, then the lanes in the sheet’s order', () => {
    const { lanes } = journeyOf(shipping(), 'ship', ['partner', 'key-account'])
    expect(lanes.map((lane) => lane.actorId)).toEqual([undefined, 'partner', 'key-account'])
  })

  it('gives the common row the steps that name no lane', () => {
    expect(laneBy(undefined).cells.map((cell) => cell.steps.map((s) => s.id))).toEqual([
      ['take-order', 'confirm'], ['standard-rate'], ['pick-goods'], ['hand-over'],
    ])
  })

  it('derives a lane’s fork and join from where it has steps', () => {
    expect(laneBy('key-account')).toMatchObject({ fork: 'quote', join: 'deliver' })
  })

  it('draws a phase inside the span with no step of its own as a pass-through', () => {
    const cells = laneBy('key-account').cells
    expect(cells.map((cell) => cell.passThrough)).toEqual([false, false, true, false])
    expect(cells[2].steps).toEqual([])
  })

  it('draws nothing outside the span — a lane before its fork is not a hole', () => {
    // *order* is outside the key account's span entirely: no steps, and not a
    // pass-through either, which is a different thing a page draws differently.
    const order = laneBy('key-account').cells[0]
    expect(order).toMatchObject({ phaseId: 'order', steps: [], passThrough: false })
  })

  it('forks and joins in the same phase for a lane with one step', () => {
    const partner = laneBy('partner')
    expect(partner).toMatchObject({ fork: 'pick', join: 'pick' })
    expect(partner.cells.every((cell) => !cell.passThrough)).toBe(true)
  })

  it('gives a lane the sheet asked for an empty row when it has no steps', () => {
    const { lanes } = journeyOf(shipping(), 'ship', ['nobody'])
    const empty = lanes.find((lane) => lane.actorId === 'nobody')!
    expect(empty.fork).toBeUndefined()
    expect(empty.cells.every((cell) => cell.steps.length === 0 && !cell.passThrough)).toBe(true)
  })

  it('draws a lane the sheet did not ask for, after the ones it did', () => {
    // A step that names a lane is a fact; leaving the row out would lose it.
    const { lanes } = journeyOf(shipping(), 'ship', ['partner'])
    expect(lanes.map((lane) => lane.actorId)).toEqual([undefined, 'partner', 'key-account'])
  })

  it('is the common row alone for a journey where nothing names a lane', () => {
    const plain = shipping().filter((e) => e.lane === undefined)
    const { lanes } = journeyOf(plain, 'ship')
    expect(lanes).toHaveLength(1)
    expect(lanes[0].actorId).toBeUndefined()
  })

  it('is an empty page for a journey the scope does not hold', () => {
    expect(journeyOf(shipping(), 'nobody')).toEqual({ phases: [], lanes: [{ cells: [] }] })
  })
})
