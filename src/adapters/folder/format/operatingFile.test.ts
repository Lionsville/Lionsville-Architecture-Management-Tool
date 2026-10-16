// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The operating model on disk (ADR-0036), and format 11: four list files under
 * `_operating/`, read back as they were written, and a folder written at 10
 * brought up to 11 without a scope moving and without a question.
 */
import { describe, expect, it } from 'vitest'
import type { OperatingRule, Responsibility, Role, UnitType } from '../../../model/operatingModel'
import { bareScope, flattenScopes } from '../../../projects/scope'
import type { ScopeSnapshot } from '../../../projects/scope'
import { isSafeScopePath } from '../../../projects/scopePath'
import { FakeDirectory } from '../fakeDirectory'
import type { DirectoryHandleLike } from '../FileSystemScopeStore'
import { FileSystemScopeStore } from '../FileSystemScopeStore'
import {
  isFormatPath, SCOPE_FILE, SCOPE_FORMAT_VERSION, scopeFiles, scopeFromFolder,
} from './folderFormat'
import type { FolderFile } from './folderFormat'
import { upgradeProjects } from './migration'
import { OPERATING_FOLDER, RESPONSIBILITIES_FILE, ROLES_FILE, RULES_FILE, UNIT_TYPES_FILE } from './operatingFile'
import { openDocumentBytes, workingFileBytes } from './workingFile'

const team: UnitType = {
  id: 'ut-team', name: 'Team', within: ['ut-train'], limit: 3,
  slots: [{ role: 'ro-po', min: 1, max: 1 }, { role: 'ro-dev', min: 3 }],
  basedOn: { library: 'scrum', entry: 'scrum-team', version: '1', language: 'en' },
}
const train: UnitType = { id: 'ut-train', name: 'Train', top: true, within: [], spans: true, slots: [] }
const owner: Role = {
  id: 'ro-po', name: 'Product owner', short: 'PO', purpose: 'Orders the backlog.', manages: true,
  duties: [{ responsibility: 'rs-order', raci: 'A' }, { responsibility: 'rs-build', raci: 'C' }],
}
const developer: Role = { id: 'ro-dev', name: 'Developer', duties: [{ responsibility: 'rs-build', raci: 'R' }] }
const order: Responsibility = { id: 'rs-order', name: 'Order the backlog', group: 'Deliver' }
const build: Responsibility = { id: 'rs-build', name: 'Build and test', description: 'Every change.', group: 'Deliver' }
const rule: OperatingRule = { id: 'applicationOwner', role: 'ro-po' }

/** The organisation, with an operating model. */
function organisation(): ScopeSnapshot {
  const scope = bareScope('', 'Acme Logistics', 'organisation')
  return {
    ...scope,
    model: {
      ...scope.model,
      // Deliberately not in id order: the order is the organisation's.
      unitTypes: [train, team], roles: [owner, developer], responsibilities: [order, build], operatingRules: [rule],
    },
  }
}

const textOf = (files: readonly FolderFile[], path: string) => {
  const file = files.find((one) => one.path === path)
  return file && 'text' in file ? file.text : undefined
}

