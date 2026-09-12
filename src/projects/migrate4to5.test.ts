/**
 * A folder written before the two records became one, opened.
 *
 * What changed at format 5 is small and total: `project.json` and `group.json`
 * both become `scope.json`, and the difference between them becomes a word in
 * it. So the properties worth pinning are the ones a fold can quietly get
 * wrong — what it carries through, what it drops, and that a folder it has
 * already been over is not folded again.
 *
 * The whole-tree half of the pass — which folders are old, what the parent of a
 * migrated project is called — is `migration.ts`'s. This is one folder.
 */
import { describe, expect, it } from 'vitest'
import { parseJson } from './fileText'
import { isFormatPath, SCOPE_FILE, scopeFiles } from './folderFormat'
import type { FolderFile } from './folderFormat'
import { foldFolderToFormat5, GROUP_FILE, isSupersededPath, openScopeFolder, PROJECT_FILE } from './migrate4to5'

const REF = 'acme-logistics/landscape'

/** A format-4 project folder: a header, a model, and a view's two files. */
const v4 = (): FolderFile[] => [
  {
    path: PROJECT_FILE,
    text: JSON.stringify({
      type: 'lionsville-architecture',
      formatVersion: 4,
      name: 'Application landscape',
      groupName: 'Acme Logistics',
      description: 'The landscape as it stands.',
      activeDiagramId: 'l7',
      diagrams: ['l7'],
      defaults: { author: 'W. Simons' },
      interchange: { formatVersion: '1' },
    }),
  },
  {
    path: 'model.json',
    text: JSON.stringify({
      elements: [{ id: 'wms', kind: 'application', name: 'WMS', lifecycle: 'live', isManaged: true, aspects: {} }],
      relations: [],
    }),
  },
  { path: 'diagrams/l7.json', text: JSON.stringify({ id: 'l7', kind: 'layer7', name: 'Landschap', members: [{ id: 'wms' }] }) },
  { path: 'diagrams/l7.geometry.json', text: JSON.stringify({ nodes: [{ id: 'wms', x: 10, y: 20 }] }) },
  { path: 'docs/wms.md', text: 'Stock and picking.\n' },
]

/** A group folder: its record, and the decisions that held across the group. */
const group = (): FolderFile[] => [
  {
    path: GROUP_FILE,
    text: JSON.stringify({
      name: 'Acme Logistics',
      client: 'Acme Logistics BV',
      description: 'A parcel and pallet operator.',
      links: [{ label: 'Wiki', url: 'https://example.test/wiki' }],
    }),
  },
  {
    path: 'decisions/0001-one-identity-provider.md',
    text: '---\nid: adr-1\nnumber: 1\ntitle: One identity provider\nstatus: accepted\ndate: 2026-09-01\n---\n\n## Context\n\nEverybody logs in differently.\n',
  },
]

const headerOf = (files: readonly FolderFile[]) =>
  parseJson((files.find((file) => file.path === SCOPE_FILE) as { text: string }).text) as Record<string, unknown>

describe('a project folder', () => {
  it('becomes a scope that says it is a landscape', () => {
    const held = headerOf(foldFolderToFormat5(v4())!)
    expect(held).toMatchObject({
      type: 'lionsville-architecture',
      version: 5,
      name: 'Application landscape',
      kind: 'landscape',
      description: 'The landscape as it stands.',
      activeDiagramId: 'l7',
      diagrams: ['l7'],
      defaults: { author: 'W. Simons' },
      interchange: { formatVersion: '1' },
    })
  })

  /**
   * It is the name of the folder ABOVE this one, carried on every project
   * inside it; the scope that owns it is a different folder, and one folder's
   * fold cannot write another's.
   */
  it('drops `groupName`, which is not this scope’s to keep', () => {
    expect('groupName' in headerOf(foldFolderToFormat5(v4())!)).toBe(false)
  })

  it('leaves everything else in the folder exactly as it was', () => {
    const folded = foldFolderToFormat5(v4())!
    for (const file of v4()) {
      if (file.path === PROJECT_FILE) continue
      expect(folded.find((held) => held.path === file.path), file.path).toEqual(file)
    }
  })

  it('opens as the scope it describes', () => {
    const scope = openScopeFolder(v4(), REF)!
    expect(scope.path).toBe(REF)
    expect(scope.model.name).toBe('Application landscape')
    expect(scope.kind).toBe('landscape')
    expect(scope.model.elements.map((element) => element.id)).toEqual(['wms'])
    expect(scope.model.elements[0].description).toBe('Stock and picking.')
    expect(scope.activeDiagramId).toBe('l7')
  })
})

