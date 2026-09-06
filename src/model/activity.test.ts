/**
 * What a step is called. The rule is "read the lead command, against the model
 * as it was", so these are the cases where that matters: a delete still names
 * what it deleted, and a transaction is named after its subject rather than
 * after the geometry the subject dragged along.
 */
import { describe, expect, it } from 'vitest'
import { summarise } from './activity'
import { transaction } from './commands'
import type { Command } from './commands'
import { fromArrays } from './normalised'
import type { HostModel } from './fromInterchange'

const element = (id: string, name: string) => ({
  id, kind: 'application' as const, name, lifecycle: 'live' as const,
  isManaged: true, aspects: {}, parameters: {},
})

const model = (over: Partial<HostModel> = {}): HostModel => ({
  name: 'Landscape',
  customerName: 'Acme',
  elements: [element('billing', 'Billing'), element('crm', 'CRM')],
  connections: [{ id: 'c#1', sourceId: 'billing', targetId: 'crm', isBidirectional: false }],
  diagrams: [{
    id: 'd1', kind: 'layer7', name: 'L7',
    placements: [{ elementId: 'billing', x: 0, y: 0 }, { elementId: 'crm', x: 100, y: 0 }],
  }],
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
      { type: 'placement.set', diagramId: 'd1', placements: [{ elementId: 'warehouse', x: 0, y: 0 }] },
    ])
    expect(summarise([drawn], before()))
      .toMatchObject({ key: 'activity.elementAdded', name: 'Warehouse' })
  })

  it('counts a move, and reads the count across the whole step', () => {
    const moved = transaction([
      { type: 'placement.set', diagramId: 'd1', placements: [{ elementId: 'billing', x: 5, y: 5 }] },
      { type: 'placement.set', diagramId: 'd1', placements: [{ elementId: 'crm', x: 9, y: 9 }] },
    ])
    expect(summarise([moved], before())).toEqual({ key: 'activity.movedMany', count: 2 })
    expect(summarise([{
      type: 'placement.set', diagramId: 'd1', placements: [{ elementId: 'crm', x: 9, y: 9 }],
    }], before())).toEqual({ key: 'activity.movedOne', count: 1 })
  })

  it('names the diagram cases after the diagram', () => {
    expect(summarise([{ type: 'diagram.rename', id: 'd1', name: 'Landscape 2027' }], before()))
      .toMatchObject({ key: 'activity.diagramRenamed', name: 'Landscape 2027' })
    expect(summarise([{ type: 'diagram.delete', id: 'd1' }], before()))
      .toMatchObject({ key: 'activity.diagramDeleted', name: 'L7' })
  })

  it('has a name for every command in the vocabulary', () => {
    // A step with no words is a step the list would show as blank, and the one
    // way that happens is a command nobody thought about here.
    const every = [
      { type: 'connection.create', connection: { id: 'c#2', sourceId: 'billing', targetId: 'crm', isBidirectional: false } },
      { type: 'connection.update', id: 'c#1', patch: { label: 'x' } },
      { type: 'connection.delete', id: 'c#1' },
      { type: 'placement.remove', diagramId: 'd1', elementIds: ['crm'] },
      { type: 'route.set', diagramId: 'd1', routes: [{ connectionId: 'c#1', waypoints: [] }] },
      { type: 'route.clear', diagramId: 'd1', connectionIds: ['c#1'] },
      { type: 'layout.set', diagramId: 'd1', layoutConfig: {} },
      { type: 'diagram.settings', id: 'd1', settings: { name: 'L7' } },
      { type: 'diagram.update', id: 'd1', patch: { autoRoute: true } },
      { type: 'project.settings', patch: { name: 'Other' } },
    ] satisfies Command[]
    for (const command of every) {
      expect(summarise([command], before()).key, command.type).not.toBe('activity.nothing')
    }
  })
})
