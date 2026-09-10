/**
 * A restore is one command, and it brings the thing to what the snapshot held
 * (ADR-0008). Tested against the reducer, not by inspecting the command: what
 * matters is where the model lands, and what the command refused to do.
 */
import { describe, expect, it } from 'vitest'
import type { Adr } from './adr'
import type { HostModel } from './fromInterchange'
import { fromArrays, toArrays } from './normalised'
import type { Model } from './normalised'
import { apply } from './reducer'
import { restoreCommand } from './restore'
import type { RestoreSubject } from './restore'
import { summarise } from './activity'
import type { DesignElement } from './types'

const element = (id: string, name: string, over: Partial<DesignElement> = {}): DesignElement => ({
  id, kind: 'application', name, lifecycle: 'live', isManaged: true, aspects: {}, ...over,
})

const decision = (over: Partial<Adr> = {}): Adr => ({
  id: 'adr-1', number: 1, title: 'One writer', status: 'proposed', date: '2026-09-01', body: 'Why.', signers: [], ...over,
})

/** The project as the snapshot held it. */
function then(over: Partial<HostModel> = {}): HostModel {
  return {
    name: 'Landscape',
    customerName: 'Acme',
    defaultAuthor: 'W.',
    elements: [
      element('billing', 'Billing', { description: 'Sends the invoices.' }),
      element('crm', 'CRM', { vendor: 'Someone' }),
    ],
    relations: [{ type: 'flow', id: 'c#1', sourceId: 'billing', targetId: 'crm', isBidirectional: false, label: 'orders' }],
    diagrams: [{
      id: 'd1', kind: 'layer7', name: 'Warehouse', author: 'W.', showAspects: false,
      autoRoute: true,
      layoutConfig: { algorithm: 'layered' } as never,
      placements: [{ elementId: 'billing', x: 0, y: 0 }, { elementId: 'crm', x: 100, y: 0 }],
      edgeRoutes: [{ connectionId: 'c#1', waypoints: [{ x: 50, y: 10 }] }],
    }],
    decisions: [decision()],
    ...over,
  }
}

/** Where the project has got to since: everything touched. */
function now(over: Partial<HostModel> = {}): HostModel {
  return then({
    name: 'Landscape, renamed',
    defaultAuthor: undefined,
    elements: [
      element('billing', 'Billing', { description: 'Rewritten.' }),
      element('crm', 'CRM'),
      element('wms', 'Warehouse system'),
    ],
    relations: [
      { type: 'flow', id: 'c#1', sourceId: 'billing', targetId: 'crm', isBidirectional: true },
      { type: 'flow', id: 'c#2', sourceId: 'crm', targetId: 'wms', isBidirectional: false },
    ],
    diagrams: [{
      id: 'd1', kind: 'layer7', name: 'A mess', client: 'Somebody',
      asOf: '2028-01-01',
      placements: [{ elementId: 'billing', x: 500, y: 500 }, { elementId: 'wms', x: 0, y: 0 }],
      edgeRoutes: [{ connectionId: 'c#2', waypoints: [] }],
    }],
    decisions: [decision({ title: 'Retitled', body: 'Changed.' })],
    ...over,
  })
}

const restored = (from: HostModel, to: HostModel, subject: RestoreSubject | undefined) => {
  const result = restoreCommand(fromArrays(from), fromArrays(to), subject, '2026-09-03')
  if (!result.ok) throw new Error(result.reason)
  const applied = apply(fromArrays(to), result.command)
  if (!applied.ok) throw new Error(applied.reason)
  return { ...result, model: applied.model, after: toArrays(applied.model), inverse: applied.inverse }
}

describe('restoring one diagram', () => {
  it('brings the diagram, its geometry and its routes to what the snapshot held', () => {
    const { after, dropped } = restored(then(), now(), { what: 'diagram', id: 'd1' })
    expect(after.diagrams[0]).toEqual(then().diagrams[0])
    expect(dropped).toBe(0)
    // And nothing else moved: the elements, the connections and the decision are today's.
    expect(after.elements).toEqual(now().elements)
    expect(after.relations).toEqual(now().relations)
    expect(after.decisions).toEqual(now().decisions)
    expect(after.name).toBe('Landscape, renamed')
  })

  it('drops the placement of an element that no longer exists, and says how many', () => {
    const later = now({ elements: [element('billing', 'Billing')], relations: [] })
    const { after, dropped } = restored(then(), later, { what: 'diagram', id: 'd1' })
    expect(dropped).toBe(1)
    expect(after.diagrams[0].placements.map((p) => p.elementId)).toEqual(['billing'])
    // The route of a connection that is gone is not brought back either.
    expect(after.diagrams[0].edgeRoutes ?? []).toEqual([])
    expect(after.elements.map((e) => e.id)).toEqual(['billing'])
  })

  it('creates the diagram again when it was deleted since', () => {
    const later = now({ diagrams: [{ id: 'other', kind: 'layer7', name: 'Other', placements: [] }] })
    const { after } = restored(then(), later, { what: 'diagram', id: 'd1' })
    expect(after.diagrams.map((d) => d.id)).toEqual(['other', 'd1'])
    expect(after.diagrams[1]).toEqual(then().diagrams[0])
  })

  it('refuses a diagram the snapshot did not have', () => {
    expect(restoreCommand(fromArrays(then()), fromArrays(now()), { what: 'diagram', id: 'nope' }, '2026-09-03'))
      .toEqual({ ok: false, reason: 'restore.absentThen' })
  })

  it('is one undo step that puts the mess back exactly', () => {
    const { model, inverse } = restored(then(), now(), { what: 'diagram', id: 'd1' })
    const undone = apply(model, inverse)
    expect(undone.ok && toArrays(undone.model)).toEqual(now())
  })

  it('is named after what it restored, not after what that took', () => {
    const result = restoreCommand(fromArrays(then()), fromArrays(now()), { what: 'diagram', id: 'd1' }, '2026-09-03')
    expect(result.ok && summarise([result.command], fromArrays(now())))
      .toEqual({ key: 'activity.diagramRestored', name: 'Warehouse', asOf: '2026-09-03' })
  })
})

