/**
 * Which interface moves where (ADR-0010).
 *
 * The heuristic is the thing to pin: what counts as a twin, what is left out,
 * and that writing a port and taking it back are exact inverses in what they
 * touch.
 */
import { describe, expect, it } from 'vitest'
import { portCommands, portProgress, portsOf, twinOf, unplannedPorts, unportCommands } from './porting'
import type { Transition } from './transition'
import type { DesignConnection, DesignElement } from './types'

function element(id: string): DesignElement {
  return { id, kind: 'application', name: id, lifecycle: 'live', isManaged: true, aspects: {} }
}
function line(id: string, sourceId: string, targetId: string, over: Partial<DesignConnection> = {}): DesignConnection {
  return { id, sourceId, targetId, isBidirectional: false, ...over }
}
function plan(elements: Transition['elements']): Transition {
  return { id: 'tr', number: 1, title: 'Replace', status: 'agreed', elements, decisions: [], milestones: [], body: '' }
}

const ELEMENTS = ['old', 'new', 'billing', 'crm', 'other-old'].map(element)
const REPLACE = plan([{ elementId: 'old', role: 'retires' }, { elementId: 'new', role: 'introduces' }])

describe('portsOf', () => {
  it('lists every line on the retiring element, with the end that leaves and the one that stays', () => {
    const ports = portsOf({ elements: ELEMENTS, connections: [line('a', 'old', 'billing'), line('b', 'crm', 'old')] }, REPLACE)
    expect(ports.map((p) => [p.from.id, p.fromElementId, p.counterpartId])).toEqual([
      ['a', 'old', 'billing'], ['b', 'old', 'crm'],
    ])
    expect(ports.every((p) => p.to === undefined && p.on === undefined)).toBe(true)
  })

  it('pairs a line with its twin: same counterpart, same end, same direction, same protocol', () => {
    const ports = portsOf({
      elements: ELEMENTS,
      connections: [
        line('a', 'old', 'billing', { protocol: 'REST' }),
        line('a2', 'new', 'billing', { protocol: 'REST', validFrom: '2027-03-01' }),
      ],
    }, REPLACE)
    expect(ports[0].to?.id).toBe('a2')
    expect(ports[0].on).toBe('2027-03-01')
  })

  it('does not pair a line whose protocol or direction changed — that is a new interface', () => {
    const ports = portsOf({
      elements: ELEMENTS,
      connections: [
        line('a', 'old', 'billing', { protocol: 'REST' }),
        line('x', 'new', 'billing', { protocol: 'SOAP' }),
        line('y', 'billing', 'new', { protocol: 'REST' }),
        line('z', 'new', 'billing', { protocol: 'REST', isBidirectional: true }),
      ],
    }, REPLACE)
    expect(ports[0].to).toBeUndefined()
  })

  it('is loose about the label, because a label is prose', () => {
    const ports = portsOf({
      elements: ELEMENTS,
      connections: [line('a', 'old', 'billing', { label: 'orders' }), line('a2', 'new', 'billing', { label: 'orders (v2)' })],
    }, REPLACE)
    expect(ports[0].to?.id).toBe('a2')
  })

  it('leaves out the tap and any line between two things that are leaving', () => {
    const merge = plan([
      { elementId: 'old', role: 'retires' }, { elementId: 'other-old', role: 'retires' }, { elementId: 'new', role: 'introduces' },
    ])
    const ports = portsOf({
      elements: ELEMENTS,
      connections: [line('tap', 'old', 'new', { validFrom: '2027-01-01', validUntil: '2027-06-30' }), line('between', 'old', 'other-old'), line('a', 'old', 'billing')],
    }, merge)
    expect(ports.map((p) => p.from.id)).toEqual(['a'])
  })

  it('moves lines off an element a split only changes', () => {
    const split = plan([{ elementId: 'old', role: 'changes' }, { elementId: 'new', role: 'introduces' }])
    const ports = portsOf({ elements: ELEMENTS, connections: [line('a', 'old', 'billing')] }, split)
    expect(ports.map((p) => p.from.id)).toEqual(['a'])
  })

  it('says when a line was closed by something other than this plan, and leaves it out of the unplanned', () => {
    // Another plan ported this line onto `crm`; `new` has no twin of it, so
    // this plan did not date it — and "every interface not yet planned" must
    // not re-date what the other plan decided.
    const ports = portsOf({
      elements: ELEMENTS,
      connections: [
        line('l1', 'old', 'billing', { validUntil: '2027-04-30' }),
        line('l1-twin', 'crm', 'billing', { validFrom: '2027-05-01' }),
        line('l2', 'old', 'crm'),
      ],
    }, REPLACE)
    expect(ports.map((port) => [port.from.id, port.on, port.closedOn])).toEqual([
      ['l1', undefined, '2027-04-30'], ['l2', undefined, undefined],
    ])
    expect(unplannedPorts(ports).map((port) => port.from.id)).toEqual(['l2'])
  })

  it('has nothing to say for a plan that introduces nothing, or retires nothing', () => {
    expect(portsOf({ elements: ELEMENTS, connections: [line('a', 'old', 'billing')] }, plan([{ elementId: 'old', role: 'retires' }]))).toEqual([])
    expect(portsOf({ elements: ELEMENTS, connections: [line('a', 'old', 'billing')] }, plan([{ elementId: 'new', role: 'introduces' }]))).toEqual([])
  })

  it('counts progress as lines with a day out of lines there are', () => {
    const progress = portProgress({
      elements: ELEMENTS,
      connections: [line('a', 'old', 'billing'), line('a2', 'new', 'billing', { validFrom: '2027-03-01' }), line('b', 'old', 'crm')],
    }, REPLACE)
    expect(progress).toEqual({ done: 1, total: 2 })
  })
})