describe('the operating model in a scope\'s folder', () => {
  it('is four list files under _operating/, and reads back as it was written, in its own order', () => {
    const files = scopeFiles(organisation())
    const paths = files.map((file) => file.path)
    expect(paths).toEqual(expect.arrayContaining([UNIT_TYPES_FILE, ROLES_FILE, RESPONSIBILITIES_FILE, RULES_FILE]))
    expect(JSON.parse(textOf(files, SCOPE_FILE)!).version).toBe(SCOPE_FORMAT_VERSION)
    const back = scopeFromFolder(files, '')!
    expect(back.model.unitTypes?.map((one) => one.id)).toEqual(['ut-train', 'ut-team'])
    expect(back.model.unitTypes).toEqual([train, team])
    expect(back.model.roles).toEqual([owner, developer])
    expect(back.model.responsibilities).toEqual([order, build])
    expect(back.model.operatingRules).toEqual([rule])
    // And again, byte for byte: two saves of the same scope are the same files.
    expect(scopeFiles(back).map((file) => textOf([file], file.path))).toEqual(files.map((file) => textOf([file], file.path)))
  })

  it('writes no file for a list the model does not hold, and reads none back', () => {
    const files = scopeFiles(bareScope('', 'Acme'))
    expect(files.some((file) => file.path.startsWith(`${OPERATING_FOLDER}/`))).toBe(false)
    const back = scopeFromFolder(files, '')!
    expect('roles' in back.model).toBe(false)
    expect('unitTypes' in back.model).toBe(false)
  })

  it('is the format\'s: the four files and nothing else in the folder', () => {
    for (const path of [UNIT_TYPES_FILE, ROLES_FILE, RESPONSIBILITIES_FILE, RULES_FILE]) expect(isFormatPath(path)).toBe(true)
    expect(isFormatPath(`${OPERATING_FOLDER}/README.md`)).toBe(false)
    expect(isFormatPath(`${OPERATING_FOLDER}/notes.json`)).toBe(false)
    expect(isFormatPath(`${OPERATING_FOLDER}/roles/ro-po.json`)).toBe(false)
  })

  it('reads what it can of a hand-edited file and passes over a row it cannot', () => {
    const files: FolderFile[] = [
      ...scopeFiles(bareScope('', 'Acme')),
      { path: ROLES_FILE, text: JSON.stringify([
        { id: 'ro-1', name: 'Lead', duties: [{ responsibility: 'rs-1', raci: 'A' }, { responsibility: 'rs-2', raci: 'X' }], manages: 'yes' },
        { name: 'No id' },
        'not a row',
      ]) },
      { path: UNIT_TYPES_FILE, text: JSON.stringify([{ id: 'ut-1', slots: [{ role: 'ro-1', min: -2, max: 2.7 }, { min: 1 }] }]) },
      { path: RULES_FILE, text: JSON.stringify([{ id: 'nonsense', role: 'ro-1' }, { id: 'domainOwner', role: 'ro-1' }]) },
    ]
    const back = scopeFromFolder(files, '')!
    expect(back.model.roles).toEqual([{ id: 'ro-1', name: 'Lead', duties: [{ responsibility: 'rs-1', raci: 'A' }] }])
    expect(back.model.unitTypes).toEqual([{ id: 'ut-1', name: '', within: [], slots: [{ role: 'ro-1', min: 0, max: 2 }] }])
    expect(back.model.operatingRules).toEqual([{ id: 'domainOwner', role: 'ro-1' }])
    expect(back.unreadable).toBeUndefined()
  })

  it('keeps a unit type\'s order in its lane, and passes over one that is not a number', () => {
    const scope = organisation()
    const ordered = { ...scope, model: { ...scope.model, unitTypes: [{ ...train, order: 2 }, { ...team, order: 0.5 }] } }
    expect(scopeFromFolder(scopeFiles(ordered), '')!.model.unitTypes?.map((one) => one.order)).toEqual([2, 0.5])
    const files: FolderFile[] = [
      ...scopeFiles(bareScope('', 'Acme')),
      { path: UNIT_TYPES_FILE, text: JSON.stringify([{ id: 'ut-1', within: [], slots: [], order: 'first' }, { id: 'ut-2', within: [], slots: [], order: null }]) },
    ]
    expect(scopeFromFolder(files, '')!.model.unitTypes?.map((one) => 'order' in one)).toEqual([false, false])
  })

  it('keeps a role\'s and a responsibility\'s own order, and passes over one that is not a number', () => {
    const scope = organisation()
    const ordered = {
      ...scope,
      model: { ...scope.model, roles: [{ ...owner, order: 2 }, { ...developer, order: 1 }], responsibilities: [{ ...order, order: 3 }, build] },
    }
    const back = scopeFromFolder(scopeFiles(ordered), '')!.model
    expect(back.roles?.map((one) => one.order)).toEqual([2, 1])
    expect(back.responsibilities?.map((one) => one.order)).toEqual([3, undefined])
    const files: FolderFile[] = [
      ...scopeFiles(bareScope('', 'Acme')),
      { path: ROLES_FILE, text: JSON.stringify([{ id: 'ro-1', duties: [], order: 'first' }]) },
      { path: RESPONSIBILITIES_FILE, text: JSON.stringify([{ id: 'rs-1', order: null }]) },
    ]
    const loose = scopeFromFolder(files, '')!.model
    expect(['order' in loose.roles![0], 'order' in loose.responsibilities![0]]).toEqual([false, false])
  })

  it('keeps the name chosen when an item came in, where a unit type was put then, and the entries a bring-in matched an item to, and passes over what does not read', () => {
    const scope = organisation()
    const matched = { library: 'safe', entry: 'product-owner', version: '6.0', language: 'nl' }
    const recorded = {
      ...scope,
      model: {
        ...scope.model,
        unitTypes: [
          { ...train, alsoBasedOn: [{ library: 'safe', entry: 'agile-release-train', version: '6.0', language: 'en' }] },
          { ...team, basedOn: { ...team.basedOn!, name: 'Squad', placed: { top: false, within: ['ut-train'] } } },
        ],
        roles: [{ ...owner, alsoBasedOn: [matched] }, developer],
      },
    }
    const back = scopeFromFolder(scopeFiles(recorded), '')!
    expect(back.model.unitTypes).toEqual(recorded.model.unitTypes)
    expect(back.model.roles).toEqual(recorded.model.roles)
    const files: FolderFile[] = [
      ...scopeFiles(bareScope('', 'Acme')),
      { path: ROLES_FILE, text: JSON.stringify([
        { id: 'ro-1', name: 'Lead', duties: [], basedOn: { library: 'scrum', entry: 'product-owner', name: '' }, alsoBasedOn: [{ entry: 'no library' }, matched, 'nonsense'] },
        { id: 'ro-2', name: 'Coach', duties: [], alsoBasedOn: [{ library: 'safe' }] },
        { id: 'ro-3', name: 'Member', duties: [], alsoBasedOn: { library: 'safe', entry: 'team-member' } },
      ]) },
    ]
    expect(scopeFromFolder(files, '')!.model.roles).toEqual([
      { id: 'ro-1', name: 'Lead', duties: [], basedOn: { library: 'scrum', entry: 'product-owner', version: '', language: 'en' }, alsoBasedOn: [matched] },
      { id: 'ro-2', name: 'Coach', duties: [] },
      { id: 'ro-3', name: 'Member', duties: [] },
    ])
    // Where a type was put: what reads of it, nothing where it is no object, and nothing on a role.
    const from = { library: 'team-topologies', entry: 'platform', version: '1', language: 'en' }
    const placedIn: FolderFile[] = [
      ...scopeFiles(bareScope('', 'Acme')),
      { path: UNIT_TYPES_FILE, text: JSON.stringify([
        { id: 'ut-1', within: [], slots: [], basedOn: { ...from, placed: { top: 'yes', within: ['ut-2', 3] } } },
        { id: 'ut-2', within: [], slots: [], basedOn: { ...from, placed: ['ut-1'] } },
        { id: 'ut-3', within: [], slots: [], basedOn: { ...from, placed: 'top' } },
      ]) },
      { path: ROLES_FILE, text: JSON.stringify([{ id: 'ro-1', duties: [], basedOn: { ...from, placed: { top: true, within: [] } } }]) },
    ]
    const read = scopeFromFolder(placedIn, '')!.model
    expect(read.unitTypes?.map((one) => one.basedOn)).toEqual([{ ...from, placed: { top: false, within: ['ut-2'] } }, from, from])
    expect(read.roles?.[0].basedOn).toEqual(from)
  })

  it('opens a scope whose list is not a list to be read and not written', () => {
    const files: FolderFile[] = [...scopeFiles(organisation()).filter((file) => file.path !== ROLES_FILE), { path: ROLES_FILE, text: '{ half a' }]
    const back = scopeFromFolder(files, '')!
    expect(back.unread).toContain(ROLES_FILE)
    expect(back.unreadable).toContain(ROLES_FILE)
    // The lists that did read are there to be looked at.
    expect(back.model.unitTypes).toHaveLength(2)
  })

  it('keeps a slot\'s reporting line and a unit\'s own, and passes over a line that does not read (ADR-0039, format 13)', () => {
    const scope = organisation()
    const reporting: UnitType = { ...team, slots: [{ role: 'ro-po', min: 1, max: 1, reportsTo: { role: 'ro-lead', kind: 'solid', from: '2026-11-01' } }, team.slots[1]] }
    const unit = {
      id: 'checkout', kind: 'actor' as const, name: 'Checkout', lifecycle: 'live' as const, isManaged: false, aspects: {}, unitTypeId: 'ut-team',
      reportingLines: [
        { role: 'ro-dev', kind: 'dotted' as const, to: { scope: 'customer/tech', unit: 'tech', role: 'ro-chief' }, until: '2027-06-30' },
        { role: 'ro-po', kind: 'solid' as const },
      ],
    }
    const lined = { ...scope, model: { ...scope.model, unitTypes: [train, reporting], elements: [unit] } }
    const back = scopeFromFolder(scopeFiles(lined), '')!
    expect(back.model.unitTypes?.[1]).toEqual(reporting)
    expect(back.model.elements[0].reportingLines).toEqual(unit.reportingLines)
    const opened = openDocumentBytes(workingFileBytes([lined]), lined)
    expect(opened.ok && opened.scope.model.unitTypes?.[1]).toEqual(reporting)
    expect(opened.ok && opened.scope.model.elements[0].reportingLines).toEqual(unit.reportingLines)
    const files: FolderFile[] = [
      ...scopeFiles(bareScope('', 'Acme')),
      {
        path: UNIT_TYPES_FILE,
        text: JSON.stringify([{ id: 'ut-1', within: [], slots: [
          { role: 'ro-a', min: 1, reportsTo: { role: 'ro-b', kind: 'sideways' } }, { role: 'ro-c', min: 0, reportsTo: { kind: 'solid' } },
        ] }]),
      },
    ]
    expect(scopeFromFolder(files, '')!.model.unitTypes?.[0].slots).toEqual([{ role: 'ro-a', min: 1 }, { role: 'ro-c', min: 0 }])
  })

  it('travels in a working file and comes back whole', () => {
    const held = organisation()
    const opened = openDocumentBytes(workingFileBytes([held]), held)
    expect(opened.ok).toBe(true)
    if (!opened.ok) return
    expect(opened.scope.model.roles).toEqual(held.model.roles)
    expect(opened.scope.model.operatingRules).toEqual(held.model.operatingRules)
  })
})

