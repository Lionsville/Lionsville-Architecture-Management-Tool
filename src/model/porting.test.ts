// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Which interface moves where (ADR-0010).
 *
 * The heuristic is the thing to pin: what counts as a twin, what is left out,
 * and that writing a port and taking it back are exact inverses in what they
 * touch — and, since an interface that has landed moves with its landings
 * (ADR-0013), that the landings go where the interface goes and nowhere the
 * writer would refuse.
 */
import { describe, expect, it } from 'vitest'
import { livenessOf } from './liveness'
import { applyAll } from './reducer'
import { fromArrays, toArrays } from './normalised'
import { portCommands, portProgress, portsOf, twinOf, unplannedPorts, unportCommands } from './porting'
import { planGate } from './transition'
import type { Transition } from './transition'
import type { DesignElement, Relation } from './types'

function element(id: string): DesignElement {
  return { id, kind: 'application', name: id, lifecycle: 'live', isManaged: true, aspects: {} }
}
function container(id: string, parentId: string): DesignElement {
  return { ...element(id), kind: 'component', parentId }
}
function line(id: string, sourceId: string, targetId: string, over: Partial<Relation> = {}): Relation {
  return { id, type: 'flow', sourceId, targetId, isBidirectional: false, ...over }
}
function plan(elements: Transition['elements']): Transition {
  return { id: 'tr', number: 1, title: 'Replace', status: 'agreed', elements, decisions: [], milestones: [], body: '' }
}

const ELEMENTS = ['old', 'new', 'billing', 'crm', 'other-old'].map(element)
const REPLACE = plan([{ elementId: 'old', role: 'retires' }, { elementId: 'new', role: 'introduces' }])