describe('writing a port', () => {
  const ports = portsOf({
    elements: ELEMENTS,
    connections: [line('a', 'old', 'billing', { protocol: 'REST', label: 'orders', color: '#123456' }), line('b', 'crm', 'old')],
  }, REPLACE)

  it('draws the twin with the leaving end replaced, and closes the original the day before', () => {
    const commands = portCommands(ports[0], 'new', '2027-03-01', () => 'c-new')
    expect(commands).toEqual([
      { type: 'connection.create', connection: { id: 'c-new', sourceId: 'new', targetId: 'billing', isBidirectional: false, protocol: 'REST', label: 'orders', color: '#123456', validFrom: '2027-03-01' } },
      { type: 'connection.update', id: 'a', patch: { validUntil: '2027-02-28' } },
    ])
  })

  it('keeps the line\'s direction: a target end stays a target', () => {
    const twin = twinOf(ports[1], 'new', 'c-new', '2027-03-01')
    expect([twin.sourceId, twin.targetId]).toEqual(['crm', 'new'])
  })

  it('re-dates a twin that is already drawn rather than drawing it twice', () => {
    const drawn = portsOf({
      elements: ELEMENTS,
      connections: [line('a', 'old', 'billing'), line('a2', 'new', 'billing', { validFrom: '2027-03-01' })],
    }, REPLACE)
    let minted = 0
    const commands = portCommands(drawn[0], 'new', '2027-05-01', () => { minted += 1; return 'x' })
    expect(minted).toBe(0)
    expect(commands).toEqual([
      { type: 'connection.update', id: 'a2', patch: { validFrom: '2027-05-01' } },
      { type: 'connection.update', id: 'a', patch: { validUntil: '2027-04-30' } },
    ])
  })

  it('takes a port back by deleting the twin and reopening the original', () => {
    const drawn = portsOf({
      elements: ELEMENTS,
      connections: [line('a', 'old', 'billing', { validUntil: '2027-02-28' }), line('a2', 'new', 'billing', { validFrom: '2027-03-01' })],
    }, REPLACE)
    expect(unportCommands(drawn[0])).toEqual([
      { type: 'connection.delete', id: 'a2' },
      { type: 'connection.update', id: 'a', patch: { validUntil: undefined } },
    ])
  })
})
