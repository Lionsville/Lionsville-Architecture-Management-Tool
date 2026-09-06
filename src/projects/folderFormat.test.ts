/**
 * The folder format. Two properties carry ADR-0003 and both are tested here
 * rather than through a store: a project survives the round trip exactly, and a
 * change to one thing changes one file.
 */
import { describe, expect, it } from 'vitest'
import type { Adr } from '../decisions/adr'
import type { DesignElement } from '../model'
import type { HostModel } from '../model/fromInterchange'
import { stableJson, textFromBytes } from './fileText'
import {
  groupFiles, groupFromFolder, MODEL_FILE, PROJECT_FILE, PROJECT_FORMAT_VERSION, projectFiles,
  projectFromFolder, projectSummaryFrom,
} from './folderFormat'
import type { FolderFile } from './folderFormat'
import type { ProjectSnapshot } from './project'
import type { ProjectRef } from './projectRef'

const REF: ProjectRef = { group: 'acme-logistics', project: 'landscape' }

function element(id: string, name: string, over: Partial<DesignElement> = {}): DesignElement {
  return { id, kind: 'application', name, lifecycle: 'live', isManaged: true, aspects: {}, parameters: {}, ...over }
}

const DECISION: Adr = {
  id: 'adr-1', number: 1, title: 'One writer', status: 'accepted', date: '2026-09-06',
  body: '## Context\n\nTwo roads.', signers: [{ name: 'Wouter Simons', verdict: 'approved' }],
}

function project(over: Partial<ProjectSnapshot> = {}): ProjectSnapshot {
  const model: HostModel = {
    name: 'Application landscape',
    customerName: 'Acme Logistics',
    description: 'The landscape as it stands.',
    defaultAuthor: 'W. Simons',
    elements: [
      element('crews', 'Crews', { description: 'Roster and duties.' }),
      element('reisinfo', 'Reisinformatie', { vendor: 'Acme' }),
    ],
    connections: [{ id: 'c-1', sourceId: 'crews', targetId: 'reisinfo', isBidirectional: false }],
    diagrams: [
      {
        id: 'l7', kind: 'layer7', name: 'Landschap',
        placements: [{ elementId: 'crews', x: 10, y: 20 }, { elementId: 'reisinfo', x: 200, y: 20 }],
        edgeRoutes: [{ connectionId: 'c-1', waypoints: [{ x: 1, y: 2 }] }],
      },
      { id: 'containers', kind: 'container', name: 'Crews · containers', placements: [] },
    ],
    decisions: [DECISION],
    explicitFields: { crews: { lifecycle: true } },
    ...(over.model ?? {}),
  }
  return {
    ref: REF,
    activeDiagramId: 'l7',
    logoLibrary: [{ key: 'lib:own', label: 'Own', url: 'data:image/svg+xml;base64,PHN2Zy8+' }],
    ...over,
    model,
  }
}

function paths(files: readonly FolderFile[]): string[] {
  return files.map((file) => file.path)
}

function textOf(files: readonly FolderFile[], path: string): string {
  const file = files.find((held) => held.path === path)
  if (!file) throw new Error(`no ${path} — the folder has ${paths(files).join(', ')}`)
  return 'text' in file ? file.text : textFromBytes(file.bytes)
}

/** Which paths differ between two writes. The diff, as git would see it. */
function changed(before: readonly FolderFile[], after: readonly FolderFile[]): string[] {
  const held = new Map(before.map((file) => [file.path, 'text' in file ? file.text : '']))
  const touched = after
    .filter((file) => held.get(file.path) !== ('text' in file ? file.text : ''))
    .map((file) => file.path)
  const gone = before.filter((file) => !after.some((one) => one.path === file.path)).map((f) => f.path)
  return [...touched, ...gone].sort()
}

