/**
 * The container: a project as one file, and every file this tool will open.
 *
 * The interesting cases are not the happy one. They are the file somebody
 * zipped themselves, the file from an older version, the file from another
 * tool, and the file that is none of those.
 */
import { describe, expect, it } from 'vitest'
import { laidOut } from '../model/testFixtures';
import { unzipSync, zipSync } from 'fflate'
import { WORKING_FILE_TYPE } from '../model/hostModel'
import { bytesFromText, stableJson, textFromBytes } from './fileText'
import { SCOPE_FORMAT_VERSION, scopeFiles } from './folderFormat'
import type { ScopeSnapshot } from './scope'
import { isZip, openDocumentBytes, workingFileBytes, workingFileName } from './workingFile'

function project(over: Partial<ScopeSnapshot> = {}): ScopeSnapshot {
  return {
    path: 'acme-logistics/landscape',
    activeDiagramId: 'l7',
    logoLibrary: [{ key: 'lib:own', label: 'Own', url: 'data:image/png;base64,AQID' }],
    model: {
      name: 'Application landscape',
      elements: [{
        id: 'crews', kind: 'application', name: 'Crews', description: 'Roster.',
        lifecycle: 'live', isManaged: true, aspects: {},
      }],
      relations: [],
      diagrams: [laidOut({ id: 'l7', kind: 'layer7', name: 'Landschap', placements: [{ id: 'crews', x: 4, y: 8 }] })],
    },
    ...over,
  }
}

/** A scope filed under {@link project}, for the tree cases. */
function under(path: string, name: string): ScopeSnapshot {
  return {
    path, activeDiagramId: 'l7', logoLibrary: [],
    model: {
      name,
      elements: [{ id: `${name}-thing`, kind: 'application', name, lifecycle: 'live', isManaged: true, aspects: {} }],
      relations: [],
      diagrams: [laidOut({ id: 'l7', kind: 'layer7', name, placements: [{ id: `${name}-thing`, x: 0, y: 0 }] })],
    },
  }
}

/**
 * The whole working set, the way the store hands it over: the organisation at
 * the root, and two scopes filed under it.
 */
const tree = (): ScopeSnapshot[] => [
  { ...project(), path: '' },
  under('retail', 'Retail'),
  under('retail/warehouse', 'Warehouse'),
]

describe('workingFileName', () => {
  it('is the name of the scope at the top, and never the path it was filed at', () => {
    // The path named the file until ADR-0018, and the organisation's path is
    // the empty string — so exporting from the top wrote a file called
    // `.lvarch`: hidden, nameless, and gone the moment macOS's save panel
    // wrote it. A name is a thing every scope has.
    expect(workingFileName({ ...project(), path: '' })).toBe('application-landscape.lvarch')
    expect(workingFileName(project())).toBe('application-landscape.lvarch')
  })

  it.each([
    ['a name with punctuation in it', 'Acme Logistics B.V.', 'acme-logistics-b-v.lvarch'],
    ['a name with accents that decompose', 'Café Zuid', 'cafe-zuid.lvarch'],
    ['a letter that is not an accented one', 'Sørlandet', 's-rlandet.lvarch'],
    ['a name that slugs to nothing', '???', 'element.lvarch'],
  ])('%s', (_what, name, expected) => {
    const held = project()
    expect(workingFileName({ ...held, model: { ...held.model, name } })).toBe(expected)
  })
})

