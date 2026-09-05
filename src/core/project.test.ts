/**
 * The project as a unit: what can be opened, what gets saved, how a list is
 * ordered, and why a file is refused.
 *
 * This is the logic that used to live in `main.tsx`, tangled up with
 * `FileReader`, toasts and React state — and therefore only checkable by hand.
 */
import { describe, expect, it } from 'vitest'
import acmeLogistics from '../examples/acme-logistics.json'
import type { InterchangeDoc } from './model/fromInterchange'
import {
  emptyProject, groupNameOf, groupsOf, isProjectOrder, isUsableProject, keysInGroup,
  moveToGroup, openProjectDocument, projectFromDocument, renameProject, resolveActive,
  sortProjects, summarise, toWorkingFile,
} from './project'
import type { ProjectSummary } from './project'
import { sampleProject } from '../ports/ProjectStore.contract'

const doc = acmeLogistics as InterchangeDoc
const GROUP = 'Acme Logistics'
const REF = { group: 'acme-logistics', project: 'landscape' }

describe('projectFromDocument', () => {
  it('turns an interchange document into a usable project', () => {
    const project = projectFromDocument(doc, REF, GROUP)
    expect(project.model.diagrams.length).toBeGreaterThan(0)
    expect(project.activeDiagramId).toBe(project.model.diagrams[0].id)
    expect(project.logoLibrary).toEqual([])
  })

  it('files it under the ref it was given', () => {
    expect(projectFromDocument(doc, REF, GROUP).ref).toEqual(REF)
  })

  it('takes the group name from the caller, not from the document', () => {
    // The document describes a landscape; the group says whose namespace it is
    // filed under. Two different decisions, so two different inputs.
    expect(projectFromDocument(doc, REF, 'Somebody Else').model.customerName)
      .toBe('Somebody Else')
  })
})

describe('emptyProject', () => {
  const fresh = emptyProject(REF, GROUP, { design: 'New design', diagram: 'Landscape' })

  it('opens on a landscape you can actually put something on', () => {
    expect(fresh.model.diagrams).toHaveLength(1)
    expect(fresh.activeDiagramId).toBe(fresh.model.diagrams[0].id)
    expect(fresh.model.diagrams[0].kind).toBe('layer7')
  })

  it('carries the names it was given, in the caller\'s language', () => {
    expect(fresh.model.name).toBe('New design')
    expect(fresh.model.diagrams[0].name).toBe('Landscape')
  })

  it('is a project a store will accept', () => {
    expect(isUsableProject(fresh)).toBe(true)
  })
})

describe('groupNameOf and summarise', () => {
  it('reads the group name off the model', () => {
    expect(groupNameOf(sampleProject().model)).toBe('Acme Logistics')
  })

  it('summarises without carrying the model along', () => {
    const summary = summarise({ ...sampleProject(), updatedAt: '2026-09-05T10:00:00.000Z' })
    expect(summary).toEqual({
      ref: { group: 'acme-logistics', project: 'landscape' },
      name: 'Application landscape',
      groupName: 'Acme Logistics',
      updatedAt: '2026-09-05T10:00:00.000Z',
    })
  })
})

describe('sortProjects', () => {
  const summary = (groupName: string, name: string, updatedAt?: string): ProjectSummary => ({
    ref: { group: groupName.toLowerCase(), project: name.toLowerCase() },
    name, groupName, updatedAt,
  })
  const list = [
    summary('Zeta', 'Beta', '2026-01-03T00:00:00.000Z'),
    summary('Alpha', 'Delta', '2026-01-01T00:00:00.000Z'),
    summary('Alpha', 'Charlie', '2026-01-02T00:00:00.000Z'),
  ]

  it('orders by group and then name, by default', () => {
    expect(sortProjects(list).map((s) => `${s.groupName}/${s.name}`))
      .toEqual(['Alpha/Charlie', 'Alpha/Delta', 'Zeta/Beta'])
  })

  it('orders newest first when asked', () => {
    expect(sortProjects(list, 'updated').map((s) => s.name))
      .toEqual(['Beta', 'Charlie', 'Delta'])
  })

  it('falls back on group and name so the order is total', () => {
    // Two saves in the same millisecond must not swap places between renders.
    const tied = [summary('A', 'Second', 'same'), summary('A', 'First', 'same')]
    expect(sortProjects(tied, 'updated').map((s) => s.name)).toEqual(['First', 'Second'])
  })

  it('puts a project that was never saved last under recency', () => {
    const withNone = [...list, summary('Alpha', 'Never')]
    expect(sortProjects(withNone, 'updated').at(-1)?.name).toBe('Never')
  })

  it('copies rather than sorting the caller\'s array in place', () => {
    const original = [...list]
    sortProjects(list)
    expect(list).toEqual(original)
  })

  it('recognises the two orders and nothing else', () => {
    expect(isProjectOrder('name')).toBe(true)
    expect(isProjectOrder('updated')).toBe(true)
    expect(isProjectOrder('size')).toBe(false)
    expect(isProjectOrder(undefined)).toBe(false)
  })
})

