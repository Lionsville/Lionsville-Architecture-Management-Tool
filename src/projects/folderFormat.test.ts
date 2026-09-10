/**
 * The folder format. Two properties carry ADR-0003 and both are tested here
 * rather than through a store: a project survives the round trip exactly, and a
 * change to one thing changes one file.
 */
import { describe, expect, it } from 'vitest'
import type { Adr } from '../decisions/adr'
import { ShellError } from '../platform/errors'
import type { DesignElement } from '../model'
import type { Transition } from '../model/transition'
import type { HostModel } from '../model/fromInterchange'
import { stableJson, textFromBytes } from './fileText'
import {
  groupFiles, groupFromFolder, isFormatPath, MODEL_FILE, PROJECT_FILE, PROJECT_FORMAT_VERSION, projectFiles,
  projectFromFolder, projectSummaryFrom,
} from './folderFormat'
import type { FolderFile } from './folderFormat'
import type { ProjectSnapshot } from './project'
import type { ProjectRef } from './projectRef'

const REF: ProjectRef = { group: 'acme-logistics', project: 'landscape' }

function element(id: string, name: string, over: Partial<DesignElement> = {}): DesignElement {
  return { id, kind: 'application', name, lifecycle: 'live', isManaged: true, aspects: {}, ...over }
}