describe('restoring one description', () => {
  it('puts the text back and touches nothing else on the element', () => {
    const { after } = restored(then(), now(), { what: 'description', id: 'billing' })
    expect(after.elements[0].description).toBe('Sends the invoices.')
    expect(after.elements[1]).toEqual(now().elements[1])
  })

  it('clears a description the snapshot did not have', () => {
    const { after } = restored(then({ elements: [element('billing', 'Billing')] }), now(), { what: 'description', id: 'billing' })
    expect('description' in after.elements[0]).toBe(false)
  })

  it('refuses when the element is gone now — that is a project restore', () => {
    const later = now({ elements: [element('crm', 'CRM')], relations: [], diagrams: [{ id: 'd1', kind: 'layer7', name: 'x', placements: [] }] })
    expect(restoreCommand(fromArrays(then()), fromArrays(later), { what: 'description', id: 'billing' }, '2026-09-03'))
      .toEqual({ ok: false, reason: 'restore.absentNow' })
  })
})

describe('restoring one decision', () => {
  it('brings the record to what the snapshot held', () => {
    const { after } = restored(then(), now(), { what: 'decision', id: 'adr-1' })
    expect(after.decisions).toEqual([decision()])
  })

  it('adds it back when it was removed since', () => {
    const { after } = restored(then(), now({ decisions: [] }), { what: 'decision', id: 'adr-1' })
    expect(after.decisions).toEqual([decision()])
  })

  it('refuses a locked record rather than opening a back door', () => {
    const later = now({ decisions: [decision({ status: 'accepted', body: 'Final.' })] })
    expect(restoreCommand(fromArrays(then()), fromArrays(later), { what: 'decision', id: 'adr-1' }, '2026-09-03'))
      .toEqual({ ok: false, reason: 'restore.locked' })
  })
})

describe('restoring the whole project', () => {
  it('brings every element, connection, diagram, decision and setting to the snapshot', () => {
    const { after, dropped, kept } = restored(then(), now(), undefined)
    // Order is the file's business and the writer sorts by id; compare as sets.
    const sorted = (model: HostModel) => ({
      ...model,
      elements: [...model.elements].sort((a, b) => a.id.localeCompare(b.id)),
      connections: [...model.relations].sort((a, b) => a.id.localeCompare(b.id)),
    })
    expect(sorted(after)).toEqual(sorted(then()))
    expect(dropped).toBe(0)
    expect(kept).toBe(0)
  })

  it('leaves a locked decision as it is, and counts it', () => {
    const later = now({ decisions: [decision({ status: 'accepted', body: 'Final.' }), decision({ id: 'adr-2', number: 2, status: 'rejected' })] })
    const { after, kept } = restored(then(), later, undefined)
    expect(kept).toBe(2)
    expect(after.decisions).toEqual(later.decisions)
  })

  it('is named as the project\'s, and undone in one step', () => {
    const result = restoreCommand(fromArrays(then()), fromArrays(now()), undefined, '2026-09-03')
    expect(result.ok && summarise([result.command], fromArrays(now())))
      .toEqual({ key: 'activity.projectRestored', name: 'Landscape', asOf: '2026-09-03' })
    const { model, inverse } = restored(then(), now(), undefined)
    const undone = apply(model, inverse)
    expect(undone.ok && toArrays(undone.model)).toEqual(now())
  })

  it('creates the diagram of a restored element before deleting today\'s, so a landscape is never the last', () => {
    // Today's only landscape is not the snapshot's; the snapshot's is created
    // first and today's deleted after, or the reducer would refuse.
    const later = now({ diagrams: [{ id: 'today', kind: 'layer7', name: 'Today', placements: [] }] })
    const { after } = restored(then(), later, undefined)
    expect(after.diagrams.map((d) => d.id)).toEqual(['d1'])
  })
})

/** Guard: the reducer is what these run through, so an indexed model must survive it. */
function indexedOnly(model: Model): Model { return model }
void indexedOnly