describe('resolveActive', () => {
  const model = sampleProject().model

  it('keeps a diagram that exists', () => {
    expect(resolveActive(model, 'cd')).toBe('cd')
  })

  it('falls back to the first diagram when the stored one is gone', () => {
    // Deleted in another session, or somebody else's file. A blank canvas is
    // then a worse answer than the first diagram.
    expect(resolveActive(model, 'does-not-exist')).toBe('l7')
  })

  it('falls back to the first diagram when nothing was stored', () => {
    expect(resolveActive(model)).toBe('l7')
  })

  it('gives an empty key for a model with no diagrams', () => {
    expect(resolveActive({ ...model, diagrams: [] })).toBe('')
  })
})

describe('toWorkingFile', () => {
  it('carries model, diagram and version', () => {
    const file = toWorkingFile(sampleProject())
    expect(file.type).toBe('lionsville-architecture')
    expect(file.version).toBe(1)
    expect(file.activeDiagramId).toBe('l7')
  })

  it('leaves the ref out — where you filed it is not the reader\'s business', () => {
    expect('ref' in toWorkingFile(sampleProject())).toBe(false)
  })

  it('leaves an empty library out entirely', () => {
    // This keeps a file without uploaded marks textually identical to a v1 file
    // apart from the version number — which saves noise in a diff.
    expect('logoLibrary' in toWorkingFile(sampleProject({ logoLibrary: [] }))).toBe(false)
  })

  it('does write the library out when there is something in it', () => {
    expect(toWorkingFile(sampleProject()).logoLibrary).toHaveLength(1)
  })

  it('passes its own recognition check', async () => {
    const { isWorkingFile } = await import('./model/hostModel')
    expect(isWorkingFile(JSON.parse(JSON.stringify(toWorkingFile(sampleProject()))))).toBe(true)
  })
})

describe('openProjectDocument — working file', () => {
  const into = sampleProject()

  it('takes over model, diagram and marks', () => {
    const parsed = JSON.parse(JSON.stringify(toWorkingFile(sampleProject())))
    const result = openProjectDocument(parsed, into)
    expect(result.ok && result.kind).toBe('workingFile')
    expect(result.ok && result.project.logoLibrary).toHaveLength(1)
  })

  it('lands in the project it was opened from, not a new one', () => {
    // A file says what the design is; it does not get to say where you filed it.
    const parsed = JSON.parse(JSON.stringify(toWorkingFile(sampleProject())))
    const elsewhere = { ...into, ref: { group: 'acme', project: 'landscape' } }
    const result = openProjectDocument(parsed, elsewhere)
    expect(result.ok && result.project.ref).toEqual({ group: 'acme', project: 'landscape' })
  })

  it('does not lay out again — a working file carries its own geometry', () => {
    const parsed = JSON.parse(JSON.stringify(toWorkingFile(sampleProject())))
    expect(openProjectDocument(parsed, into).ok && openProjectDocument(parsed, into)).toMatchObject(
      { relayout: false })
  })

  it('falls back to the first diagram when the stored one is gone', () => {
    const parsed = JSON.parse(JSON.stringify(toWorkingFile(sampleProject({ activeDiagramId: 'gone' }))))
    const result = openProjectDocument(parsed, into)
    expect(result.ok && result.project.activeDiagramId).toBe('l7')
  })

  it('gives an empty library for a v1 file', () => {
    const parsed = { type: 'lionsville-architecture', version: 1, model: sampleProject().model }
    const result = openProjectDocument(parsed, into)
    expect(result.ok && result.project.logoLibrary).toEqual([])
  })

  it('refuses a working file without diagrams, with its own key', () => {
    const empty = { ...toWorkingFile(into), model: { ...into.model, diagrams: [] } }
    expect(openProjectDocument(empty, into))
      .toEqual({ ok: false, messageKey: 'shell.workingFileNoDiagrams' })
  })
})

describe('openProjectDocument — interchange', () => {
  const into = sampleProject()

  it('lays out again, because such a document carries no geometry', () => {
    const result = openProjectDocument(doc, into)
    expect(result.ok && result.relayout).toBe(true)
    expect(result.ok && result.kind).toBe('interchange')
  })

  it('keeps the group name of the project it lands in', () => {
    const elsewhere = { ...into, model: { ...into.model, customerName: 'Acme Corp' } }
    const result = openProjectDocument(doc, elsewhere)
    expect(result.ok && result.project.model.customerName).toBe('Acme Corp')
  })

  it('keeps the marks of the project it lands in', () => {
    // They belong to this browser and not to the document: opening an
    // interchange file must not throw away your own marks.
    const result = openProjectDocument(doc, into)
    expect(result.ok && result.project.logoLibrary).toEqual(into.logoLibrary)
  })

  it('copies that library rather than sharing it', () => {
    const result = openProjectDocument(doc, into)
    expect(result.ok && result.project.logoLibrary).not.toBe(into.logoLibrary)
  })

  it('refuses an interchange document without diagrams', () => {
    expect(openProjectDocument({ ...doc, diagrams: [] }, into))
      .toEqual({ ok: false, messageKey: 'shell.interchangeNoDiagrams' })
  })
})

