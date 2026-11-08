// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The example kept into a folder, over the folder's own repositories: what
 * `projects/examples/copy.test.ts`, whose destination is memory, cannot catch.
 * A folder lists its organisation under the folder's own name before anything
 * is written there, and a keep that read that name as somebody's filed the
 * example under an organisation called after the folder, with its operating
 * model in a scope where nothing reads one.
 *
 * Every assertion reads the folder anew, and the files on it, not what the keep
 * said it did.
 */
import { describe, expect, it } from 'vitest'
import acmeLogistics from './format/examples/acme-logistics.json' with { type: 'json' }
import { exampleScopes } from './format/exampleFolder'
import type { ExampleFolder } from './format/exampleFolder'
import { memoryRepositories } from '../memory/memoryRepositories'
import { EXAMPLE_CATALOGUE } from '../../projects/examples/catalogue'
import { exampleCopyOver, keepAsks, keepVisit, ORGANISATION_ONLY, placeCopy } from '../../projects/examples/copy'
import { organisationHoldsWork } from '../../projects/organisationWork'
import { modelsOf, nodesOf, readScope, summaryOf } from '../../projects/scopeAccess'
import { checkMarkFor, checkMarkId } from '../../model/checkMarks'
import { identityFindings, organisationFindings, documentFindings, tally } from '../../projects/checks'
import type { Finding } from '../../projects/checks'
import { indexScopes } from '../../projects/scopeIndex'
import { isWithinScope } from '../../projects/scopePath'
import { emptyContent } from '../../projects/scopeState'
import { placeWhole } from '../../projects/scopeAccess'
import { FakeDirectory } from './fakeDirectory'
import { folderRepositories } from './folderRepositories'
import { memoryGit } from './memoryGit'

const FOLDER = 'work1'
const entry = EXAMPLE_CATALOGUE[0]
const named = { key: entry.key, label: entry.label, description: entry.description, path: entry.path }

/** The example as a visit has it: the shipped organisation, in memory, at the root. */
async function visit() {
  const from = memoryRepositories()
  await placeCopy(from, await exampleCopyOver(from.scopes, { ...entry, scopes: exampleScopes(acmeLogistics as ExampleFolder, entry.path) }))
  return from
}

function folder(seed?: (root: FakeDirectory) => void) {
  const root = new FakeDirectory(FOLDER)
  seed?.(root)
  return { root, into: folderRepositories({ root, git: memoryGit(root) }), reopen: () => folderRepositories({ root, git: memoryGit(root) }) }
}

/** The organisation's lists only it reads, by name and length, off the folder read anew. */
async function organisationOnlyAt(repositories: ReturnType<typeof folder>['into'], address: string): Promise<Record<string, number>> {
  const model = (await readScope(repositories.scopes, address))?.model as Record<string, unknown[] | undefined> | undefined
  return Object.fromEntries(ORGANISATION_ONLY.map((list) => [list, model?.[list]?.length ?? 0]))
}

describe('the example kept into an empty folder', () => {
  it('is listed under the folder\'s name, and that name is nobody\'s: no work, nothing to ask', async () => {
    const { into } = folder()
    const tree = summaryOf(await into.scopes.tree())
    expect(tree.name).toBe(FOLDER)
    expect(tree.unnamed).toBe(true)
    expect(organisationHoldsWork(tree, await readScope(into.scopes, ''))).toBe(false)
    expect(await keepAsks(into.scopes)).toBe(false)
  })

  it('becomes the organisation: its header at the root, its operating model and principles there, and no child named after it', async () => {
    const { root, into, reopen } = folder()
    expect(await keepVisit((await visit()).scopes, into, named)).toEqual({})
    const files = root.paths()
    expect(files).toContain('scope.json')
    expect(files.some((path) => path.startsWith('_operating/'))).toBe(true)
    expect(files.some((path) => path.startsWith('_principles/'))).toBe(true)
    expect(files.some((path) => path.startsWith('acme-logistics/'))).toBe(false)
    const back = reopen()
    const tree = summaryOf(await back.scopes.tree())
    expect(tree.name).toBe('Acme Logistics')
    expect(tree.unnamed).toBeUndefined()
    expect(tree.children.map((child) => child.path).sort()).toEqual(['application-landscape', 'platforms', 'topics'])
    const organisation = await readScope(back.scopes, '')
    expect(organisation?.kind).toBe('organisation')
    const only = await organisationOnlyAt(back, '')
    expect(only.unitTypes).toBeGreaterThan(0)
    expect(only.roles).toBeGreaterThan(0)
    expect(organisation?.model.principles?.length).toBeGreaterThan(0)
  })
})

