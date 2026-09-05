/**
 * The shell as a backend: re-keying and applying.
 *
 * This is where the agreement with the package is proved — batches are
 * cumulative and idempotent, placements are the complete set for one diagram,
 * and a tmp id becomes a permanent key exactly once and never a different one
 * afterwards.
 */
import { describe, expect, it } from 'vitest'
import { createTempId } from '@lionsville/solution-design'
import type {
  DesignConnection, DesignElement, DiagramContentBatch, DiagramPlacement, DiagramSettings,
  EdgeRoute,
} from '@lionsville/solution-design'
import type { HostModel } from './fromInterchange'
import {
  applyBatch, applyDiagramSettings, deleteDiagram, duplicateDiagram, isInterchange, isWorkingFile,
  needsRemount,
  rekeyBatch, removedDiagrams, renameDiagram, resolveActiveDiagramId, workingFileLogoLibrary,
  WORKING_FILE_TYPE, WORKING_FILE_VERSION,
} from './hostModel'
import type { Aliases } from './hostModel'

function element(id: string, name: string, over: Partial<DesignElement> = {}): DesignElement {
  return {
    id, kind: 'application', name, lifecycle: 'live', isManaged: true,
    aspects: {}, parameters: {}, ...over,
  }
}

function connection(id: string, sourceId: string, targetId: string): DesignConnection {
  return { id, sourceId, targetId, isBidirectional: false }
}

function place(elementId: string, x = 0, y = 0): DiagramPlacement {
  return { elementId, x, y }
}

/** A model with two diagrams, so "this diagram only" is visible. */
function model(over: Partial<HostModel> = {}): HostModel {
  return {
    name: 'Acme Logistics',
    customerName: 'Acme Logistics',
    elements: [element('crews', 'Crews'), element('reisinfo', 'Reisinformatie')],
    connections: [connection('c#1', 'crews', 'reisinfo')],
    diagrams: [
      { id: 'l7', kind: 'layer7', name: 'Landschap', placements: [place('crews', 10, 20), place('reisinfo', 30, 40)] },
      { id: 'cd', kind: 'container', name: 'Crews · containers', placements: [place('crews', 5, 5)] },
    ],
    ...over,
  }
}

function batch(over: Partial<DiagramContentBatch> = {}): DiagramContentBatch {
  return {
    diagramId: 'l7',
    elements: [],
    deletedElementIds: [],
    connections: [],
    deletedConnectionIds: [],
    placements: [],
    removedPlacementElementIds: [],
    edgeRoutes: [],
    ...over,
  }
}

const noAliases = (): Aliases => ({ elements: new Map(), connections: new Map() })

