/**
 * The container: a project as one file, and every file this tool will open.
 *
 * The interesting cases are not the happy one. They are the file somebody
 * zipped themselves, the file from an older version, the file from another
 * tool, and the file that is none of those.
 */
import { describe, expect, it } from 'vitest'
import { unzipSync, zipSync } from 'fflate'
import { WORKING_FILE_TYPE } from '../model/hostModel'
import { bytesFromText, stableJson, textFromBytes } from './fileText'
import { projectFiles } from './folderFormat'
import type { ProjectSnapshot } from './project'
import { isZip, openDocumentBytes, workingFileBytes } from './workingFile'

function project(over: Partial<ProjectSnapshot> = {}): ProjectSnapshot {
  return {
    ref: { group: 'acme-logistics', project: 'landscape' },
    activeDiagramId: 'l7',
    logoLibrary: [{ key: 'lib:own', label: 'Own', url: 'data:image/png;base64,AQID' }],
    model: {
      name: 'Application landscape',
      customerName: 'Acme Logistics',
      elements: [{
        id: 'crews', kind: 'application', name: 'Crews', description: 'Roster.',
        lifecycle: 'live', isManaged: true, aspects: {}, parameters: {},
      }],
      connections: [],
      diagrams: [{ id: 'l7', kind: 'layer7', name: 'Landschap', placements: [{ elementId: 'crews', x: 4, y: 8 }] }],
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
    expect(Object.keys(entries).sort()).toEqual(projectFiles(project()).map((f) => f.path))
    expect(JSON.parse(textFromBytes(entries['project.json'])))
      .toMatchObject({ type: WORKING_FILE_TYPE, formatVersion: 3 })
    expect(textFromBytes(entries['docs/crews.md'])).toBe('Roster.\n')
  })
})

describe('openDocumentBytes', () => {
  const into = project({ model: { ...project().model, name: 'The one that was open' } })

  it('opens what it wrote, with its marks', () => {
    const held = openDocumentBytes(workingFileBytes(project()), into)
    expect(held.ok).toBe(true)
    expect(held.ok && held.kind).toBe('workingFile')
    expect(held.ok && stableJson(held.project)).toBe(stableJson(project()))
  })

  it('files what it opened where the open project is filed', () => {
    const elsewhere = { ...into, ref: { group: 'globex', project: 'theirs' } }
    const held = openDocumentBytes(workingFileBytes(project()), elsewhere)
    expect(held.ok && held.project.ref).toEqual({ group: 'globex', project: 'theirs' })
  })

  it('opens a zip somebody made themselves, folder and all', () => {
    // "Right click, compress" puts the folder itself at the top of the zip.
    const entries: Record<string, Uint8Array> = {}
    for (const file of projectFiles(project())) {
      entries[`landscape/${file.path}`] = 'text' in file ? bytesFromText(file.text) : file.bytes
    }
    const held = openDocumentBytes(zipSync(entries), into)
    expect(held.ok && held.project.model.name).toBe('Application landscape')
  })

  it('still opens a version-2 document, which is not a zip at all', () => {
    const v2 = stableJson({
      type: WORKING_FILE_TYPE, version: 2, model: project().model, activeDiagramId: 'l7',
    })
    const held = openDocumentBytes(bytesFromText(v2), into)
    expect(held.ok && held.kind).toBe('workingFile')
    expect(held.ok && held.project.model.name).toBe('Application landscape')
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
