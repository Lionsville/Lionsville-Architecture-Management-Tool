/**
 * The folder format. Two properties carry ADR-0003 and both are tested here
 * rather than through a store: a project survives the round trip exactly, and a
 * change to one thing changes one file.
 */
import { describe, expect, it } from 'vitest'
import { laidOut } from '../model/testFixtures';
import type { Adr } from '../decisions/adr'
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
import type { ScopePath } from './scopePath'

const REF: ScopePath = 'acme-logistics/landscape'

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
      laidOut({
        id: 'l7', kind: 'layer7', name: 'Landschap',
        groups: [{ id: 'kern', name: 'Kern' }],
        placements: [
          { id: 'crews', group: 'kern', x: 10, y: 20 },
          { id: 'reisinfo', x: 200, y: 20 },
        ],
        edgeRoutes: [{ relationId: 'c-1', waypoints: [{ x: 1, y: 2 }] }],
      }),
      laidOut({ id: 'containers', kind: 'container', name: 'Crews · containers', placements: [] }),
    ],
    decisions: [DECISION],
    transitions: [PLAN],
    explicitFields: { crews: { lifecycle: true } },
    ...(over.model ?? {}),
  }
  return {
    path: REF,
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
      'diagrams/containers.geometry.json',
      'diagrams/containers.json',
      'diagrams/l7.geometry.json',
      'diagrams/l7.json',
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

  it('keeps coordinates out of the definition and everything but numbers out of the geometry', () => {
    const files = projectFiles(project())
    expect(textOf(files, 'diagrams/l7.json')).not.toContain('"x"')
    const geometry = textOf(files, 'diagrams/l7.geometry.json')
    expect(geometry).not.toContain('Landschap')
    // A group's name and a member's band are the view's business, not the
    // geometry's — which is the whole of ADR-0012 §6.
    expect(geometry).not.toContain('Kern')
    expect(geometry).not.toContain('"zone"')
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

  it('writes an empty geometry file rather than none, so a missing one means something', () => {
    expect(textOf(projectFiles(project()), 'diagrams/containers.geometry.json'))
      .toBe('{\n  "nodes": []\n}\n')
  })
})

/**
 * What the model says, the file says (ADR-0012 §5 and §4).
 *
 * Both of these were refusals until format 4: the model could say more than the
 * file could hold, and a save that wrote a `supports` row into a list called
 * `connections` — or a capability as the `application` its figure fell back
 * to — would have handed an older build a row that was a lie. The list is
 * called `relations` now and carries the type on every row, so there is nothing
 * left to refuse.
 */
describe('the model\'s own vocabulary, written', () => {
  const wider = (): ProjectSnapshot => {
    const held = project()
    const model: HostModel = {
      ...held.model,
      // In id order, because that is the order the file writes them back in
      // and this fixture is compared against a round trip of itself.
      elements: [
        element('carrier', 'Carrier', { outside: true, partyId: 'partner' }),
        ...held.model.elements.filter((held) => held.id === 'crews'),
        element('fulfilment', 'Fulfilment', { kind: 'function', order: 2 }),
        element('partner', 'Marketplace partner', { kind: 'actor', outside: true }),
        ...held.model.elements.filter((held) => held.id === 'reisinfo'),
        element('ship', 'Ship a consignment', { kind: 'step', parentId: 'fulfilment', lane: 'partner' }),
      ],
      relations: [
        ...held.model.relations,
        { id: 'r-1', type: 'supports', sourceId: 'crews', targetId: 'fulfilment', validFrom: '2027-03-01' },
      ],
    }
    return { ...held, model }
  }

  it('writes every relation with the type it has, under the name the model uses', () => {
    expect(JSON.parse(textOf(projectFiles(wider()), MODEL_FILE)).relations).toEqual([
      { id: 'c-1', type: 'flow', sourceId: 'crews', targetId: 'reisinfo', isBidirectional: false },
      { id: 'r-1', type: 'supports', sourceId: 'crews', targetId: 'fulfilment', validFrom: '2027-03-01' },
    ])
  })

  it('writes a business kind as the kind it is, with its own fields', () => {
    const rows: Record<string, Record<string, unknown>> = Object.fromEntries(
      JSON.parse(textOf(projectFiles(wider()), MODEL_FILE)).elements
        .map((row: { id: string }) => [row.id, row]),
    )
    expect(rows.fulfilment).toMatchObject({ kind: 'function', order: 2 })
    expect(rows.ship).toMatchObject({ kind: 'step', parentId: 'fulfilment', lane: 'partner' })
    expect(rows.partner).toMatchObject({ kind: 'actor', outside: true })
    // Three facts that used to be one word: an application nobody here owns,
    // and whose it is (ADR-0012 §4).
    expect(rows.carrier).toMatchObject({ kind: 'application', outside: true, partyId: 'partner' })
  })

  it('gives the whole of it back, field for field', () => {
    expect(stableJson(projectFromFolder(projectFiles(wider()), REF))).toBe(stableJson(wider()))
  })

  it('carries a kind of view this build has not heard of', () => {
    // The format holds what the model's type allows and switches on no list of
    // its own: a view kind added tomorrow is written and read today.
    const held = project()
    held.model.diagrams = [
      { ...held.model.diagrams[0], kind: 'sheet' as never },
      held.model.diagrams[1],
    ]
    expect(projectFromFolder(projectFiles(held), REF)?.model.diagrams[0].kind).toBe('sheet')
  })
})

describe('what one change touches', () => {
  const before = projectFiles(project())

  it('moving a node: the geometry file, and nothing else', () => {
    const moved = project()
    const diagram = moved.model.diagrams[0]
    moved.model.diagrams[0] = {
      ...diagram,
      geometry: {
        ...diagram.geometry,
        nodes: diagram.geometry.nodes.map((node) => (node.id === 'crews' ? { ...node, x: 44 } : node)),
      },
    }
    expect(changed(before, projectFiles(moved))).toEqual(['diagrams/l7.geometry.json'])
  })

  it('renaming a dashed group: the definition, and not one coordinate', () => {
    // What format 3 could not do: the name was the key there, so a rename
    // rewrote every row that mentioned it. A member points at the id now.
    const renamed = project()
    const diagram = renamed.model.diagrams[0]
    renamed.model.diagrams[0] = { ...diagram, groups: [{ id: 'kern', name: 'Core' }] }
    expect(changed(before, projectFiles(renamed))).toEqual(['diagrams/l7.json'])
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
      path: REF,
      activeDiagramId: 'l7',
      logoLibrary: [],
      model: {
        name: 'Bare', customerName: 'Nobody', elements: [], relations: [],
        diagrams: [laidOut({ id: 'l7', kind: 'layer7', name: 'One', placements: [] })],
      },
    }
    expect(stableJson(projectFromFolder(projectFiles(plain), REF))).toBe(stableJson(plain))
  })

  /**
   * The one thing format 3 could not carry, now carried.
   *
   * A group's colour lived on its rectangle there, so a group with no box had
   * nowhere to put one and the fold said so out loud rather than dropping it
   * quietly. The colour is on the group's own row now, and the box is numbers.
   */
  it('keeps the colour of a group that has no box of its own', () => {
    const held = project()
    const diagram = held.model.diagrams[0]
    held.model.diagrams[0] = {
      ...diagram,
      groups: [{ id: 'kern', name: 'Kern', color: '#2f6fdb' }, { id: 'rand', name: 'Rand', color: '#aa0000' }],
    }
    expect(projectFromFolder(projectFiles(held), REF)?.model.diagrams[0].groups).toEqual([
      { id: 'kern', name: 'Kern', color: '#2f6fdb' },
      { id: 'rand', name: 'Rand', color: '#aa0000' },
    ])
  })

  it('takes the ref from where the folder is, not from anything inside it', () => {
    const elsewhere = 'globex/moved'
    expect(projectFromFolder(projectFiles(project()), elsewhere)?.path).toEqual(elsewhere)
  })

  it('treats a deleted geometry file as "lay it out again", with the view intact', () => {
    // The flip format 4 makes: membership is the definition's, so a view whose
    // coordinates are gone is laid out again from a list that is still whole
    // (ADR-0012 §6). At format 3 the same deletion emptied the board.
    const files = projectFiles(project())
      .filter((file) => file.path !== 'diagrams/l7.geometry.json')
    const back = projectFromFolder(files, REF)
    expect(back?.model.diagrams[0].geometry).toEqual({ nodes: [], needsLayout: true })
    expect(back?.model.diagrams[0].members.map((member) => member.id)).toEqual(['crews', 'reisinfo'])
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
      ? { path: PROJECT_FILE, text: stableJson({ type: 'lionsville-architecture', formatVersion: PROJECT_FORMAT_VERSION + 1, diagrams: ['l7'] }) }
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
      path: REF, name: 'Application landscape', groupName: 'Acme Logistics',
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