const PLAN: Transition = {
  id: 'tr-1', number: 1, title: 'Replace the warehouse system', status: 'agreed',
  from: '2027-01-15', to: '2028-01-31', owner: 'Logistics IT',
  elements: [{ elementId: 'crews', role: 'retires' }],
  decisions: ['adr-1'],
  milestones: [{ date: '2027-04-01', name: 'Cutover begins' }],
  body: '## Goal\n\nOne system.',
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
    relations: [{ type: 'flow', id: 'c-1', sourceId: 'crews', targetId: 'reisinfo', isBidirectional: false }],
    diagrams: [
      {
        id: 'l7', kind: 'layer7', name: 'Landschap',
        groups: [{ id: 'kern', name: 'Kern' }],
        placements: [
          { elementId: 'crews', group: 'kern', x: 10, y: 20 },
          { elementId: 'reisinfo', x: 200, y: 20 },
        ],
        edgeRoutes: [{ relationId: 'c-1', waypoints: [{ x: 1, y: 2 }] }],
      },
      { id: 'containers', kind: 'container', name: 'Crews · containers', placements: [] },
    ],
    decisions: [DECISION],
    transitions: [PLAN],
    explicitFields: { crews: { lifecycle: true } },
    ...(over.model ?? {}),
  }
  return {
    ref: REF,
    activeDiagramId: 'l7',
    logoLibrary: [{ key: 'lib:own', label: 'Own', url: 'data:image/svg+xml;base64,PHN2Zy8+' }],
    imageLibrary: [{ file: 'cutover.png', url: 'data:image/png;base64,AQI=' }],
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
      'images/cutover.png',
      'logos/own.svg',
      'model.json',
      'project.json',
      'transitions/0001-replace-the-warehouse-system.md',
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

  it('writes a document picture as the file its markdown names, and nothing in the header', () => {
    const files = projectFiles(project())
    const image = files.find((file) => file.path === 'images/cutover.png')
    // Bytes, not base64 in a JSON string: the folder holds a real PNG.
    expect(image && 'bytes' in image && [...image.bytes]).toEqual([1, 2])
    // The file name IS the reference, so `project.json` has no list to drift.
    expect(textOf(files, PROJECT_FILE)).not.toContain('cutover')
  })

  it('writes an SVG picture as text, so it diffs as the XML it is', () => {
    const files = projectFiles(project({
      imageLibrary: [{ file: 'flow.svg', url: 'data:image/svg+xml;base64,PHN2Zy8+' }],
    }))
    expect(textOf(files, 'images/flow.svg')).toBe('<svg/>')
  })

  it('will not write a picture whose name is not one it can read back', () => {
    const files = projectFiles(project({
      imageLibrary: [
        { file: 'ok.png', url: 'data:image/png;base64,AQI=' },
        { file: 'nested/x.png', url: 'data:image/png;base64,AQI=' },
        { file: 'notes.md', url: 'data:image/png;base64,AQI=' },
        { file: 'ok.png', url: 'data:image/png;base64,AwQ=' },
      ],
    }))
    expect(paths(files).filter((path) => path.startsWith('images/'))).toEqual(['images/ok.png'])
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

/**
 * The model gained four relation types before the file gained a place for them
 * (ADR-0012 §5). A save that quietly wrote one into a list called `connections`
 * would hand every 1.x build a line it reads as an interface between two
 * applications, so the writer says no instead.
 */
describe('a relation format 3 has no place for', () => {
  it('refuses the save, with a key rather than a sentence', () => {
    const held = project()
    const model: HostModel = {
      ...held.model,
      relations: [...held.model.relations, { id: 'r-1', type: 'supports', sourceId: 'crews', targetId: 'reisinfo' }],
    }
    expect(() => projectFiles({ ...held, model })).toThrow(ShellError)
    try {
      projectFiles({ ...held, model })
    } catch (error) {
      expect((error as ShellError).key).toBe('relation.notInThisFormat')
    }
  })

  it('writes the flows it does have a place for exactly as it always did', () => {
    expect(JSON.parse(textOf(projectFiles(project()), MODEL_FILE)).connections)
      .toEqual([{ id: 'c-1', sourceId: 'crews', targetId: 'reisinfo', isBidirectional: false }])
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
        name: 'Bare', customerName: 'Nobody', elements: [], relations: [],
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

  it('files a plan as its own markdown file, and reads it back', () => {
    const files = projectFiles(project())
    expect(textOf(files, 'transitions/0001-replace-the-warehouse-system.md'))
      .toContain('# TR-0001 — Replace the warehouse system')
    expect(projectFromFolder(files, REF)?.model.transitions).toEqual([PLAN])
  })

  it('says nothing rather than nothing-at-all for a project with no plans', () => {
    const back = projectFromFolder(projectFiles(project({ model: { transitions: [] } as never })), REF)
    expect(back?.model && 'transitions' in back.model).toBe(false)
  })

  it('ignores a README in the transitions folder rather than reading it as a plan', () => {
    const files = [...projectFiles(project()), { path: 'transitions/README.md', text: 'Notes.\n' }]
    expect(projectFromFolder(files, REF)?.model.transitions).toHaveLength(1)
  })

  it('reads the pictures back off the folder, which is their whole index', () => {
    const back = projectFromFolder(projectFiles(project()), REF)
    expect(back?.imageLibrary).toEqual([{ file: 'cutover.png', url: 'data:image/png;base64,AQI=' }])
  })

  it('picks up a picture somebody dropped in by hand, and ignores what is not one', () => {
    const files = [
      ...projectFiles(project()),
      { path: 'images/whiteboard.jpg', bytes: new Uint8Array([3, 4]) },
      { path: 'images/notes.md', text: 'not a picture' },
      { path: 'images/nested/deep.png', bytes: new Uint8Array([5]) },
    ]
    expect(projectFromFolder(files, REF)?.imageLibrary).toEqual([
      { file: 'cutover.png', url: 'data:image/png;base64,AQI=' },
      { file: 'whiteboard.jpg', url: 'data:image/jpeg;base64,AwQ=' },
    ])
  })

  it('says nothing rather than nothing-at-all for a project with no pictures', () => {
    // Absent, not empty: there is no `images/` folder to write the difference
    // into, so a round trip must not invent one.
    const back = projectFromFolder(projectFiles(project({ imageLibrary: [] })), REF)
    expect(back && 'imageLibrary' in back).toBe(false)
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

/**
 * The shim that carries a dashed group's id across format 3 (ADR-0012 §6).
 *
 * The file has no field for an id: it files a group under its NAME, on the
 * rectangle and on every placement. So the ids are minted on read and folded
 * back on write, and the property that has to hold is that a folder which goes
 * through this build unchanged comes out as the bytes that went in — a 1.x
 * build still reads it, and a save is not a diff.
 *
 * All of this goes at format 4, where a group is written with its id.
 */
describe('dashed groups, across format 3', () => {
  const v3 = (): FolderFile[] => [
    {
      path: 'project.json',
      text: stableJson({
        type: 'lionsville-architecture', formatVersion: 3, name: 'L', groupName: 'G',
        activeDiagramId: 'l7', diagrams: ['l7'],
      }),
    },
    { path: 'model.json', text: stableJson({ connections: [], elements: [element('a', 'A'), element('b', 'B'), element('c', 'C')] }) },
    {
      path: 'diagrams/l7.json',
      text: stableJson({
        id: 'l7',
        kind: 'layer7',
        name: 'Landscape',
        layoutConfig: {
          canvas: { width: 1680, height: 1040 },
          domainGroups: [
            { name: 'Core systems', x: 10, y: 20, width: 300, height: 200, color: '#2f6fdb' },
            { name: 'Core Systems', x: 400, y: 20, width: 300, height: 200 },
          ],
        },
      }),
    },
    {
      path: 'diagrams/l7.placements.json',
      text: stableJson({
        placements: [
          { elementId: 'a', domainGroup: 'Core systems', x: 30, y: 40 },
          { elementId: 'b', domainGroup: 'Core Systems', x: 420, y: 40 },
          // A name no rectangle claims — format 3 allows it, and so does this.
          { elementId: 'c', domainGroup: 'Nobody drew a box', x: 800, y: 40 },
        ],
      }),
    },
  ]

  const diagramOf = (files: readonly FolderFile[]) =>
    projectFromFolder(files, REF)!.model.diagrams[0]

  it('mints an id per name, in the order the file has them, and files the members under it', () => {
    const diagram = diagramOf(v3())
    // Two names that slug alike are told apart by which came first, the way
    // `diagramStems` tells two diagram ids apart.
    expect(diagram.groups).toEqual([
      { id: 'core-systems', name: 'Core systems', color: '#2f6fdb' },
      { id: 'core-systems-2', name: 'Core Systems' },
      { id: 'nobody-drew-a-box', name: 'Nobody drew a box' },
    ])
    expect(diagram.layoutConfig?.domainGroups).toEqual([
      { id: 'core-systems', x: 10, y: 20, width: 300, height: 200 },
      { id: 'core-systems-2', x: 400, y: 20, width: 300, height: 200 },
    ])
    expect(diagram.placements.map((p) => p.group))
      .toEqual(['core-systems', 'core-systems-2', 'nobody-drew-a-box'])
  })

  it('reads, then writes, the bytes it started with', () => {
    const files = v3()
    const written = projectFiles(projectFromFolder(files, REF)!)
    for (const file of files) {
      expect(textOf(written, file.path)).toBe(textOf(files, file.path))
    }
  })

  it('writes no id and no groups list into a format-3 file', () => {
    const written = projectFiles(projectFromFolder(v3(), REF)!)
    expect(textOf(written, 'diagrams/l7.json')).not.toContain('"groups"')
    expect(textOf(written, 'diagrams/l7.placements.json')).not.toContain('"group"')
  })

  /**
   * The one thing the fold cannot carry, said out loud.
   *
   * Format 3 keeps a group's colour ON its rectangle, so a group that has a
   * colour and no box has nowhere to put it. Nothing in the app makes one —
   * the colour is picked from the box's own menu — and it goes at format 4,
   * where the group's record holds both.
   */
  it('cannot carry the colour of a group that has no box', () => {
    const project = projectFromFolder(v3(), REF)!
    const diagram = project.model.diagrams[0]
    project.model.diagrams[0] = {
      ...diagram,
      groups: diagram.groups!.map((g) =>
        (g.id === 'nobody-drew-a-box' ? { ...g, color: '#aa0000' } : g)),
    }
    const back = projectFromFolder(projectFiles(project), REF)!
    expect(back.model.diagrams[0].groups).toEqual(diagram.groups)
  })

  /**
   * A rename is one line in the MODEL, and format 3 is what still spreads it.
   *
   * The members point at the id, so nothing but the group's own row changes in
   * the document — which is the whole point of ADR-0012 §6. On disk, format 3
   * has only the name to file a member under, so the placements file follows;
   * the coordinates in it are untouched. That second line goes at format 4,
   * and this pins that it is the format's doing and not the model's.
   */
  it('renames a group in one row of the model, and only the name moves on disk', () => {
    const project = projectFromFolder(v3(), REF)!
    const before = projectFiles(project)
    const diagram = project.model.diagrams[0]
    project.model.diagrams[0] = {
      ...diagram,
      groups: diagram.groups!.map((g) => (g.id === 'core-systems' ? { ...g, name: 'Kern' } : g)),
    }
    expect(project.model.diagrams[0].placements).toBe(diagram.placements)
    const after = projectFiles(project)
    expect(changed(before, after)).toEqual(['diagrams/l7.json', 'diagrams/l7.placements.json'])
    // And what moved in the placements file is the name, nothing else.
    expect(textOf(after, 'diagrams/l7.placements.json'))
      .toBe(textOf(before, 'diagrams/l7.placements.json').replaceAll('Core systems"', 'Kern"'))
  })
})

describe('a group', () => {
  const profile = {
    group: 'acme-logistics',
    name: 'Acme Logistics',
    client: 'Acme Logistics BV',
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

describe('isFormatPath', () => {
  it('claims every file the format writes', () => {
    for (const file of projectFiles(project())) {
      expect(isFormatPath(file.path), file.path).toBe(true)
    }
    for (const file of groupFiles({ group: 'a', name: 'A', decisions: [DECISION] })) {
      expect(isFormatPath(file.path), file.path).toBe(true)
    }
  })

  it('claims none of what a user keeps beside their landscape', () => {
    // A save that tidied these away would be unforgivable.
    for (const path of [
      'README.md', 'notes.txt', '.git/config', 'decisions/README.md', 'logos/source.ai',
      'diagrams/old/l7.json', 'budget.xlsx', 'docs/pictures/one.png', '../escape.json',
      'images/source.psd', 'images/notes.md', 'images/nested/one.png',
      'transitions/README.md', 'transitions/notes.txt', 'transitions/old/0001-x.md',
    ]) {
      expect(isFormatPath(path), path).toBe(false)
    }
  })
})