describe('workingFileBytes', () => {
  it('is a zip', () => {
    expect(isZip(workingFileBytes([project()]))).toBe(true)
    expect(isZip(bytesFromText('{"type":"lionsville-architecture"}'))).toBe(false)
  })

  it('is the same file twice — an export can be compared, and committed', () => {
    // Zip entries carry an mtime; `Date.now()` in it would make every export
    // of an unchanged project a different file.
    expect(workingFileBytes([project()])).toEqual(workingFileBytes([project()]))
  })

  it('carries the folder, so it can be unzipped and read without this tool', () => {
    const entries = unzipSync(workingFileBytes([project()]))
    expect(Object.keys(entries).sort()).toEqual(scopeFiles(project()).map((f) => f.path))
    expect(JSON.parse(textFromBytes(entries['scope.json'])))
      .toMatchObject({ type: WORKING_FILE_TYPE, version: SCOPE_FORMAT_VERSION })
    expect(textFromBytes(entries['docs/crews.md'])).toBe('Roster.\n')
  })

  it('carries every record the folder holds: decisions, plans, pictures and marks', () => {
    const full = project({
      imageLibrary: [{ file: 'cutover.png', url: 'data:image/png;base64,AQI=' }],
      model: {
        ...project().model,
        decisions: [{
          id: 'adr-1', number: 1, title: 'One writer', status: 'accepted', date: '2026-09-01',
          signers: [], body: 'Because.',
        }],
        transitions: [{
          id: 'tr-1', number: 1, title: 'Replace the warehouse system', status: 'draft',
          elements: [], decisions: [], milestones: [], body: '',
        }],
      },
    })
    const entries = Object.keys(unzipSync(workingFileBytes([full])))
    expect(entries).toContain('decisions/0001-one-writer.md')
    expect(entries).toContain('transitions/0001-replace-the-warehouse-system.md')
    expect(entries).toContain('images/cutover.png')
    expect(entries).toContain('logos/own.png')
    const back = openDocumentBytes(workingFileBytes([full]), project())
    expect(back.ok && back.scope.model.decisions?.[0]?.title).toBe('One writer')
    expect(back.ok && back.scope.model.transitions?.[0]?.title).toBe('Replace the warehouse system')
    expect(back.ok && back.scope.imageLibrary?.[0]?.file).toBe('cutover.png')
  })
})

describe('workingFileBytes — the whole set', () => {
  it('files every scope where it sits under the one at the top', () => {
    const entries = Object.keys(unzipSync(workingFileBytes(tree()))).sort()
    // The root's own files have no prefix; the others carry their path.
    expect(entries).toContain('scope.json')
    expect(entries).toContain('retail/scope.json')
    expect(entries).toContain('retail/warehouse/scope.json')
    expect(entries).toContain('retail/warehouse/model.json')
  })

  it('addresses the scopes relative to the top one, not from the organisation', () => {
    // A file is something you hand to somebody else, and where the scope at its
    // top was filed in YOUR tree is none of their business — the same reason
    // `toWorkingFile` never wrote the path.
    const held = [project(), under('acme-logistics/landscape/eu', 'Europe')]
    const entries = Object.keys(unzipSync(workingFileBytes(held))).sort()
    expect(entries).toContain('scope.json')
    expect(entries).toContain('eu/scope.json')
    expect(entries.some((path) => path.startsWith('acme-logistics/'))).toBe(false)
  })

  it('is still one scope at the top of the zip when it is handed one scope', () => {
    // Every `.lvarch` written before format 6 looks like this, and one written
    // from a scope with nothing under it still does.
    const entries = Object.keys(unzipSync(workingFileBytes([project()])))
    expect(entries).toContain('scope.json')
    expect(entries.every((path) => !path.includes('/scope.json'))).toBe(true)
  })
})