describe('the example kept into a folder whose root is blank but named after the folder', () => {
  // What a folder holds before anybody wrote a scope there: the app's own settings
  // folder, a file of somebody's own, and no `scope.json` at the root.
  const seeded = (root: FakeDirectory) => {
    root.writeRaw('README.txt', 'notes, not a scope')
    void root.getDirectoryHandle('.lionsville-architecture', { create: true }).then((own) => (own as FakeDirectory).writeRaw('local.json', '{}'))
  }

  it('reads as an organisation nobody started, and the example becomes it', async () => {
    const { root, into, reopen } = folder(seeded)
    expect(summaryOf(await into.scopes.tree())).toMatchObject({ name: FOLDER, unnamed: true, children: [] })
    expect(await keepAsks(into.scopes)).toBe(false)
    await keepVisit((await visit()).scopes, into, named)
    expect(root.paths()).toEqual(expect.arrayContaining(['README.txt', '.lionsville-architecture/local.json']))
    expect(root.paths()).toContain('scope.json')
    expect((await readScope(reopen().scopes, ''))?.model.name).toBe('Acme Logistics')
  })

  it('still holds work where somebody wrote the folder\'s own name as the organisation\'s: a header written is a name chosen', async () => {
    const { into } = folder()
    await placeWhole(into.scopes, '', { ...emptyContent(FOLDER), kind: 'organisation' })
    expect(summaryOf(await into.scopes.tree()).unnamed).toBeUndefined()
    expect(await keepAsks(into.scopes)).toBe(true)
  })
})

describe('the example kept into a folder whose organisation holds work', () => {
  async function withWork() {
    const made = folder()
    await placeWhole(made.into.scopes, '', {
      ...emptyContent('Globex'), kind: 'organisation',
      model: { ...emptyContent('Globex').model, unitTypes: [], roles: [], elements: [{ id: 'ours', kind: 'application', name: 'Our system' } as never] },
    })
    return made
  }

  it('asks first', async () => {
    const { into } = await withWork()
    expect(await keepAsks(into.scopes)).toBe(true)
  })

  it('is filed under a scope of its own, without what only the organisation reads, and the organisation is as it was', async () => {
    const { root, into, reopen } = await withWork()
    const before = await readScope(into.scopes, '')
    expect(await keepVisit((await visit()).scopes, into, named)).toEqual({ under: 'acme-logistics' })
    const files = root.paths()
    expect(files).toContain('acme-logistics/scope.json')
    expect(files.some((path) => path.startsWith('acme-logistics/_operating/'))).toBe(false)
    // Principles are read by their own scope and every scope below (ADR-0041): they come.
    expect(files.some((path) => path.startsWith('acme-logistics/_principles/'))).toBe(true)
    expect(files.some((path) => path.startsWith('_operating/'))).toBe(false)
    const back = reopen()
    expect(await organisationOnlyAt(back, 'acme-logistics')).toEqual(Object.fromEntries(ORGANISATION_ONLY.map((list) => [list, 0])))
    const after = await readScope(back.scopes, '')
    expect(after?.model).toEqual(before?.model)
    expect(nodesOf((await back.scopes.tree()).root).map((node) => node.address)).toContain('acme-logistics/application-landscape')
  })

  it('never writes into an organisation\'s operating model, an empty one included', async () => {
    const { into, reopen } = await withWork()
    await keepVisit((await visit()).scopes, into, named)
    expect(await organisationOnlyAt(reopen(), '')).toEqual(Object.fromEntries(ORGANISATION_ONLY.map((list) => [list, 0])))
  })
})

/**
 * What the example filed under a child says, read off the folder anew: every
 * address in it its own, its units plain, and no finding the example kept as
 * the organisation does not have.
 */