describe('a group folder', () => {
  it('becomes a scope that says it is a domain, and keeps what it said about itself', () => {
    const held = headerOf(foldFolderToFormat5(group())!)
    expect(held).toMatchObject({
      version: 5,
      name: 'Acme Logistics',
      kind: 'domain',
      client: 'Acme Logistics BV',
      description: 'A parcel and pallet operator.',
      links: [{ label: 'Wiki', url: 'https://example.test/wiki' }],
      diagrams: [],
    })
  })

  it('opens as a scope with the decisions it carried and no views', () => {
    const scope = openScopeFolder(group(), 'acme-logistics')!
    expect(scope.model.diagrams).toEqual([])
    expect(scope.model.decisions?.map((adr) => adr.title)).toEqual(['One identity provider'])
    expect(scope.client).toBe('Acme Logistics BV')
  })
})

describe('what the pass takes away', () => {
  /**
   * The format cannot claim a name it has stopped writing — a grammar that
   * named its own history would never stop naming it — so the store asks both
   * questions, and this pins the half that is not the grammar's.
   */
  it('names the two headers the format no longer writes', () => {
    expect(isSupersededPath(PROJECT_FILE)).toBe(true)
    expect(isSupersededPath(GROUP_FILE)).toBe(true)
    expect(isFormatPath(PROJECT_FILE)).toBe(false)
    expect(isFormatPath(GROUP_FILE)).toBe(false)
    expect(isSupersededPath('model.json')).toBe(false)
  })

  it('leaves neither among the files a save hands over', () => {
    const written = scopeFiles(openScopeFolder(v4(), REF)!).map((file) => file.path)
    expect(written).not.toContain(PROJECT_FILE)
    expect(written).toContain(SCOPE_FILE)
  })
})

describe('a folder that is not format 4', () => {
  it('is not folded at all', () => {
    expect(foldFolderToFormat5(scopeFiles(openScopeFolder(v4(), REF)!))).toBeUndefined()
    expect(foldFolderToFormat5([{ path: 'notes.txt', text: 'hello' }])).toBeUndefined()
    expect(foldFolderToFormat5([])).toBeUndefined()
  })

  it('is opened by the one door without folding anything', () => {
    const once = openScopeFolder(v4(), REF)!
    expect(openScopeFolder(scopeFiles(once), REF)).toEqual(once)
  })

  it('is not a scope at all, and says so', () => {
    expect(openScopeFolder([{ path: 'notes.txt', text: 'hello' }], REF)).toBeUndefined()
  })
})

/**
 * A 1.x folder goes 3 → 4 → 5 through the two folds in order, which is what
 * the rule on formats promises: every older version opens.
 */
describe('a format-3 folder', () => {
  const v3 = (): FolderFile[] => [
    {
      path: PROJECT_FILE,
      text: JSON.stringify({
        type: 'lionsville-architecture',
        formatVersion: 3,
        name: 'Application landscape',
        groupName: 'Acme Logistics',
        activeDiagramId: 'l7',
        diagrams: ['l7'],
      }),
    },
    {
      path: 'model.json',
      text: JSON.stringify({
        elements: [{ id: 'portal', kind: 'inputChannel', name: 'Portal' }],
        connections: [],
      }),
    },
    { path: 'diagrams/l7.json', text: JSON.stringify({ id: 'l7', kind: 'layer7', name: 'Landschap' }) },
    {
      path: 'diagrams/l7.placements.json',
      text: JSON.stringify({ placements: [{ elementId: 'portal', zone: 'inputChannels', x: 1, y: 2 }] }),
    },
  ]

  it('lands at format 5, through both folds', () => {
    const scope = openScopeFolder(v3(), REF)!
    expect(headerOf(foldFolderToFormat5(v3())!).version).toBe(5)
    expect(scope.model.elements[0]).toMatchObject({ kind: 'application' })
    expect(scope.model.diagrams[0].members).toEqual([{ id: 'portal', zone: 'inputChannels' }])
    expect(scope.model.diagrams[0].geometry.nodes).toEqual([{ id: 'portal', x: 1, y: 2 }])
  })

  it('leaves neither superseded file behind once it is written back', () => {
    const written = scopeFiles(openScopeFolder(v3(), REF)!).map((file) => file.path)
    expect(written).not.toContain(PROJECT_FILE)
    expect(written).not.toContain('diagrams/l7.placements.json')
  })
})
