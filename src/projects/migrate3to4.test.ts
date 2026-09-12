/**
 * A folder written before the format turned, opened.
 *
 * The fixtures here are the ones that used to live in `folderFormat.test.ts`
 * under "across format 3", where they pinned that a fold could write back the
 * bytes it read. Nothing writes those bytes any more, so the same fixtures now
 * pin the other half of the promise the format rule makes: every older version
 * opens, and what it opens as is the model's own shape.
 *
 * One v3 tree, holding everything the fold has to carry — all three retired
 * kinds, a component inside an application, a dashed group with a colour and
 * one with no box at all, a manual route with a fixed side, a line with a
 * window, a decision per list and a plan — and then the properties: the shape
 * that comes out, the files that go, and a round trip that does not move.
 */
import { describe, expect, it } from 'vitest'
import type { Adr } from '../decisions/adr'
import type { HostModel } from '../model/fromInterchange'
import type { Transition } from '../model/transition'
import { adrFileText, adrPath } from './adrFile'
import { stableJson, textFromBytes } from './fileText'
import { isFormatPath, projectFiles, projectFromFolder } from './folderFormat'
import type { FolderFile } from './folderFormat'
import { foldFolderToFormat4, migrateModel, openProjectFolder } from './migrate3to4'
import { transitionFileText, transitionPath } from './transitionFile'
import type { ScopePath } from './scopePath'

const REF: ScopePath = 'acme-logistics/landscape'

const DECISION: Adr = {
  id: 'adr-1', number: 1, title: 'One writer', status: 'accepted', date: '2026-09-06',
  body: '## Context\n\nTwo roads.', signers: [{ name: 'W. Simons', verdict: 'approved' }],
}

const PER_APPLICATION: Adr = {
  ...DECISION, id: 'adr-2', title: 'The WMS keeps its own stock', applicationId: 'wms',
}

const PLAN: Transition = {
  id: 'tr-1', number: 1, title: 'Replace the warehouse system', status: 'agreed',
  from: '2027-01-15', to: '2028-01-31', owner: 'Logistics IT',
  elements: [{ elementId: 'wms', role: 'retires' }], decisions: ['adr-1'],
  milestones: [{ date: '2027-04-01', name: 'Cutover begins' }], body: '## Goal\n\nOne system.',
}

const v3 = (): FolderFile[] => [
  {
    path: 'project.json',
    text: stableJson({
      type: 'lionsville-architecture', formatVersion: 3, name: 'Application landscape',
      groupName: 'Acme Logistics', activeDiagramId: 'l7', diagrams: ['l7', 'containers'],
      defaults: { author: 'W. Simons' },
    }),
  },
  {
    path: 'model.json',
    text: stableJson({
      connections: [
        {
          id: 'c-1', sourceId: 'portal', targetId: 'wms', isBidirectional: false,
          protocol: 'REST', validFrom: '2027-01-01', validUntil: '2027-12-31',
        },
        { id: 'c-2', sourceId: 'wms', targetId: 'carrier', isBidirectional: true },
      ],
      elements: [
        { id: 'carrier', kind: 'externalSystem', name: 'Carrier', isManaged: false, aspects: {} },
        { id: 'monitoring', kind: 'managementTool', name: 'Monitoring', aspects: {} },
        { id: 'portal', kind: 'inputChannel', name: 'Portal', aspects: {} },
        { id: 'wms', kind: 'application', name: 'WMS', lifecycle: 'live', isManaged: true, aspects: {} },
        { id: 'wms-core', kind: 'component', name: 'Core', parentApplicationId: 'wms', aspects: {} },
      ],
    }),
  },
  {
    path: 'diagrams/l7.json',
    text: stableJson({
      id: 'l7',
      kind: 'layer7',
      name: 'Landscape',
      layoutConfig: {
        canvas: { width: 1680, height: 1040 },
        zones: { actors: { size: 120 } },
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
        { elementId: 'carrier', zone: 'externalSystems', domainGroup: 'Core systems', x: 1500, y: 40 },
        { elementId: 'monitoring', zone: 'management', x: 100, y: 900 },
        { elementId: 'portal', zone: 'inputChannels', domainGroup: 'Core Systems', x: 60, y: 300 },
        // A group name no rectangle claims — format 3 allowed it, and so does
        // the fold, because dropping it would lose the grouping.
        { elementId: 'wms', zone: 'landscape', domainGroup: 'Nobody drew a box', x: 400, y: 300 },
      ],
      routes: [
        { connectionId: 'c-1', waypoints: [{ x: 1, y: 2 }], sourceSide: 'left', source: 'manual' },
      ],
    }),
  },
  {
    path: 'diagrams/containers.json',
    text: stableJson({ id: 'containers', kind: 'container', name: 'WMS · containers', applicationElementId: 'wms' }),
  },
  {
    path: 'diagrams/containers.placements.json',
    text: stableJson({ placements: [{ elementId: 'wms-core', x: 40, y: 40 }] }),
  },
  { path: 'docs/wms.md', text: 'Stock, and where it is.\n' },
  { path: adrPath(DECISION), text: adrFileText(DECISION) },
  { path: adrPath(PER_APPLICATION), text: adrFileText(PER_APPLICATION) },
  { path: transitionPath(PLAN), text: transitionFileText(PLAN) },
  { path: 'README.md', text: 'Somebody keeps notes here.\n' },
]