describe('the example filed under an organisation that holds work, as it reads there', () => {
  const DAY = '2026-11-08'

  /** The folder after a keep, either way, and every finding about the example's scopes not marked as intended. */
  async function landed(work: boolean) {
    const made = folder()
    if (work) {
      await placeWhole(made.into.scopes, '', {
        ...emptyContent('Globex'), kind: 'organisation',
        model: { ...emptyContent('Globex').model, elements: [{ id: 'ours', kind: 'application', name: 'Our system' } as never] },
      })
    }
    const base = (await keepVisit((await visit()).scopes, made.into, named)).under ?? ''
    const back = made.reopen()
    const tree = await back.scopes.tree()
    const paths = nodesOf(tree.root).map((node) => node.address).filter((path) => isWithinScope(path, base))
    const scopes = new Map(await Promise.all(paths.map(async (path) => [path, (await readScope(back.scopes, path))!] as const)))
    const index = indexScopes(modelsOf(await back.index.read()))
    const found: Finding[] = [
      ...identityFindings(index), ...organisationFindings(index, DAY),
      ...paths.flatMap((path) => documentFindings({ scope: path, model: scopes.get(path)!.model, index })),
    ].filter((finding) => isWithinScope(finding.scope, base))
    const marked = new Set(paths.flatMap((path) => (scopes.get(path)!.model.checkMarks ?? []).map((mark) => `${path} ${checkMarkId(mark)}`)))
    const open = found.filter((finding) => !marked.has(`${finding.scope} ${checkMarkId(checkMarkFor(finding as never, { on: DAY }))}`))
    return { base, tree, scopes, found, open, marked }
  }

  it('names its own scopes wherever it names one: units\' lines gone with their roles, topic links and evaluations under the child', async () => {
    const { base, tree, scopes } = await landed(true)
    expect(base).toBe('acme-logistics')
    const topic = nodesOf(tree.root).find((node) => node.address === 'acme-logistics/topics/integration')
    expect(topic?.relevantTo?.map((link) => link.path)).toEqual(['acme-logistics/application-landscape', 'acme-logistics/platforms'])
    const blocks = [...scopes.values()].flatMap((scope) => scope.model.evaluations ?? []).map((one) => one.block.scope)
    expect(blocks.length).toBeGreaterThan(0)
    expect(new Set(blocks)).toEqual(new Set(['acme-logistics/topics/integration']))
  })

  it('brings its units as plain actors, nested as they were, with nothing that names the operating model it left behind', async () => {
    const { scopes } = await landed(true)
    const organisation = scopes.get('acme-logistics')!
    const actors = organisation.model.elements.filter((element) => element.kind === 'actor')
    expect(actors.find((one) => one.id === 'planning-desk')?.parentId).toBeDefined()
    for (const scope of scopes.values()) {
      expect(scope.unitTypeId).toBeUndefined()
      expect(scope.model.assignments ?? []).toEqual([])
      for (const element of scope.model.elements) {
        expect(element.unitTypeId, element.id).toBeUndefined()
        expect(element.reportingLines, element.id).toBeUndefined()
      }
    }
  })

  it('is a domain of the organisation it is filed under, without the views its units\' types drew', async () => {
    const { base, tree, scopes } = await landed(true)
    const top = scopes.get(base)!
    expect(top.kind).toBe('domain')
    expect(nodesOf(tree.root).find((node) => node.address === base)?.kind).toBe('domain')
    for (const scope of scopes.values()) {
      expect(scope.model.diagrams.filter((view) => view.kind === 'chart' || view.kind === 'conway'), scope.path).toEqual([])
      if (scope.model.diagrams.length > 0) expect(scope.model.diagrams.map((view) => view.id)).toContain(scope.activeDiagramId)
    }
    // What it draws from its own records stays.
    expect(top.model.diagrams.map((view) => view.kind)).toEqual(expect.arrayContaining(['sheet', 'map']))
    // Kept as the organisation, it is the example whole: its chart is there.
    const whole = await landed(false)
    expect(whole.scopes.get(whole.base)?.model.diagrams.some((view) => view.kind === 'chart')).toBe(true)
  })

  it('greets the person with no finding the example kept as the organisation lacks: its capabilities are marked as its own, not proposed', async () => {
    const asOrganisation = await landed(false)
    const under = await landed(true)
    // Filed under, its own map reads as forty-odd capabilities proposed to the organisation above; each is marked as intended.
    const proposals = under.found.filter((finding) => finding.key === 'check.proposal')
    expect(proposals.length).toBeGreaterThan(0)
    expect(under.open.filter((finding) => finding.key === 'check.proposal')).toEqual([])
    expect(under.marked.size).toBe(proposals.length)
    // Nothing open in the child that the example as the organisation does not raise too, and no more of any.
    const root = tally(asOrganisation.open)
    for (const [key, count] of Object.entries(tally(under.open))) expect(count, key).toBeLessThanOrEqual(root[key as keyof typeof root] ?? 0)
  })
})