// --- format 10 to 11 --------------------------------------------------------

/** One scope's files as a build at format 10 wrote them. */
function atTen(scope: ScopeSnapshot): FolderFile[] {
  return scopeFiles(scope).map((file) => (
    file.path === SCOPE_FILE && 'text' in file
      ? { ...file, text: file.text.replace(`"version": ${SCOPE_FORMAT_VERSION}`, '"version": 10') }
      : file
  ))
}

async function plant(root: FakeDirectory, path: string, file: FolderFile): Promise<void> {
  const parts = path.split('/')
  let folder: DirectoryHandleLike = root
  for (const segment of parts.slice(0, -1)) folder = await folder.getDirectoryHandle(segment, { create: true })
  ;(folder as FakeDirectory).writeRaw(parts[parts.length - 1], 'text' in file ? file.text : new TextDecoder().decode(file.bytes))
}

/**
 * A tree at format 10 whose organisation has a scope filed under it called
 * `operating`, and one called `assignments` deeper down: both were ordinary
 * names then, and stay what they are.
 */
async function tenTree(): Promise<FakeDirectory> {
  const root = new FakeDirectory('Architecture')
  const scopes = [bareScope('', 'Acme', 'organisation'), bareScope('operating', 'Operating', 'domain'), bareScope('operating/assignments', 'Assignments', 'landscape')]
  for (const scope of scopes) {
    for (const file of atTen(scope)) await plant(root, scope.path ? `${scope.path}/${file.path}` : file.path, file)
  }
  return root
}