const opened = () => openProjectFolder(v3(), REF)!

function textOf(files: readonly FolderFile[], path: string): string {
  const file = files.find((held) => held.path === path)
  if (!file) throw new Error(`no ${path} — the folder has ${files.map((f) => f.path).join(', ')}`)
  return 'text' in file ? file.text : textFromBytes(file.bytes)
}

describe('the retired kinds', () => {
  const elementsOf = (model: HostModel) =>
    Object.fromEntries(model.elements.map((element) => [element.id, element]))

  it('reads all three as the application each always was', () => {
    const read = elementsOf(opened().model)
    expect(read.carrier).toMatchObject({ kind: 'application', outside: true })
    // A band says where a card is drawn, not who owns it: nothing in the file
    // ever said that a channel or a management tool was somebody else's.
    expect(read.portal).toMatchObject({ kind: 'application' })
    expect(read.monitoring).toMatchObject({ kind: 'application' })
    expect('outside' in read.portal).toBe(false)
    expect('outside' in read.monitoring).toBe(false)
  })

  it('keeps the band, on the view where it always belonged', () => {
    const members = opened().model.diagrams[0].members
    expect(members).toEqual([
      { id: 'carrier', zone: 'externalSystems', group: 'core-systems' },
      { id: 'monitoring', zone: 'management' },
      { id: 'portal', zone: 'inputChannels', group: 'core-systems-2' },
      { id: 'wms', zone: 'landscape', group: 'nobody-drew-a-box' },
    ])
  })

  it('reads one parent field for a kind that only ever had one', () => {
    expect(elementsOf(opened().model)['wms-core']).toMatchObject({
      kind: 'component', parentId: 'wms',
    })
  })
})

describe('dashed groups', () => {
  it('mints an id per name, in the order the file has them', () => {
    // Two names that slug alike are told apart by which came first, and a name
    // no rectangle claims still becomes a group.
    expect(opened().model.diagrams[0].groups).toEqual([
      { id: 'core-systems', name: 'Core systems', color: '#2f6fdb' },
      { id: 'core-systems-2', name: 'Core Systems' },
      { id: 'nobody-drew-a-box', name: 'Nobody drew a box' },
    ])
  })

  it('leaves the boxes in the geometry, keyed by the id and not the name', () => {
    expect(opened().model.diagrams[0].geometry.groups).toEqual([
      { id: 'core-systems', x: 10, y: 20, width: 300, height: 200 },
      { id: 'core-systems-2', x: 400, y: 20, width: 300, height: 200 },
    ])
  })
})

describe('what a view is, and where it ended up', () => {
  it('takes the coordinates, the canvas and the band widths into the geometry', () => {
    const geometry = opened().model.diagrams[0].geometry
    expect(geometry.nodes).toEqual([
      { id: 'carrier', x: 1500, y: 40 },
      { id: 'monitoring', x: 100, y: 900 },
      { id: 'portal', x: 60, y: 300 },
      { id: 'wms', x: 400, y: 300 },
    ])
    expect(geometry.canvas).toEqual({ width: 1680, height: 1040 })
    expect(geometry.zones).toEqual({ actors: { size: 120 } })
  })

  it('splits a route row into what was asked for and where the line went', () => {
    const diagram = opened().model.diagrams[0]
    expect(diagram.lines).toEqual([{ relationId: 'c-1', sourceSide: 'left', source: 'manual' }])
    expect(diagram.geometry.routes).toEqual([{ relationId: 'c-1', waypoints: [{ x: 1, y: 2 }] }])
  })

  it('reads every line as the one type format 3 had, window and all', () => {
    expect(opened().model.relations).toEqual([
      {
        id: 'c-1', type: 'flow', sourceId: 'portal', targetId: 'wms', isBidirectional: false,
        protocol: 'REST', validFrom: '2027-01-01', validUntil: '2027-12-31',
      },
      { id: 'c-2', type: 'flow', sourceId: 'wms', targetId: 'carrier', isBidirectional: true },
    ])
  })
})

describe('everything else in the folder', () => {
  it('comes through untouched — the pass only knows the three folds', () => {
    const project = opened()
    expect(project.model.name).toBe('Application landscape')
    expect(project.model.customerName).toBe('Acme Logistics')
    expect(project.model.defaultAuthor).toBe('W. Simons')
    expect(project.activeDiagramId).toBe('l7')
    expect(project.model.decisions?.map((adr) => adr.id)).toEqual(['adr-1', 'adr-2'])
    expect(project.model.transitions).toEqual([PLAN])
    expect(project.model.elements.find((e) => e.id === 'wms')?.description)
      .toBe('Stock, and where it is.')
  })

  it('leaves a file that is not the format\'s where it was', () => {
    expect(textOf(foldFolderToFormat4(v3())!, 'README.md')).toBe('Somebody keeps notes here.\n')
  })
})

