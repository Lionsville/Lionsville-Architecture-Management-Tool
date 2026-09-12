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
import { scopeFiles } from './folderFormat'
import type { ScopeSnapshot } from './scope'
import { isZip, openDocumentBytes, workingFileBytes } from './workingFile'

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

describe('workingFileBytes', () => {
  it('is a zip', () => {
    expect(isZip(workingFileBytes(project()))).toBe(true)
    expect(isZip(bytesFromText('{"type":"lionsville-architecture"}'))).toBe(false)
  })

  it('is the same file twice — an export can be compared, and committed', () => {
    // Zip entries carry an mtime; `Date.now()` in it would make every export
    // of an unchanged project a different file.
    expect(workingFileBytes(project())).toEqual(workingFileBytes(project()))
  })

  it('carries the folder, so it can be unzipped and read without this tool', () => {
    const entries = unzipSync(workingFileBytes(project()))
    expect(Object.keys(entries).sort()).toEqual(scopeFiles(project()).map((f) => f.path))
    expect(JSON.parse(textFromBytes(entries['scope.json'])))
      .toMatchObject({ type: WORKING_FILE_TYPE, version: 5 })
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
    const entries = Object.keys(unzipSync(workingFileBytes(full)))
    expect(entries).toContain('decisions/0001-one-writer.md')
    expect(entries).toContain('transitions/0001-replace-the-warehouse-system.md')
    expect(entries).toContain('images/cutover.png')
    expect(entries).toContain('logos/own.png')
    const back = openDocumentBytes(workingFileBytes(full), project())
    expect(back.ok && back.scope.model.decisions?.[0]?.title).toBe('One writer')
    expect(back.ok && back.scope.model.transitions?.[0]?.title).toBe('Replace the warehouse system')
    expect(back.ok && back.scope.imageLibrary?.[0]?.file).toBe('cutover.png')
  })
})

describe('openDocumentBytes', () => {
  const into = project({ model: { ...project().model, name: 'The one that was open' } })

  it('opens what it wrote, with its marks', () => {
    const held = openDocumentBytes(workingFileBytes(project()), into)
    expect(held.ok).toBe(true)
    expect(held.ok && held.kind).toBe('workingFile')
    expect(held.ok && stableJson(held.scope)).toBe(stableJson(project()))
  })

  it('files what it opened where the open project is filed', () => {
    const elsewhere = { ...into, path: 'globex/theirs' }
    const held = openDocumentBytes(workingFileBytes(project()), elsewhere)
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

  it('opens a version-3 zip, and what comes out is format 4\'s shape', () => {
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

  it('still imports an interchange document, and lays it out again', () => {
    const doc = stableJson({
      formatVersion: 'solution-design/v1',
      design: { name: 'Imported' },
      elements: [{ key: 'crews', kind: 'application', name: 'Crews' }],
      diagrams: [{ key: 'l7', kind: 'layer7', name: 'Landschap', places: [{ elementKey: 'crews' }] }],
    })
    const held = openDocumentBytes(bytesFromText(doc), into)
    expect(held.ok && held.kind).toBe('interchange')
    expect(held.ok && held.relayout).toBe(true)
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
