/**
 * The property ADR-0008 promises: after a whole-project restore, the files
 * the folder would hold are the snapshot's, byte for byte. That is what makes
 * the next snapshot a commit whose tree equals the old one — a revert, in the
 * history's own currency — without anything having moved backwards.
 */
import { describe, expect, it } from 'vitest'
import { apply, fromArrays, restoreCommand, toArrays } from '../model'
import type { HostModel } from '../model/fromInterchange'
import { projectFiles } from './folderFormat'
import type { ProjectSnapshot } from './project'

const element = (id: string, name: string, description?: string) => ({
  id, kind: 'application' as const, name, lifecycle: 'live' as const, isManaged: true, aspects: {},
  ...(description !== undefined ? { description } : {}),
})

const then: HostModel = {
  name: 'Landscape', customerName: 'Acme',
  elements: [element('billing', 'Billing', 'Invoices.'), element('crm', 'CRM')],
  relations: [{ type: 'flow', id: 'c#1', sourceId: 'billing', targetId: 'crm', isBidirectional: false }],
  diagrams: [{
    id: 'd1', kind: 'layer7', name: 'Warehouse',
    placements: [{ elementId: 'billing', x: 0, y: 0 }, { elementId: 'crm', x: 100, y: 0 }],
    edgeRoutes: [{ relationId: 'c#1', waypoints: [{ x: 50, y: 10 }] }],
  }],
  decisions: [{ id: 'adr-1', number: 1, title: 'One writer', status: 'proposed', date: '2026-09-01', body: 'Why.', signers: [] }],
}

const now: HostModel = {
  name: 'Renamed', customerName: 'Acme', description: 'Added since.',
  elements: [element('billing', 'Billing', 'Rewritten.'), element('wms', 'WMS')],
  relations: [{ type: 'flow', id: 'c#2', sourceId: 'billing', targetId: 'wms', isBidirectional: true }],
  diagrams: [
    { id: 'd1', kind: 'layer7', name: 'A mess', placements: [{ elementId: 'wms', x: 9, y: 9 }] },
    { id: 'd2', kind: 'container', name: 'WMS', applicationElementId: 'wms', placements: [] },
  ],
  decisions: [{ id: 'adr-1', number: 1, title: 'Two writers', status: 'reviewing', date: '2026-09-02', body: 'Changed.', signers: [] }],
}

const files = (model: HostModel) => {
  const project: ProjectSnapshot = { ref: { group: 'acme', project: 'landscape' }, model, activeDiagramId: 'd1', logoLibrary: [] }
  return projectFiles(project).map((file) => ('text' in file ? `${file.path}\n${file.text}` : file.path))
}

describe('a restore, at the folder', () => {
  it('leaves the project\'s files exactly as the snapshot had them', () => {
    const result = restoreCommand(fromArrays(then), fromArrays(now), undefined, '2026-09-03')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const applied = apply(fromArrays(now), result.command)
    expect(applied.ok).toBe(true)
    if (!applied.ok) return
    expect(files(toArrays(applied.model))).toEqual(files(then))
  })

  it('leaves one diagram\'s files as the snapshot had them, and the rest as today', () => {
    const result = restoreCommand(fromArrays(then), fromArrays(now), { what: 'diagram', id: 'd1' }, '2026-09-03')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const applied = apply(fromArrays(now), result.command)
    if (!applied.ok) throw new Error(applied.reason)
    const after = files(toArrays(applied.model))
    const only = (list: string[], prefix: string) => list.filter((entry) => entry.startsWith(prefix))
    // The diagram's own two files are the snapshot's, less the placement of
    // an element today does not have.
    expect(only(after, 'diagrams/d1.json')).toEqual(only(files(then), 'diagrams/d1.json'))
    expect(only(after, 'diagrams/d1.placements')[0]).toContain('"billing"')
    expect(only(after, 'diagrams/d1.placements')[0]).not.toContain('"crm"')
    expect(result.dropped).toBe(1)
    // Everything else is today's.
    expect(only(after, 'docs/')).toEqual(only(files(now), 'docs/'))
    expect(only(after, 'decisions/')).toEqual(only(files(now), 'decisions/'))
    expect(only(after, 'diagrams/d2')).toEqual(only(files(now), 'diagrams/d2'))
  })
})