describe('openProjectDocument — the rest', () => {
  const into = sampleProject()

  it.each([
    ['an arbitrary object', { something: 'else' }],
    ['a string', 'just text'],
    ['nothing', null],
    ['a list', []],
  ])('refuses %s as an unknown file', (_name, input) => {
    expect(openProjectDocument(input, into)).toEqual({ ok: false, messageKey: 'shell.unknownFile' })
  })

  it('refuses a working file from a later version rather than half-reading it', () => {
    expect(openProjectDocument({ ...toWorkingFile(into), version: 99 }, into))
      .toEqual({ ok: false, messageKey: 'shell.unknownFile' })
  })
})

describe('isUsableProject', () => {
  it('recognises a project with diagrams', () => {
    expect(isUsableProject(sampleProject())).toBe(true)
  })

  it.each([
    ['without a model', { activeDiagramId: 'l7' }],
    ['with a model that has no diagrams', { model: { diagrams: [] } }],
    ['with diagrams that are not a list', { model: { diagrams: 'l7' } }],
    ['that is nothing', undefined],
    ['that is a string', 'no'],
  ])('rejects something %s', (_name, input) => {
    expect(isUsableProject(input)).toBe(false)
  })
})

describe('groupsOf', () => {
  const summary = (group: string, groupName: string, name: string): ProjectSummary => ({
    ref: { group, project: name.toLowerCase() }, name, groupName,
  })

  it('collects the projects of a group under one entry', () => {
    const groups = groupsOf([
      summary('acme', 'Acme', 'One'),
      summary('acme', 'Acme', 'Two'),
      summary('globex', 'Globex', 'Three'),
    ])
    expect(groups.map((g) => g.group)).toEqual(['acme', 'globex'])
    expect(groups[0].projects.map((p) => p.name)).toEqual(['One', 'Two'])
  })

  it('keeps the order the list arrived in, so the picker controls sorting', () => {
    const groups = groupsOf([summary('zeta', 'Zeta', 'A'), summary('alpha', 'Alpha', 'B')])
    expect(groups.map((g) => g.group)).toEqual(['zeta', 'alpha'])
  })

  it('takes the display name from the projects in it', () => {
    expect(groupsOf([summary('acme', 'Acme Logistics', 'One')])[0].name).toBe('Acme Logistics')
  })

  it('falls back to the slug when nothing named the group', () => {
    expect(groupsOf([summary('acme', '', 'One')])[0].name).toBe('acme')
  })

  it('finds no groups in an empty list', () => {
    expect(groupsOf([])).toEqual([])
  })
})

describe('keysInGroup', () => {
  const summary = (group: string, project: string): ProjectSummary => ({
    ref: { group, project }, name: project, groupName: group,
  })

  it('returns only the keys used inside that group', () => {
    const all = [summary('acme', 'one'), summary('acme', 'two'), summary('globex', 'one')]
    expect(keysInGroup(all, 'acme')).toEqual(['one', 'two'])
  })

  it('is why the same project name may exist in two groups', () => {
    expect(keysInGroup([summary('globex', 'one')], 'acme')).toEqual([])
  })
})

describe('renameProject', () => {
  it('changes the name on the model', () => {
    expect(renameProject(sampleProject(), 'Another name').model.name).toBe('Another name')
  })

  it('leaves the ref alone — a rename must not re-file the project', () => {
    // The picker and the lastProject preference both hold the ref. Re-filing on
    // every rename would break both, and for nothing: a ref is an address.
    const renamed = renameProject(sampleProject(), 'Another name')
    expect(renamed.ref).toEqual(sampleProject().ref)
  })

  it('does not touch the original', () => {
    const project = sampleProject()
    renameProject(project, 'Another name')
    expect(project.model.name).toBe('Application landscape')
  })
})

describe('moveToGroup', () => {
  const moved = moveToGroup(sampleProject(), 'globex', 'Globex')

  it('changes the half of the address that is the group', () => {
    expect(moved.ref).toEqual({ group: 'globex', project: 'landscape' })
  })

  it('changes the label with it, so the two cannot disagree', () => {
    expect(groupNameOf(moved.model)).toBe('Globex')
  })

  it('leaves the content alone', () => {
    expect(moved.model.elements).toEqual(sampleProject().model.elements)
    expect(moved.activeDiagramId).toBe('l7')
  })

  it('does not touch the original', () => {
    const project = sampleProject()
    moveToGroup(project, 'globex', 'Globex')
    expect(project.ref.group).toBe('acme-logistics')
  })
})