describe('openDocumentBytes — the whole set', () => {
  const into = (): ScopeSnapshot => ({ ...project(), path: 'somewhere' })

  it('reads the tree back, filed under the scope it was opened into', () => {
    const held = openDocumentBytes(workingFileBytes(tree()), into())
    expect(held.ok).toBe(true)
    if (!held.ok) return
    expect(held.scope.path).toBe('somewhere')
    expect(held.rest?.map((scope) => scope.path))
      .toEqual(['somewhere/retail', 'somewhere/retail/warehouse'])
  })

  it('brings every scope back whole, not just its name', () => {
    const held = openDocumentBytes(workingFileBytes(tree()), into())
    if (!held.ok) throw new Error('did not open')
    const warehouse = held.rest?.find((scope) => scope.path.endsWith('warehouse'))
    expect(warehouse?.model.name).toBe('Warehouse')
    expect(warehouse?.model.diagrams).toHaveLength(1)
    expect(warehouse?.model.elements.map((element) => element.id)).toEqual(['Warehouse-thing'])
  })

  it('survives the round trip: what went in is what comes out', () => {
    const held = openDocumentBytes(workingFileBytes(tree()), { ...project(), path: '' })
    if (!held.ok) throw new Error('did not open')
    const back = [held.scope, ...(held.rest ?? [])]
    expect(back.map((scope) => scope.path)).toEqual(tree().map((scope) => scope.path))
    expect(workingFileBytes(back)).toEqual(workingFileBytes(tree()))
  })

  it('says nothing came with it when the file holds one scope', () => {
    // Absent rather than empty, so a caller that can only replace one scope
    // knows it is not quietly dropping anything.
    const held = openDocumentBytes(workingFileBytes([project()]), into())
    expect(held.ok && held.rest).toBeUndefined()
  })
})