describe('what the pass writes, and what it takes away', () => {
  it('says format 4 in the header', () => {
    expect(JSON.parse(textOf(foldFolderToFormat4(v3())!, 'project.json')))
      .toMatchObject({ type: 'lionsville-architecture', formatVersion: 4 })
  })

  it('hands back a geometry file per view and no placement file at all', () => {
    const paths = foldFolderToFormat4(v3())!.map((file) => file.path).sort()
    expect(paths).toContain('diagrams/l7.geometry.json')
    expect(paths).toContain('diagrams/containers.geometry.json')
    expect(paths.filter((path) => path.endsWith('.placements.json'))).toEqual([])
  })

  /**
   * Which is what takes it off disk.
   *
   * The store removes every path that matches the format's grammar and is not
   * among the files it was handed (`isFormatPath`), so a name the format has
   * stopped writing leaves the folder on the first save. The pass depends on
   * that, so the dependency is pinned rather than assumed.
   */
  it('leaves the superseded file claimed by the grammar, so a save removes it', () => {
    expect(isFormatPath('diagrams/l7.placements.json')).toBe(true)
    expect(projectFiles(opened()).map((file) => file.path))
      .not.toContain('diagrams/l7.placements.json')
  })

  it('does not touch a folder that is already format 4', () => {
    expect(foldFolderToFormat4(projectFiles(opened()))).toBeUndefined()
    expect(foldFolderToFormat4([{ path: 'notes.txt', text: 'hello' }])).toBeUndefined()
  })
})

describe('the migrated project', () => {
  it('round-trips byte for byte once it has been written as format 4', () => {
    const written = projectFiles(opened())
    const again = projectFiles(projectFromFolder(written, REF)!)
    expect(again).toEqual(written)
  })

  it('opens the same whether it is read once or twice', () => {
    expect(stableJson(projectFromFolder(projectFiles(opened()), REF))).toBe(stableJson(opened()))
  })

  it('is opened by the one door a second time without folding anything', () => {
    expect(stableJson(openProjectFolder(projectFiles(opened()), REF))).toBe(stableJson(opened()))
  })
})

/**
 * The same three folds, over a model that was stored whole.
 *
 * A browser-storage record and a version-1 or -2 working file are one object
 * with no version on it, so the fold runs over every read and has to be safe
 * on a model that has already been through it.
 */
describe('a model stored as one object', () => {
  const beforeAdr0012 = {
    name: 'Landscape',
    customerName: 'Acme',
    connections: [{ id: 'c-1', sourceId: 'portal', targetId: 'wms', isBidirectional: false }],
    elements: [
      { id: 'portal', kind: 'inputChannel', name: 'Portal' },
      { id: 'wms', kind: 'application', name: 'WMS' },
      { id: 'wms-core', kind: 'component', name: 'Core', parentApplicationId: 'wms' },
    ],
    diagrams: [{
      id: 'l7',
      kind: 'layer7',
      name: 'Landscape',
      placements: [
        { elementId: 'portal', zone: 'inputChannels', x: 10, y: 20 },
        { elementId: 'wms', domainGroup: 'Core', x: 200, y: 20 },
      ],
      edgeRoutes: [{ connectionId: 'c-1', waypoints: [{ x: 5, y: 5 }] }],
      layoutConfig: { domainGroups: [{ name: 'Core', x: 0, y: 0, width: 10, height: 10 }] },
    }],
  } as unknown as HostModel

  it('folds the list, the kinds, the parent and the view', () => {
    const model = migrateModel(beforeAdr0012)
    expect(model.relations).toEqual([
      { id: 'c-1', type: 'flow', sourceId: 'portal', targetId: 'wms', isBidirectional: false },
    ])
    expect('connections' in model).toBe(false)
    expect(model.elements.map((element) => element.kind)).toEqual(['application', 'application', 'component'])
    expect(model.elements[2]).toMatchObject({ parentId: 'wms' })
    expect(model.diagrams[0].members).toEqual([
      { id: 'portal', zone: 'inputChannels' },
      { id: 'wms', group: 'core' },
    ])
    expect(model.diagrams[0].geometry.nodes).toEqual([
      { id: 'portal', x: 10, y: 20 }, { id: 'wms', x: 200, y: 20 },
    ])
    expect(model.diagrams[0].geometry.routes).toEqual([{ relationId: 'c-1', waypoints: [{ x: 5, y: 5 }] }])
  })

  it('leaves a model that is already this shape exactly as it is', () => {
    const once = migrateModel(beforeAdr0012)
    expect(stableJson(migrateModel(once))).toBe(stableJson(once))
    expect(stableJson(migrateModel(opened().model))).toBe(stableJson(opened().model))
  })
})