describe('rekeyBatch', () => {
  it('turns a temp element id into a slug of its name', () => {
    const tmp = createTempId()
    const aliases = noAliases()

    const out = rekeyBatch(batch({
      elements: [element(tmp, 'Nieuwe Werkplek')],
      placements: [place(tmp, 100, 200)],
    }), model(), aliases)

    expect(out.elements[0].id).toBe('nieuwe-werkplek')
    expect(out.placements[0]).toEqual({ elementId: 'nieuwe-werkplek', x: 100, y: 200 })
    expect(aliases.elements.get(tmp)).toBe('nieuwe-werkplek')
  })

  it('turns a temp connection id into a c#… id, because the format carries no key for one', () => {
    const tmp = createTempId()
    const aliases = noAliases()

    const out = rekeyBatch(batch({
      connections: [connection(tmp, 'crews', 'reisinfo')],
    }), model(), aliases)

    expect(out.connections[0].id).toMatch(/^c#\d+-[a-z0-9]+$/)
    expect(out.connections[0].id).not.toBe(tmp)
    expect(aliases.connections.get(tmp)).toBe(out.connections[0].id)
  })

  it('leaves real ids alone', () => {
    const out = rekeyBatch(batch({
      elements: [element('crews', 'Crews hernoemd')],
      connections: [connection('c#1', 'crews', 'reisinfo')],
      placements: [place('crews')],
      deletedElementIds: ['reisinfo'],
      deletedConnectionIds: ['c#1'],
      removedPlacementElementIds: ['reisinfo'],
      edgeRoutes: [{ connectionId: 'c#1', waypoints: [] }],
    }), model(), noAliases())

    expect(out.elements[0].id).toBe('crews')
    expect(out.connections[0].id).toBe('c#1')
    expect(out.placements[0].elementId).toBe('crews')
    expect(out.deletedElementIds).toEqual(['reisinfo'])
    expect(out.deletedConnectionIds).toEqual(['c#1'])
    expect(out.removedPlacementElementIds).toEqual(['reisinfo'])
    expect(out.edgeRoutes[0].connectionId).toBe('c#1')
  })

  it('rewrites every id-bearing field of the batch', () => {
    const app = createTempId()
    const comp = createTempId()
    const gone = createTempId()
    const conn = createTempId()
    const route = createTempId()
    const aliases = noAliases()

    const out = rekeyBatch(batch({
      elements: [
        element(app, 'Nieuwe App'),
        element(comp, 'Onderdeel', { kind: 'component', parentApplicationId: app }),
        element(gone, 'Weg'),
      ],
      deletedElementIds: [gone],
      connections: [connection(conn, app, comp)],
      deletedConnectionIds: [route],
      placements: [place(app), place(comp)],
      removedPlacementElementIds: [gone],
      edgeRoutes: [{ connectionId: conn, waypoints: [{ x: 1, y: 2 }] }],
    }), model(), aliases)

    expect(out.elements.map((e) => e.id)).toEqual(['nieuwe-app', 'onderdeel', 'weg'])
    // parentApplicationId travels through the same map as the element itself
    expect(out.elements[1].parentApplicationId).toBe('nieuwe-app')
    expect(out.deletedElementIds).toEqual(['weg'])
    expect(out.connections[0]).toMatchObject({ sourceId: 'nieuwe-app', targetId: 'onderdeel' })
    expect(out.placements.map((p) => p.elementId)).toEqual(['nieuwe-app', 'onderdeel'])
    expect(out.removedPlacementElementIds).toEqual(['weg'])
    // the route rides the SAME connection alias as the connection upsert
    expect(out.edgeRoutes[0].connectionId).toBe(out.connections[0].id)
    // and a deleted connection gets its own alias, not the same one
    expect(out.deletedConnectionIds[0]).not.toBe(out.connections[0].id)
  })

  it('reuses aliases across batches, so a second batch keeps the first key', () => {
    const tmp = createTempId()
    const conn = createTempId()
    const aliases = noAliases()
    const m = model()

    const first = rekeyBatch(batch({
      elements: [element(tmp, 'Werkplek')],
      connections: [connection(conn, tmp, 'crews')],
    }), m, aliases)
    // second batch: same temp ids, and the model has NOT caught up yet
    const second = rekeyBatch(batch({
      elements: [element(tmp, 'Werkplek anders genoemd')],
      connections: [connection(conn, tmp, 'crews')],
      placements: [place(tmp)],
    }), m, aliases)

    expect(second.elements[0].id).toBe(first.elements[0].id)
    expect(second.connections[0].id).toBe(first.connections[0].id)
    expect(second.placements[0].elementId).toBe(first.elements[0].id)
    // a rename does not re-slug: the key was claimed once
    expect(second.elements[0].id).toBe('werkplek')
    expect(aliases.elements.size).toBe(1)
    expect(aliases.connections.size).toBe(1)
  })

  it('suffixes a slug that collides with the model or with an earlier alias', () => {
    const first = createTempId()
    const second = createTempId()
    const aliases = noAliases()

    const out = rekeyBatch(batch({
      elements: [element(first, 'Crews'), element(second, 'Crews')],
    }), model(), aliases)

    // 'crews' is taken by the model, and 'crews-2' by the first new element
    expect(out.elements.map((e) => e.id)).toEqual(['crews-2', 'crews-3'])
  })

  it('counts diagram ids as taken too — keys are document-wide unique', () => {
    const tmp = createTempId()

    const out = rekeyBatch(batch({
      elements: [element(tmp, 'l7')],
    }), model(), noAliases())

    expect(out.elements[0].id).toBe('l7-2')
  })

  it('names a temp id with no matching upsert "element"', () => {
    const tmp = createTempId()

    const out = rekeyBatch(batch({ placements: [place(tmp)] }), model(), noAliases())

    expect(out.placements[0].elementId).toBe('element')
  })
})

describe('applyBatch', () => {
  it('upserts an element in place, keeping the model order', () => {
    const out = applyBatch(model(), batch({
      elements: [element('reisinfo', 'Reisinformatie 2.0')],
    }))

    expect(out.elements.map((e) => e.name)).toEqual(['Crews', 'Reisinformatie 2.0'])
  })

  it('adds a new element at the end', () => {
    const out = applyBatch(model(), batch({ elements: [element('werkplek', 'Werkplek')] }))

    expect(out.elements.map((e) => e.id)).toEqual(['crews', 'reisinfo', 'werkplek'])
  })

  it('is idempotent: applying the same batch twice gives the same model', () => {
    const b = batch({
      elements: [element('werkplek', 'Werkplek')],
      placements: [place('crews'), place('werkplek', 9, 9)],
    })
    const once = applyBatch(model(), b)

    expect(applyBatch(once, b)).toEqual(once)
  })

  it('deletes elements, and their connections with them', () => {
    const out = applyBatch(model(), batch({ deletedElementIds: ['reisinfo'] }))

    expect(out.elements.map((e) => e.id)).toEqual(['crews'])
    expect(out.connections).toEqual([])
  })

  it('lets a delete win over an upsert of the same element in one batch', () => {
    const out = applyBatch(model(), batch({
      elements: [element('reisinfo', 'Reisinformatie 2.0')],
      deletedElementIds: ['reisinfo'],
    }))

    expect(out.elements.map((e) => e.id)).toEqual(['crews'])
  })

  it('upserts and deletes connections', () => {
    const added = applyBatch(model(), batch({
      connections: [{ ...connection('c#1', 'crews', 'reisinfo'), label: 'rooster' },
        connection('c#2', 'reisinfo', 'crews')],
    }))
    expect(added.connections.map((c) => c.id)).toEqual(['c#1', 'c#2'])
    expect(added.connections[0].label).toBe('rooster')

    const removed = applyBatch(added, batch({ deletedConnectionIds: ['c#1'] }))
    expect(removed.connections.map((c) => c.id)).toEqual(['c#2'])
  })

  it('drops a connection whose endpoint is not in the model', () => {
    const out = applyBatch(model(), batch({
      connections: [connection('c#9', 'crews', 'does-not-exist')],
    }))

    expect(out.connections.map((c) => c.id)).toEqual(['c#1'])
  })

  it('replaces the placements of the batch diagram only', () => {
    const out = applyBatch(model(), batch({
      diagramId: 'l7',
      placements: [place('crews', 111, 222)],
    }))

    expect(out.diagrams[0].placements).toEqual([{ elementId: 'crews', x: 111, y: 222 }])
    // the other diagram is untouched — reisinfo is gone from l7, not from cd
    expect(out.diagrams[1].placements).toEqual([{ elementId: 'crews', x: 5, y: 5 }])
  })

  it('honours removedPlacementElementIds against the batch placement set', () => {
    const out = applyBatch(model(), batch({
      placements: [place('crews'), place('reisinfo')],
      removedPlacementElementIds: ['reisinfo'],
    }))

    expect(out.diagrams[0].placements.map((p) => p.elementId)).toEqual(['crews'])
  })

  it('removes the placements of a deleted element from EVERY diagram', () => {
    const out = applyBatch(model(), batch({
      diagramId: 'l7',
      // 'crews' is deleted from the model, and the l7 batch still lists it
      deletedElementIds: ['crews'],
      placements: [place('crews'), place('reisinfo')],
    }))

    expect(out.diagrams[0].placements.map((p) => p.elementId)).toEqual(['reisinfo'])
    expect(out.diagrams[1].placements).toEqual([])
  })

  it('upserts an edge route on the batch diagram', () => {
    const route: EdgeRoute = { connectionId: 'c#1', waypoints: [{ x: 1, y: 2 }], source: 'manual' }

    const out = applyBatch(model(), batch({ placements: [place('crews'), place('reisinfo')], edgeRoutes: [route] }))

    expect(out.diagrams[0].edgeRoutes).toEqual([route])
    expect(out.diagrams[1].edgeRoutes).toEqual([])
  })

  it('replaces an existing route rather than appending a second row for it', () => {
    const first = applyBatch(model(), batch({
      placements: [place('crews'), place('reisinfo')],
      edgeRoutes: [{ connectionId: 'c#1', waypoints: [{ x: 1, y: 1 }] }],
    }))
    const second = applyBatch(first, batch({
      placements: [place('crews'), place('reisinfo')],
      edgeRoutes: [{ connectionId: 'c#1', waypoints: [{ x: 5, y: 5 }] }],
    }))

    expect(second.diagrams[0].edgeRoutes).toEqual([{ connectionId: 'c#1', waypoints: [{ x: 5, y: 5 }] }])
  })

  it('deletes a route when the upsert has no waypoints and no label position', () => {
    const seeded = applyBatch(model(), batch({
      placements: [place('crews'), place('reisinfo')],
      edgeRoutes: [{ connectionId: 'c#1', waypoints: [{ x: 1, y: 1 }] }],
    }))

    const cleared = applyBatch(seeded, batch({
      placements: [place('crews'), place('reisinfo')],
      edgeRoutes: [{ connectionId: 'c#1', waypoints: [] }],
    }))

    expect(cleared.diagrams[0].edgeRoutes).toEqual([])
  })

  it('keeps a pinned route with no waypoints and no label (the pin IS the content)', () => {
    const pinned: EdgeRoute = { connectionId: 'c#1', waypoints: [], source: 'manual', pinned: true }
    const out = applyBatch(model(), batch({ placements: [place('crews'), place('reisinfo')], edgeRoutes: [pinned] }))
    expect(out.diagrams[0].edgeRoutes).toEqual([pinned])

    // Unpinning writes the same row without the pin: nothing left, so it goes.
    const unpinned = applyBatch(out, batch({
      placements: [place('crews'), place('reisinfo')],
      edgeRoutes: [{ connectionId: 'c#1', waypoints: [], source: 'auto' }],
    }))
    expect(unpinned.diagrams[0].edgeRoutes).toEqual([])
  })

  it('keeps a label-only route (no waypoints, but a label position)', () => {
    const out = applyBatch(model(), batch({
      placements: [place('crews'), place('reisinfo')],
      edgeRoutes: [{ connectionId: 'c#1', waypoints: [], labelPosition: { x: 7, y: 8 } }],
    }))

    expect(out.diagrams[0].edgeRoutes).toEqual([
      { connectionId: 'c#1', waypoints: [], labelPosition: { x: 7, y: 8 } },
    ])
  })

  it('keeps a sides-only route (an attach side IS content), and frees it on the plain marker', () => {
    const sidesOnly: EdgeRoute = { connectionId: 'c#1', waypoints: [], source: 'auto', sourceSide: 'top' }
    const out = applyBatch(model(), batch({ placements: [place('crews'), place('reisinfo')], edgeRoutes: [sidesOnly] }))
    expect(out.diagrams[0].edgeRoutes).toEqual([sidesOnly])

    const freed = applyBatch(out, batch({
      placements: [place('crews'), place('reisinfo')],
      edgeRoutes: [{ connectionId: 'c#1', waypoints: [] }],
    }))
    expect(freed.diagrams[0].edgeRoutes).toEqual([])
  })

  it('drops the routes of a deleted connection from every diagram', () => {
    const seeded = applyBatch(model(), batch({
      placements: [place('crews'), place('reisinfo')],
      edgeRoutes: [{ connectionId: 'c#1', waypoints: [{ x: 1, y: 1 }] }],
    }))
    // the route was stored on l7; delete the connection from the OTHER diagram
    const out = applyBatch(seeded, batch({ diagramId: 'cd', deletedConnectionIds: ['c#1'], placements: [place('crews')] }))

    expect(out.diagrams[0].edgeRoutes).toEqual([])
  })

  it('carries layoutConfig only when the batch has one', () => {
    const withConfig = applyBatch(model(), batch({
      layoutConfig: { domainGroups: [{ name: 'Kern', x: 0, y: 0, width: 200, height: 200 }] },
    }))
    expect(withConfig.diagrams[0].layoutConfig?.domainGroups?.[0].name).toBe('Kern')

    const untouched = applyBatch(withConfig, batch({}))
    expect(untouched.diagrams[0].layoutConfig?.domainGroups?.[0].name).toBe('Kern')
  })

  it('carries autoRoute only when the batch has one, false included', () => {
    const on = applyBatch(model(), batch({ autoRoute: true }))
    expect(on.diagrams[0].autoRoute).toBe(true)

    const untouched = applyBatch(on, batch({}))
    expect(untouched.diagrams[0].autoRoute).toBe(true)

    const off = applyBatch(on, batch({ autoRoute: false }))
    expect(off.diagrams[0].autoRoute).toBe(false)
  })

  it('never mutates the model it was given', () => {
    const before = model()
    const snapshot = JSON.parse(JSON.stringify(before))

    applyBatch(before, batch({
      elements: [element('werkplek', 'Werkplek')],
      deletedElementIds: ['reisinfo'],
      placements: [place('crews', 99, 99)],
      edgeRoutes: [{ connectionId: 'c#1', waypoints: [{ x: 1, y: 1 }] }],
    }))

    expect(before).toEqual(snapshot)
  })

  it('keeps the host extras a model carries', () => {
    const out = applyBatch(model({
      formatVersion: '1', description: 'Toelichting',
      explicitFields: { crews: { lifecycle: true, isManaged: true } },
    }), batch({ elements: [element('werkplek', 'Werkplek')] }))

    expect(out.formatVersion).toBe('1')
    expect(out.description).toBe('Toelichting')
    expect(out.explicitFields?.crews).toEqual({ lifecycle: true, isManaged: true })
  })
})

describe('isWorkingFile / isInterchange', () => {
  it('recognises a working file by its type tag and version', () => {
    expect(isWorkingFile({ type: WORKING_FILE_TYPE, version: 1, model: model() })).toBe(true)
    expect(isWorkingFile({ type: 'something-else' })).toBe(false)
    expect(isWorkingFile({})).toBe(false)
    expect(isWorkingFile(null)).toBe(false)
    // The tag alone is not a file: a bare string carries no model to read.
    expect(isWorkingFile(WORKING_FILE_TYPE)).toBe(false)
  })

  it('refuses a version it cannot read, rather than reading half of it', () => {
    // This shell always writes a version, so an unknown one is a file from a
    // LATER tool and not an older one. Half-reading it would silently drop
    // whatever that version added.
    expect(isWorkingFile({ type: WORKING_FILE_TYPE, version: 3, model: model() })).toBe(false)
    expect(isWorkingFile({ type: WORKING_FILE_TYPE, model: model() })).toBe(false)
    // Both versions this shell has written still open: v1 simply has no decisions.
    expect(isWorkingFile({ type: WORKING_FILE_TYPE, version: 1, model: model() })).toBe(true)
    expect(isWorkingFile({ type: WORKING_FILE_TYPE, version: 2, model: model() })).toBe(true)
  })

  it('refuses a file written by the tool this one replaces', () => {
    // Deliberate, and pinned here so it reads as a decision rather than as an
    // oversight: the working file was redefined rather than extended, and the
    // files the old shell wrote are not opened. Nobody had one worth keeping —
    // and paying for compatibility on every later change would have cost more
    // than the break did.
    expect(isWorkingFile({ type: 'solution-design-werkbestand', version: 1, model: model() })).toBe(false)
    expect(isWorkingFile({ type: 'solution-design-werkbestand', version: 2, model: model() })).toBe(false)
  })

  it('refuses a tag it does not know at all', () => {
    expect(isWorkingFile({ type: 'some-other-tool', version: 1, model: model() })).toBe(false)
  })

  it('recognises an interchange document by formatVersion + elements', () => {
    expect(isInterchange({ formatVersion: '1', elements: [] })).toBe(true)
    expect(isInterchange({ formatVersion: '1' })).toBe(false)
    expect(isInterchange({ elements: [] })).toBe(false)
    expect(isInterchange(null)).toBe(false)
  })

  it('does not mistake one for the other', () => {
    const workingFile = { type: WORKING_FILE_TYPE, version: 1, model: model() }
    expect(isInterchange(workingFile)).toBe(false)
    expect(isWorkingFile({ formatVersion: '1', elements: [] })).toBe(false)
  })
})

/**
 * The logo library inside a working file.
 *
 * Optional rather than required: a file written before anyone uploaded a mark
 * has no library at all, and an element whose `iconKey` points at a mark that is
 * not there falls back to its kind glyph — the package's own degradation rule,
 * not a special case invented here.
 */
describe('working file logo library', () => {
  const base = { type: WORKING_FILE_TYPE, version: WORKING_FILE_VERSION, model: model() } as const
  const library = [{ key: 'lib:own-mark', label: 'Own mark', url: 'data:image/png;base64,AAA' }]

  it('saves in the newest version this shell knows', () => {
    expect(WORKING_FILE_VERSION).toBe(2)
  })

  it('reads the library out of a file that carries one', () => {
    expect(workingFileLogoLibrary({ ...base, logoLibrary: library })).toEqual(library)
  })

  it('gives a file without one an empty library instead of undefined', () => {
    expect(workingFileLogoLibrary(base)).toEqual([])
  })

  it('tolerates a file whose library field is junk', () => {
    // Hand-edited files exist. An empty library loses the marks; a crash loses
    // the whole diagram.
    const junk = { ...base, logoLibrary: 'nope' as unknown as [] }
    expect(workingFileLogoLibrary(junk)).toEqual([])
  })
})

describe('renameDiagram', () => {
  it('renames exactly the one diagram, trimmed', () => {
    const out = renameDiagram(model(), 'l7', '  Landschap 2027  ')
    expect(out.diagrams.map((d) => d.name)).toEqual(['Landschap 2027', 'Crews · containers'])
  })

  it('leaves the model untouched for an empty or unchanged name', () => {
    const m = model()
    expect(renameDiagram(m, 'l7', '   ')).toBe(m)
    expect(renameDiagram(m, 'l7', 'Landschap').diagrams[0]).toBe(m.diagrams[0])
  })
})

describe('applyDiagramSettings', () => {
  const settings = (over: Partial<DiagramSettings> = {}): DiagramSettings =>
    ({ name: 'Landschap', ...over })
  const l7 = (m: HostModel) => m.diagrams[0]

  it('renames and sets the title-block fields', () => {
    const out = applyDiagramSettings(model(), 'l7', settings({
      name: '  Landschap 2027  ',
      author: 'W. Simons',
      client: 'Acme Rail',
      documentDate: '2026-09-05',
    }))
    expect(l7(out)).toMatchObject({
      name: 'Landschap 2027',
      author: 'W. Simons',
      client: 'Acme Rail',
      documentDate: '2026-09-05',
    })
  })

  /**
   * The settings are the whole answer. Somebody who cleared the author field
   * meant the export to stop naming one — keeping the old value because the
   * field arrived undefined would make the field impossible to empty.
   */
  it('clears a field the settings do not carry, key and all', () => {
    const before = applyDiagramSettings(model(), 'l7', settings({ author: 'W. Simons' }))
    const after = applyDiagramSettings(before, 'l7', settings())
    expect('author' in l7(after)).toBe(false)
    expect(JSON.parse(JSON.stringify(l7(after)))).not.toHaveProperty('author')
  })

  it('keeps an empty column set, which is not the same as no column set', () => {
    const out = applyDiagramSettings(model(), 'l7', settings({ aspectConfig: [] }))
    expect(l7(out).aspectConfig).toEqual([])
  })

  it('stores a hidden aspect row alongside the columns it keeps', () => {
    const config = [{ key: 'dr', label: 'Continuity' }]
    const out = applyDiagramSettings(model(), 'l7', settings({
      aspectConfig: config, showAspects: false,
    }))
    expect(l7(out)).toMatchObject({ aspectConfig: config, showAspects: false })
  })

  it('touches nobody else', () => {
    const m = model()
    const out = applyDiagramSettings(m, 'l7', settings({ author: 'W. Simons' }))
    expect(out.diagrams[1]).toBe(m.diagrams[1])
  })

  it('refuses a nameless diagram', () => {
    const m = model()
    expect(applyDiagramSettings(m, 'l7', settings({ name: '  ' }))).toBe(m)
  })
})

describe('duplicateDiagram', () => {
  it('lets the shell decide the copy name, so it follows the UI language', () => {
    // The name ends up in the model and on the tab; "(copy)" should therefore
    // come from the string table and not from this file. Without a translator it
    // stays
    // Nederlands dat er altijd stond.
    const out = duplicateDiagram(model(), 'l7', 'l7-copy', (name) => `${name} (copy)`)
    expect(out.diagrams[1].name).toBe('Landschap (copy)')
  })

  it('inserts a deep copy with a new id and "(kopie)" right after the original', () => {
    const m = model()
    m.diagrams[0].edgeRoutes = [{ connectionId: 'c#1', waypoints: [{ x: 1, y: 2 }] }]
    m.diagrams[0].layoutConfig = { domainGroups: [{ name: 'Kern', x: 0, y: 0, width: 100, height: 100 }] }
    m.diagrams[0].aspectConfig = [{ key: 'cost', label: 'Kosten' }]
    m.diagrams[0].needsLayout = true

    const out = duplicateDiagram(m, 'l7', 'l7-copy')

    expect(out.diagrams.map((d) => d.id)).toEqual(['l7', 'l7-copy', 'cd'])
    const copy = out.diagrams[1]
    expect(copy.name).toBe('Landschap (kopie)')
    expect(copy.kind).toBe('layer7')
    expect(copy.needsLayout).toBeUndefined()
    expect(copy.placements).toEqual(m.diagrams[0].placements)
    expect(copy.edgeRoutes).toEqual(m.diagrams[0].edgeRoutes)
    expect(copy.layoutConfig).toEqual(m.diagrams[0].layoutConfig)
    expect(copy.aspectConfig).toEqual(m.diagrams[0].aspectConfig)
    // Deep: mutating the copy's geometry must not reach the original.
    copy.placements[0].x = 999
    copy.layoutConfig!.domainGroups![0].name = 'Anders'
    expect(m.diagrams[0].placements[0].x).toBe(10)
    expect(m.diagrams[0].layoutConfig!.domainGroups![0].name).toBe('Kern')
    // The original itself is untouched.
    expect(out.diagrams[0]).toBe(m.diagrams[0])
  })

  it('is a no-op for an unknown id', () => {
    const m = model()
    expect(duplicateDiagram(m, 'nope', 'x')).toBe(m)
  })
})

describe('deleteDiagram', () => {
  it('removes the diagram and leaves the rest in order', () => {
    const m = duplicateDiagram(model(), 'l7', 'l7-2')
    const out = deleteDiagram(m, 'l7')
    expect(out.diagrams.map((d) => d.id)).toEqual(['l7-2', 'cd'])
  })

  it('refuses to remove the last landscape, and ignores an unknown id', () => {
    const m = model()
    expect(deleteDiagram(m, 'l7')).toBe(m)
    expect(deleteDiagram(m, 'nope')).toBe(m)
  })

  it('removes a container diagram regardless', () => {
    expect(deleteDiagram(model(), 'cd').diagrams.map((d) => d.id)).toEqual(['l7'])
  })
})

/**
 * A container diagram belongs to one application. If that application leaves the
 * model, what remains otherwise is a tab named after something that no longer
 * exists.
 */
describe('applyBatch — verweesde containeraanzichten', () => {
  /** A model in which the container diagram does point at its application. */
  function withContainer(applicationElementId = 'crews'): HostModel {
    const m = model()
    return {
      ...m,
      diagrams: m.diagrams.map((d) => d.id === 'cd' ? { ...d, applicationElementId } : d),
    }
  }

  it('removes the diagram of an application that leaves the model', () => {
    const next = applyBatch(withContainer(), batch({ deletedElementIds: ['crews'] }))
    expect(next.diagrams.map((d) => d.id)).toEqual(['l7'])
  })

  it('leaves another application\'s diagram alone', () => {
    const next = applyBatch(withContainer('reisinfo'), batch({ deletedElementIds: ['crews'] }))
    expect(next.diagrams.map((d) => d.id)).toEqual(['l7', 'cd'])
  })

  it('touches nothing on a batch that deletes nothing', () => {
    const before = withContainer()
    expect(applyBatch(before, batch()).diagrams.map((d) => d.id)).toEqual(['l7', 'cd'])
  })

  it('does NOT quietly tidy away a diagram with an unknown application', () => {
    // A reference to an element that never existed is a fault you have to be
    // kunnen zien; hem opruimen bij de eerste de beste wijziging verbergt hem.
    const next = applyBatch(withContainer('does-not-exist'), batch({ deletedElementIds: ['crews'] }))
    expect(next.diagrams.map((d) => d.id)).toEqual(['l7', 'cd'])
  })

  it('an application that returns in the same batch keeps its diagram', () => {
    // Delete-and-re-add amounts to "still exists": the diagram still has an
    // application to be about.
    const next = applyBatch(withContainer(), batch({
      deletedElementIds: [],
      elements: [element('crews', 'Crews')],
    }))
    expect(next.diagrams.map((d) => d.id)).toEqual(['l7', 'cd'])
  })
})

describe('resolveActiveDiagramId', () => {
  it('keeps the current diagram when it still exists', () => {
    expect(resolveActiveDiagramId(model(), 'cd')).toBe('cd')
  })

  it('falls back to the first diagram when the current one is gone', () => {
    expect(resolveActiveDiagramId(model(), 'weg')).toBe('l7')
  })

  it('geeft de gevraagde id terug als er niets over is', () => {
    expect(resolveActiveDiagramId(model({ diagrams: [] }), 'weg')).toBe('weg')
  })
})

describe('removedDiagrams', () => {
  it('noemt de aanzichten die verdwenen', () => {
    const before = model()
    const after = { ...before, diagrams: before.diagrams.filter((d) => d.id !== 'cd') }
    expect(removedDiagrams(before, after).map((d) => d.name)).toEqual(['Crews · containers'])
  })

  it('is leeg als er niets verdween', () => {
    expect(removedDiagrams(model(), model())).toEqual([])
  })

  it('does not count an added diagram', () => {
    const before = model()
    const after = {
      ...before,
      diagrams: [...before.diagrams, { id: 'l7b', kind: 'layer7' as const, name: 'Tweede', placements: [] }],
    }
    expect(removedDiagrams(before, after)).toEqual([])
  })
})

describe('needsRemount', () => {
  it('remount als de plaat opnieuw gelegd moet worden', () => {
    // The package's settle pass runs once per id per editor instance.
    expect(needsRemount(model(), model(), true)).toBe(true)
  })

  it('no remount for the same diagrams without a re-layout', () => {
    expect(needsRemount(model(), model(), false)).toBe(false)
  })

  it('remounts when a diagram is added or removed', () => {
    const before = model()
    const after = { ...before, diagrams: before.diagrams.filter((d) => d.id !== 'cd') }
    expect(needsRemount(before, after, false)).toBe(true)
    expect(needsRemount(after, before, false)).toBe(true)
  })

  it('remounts when the ids differ, even with the same number of diagrams', () => {
    const before = model()
    const after = {
      ...before,
      diagrams: before.diagrams.map((d) => ({ ...d, id: `${d.id}-nieuw` })),
    }
    expect(needsRemount(before, after, false)).toBe(true)
  })

  it('looks at the set and not at the order', () => {
    const before = model()
    const after = { ...before, diagrams: [...before.diagrams].reverse() }
    expect(needsRemount(before, after, false)).toBe(false)
  })
})