describe('openDocumentBytes', () => {
  const into = project({ model: { ...project().model, name: 'The one that was open' } })

  it('opens what it wrote, with its marks', () => {
    const held = openDocumentBytes(workingFileBytes([project()]), into)
    expect(held.ok).toBe(true)
    expect(held.ok && held.kind).toBe('workingFile')
    expect(held.ok && stableJson(held.scope)).toBe(stableJson(project()))
  })

  it('files what it opened where the open project is filed', () => {
    const elsewhere = { ...into, path: 'globex/theirs' }
    const held = openDocumentBytes(workingFileBytes([project()]), elsewhere)
    expect(held.ok && held.scope.path).toEqual('globex/theirs')
  })

  it('opens a zip somebody made themselves, folder and all', () => {
    // "Right click, compress" puts the folder itself at the top of the zip.
    const entries: Record<string, Uint8Array> = {}
    for (const file of scopeFiles(project())) {
      entries[`landscape/${file.path}`] = 'text' in file ? bytesFromText(file.text) : file.bytes
    }
    const held = openDocumentBytes(zipSync(entries), into)
    expect(held.ok && held.scope.model.name).toBe('Application landscape')
  })

  it('still opens a version-1 document, from before decisions existed', () => {
    const v1 = stableJson({ type: WORKING_FILE_TYPE, version: 1, model: project().model })
    const held = openDocumentBytes(bytesFromText(v1), into)
    expect(held.ok && held.kind).toBe('workingFile')
    expect(held.ok && held.scope.model.elements).toHaveLength(1)
  })

  it('still opens a version-2 document, which is not a zip at all', () => {
    const v2 = stableJson({
      type: WORKING_FILE_TYPE, version: 2, model: project().model, activeDiagramId: 'l7',
    })
    const held = openDocumentBytes(bytesFromText(v2), into)
    expect(held.ok && held.kind).toBe('workingFile')
    expect(held.ok && held.scope.model.name).toBe('Application landscape')
  })

  /**
   * The versions that are the point of a version number.
   *
   * A v1 or v2 document was written when the model had one list of connections
   * and kept a view's membership in the same row as its coordinates, and a v3
   * zip is that folder one format ago. All three open, and all three land on
   * format 4 through the one fold (`migrate3to4.ts`).
   */
  it('opens a version-1 document written before ADR-0012, in the shape it was written', () => {
    const v1 = stableJson({
      type: WORKING_FILE_TYPE,
      version: 1,
      model: {
        name: 'Landscape',
        connections: [{ id: 'c-1', sourceId: 'portal', targetId: 'wms', isBidirectional: false }],
        elements: [
          { id: 'portal', kind: 'inputChannel', name: 'Portal' },
          { id: 'wms', kind: 'application', name: 'WMS' },
        ],
        diagrams: [{
          id: 'l7',
          kind: 'layer7',
          name: 'Landschap',
          placements: [{ elementId: 'portal', zone: 'inputChannels', x: 4, y: 8 }],
        }],
      },
    })
    const held = openDocumentBytes(bytesFromText(v1), into)
    expect(held.ok && held.kind).toBe('workingFile')
    if (!held.ok) return
    expect(held.scope.model.relations[0]).toMatchObject({ type: 'flow', id: 'c-1' })
    expect(held.scope.model.elements[0]).toMatchObject({ kind: 'application' })
    expect(held.scope.model.diagrams[0].members).toEqual([{ id: 'portal', zone: 'inputChannels' }])
    expect(held.scope.model.diagrams[0].geometry.nodes).toEqual([{ id: 'portal', x: 4, y: 8 }])
  })

  it('opens a version-3 zip, and what comes out is the model\'s own shape', () => {
    const entries: Record<string, Uint8Array> = {
      'project.json': bytesFromText(stableJson({
        type: WORKING_FILE_TYPE, formatVersion: 3, name: 'Landscape', groupName: 'Acme',
        activeDiagramId: 'l7', diagrams: ['l7'],
      })),
      'model.json': bytesFromText(stableJson({
        connections: [], elements: [{ id: 'carrier', kind: 'externalSystem', name: 'Carrier' }],
      })),
      'diagrams/l7.json': bytesFromText(stableJson({ id: 'l7', kind: 'layer7', name: 'Landschap' })),
      'diagrams/l7.placements.json': bytesFromText(stableJson({
        placements: [{ elementId: 'carrier', zone: 'externalSystems', x: 1, y: 2 }],
      })),
    }
    const held = openDocumentBytes(zipSync(entries), into)
    expect(held.ok && held.kind).toBe('workingFile')
    if (!held.ok) return
    expect(held.scope.model.elements[0]).toMatchObject({ kind: 'application', outside: true })
    expect(held.scope.model.diagrams[0].members).toEqual([{ id: 'carrier', zone: 'externalSystems' }])
  })

  it('opens a version-4 zip, whose header is the one scopes replaced', () => {
    const entries: Record<string, Uint8Array> = {
      'project.json': bytesFromText(stableJson({
        type: WORKING_FILE_TYPE, formatVersion: 4, name: 'Landscape', groupName: 'Acme',
        activeDiagramId: 'l7', diagrams: ['l7'],
      })),
      'model.json': bytesFromText(stableJson({
        relations: [],
        elements: [{ id: 'wms', kind: 'application', name: 'WMS', lifecycle: 'live', isManaged: true, aspects: {} }],
      })),
      'diagrams/l7.json': bytesFromText(stableJson({
        id: 'l7', kind: 'layer7', name: 'Landschap', members: [{ id: 'wms' }],
      })),
      'diagrams/l7.geometry.json': bytesFromText(stableJson({ nodes: [{ id: 'wms', x: 3, y: 4 }] })),
    }
    const held = openDocumentBytes(zipSync(entries), into)
    expect(held.ok && held.kind).toBe('workingFile')
    if (!held.ok) return
    expect(held.scope.model.name).toBe('Landscape')
    expect(held.scope.kind).toBe('landscape')
    expect(held.scope.model.diagrams[0].geometry.nodes).toEqual([{ id: 'wms', x: 3, y: 4 }])
    // The name of the folder above it, which this file has no folder above.
    expect('customerName' in held.scope.model).toBe(false)
  })


  it('refuses a zip that is not a project', () => {
    const held = openDocumentBytes(zipSync({ 'notes.txt': bytesFromText('hello') }), into)
    expect(held).toEqual({ ok: false, messageKey: 'shell.unknownFile' })
  })

  it('refuses something that is neither', () => {
    expect(openDocumentBytes(bytesFromText('hello'), into))
      .toEqual({ ok: false, messageKey: 'shell.unknownFile' })
    expect(openDocumentBytes(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 9, 9]), into))
      .toEqual({ ok: false, messageKey: 'shell.unknownFile' })
  })
})