const versionAt = async (root: FakeDirectory, path: string) => {
  let folder: DirectoryHandleLike = root
  for (const segment of path.split('/').filter(Boolean)) folder = await folder.getDirectoryHandle(segment)
  const handle = await folder.getFileHandle(SCOPE_FILE)
  return JSON.parse(await (await handle.getFile()).text()).version as number
}

describe('a folder written at format 10', () => {
  it('reads as an organisation with no operating model', async () => {
    const store = new FileSystemScopeStore(await tenTree())
    const held = await store.load('')
    expect(held?.model.name).toBe('Acme')
    expect(held?.model.roles).toBeUndefined()
  })

  it('is brought up to 11 by the pass, and not one scope moves — not even one called operating', async () => {
    const root = await tenTree()
    const store = new FileSystemScopeStore(root)
    expect((await store.outdated()).sort()).toEqual(['', 'operating', 'operating/assignments'])
    const tally = await upgradeProjects(store)
    expect(tally).toMatchObject({ upgraded: 3, created: 0, failed: 0 })
    expect(flattenScopes(await store.list()).map((scope) => scope.path)).toEqual(['', 'operating', 'operating/assignments'])
    for (const path of ['', 'operating', 'operating/assignments']) expect(await versionAt(root, path)).toBe(SCOPE_FORMAT_VERSION)
    expect(await store.outdated()).toEqual([])
  })

  it('keeps the organisation\'s operating model beside a scope called operating, each in its own folder', async () => {
    const root = await tenTree()
    const store = new FileSystemScopeStore(root)
    await upgradeProjects(store)
    await store.save(organisation())
    expect(root.paths()).toEqual(expect.arrayContaining([ROLES_FILE, 'operating/scope.json', 'operating/assignments/scope.json']))
    expect((await store.load(''))?.model.roles).toEqual([owner, developer])
    expect((await store.load('operating'))?.model.name).toBe('Operating')
    expect(flattenScopes(await store.list()).map((scope) => scope.path)).toEqual(['', 'operating', 'operating/assignments'])
  })
})

describe('the folder the operating model is kept in', () => {
  it('is no name a scope can have, so no tree can hold one there', () => {
    expect(isSafeScopePath(OPERATING_FOLDER)).toBe(false)
    expect(isSafeScopePath(`acme/${OPERATING_FOLDER}`)).toBe(false)
  })

  it('is never walked as a scope, whatever somebody put in it', async () => {
    const root = new FakeDirectory('Architecture')
    for (const file of scopeFiles(organisation())) await plant(root, file.path, file)
    for (const file of scopeFiles(bareScope('', 'Planted'))) await plant(root, `${OPERATING_FOLDER}/${file.path}`, file)
    const store = new FileSystemScopeStore(root)
    expect(flattenScopes(await store.list()).map((scope) => scope.path)).toEqual([''])
  })
})
