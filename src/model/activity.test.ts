/**
 * What a step is called. The rule is "read the lead command, against the model
 * as it was", so these are the cases where that matters: a delete still names
 * what it deleted, and a transaction is named after its subject rather than
 * after the geometry the subject dragged along.
 */
import { describe, expect, it } from 'vitest'
import { placeOn } from '../model/commands';
import { laidOut } from '../model/testFixtures';
import { summarise } from './activity'
import { transaction } from './commands'
import type { Command } from './commands'
import { fromArrays } from './normalised'
import type { HostModel } from './fromInterchange'

const element = (id: string, name: string) => ({
  id, kind: 'application' as const, name, lifecycle: 'live' as const,
  isManaged: true, aspects: {},
})

const model = (over: Partial<HostModel> = {}): HostModel => ({
  name: 'Landscape',
  customerName: 'Acme',
  elements: [element('billing', 'Billing'), element('crm', 'CRM')],
  relations: [{ type: 'flow', id: 'c#1', sourceId: 'billing', targetId: 'crm', isBidirectional: false }],
  diagrams: [laidOut({
    id: 'd1', kind: 'layer7', name: 'L7',
    placements: [{ id: 'billing', x: 0, y: 0 }, { id: 'crm', x: 100, y: 0 }],
  })],
  ...over,
})

const before = () => fromArrays(model())

describe('summarise', () => {
  it('names a step nobody made', () => {
    expect(summarise([], before())).toEqual({ key: 'activity.nothing' })
    expect(summarise([transaction([])], before())).toEqual({ key: 'activity.nothing' })
  })

  it('names a new element after the element, which only the command knows', () => {
    expect(summarise([{
      type: 'element.create', element: element('warehouse', 'Warehouse'),
    }], before())).toMatchObject({ key: 'activity.elementAdded', name: 'Warehouse' })
  })

  it('names a delete after what it deleted — the model after it cannot', () => {
    expect(summarise([{ type: 'element.delete', id: 'billing' }], before()))
      .toMatchObject({ key: 'activity.elementDeleted', name: 'Billing' })
  })

  it('names an edit after the row as it was, not as it became', () => {
    expect(summarise([{
      type: 'element.update', id: 'billing', patch: { name: 'Invoicing' },
    }], before())).toMatchObject({ key: 'activity.elementChanged', name: 'Billing' })
  })

  it('takes a transaction’s name from its subject, not its consequences', () => {
    // Drawing a card is an element and a placement; it is "Added Warehouse",
    // never "Moved one element".
    const drawn = transaction([
      { type: 'element.create', element: element('warehouse', 'Warehouse') },
      placeOn('d1', [{ id: 'warehouse', x: 0, y: 0}]),
    ])
    expect(summarise([drawn], before()))
      .toMatchObject({ key: 'activity.elementAdded', name: 'Warehouse' })
  })

  it('counts a move, and reads the count across the whole step', () => {
    const moved = transaction([
      placeOn('d1', [{ id: 'billing', x: 5, y: 5}]),
      placeOn('d1', [{ id: 'crm', x: 9, y: 9}]),
    ])
    expect(summarise([moved], before())).toEqual({ key: 'activity.movedMany', count: 2 })
    expect(summarise([placeOn('d1', [{ id: 'crm', x: 9, y: 9}])], before())).toEqual({ key: 'activity.movedOne', count: 1 })
  })

  it('names the diagram cases after the diagram', () => {
    expect(summarise([{ type: 'diagram.rename', id: 'd1', name: 'Landscape 2027' }], before()))
      .toMatchObject({ key: 'activity.diagramRenamed', name: 'Landscape 2027' })
    expect(summarise([{ type: 'diagram.delete', id: 'd1' }], before()))
      .toMatchObject({ key: 'activity.diagramDeleted', name: 'L7' })
  })

  it('calls a flow a connection, and says which the other four rows were', () => {
    // The vocabulary follows the type (ADR-0012 §5). A flow keeps the word this
    // tool has always used for it — it is what a person draws on a board, and
    // it is almost every row — and "drew a connection" for a row between a
    // capability and a journey step would be the log describing something that
    // did not happen.
    expect(summarise([{
      type: 'relation.create',
      relation: { id: 'r1', type: 'flow', sourceId: 'billing', targetId: 'crm', isBidirectional: false },
    }], before())).toEqual({ key: 'activity.relationAdded' })

    expect(summarise([{
      type: 'relation.create',
      relation: { id: 'r2', type: 'supports', sourceId: 'billing', targetId: 'fulfilment' },
    }], before())).toEqual({ key: 'activity.rowAdded', typeKey: 'relation.supports' })
  })

  it('names a row it no longer holds as the flow it almost certainly was', () => {
    // An update to something deleted in the same breath: a log line is not the
    // place to say "unknown".
    expect(summarise([{ type: 'relation.update', id: 'gone', patch: { label: 'x' } }], before()))
      .toEqual({ key: 'activity.relationChanged' })
  })

  it('has a name for every command in the vocabulary', () => {
    // A step with no words is a step the list would show as blank, and the one
    // way that happens is a command nobody thought about here.
    const every = [
      { type: 'relation.create', relation: { id: 'c#2', type: 'flow' as const, sourceId: 'billing', targetId: 'crm', isBidirectional: false } },
      { type: 'relation.update', id: 'c#1', patch: { label: 'x' } },
      { type: 'relation.delete', id: 'c#1' },
      { type: 'member.set', diagramId: 'd1', members: [{ id: 'crm' }] },
      { type: 'member.remove', diagramId: 'd1', elementIds: ['crm'] },
      { type: 'node.set', diagramId: 'd1', nodes: [{ id: 'crm', x: 0, y: 0 }] },
      { type: 'node.remove', diagramId: 'd1', elementIds: ['crm'] },
      { type: 'group.set', diagramId: 'd1', groups: [{ id: 'g', name: 'G' }] },
      { type: 'group.remove', diagramId: 'd1', groupIds: ['g'] },
      { type: 'box.remove', diagramId: 'd1', groupIds: ['g'] },
      { type: 'route.set', diagramId: 'd1', routes: [{ relationId: 'c#1', waypoints: [] }] },
      { type: 'route.clear', diagramId: 'd1', relationIds: ['c#1'] },
      { type: 'box.set', diagramId: 'd1', boxes: [] },
      { type: 'board.set', diagramId: 'd1', patch: { needsLayout: true } },
      { type: 'diagram.settings', id: 'd1', settings: { name: 'L7' } },
      { type: 'diagram.update', id: 'd1', patch: { autoRoute: true } },
      { type: 'project.settings', patch: { name: 'Other' } },
    ] satisfies Command[]
    for (const command of every) {
      expect(summarise([command], before()).key, command.type).not.toBe('activity.nothing')
    }
  })
})