describe('projectFiles', () => {
  it('writes one document per thing that changes independently', () => {
    expect(paths(projectFiles(project()))).toEqual([
      'decisions/0001-one-writer.md',
      'diagrams/containers.json',
      'diagrams/containers.placements.json',
      'diagrams/l7.json',
      'diagrams/l7.placements.json',
      'docs/crews.md',
      'logos/own.svg',
      'model.json',
      'project.json',
    ])
  })

  it('writes the same bytes twice for the same project', () => {
    expect(projectFiles(project())).toEqual(projectFiles(project()))
  })

  it('keeps coordinates out of the definition and everything else out of the placements', () => {
    const files = projectFiles(project())
    expect(textOf(files, 'diagrams/l7.json')).not.toContain('"x"')
    expect(textOf(files, 'diagrams/l7.placements.json')).not.toContain('Landschap')
  })

  it('files a description as prose, not as an escaped string in JSON', () => {
    const files = projectFiles(project())
    expect(textOf(files, 'docs/crews.md')).toBe('Roster and duties.\n')
    expect(textOf(files, MODEL_FILE)).not.toContain('Roster')
  })

  it('writes an uploaded mark as an image a person can open', () => {
    expect(textOf(projectFiles(project()), 'logos/own.svg')).toBe('<svg/>')
  })

  it('names the format and the tool, so a folder says what it is', () => {
    expect(JSON.parse(textOf(projectFiles(project()), PROJECT_FILE))).toMatchObject({
      type: 'lionsville-architecture',
      formatVersion: PROJECT_FORMAT_VERSION,
      groupName: 'Acme Logistics',
      diagrams: ['l7', 'containers'],
    })
  })

  it('sorts elements by id, so two people adding one do not both append', () => {
    const shuffled = project()
    shuffled.model.elements = [...shuffled.model.elements].reverse()
    expect(textOf(projectFiles(shuffled), MODEL_FILE))
      .toBe(textOf(projectFiles(project()), MODEL_FILE))
  })

  it('keeps a description inline when the element id cannot be a file name', () => {
    const odd = project()
    odd.model.elements = [element('a/b', 'Odd', { description: 'Nowhere to file this.' })]
    const files = projectFiles(odd)
    expect(paths(files)).not.toContain('docs/a/b.md')
    expect(textOf(files, MODEL_FILE)).toContain('Nowhere to file this.')
  })

  it('writes an empty placement file rather than none, so a missing one means something', () => {
    expect(textOf(projectFiles(project()), 'diagrams/containers.placements.json'))
      .toBe('{\n  "placements": []\n}\n')
  })
})

describe('what one change touches', () => {
  const before = projectFiles(project())

  it('moving a node: the placement file, and nothing else', () => {
    const moved = project()
    moved.model.diagrams[0].placements[0] = { elementId: 'crews', x: 44, y: 20 }
    expect(changed(before, projectFiles(moved))).toEqual(['diagrams/l7.placements.json'])
  })

  it('editing a description: one markdown file', () => {
    const edited = project()
    edited.model.elements[0] = element('crews', 'Crews', { description: 'Rewritten.' })
    expect(changed(before, projectFiles(edited))).toEqual(['docs/crews.md'])
  })

  it('renaming a diagram: its definition, and not its coordinates', () => {
    const renamed = project()
    renamed.model.diagrams[0] = { ...renamed.model.diagrams[0], name: 'Landscape' }
    expect(changed(before, projectFiles(renamed))).toEqual(['diagrams/l7.json'])
  })

  it('accepting a decision: one markdown file', () => {
    const decided = project()
    decided.model.decisions = [{ ...DECISION, status: 'rejected' }]
    expect(changed(before, projectFiles(decided))).toEqual(['decisions/0001-one-writer.md'])
  })

  it('renaming the project: the header, and not the model', () => {
    const renamed = project()
    renamed.model.name = 'Landscape 2027'
    expect(changed(before, projectFiles(renamed))).toEqual([PROJECT_FILE])
  })
})