describe('portsOf', () => {
  it('lists every line on the retiring element, with the end that leaves and the one that stays', () => {
    const ports = portsOf({ elements: ELEMENTS, relations: [line('a', 'old', 'billing'), line('b', 'crm', 'old')] }, REPLACE)
    expect(ports.map((p) => [p.from.id, p.fromElementId, p.counterpartId])).toEqual([
      ['a', 'old', 'billing'], ['b', 'old', 'crm'],
    ])
    expect(ports.every((p) => p.to === undefined && p.on === undefined)).toBe(true)
  })

  it('pairs a line with its twin: same counterpart, same end, same direction, same protocol', () => {
    const ports = portsOf({
      elements: ELEMENTS,
      relations: [
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
      relations: [
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
      relations: [line('a', 'old', 'billing', { label: 'orders' }), line('a2', 'new', 'billing', { label: 'orders (v2)' })],
    }, REPLACE)
    expect(ports[0].to?.id).toBe('a2')
  })

  it('leaves out the tap and any line between two things that are leaving', () => {
    const merge = plan([
      { elementId: 'old', role: 'retires' }, { elementId: 'other-old', role: 'retires' }, { elementId: 'new', role: 'introduces' },
    ])
    const ports = portsOf({
      elements: ELEMENTS,
      relations: [line('tap', 'old', 'new', { validFrom: '2027-01-01', validUntil: '2027-06-30' }), line('between', 'old', 'other-old'), line('a', 'old', 'billing')],
    }, merge)
    expect(ports.map((p) => p.from.id)).toEqual(['a'])
  })

  it('moves lines off an element a split only changes', () => {
    const split = plan([{ elementId: 'old', role: 'changes' }, { elementId: 'new', role: 'introduces' }])
    const ports = portsOf({ elements: ELEMENTS, relations: [line('a', 'old', 'billing')] }, split)
    expect(ports.map((p) => p.from.id)).toEqual(['a'])
  })

  it('says when a line was closed by something other than this plan, and leaves it out of the unplanned', () => {
    // Another plan ported this line onto `crm`; `new` has no twin of it, so
    // this plan did not date it — and "every interface not yet planned" must
    // not re-date what the other plan decided.
    const ports = portsOf({
      elements: ELEMENTS,
      relations: [
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
    expect(portsOf({ elements: ELEMENTS, relations: [line('a', 'old', 'billing')] }, plan([{ elementId: 'old', role: 'retires' }]))).toEqual([])
    expect(portsOf({ elements: ELEMENTS, relations: [line('a', 'old', 'billing')] }, plan([{ elementId: 'new', role: 'introduces' }]))).toEqual([])
  })

  it('counts progress as lines with a day out of lines there are', () => {
    const progress = portProgress({
      elements: ELEMENTS,
      relations: [line('a', 'old', 'billing'), line('a2', 'new', 'billing', { validFrom: '2027-03-01' }), line('b', 'old', 'crm')],
    }, REPLACE)
    expect(progress).toEqual({ done: 1, total: 2 })
  })
})

describe('writing a port', () => {
  const ports = portsOf({
    elements: ELEMENTS,
    relations: [line('a', 'old', 'billing', { protocol: 'REST', label: 'orders', color: '#123456' }), line('b', 'crm', 'old')],
  }, REPLACE)

  it('draws the twin with the leaving end replaced, and closes the original the day before', () => {
    const commands = portCommands(ports[0], 'new', '2027-03-01', () => 'c-new')
    expect(commands).toEqual([
      { type: 'relation.create', relation: { id: 'c-new', type: 'flow', sourceId: 'new', targetId: 'billing', isBidirectional: false, protocol: 'REST', label: 'orders', color: '#123456', validFrom: '2027-03-01' } },
      { type: 'relation.update', id: 'a', patch: { validUntil: '2027-02-28' } },
    ])
  })

  it('keeps the line\'s direction: a target end stays a target', () => {
    const twin = twinOf(ports[1], 'new', 'c-new', '2027-03-01')
    expect([twin.sourceId, twin.targetId]).toEqual(['crm', 'new'])
  })

  it('re-dates a twin that is already drawn rather than drawing it twice', () => {
    const drawn = portsOf({
      elements: ELEMENTS,
      relations: [line('a', 'old', 'billing'), line('a2', 'new', 'billing', { validFrom: '2027-03-01' })],
    }, REPLACE)
    let minted = 0
    const commands = portCommands(drawn[0], 'new', '2027-05-01', () => { minted += 1; return 'x' })
    expect(minted).toBe(0)
    expect(commands).toEqual([
      { type: 'relation.update', id: 'a2', patch: { validFrom: '2027-05-01' } },
      { type: 'relation.update', id: 'a', patch: { validUntil: '2027-04-30' } },
    ])
  })

  it('takes a port back by deleting the twin and reopening the original', () => {
    const drawn = portsOf({
      elements: ELEMENTS,
      relations: [line('a', 'old', 'billing', { validUntil: '2027-02-28' }), line('a2', 'new', 'billing', { validFrom: '2027-03-01' })],
    }, REPLACE)
    expect(unportCommands(drawn[0])).toEqual([
      { type: 'relation.delete', id: 'a2' },
      { type: 'relation.update', id: 'a', patch: { validUntil: undefined } },
    ])
  })
})

describe('the days a port writes, read by the liveness rules', () => {
  it('hands over from one line to the other with no day on both and none on neither, landings included', () => {
    // Ported on the day the old one is gone (a cutover): validUntil is the
    // last day a line is there and retired the first day a thing is gone, so
    // the original's last day is the old one's last, and nothing outlives it.
    const elements = [
      { ...element('old'), lifecycleDates: { retired: '2027-03-01' } }, element('new'), element('billing'),
      container('billing-api', 'billing'),
    ]
    const held = { name: 'm', diagrams: [], elements, relations: [
      line('i1', 'old', 'billing'), line('r1', 'old', 'billing-api', { refines: 'i1' }),
    ] }
    const [port] = portsOf(held, REPLACE)
    const result = applyAll(fromArrays(held), portCommands(port, 'new', '2027-03-01', (() => { let n = 0; return () => `c${++n}` })()))
    if (!result.ok) throw new Error(result.reason)
    const after = toArrays(result.model)
    const live = livenessOf({ elements, relations: after.relations })
    const there = (day: string) => after.relations.filter((row) => live.thereOn(row, day)).map((row) => row.id)
    expect(there('2027-02-28')).toEqual(['i1', 'r1'])
    expect(there('2027-03-01')).toEqual(['c1', 'c2'])
    expect(after.relations.map((row) => live.outlivedEnd(row))).toEqual([undefined, undefined, undefined, undefined])
  })
})

describe('an interface that has landed', () => {
  // The interface runs from the old application to billing; billing's end of
  // it arrives on its API, and the old one's on a service of its own.
  const LANDED = [
    ...ELEMENTS, container('billing-api', 'billing'), container('billing-queue', 'billing'),
    container('old-svc', 'old'), container('old-job', 'old'),
  ]
  const model = (relations: Relation[]) => ({ name: 'm', diagrams: [], elements: LANDED, relations })
  const counter = () => { let n = 0; return () => `c${++n}` }

  it('is one row however many landings it has, and a landing is never a row of its own', () => {
    const ports = portsOf(model([
      line('i1', 'old', 'billing'),
      line('r1', 'old', 'billing-api', { refines: 'i1', protocol: 'REST' }),
      line('r2', 'old-svc', 'billing-queue', { refines: 'i1', protocol: 'AMQP' }),
    ]), REPLACE)
    expect(ports.map((port) => port.from.id)).toEqual(['i1'])
    expect(ports[0].landings.map((landing) => landing.row.id)).toEqual(['r1', 'r2'])
  })

  it('draws the counterpart\'s landings again on the twin, from the new application\'s boundary', () => {
    const [port] = portsOf(model([
      line('i1', 'old', 'billing', { label: 'invoices' }),
      line('r1', 'old', 'billing-api', { refines: 'i1', protocol: 'REST', validFrom: '2026-01-01' }),
      // The same arrival from one of the old one's own containers: once the
      // old containers are out of the picture, it is the same landing.
      line('r2', 'old-svc', 'billing-api', { refines: 'i1', protocol: 'REST' }),
      // Arrives on billing's queue from the old job: follows, as billing's.
      line('r3', 'old-job', 'billing-queue', { refines: 'i1', protocol: 'AMQP' }),
      // Arrives only on the old one's side: goes with it.
      line('r4', 'old-svc', 'billing', { refines: 'i1', protocol: 'SFTP' }),
    ]), REPLACE)
    expect(portCommands(port, 'new', '2027-03-01', counter())).toEqual([
      { type: 'relation.create', relation: { id: 'c1', type: 'flow', sourceId: 'new', targetId: 'billing', isBidirectional: false, label: 'invoices', validFrom: '2027-03-01' } },
      { type: 'relation.create', relation: { id: 'c2', type: 'flow', sourceId: 'new', targetId: 'billing-api', isBidirectional: false, refines: 'c1', protocol: 'REST' } },
      { type: 'relation.create', relation: { id: 'c3', type: 'flow', sourceId: 'new', targetId: 'billing-queue', isBidirectional: false, refines: 'c1', protocol: 'AMQP' } },
      { type: 'relation.update', id: 'i1', patch: { validUntil: '2027-02-28' } },
    ])
  })

  it('moves a two-way interface\'s landing drawn the other way round, keeping its direction', () => {
    const [port] = portsOf(model([
      line('i1', 'billing', 'old', { isBidirectional: true }),
      line('r1', 'old', 'billing-api', { refines: 'i1', isBidirectional: true }),
    ]), REPLACE)
    const commands = portCommands(port, 'new', '2027-03-01', counter())
    expect(commands[1]).toMatchObject({ relation: { sourceId: 'new', targetId: 'billing-api', refines: 'c1' } })
    const held = model([line('i1', 'billing', 'old', { isBidirectional: true }), line('r1', 'old', 'billing-api', { refines: 'i1', isBidirectional: true })])
    expect(applyAll(fromArrays(held), commands).ok).toBe(true)
  })

  it('ports all of a plan in one step the writer accepts, and the plan\'s gate clears', () => {
    const held = model([
      line('i1', 'old', 'billing'),
      line('r1', 'old', 'billing-api', { refines: 'i1', protocol: 'REST' }),
      line('b', 'crm', 'old'),
    ])
    const next = counter()
    const commands = unplannedPorts(portsOf(held, REPLACE)).flatMap((port) => portCommands(port, 'new', '2027-03-01', next))
    const result = applyAll(fromArrays(held), commands)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const after = toArrays(result.model)
    const gate = planGate({ ...REPLACE, status: 'running' }, 'done', {
      decisions: [], element: () => undefined, unported: () => unplannedPorts(portsOf({ elements: LANDED, relations: after.relations }, REPLACE)).length,
    })
    expect(gate?.items.find((one) => one.item === 'interfacesPorted')?.ok).toBe(true)
  })

  it('takes a port back with what landed on the twin, so nothing is left as an interface nobody drew', () => {
    const held = model([line('i1', 'old', 'billing'), line('r1', 'old', 'billing-api', { refines: 'i1', protocol: 'REST' })])
    const [port] = portsOf(held, REPLACE)
    const ported = applyAll(fromArrays(held), portCommands(port, 'new', '2027-03-01', counter()))
    if (!ported.ok) throw new Error(ported.reason)
    const [again] = portsOf({ elements: LANDED, relations: toArrays(ported.model).relations }, REPLACE)
    expect(unportCommands(again)).toEqual([
      { type: 'relation.delete', id: 'c2' },
      { type: 'relation.delete', id: 'c1' },
      { type: 'relation.update', id: 'i1', patch: { validUntil: undefined } },
    ])
    const back = applyAll(ported.model, unportCommands(again))
    if (!back.ok) throw new Error(back.reason)
    expect(toArrays(back.model).relations).toEqual(held.relations)
  })

  it('never takes a landing for a twin', () => {
    // A container line that is an interface of its own moves off the old
    // application; the new one's landing on billing's API is part of another
    // interface, and re-dating it would give a landing a window of its own.
    const [port] = portsOf(model([
      line('x', 'old', 'billing-api'),
      line('i2', 'new', 'billing'),
      line('r2', 'new', 'billing-api', { refines: 'i2' }),
    ]), REPLACE)
    expect(port.from.id).toBe('x')
    expect(port.to).toBeUndefined()
  })

  it('carries a drawn twin\'s landings when the twin moves to another introduced application', () => {
    const merge = plan([
      { elementId: 'old', role: 'retires' }, { elementId: 'new', role: 'introduces' }, { elementId: 'other-old', role: 'introduces' },
    ])
    const held = {
      name: 'm', diagrams: [],
      elements: [...LANDED, container('new-svc', 'new')],
      relations: [
        line('i1', 'old', 'billing', { validUntil: '2027-02-28' }),
        line('t1', 'new', 'billing', { validFrom: '2027-03-01' }),
        line('t1a', 'new', 'billing-api', { refines: 't1' }),
        line('t1b', 'new-svc', 'billing', { refines: 't1' }),
      ],
    }
    const [port] = portsOf(held, merge)
    const commands = portCommands(port, 'other-old', '2027-04-01', counter())
    expect(commands).toEqual([
      { type: 'relation.update', id: 't1', patch: { validFrom: '2027-04-01', sourceId: 'other-old' } },
      { type: 'relation.update', id: 't1a', patch: { sourceId: 'other-old' } },
      { type: 'relation.delete', id: 't1b' },
      { type: 'relation.update', id: 'i1', patch: { validUntil: '2027-03-31' } },
    ])
    expect(applyAll(fromArrays(held), commands).ok).toBe(true)
  })
})