describe('projectFromFolder', () => {
  it('gives back the project it was handed, field for field', () => {
    const original = project()
    const back = projectFromFolder(projectFiles(original), REF)
    expect(stableJson(back)).toBe(stableJson(original))
  })

  it('reads a project with nothing optional in it', () => {
    const plain: ProjectSnapshot = {
      ref: REF,
      activeDiagramId: 'l7',
      logoLibrary: [],
      model: {
        name: 'Bare', customerName: 'Nobody', elements: [], connections: [],
        diagrams: [{ id: 'l7', kind: 'layer7', name: 'One', placements: [] }],
      },
    }
    expect(stableJson(projectFromFolder(projectFiles(plain), REF))).toBe(stableJson(plain))
  })

  it('takes the ref from where the folder is, not from anything inside it', () => {
    const elsewhere = { group: 'globex', project: 'moved' }
    expect(projectFromFolder(projectFiles(project()), elsewhere)?.ref).toEqual(elsewhere)
  })

  it('treats a deleted placement file as "lay it out again"', () => {
    const files = projectFiles(project())
      .filter((file) => file.path !== 'diagrams/l7.placements.json')
    const back = projectFromFolder(files, REF)
    expect(back?.model.diagrams[0]).toMatchObject({ placements: [], needsLayout: true })
    expect(back?.model.diagrams[0].name).toBe('Landschap')
  })

  it('keeps the tab order the header gives, not the order of the file names', () => {
    expect(projectFromFolder(projectFiles(project()), REF)?.model.diagrams.map((d) => d.id))
      .toEqual(['l7', 'containers'])
  })

  it('picks up a diagram somebody dropped in by hand, at the end', () => {
    const files = [...projectFiles(project()), {
      path: 'diagrams/extra.json',
      text: stableJson({ id: 'extra', kind: 'layer7', name: 'By hand' }),
    }]
    expect(projectFromFolder(files, REF)?.model.diagrams.map((d) => d.id))
      .toEqual(['l7', 'containers', 'extra'])
  })

  it('picks up a mark somebody dropped in by hand', () => {
    const files = [...projectFiles(project()), { path: 'logos/Extra.png', bytes: new Uint8Array([1, 2]) }]
    expect(projectFromFolder(files, REF)?.logoLibrary).toContainEqual({
      key: 'lib:extra', label: 'Extra', url: 'data:image/png;base64,AQI=',
    })
  })

  it('ignores a README in the decisions folder rather than reading it as a record', () => {
    const files = [...projectFiles(project()), { path: 'decisions/README.md', text: 'Notes.\n' }]
    expect(projectFromFolder(files, REF)?.model.decisions).toHaveLength(1)
  })

  it('refuses a folder written by a newer version of this tool', () => {
    // Half-reading it would drop whatever the new version added, on the next save.
    const files = projectFiles(project()).map((file) => file.path === PROJECT_FILE
      ? { path: PROJECT_FILE, text: stableJson({ type: 'lionsville-architecture', formatVersion: 4, diagrams: ['l7'] }) }
      : file)
    expect(projectFromFolder(files, REF)).toBeUndefined()
  })

  it('refuses a folder that is not a project at all', () => {
    expect(projectFromFolder([{ path: 'notes.txt', text: 'hello' }], REF)).toBeUndefined()
    expect(projectFromFolder([], REF)).toBeUndefined()
  })

  it('refuses a project with no diagrams: there is nothing to show', () => {
    const empty = project()
    empty.model.diagrams = []
    expect(projectFromFolder(projectFiles(empty), REF)).toBeUndefined()
  })

  it('falls back to the first diagram when the header names one that is gone', () => {
    const files = projectFiles(project({ activeDiagramId: 'deleted' }))
    expect(projectFromFolder(files, REF)?.activeDiagramId).toBe('l7')
  })
})

describe('projectSummaryFrom', () => {
  it('answers the picker from the header alone', () => {
    const header = textOf(projectFiles(project()), PROJECT_FILE)
    expect(projectSummaryFrom(header, REF, '2026-09-06T10:00:00.000Z')).toEqual({
      ref: REF, name: 'Application landscape', groupName: 'Acme Logistics',
      updatedAt: '2026-09-06T10:00:00.000Z',
    })
  })

  it('does not list a folder with no diagrams, or one that is not a project', () => {
    const empty = project()
    empty.model.diagrams = []
    expect(projectSummaryFrom(textOf(projectFiles(empty), PROJECT_FILE), REF)).toBeUndefined()
    expect(projectSummaryFrom('{}', REF)).toBeUndefined()
    expect(projectSummaryFrom('half a fi', REF)).toBeUndefined()
  })
})

describe('a group', () => {
  const profile = {
    group: 'acme-logistics',
    name: 'Acme Logistics',
    description: 'The one with the warehouses.',
    links: [{ label: 'Wiki', url: 'https://wiki.test/acme' }],
    decisions: [{ ...DECISION, id: 'g-1', title: 'One tenant per group' }],
  }

  it('is a small record beside its projects, plus its own decisions', () => {
    expect(paths(groupFiles(profile)))
      .toEqual(['decisions/0001-one-tenant-per-group.md', 'group.json'])
  })

  it('round-trips', () => {
    expect(groupFromFolder(groupFiles(profile), 'acme-logistics')).toEqual(profile)
  })

  it('does not write its path into the file: a group is where its folder is', () => {
    expect(textOf(groupFiles(profile), 'group.json')).not.toContain('acme-logistics')
    expect(groupFromFolder(groupFiles(profile), 'moved')?.group).toBe('moved')
  })

  it('answers nothing for a group folder with no record in it', () => {
    // A group with projects and no group.json is still a group; it is derived.
    expect(groupFromFolder([{ path: 'landscape/project.json', text: '{}' }], 'acme')).toBeUndefined()
  })

  it('drops a link that is not one rather than handing it to a renderer', () => {
    const files = [{ path: 'group.json', text: stableJson({ name: 'A', links: ['https://x.test', { url: 'y' }] }) }]
    expect(groupFromFolder(files, 'a')?.links).toEqual([])
  })
})
