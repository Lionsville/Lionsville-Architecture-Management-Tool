/**
 * The path a subject's history is asked by is a path the format writes.
 *
 * Pinned against `projectFiles` rather than against literals, so a change to
 * where the writer puts a diagram or a decision fails here rather than
 * silently emptying every per-thing history.
 */
import { describe, expect, it } from 'vitest'
import { laidOut } from '../model/testFixtures';
import type { Adr } from '../decisions/adr'
import type { HostModel } from '../model/fromInterchange'
import { scopeFiles } from './folderFormat'
import { historyPaths, historyPlaces, historyScopes } from './historyPath'
import { indexScopes } from './scopeIndex'
import type { ScopeSnapshot } from './scope'

const decision = (over: Partial<Adr> = {}): Adr => ({
  id: 'adr-7', number: 7, title: 'One writer', status: 'proposed', date: '2026-09-06',
  body: 'Context.', signers: [], ...over,
})

function model(over: Partial<HostModel> = {}): HostModel {
  return {
    name: 'Landscape',
    elements: [
      {
        id: 'billing', kind: 'application', name: 'Billing', lifecycle: 'live', isManaged: true,
        aspects: {}, description: 'Sends the invoices.',
      },
      {
        id: 'ap#1', kind: 'application', name: 'Odd one', lifecycle: 'live', isManaged: true,
        aspects: {}, description: 'An id that cannot be a file name.',
      },
    ],
    relations: [],
    diagrams: [
      laidOut({ id: 'landscape', kind: 'layer7', name: 'Landscape', placements: [] }),
      laidOut({ id: 'Billing View', kind: 'container', name: 'Billing', placements: [], applicationElementId: 'billing' }),
      laidOut({ id: 'billing-view', kind: 'container', name: 'Billing again', placements: [], applicationElementId: 'billing' }),
    ],
    decisions: [decision(), decision({ id: 'adr-app', number: 1, title: 'Inside billing', subjectId: 'billing' })],
    ...over,
  }
}

const project = (held: HostModel): ScopeSnapshot => ({
  path: 'acme/landscape', model: held, activeDiagramId: 'landscape', logoLibrary: [],
})

/** A pattern, as git reads one: `*` matches within a name. */
const matches = (pattern: string, path: string): boolean =>
  new RegExp(`^${pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*')}$`).test(path)

const written = (held: HostModel): string[] => scopeFiles(project(held)).map((file) => file.path)

describe('what a subject is filed as', () => {
  it('names both of a diagram\'s files, as the writer names them', () => {
    const paths = historyPaths({ what: 'diagram', id: 'landscape' }, model())
    expect(paths).toEqual(['diagrams/landscape.json', 'diagrams/landscape.geometry.json'])
    for (const path of paths!) expect(written(model())).toContain(path)
  })

  it('follows the writer when two diagrams would share a stem', () => {
    // 'Billing View' slugs to 'billing-view', which the third diagram has as
    // its id; whoever comes second gets a suffix, and the history has to ask
    // by the name the file actually has.
    const files = written(model())
    for (const id of ['Billing View', 'billing-view']) {
      const paths = historyPaths({ what: 'diagram', id }, model())!
      expect(paths).toHaveLength(2)
      for (const path of paths) expect(files).toContain(path)
    }
    expect(historyPaths({ what: 'diagram', id: 'billing-view' }, model())![0]).not.toBe(
      historyPaths({ what: 'diagram', id: 'Billing View' }, model())![0],
    )
  })

  it('still names a diagram that has been deleted since', () => {
    const paths = historyPaths({ what: 'diagram', id: 'gone' }, model())
    expect(paths).toEqual(['diagrams/gone.json', 'diagrams/gone.geometry.json'])
  })

  it('names the description\'s own page', () => {
    const paths = historyPaths({ what: 'description', id: 'billing' }, model())
    expect(paths).toEqual(['docs/billing.md'])
    expect(written(model())).toContain('docs/billing.md')
  })

  it('names the model for a description the format keeps there', () => {
    expect(historyPaths({ what: 'description', id: 'ap#1' }, model())).toEqual(['model.json'])
    expect(written(model())).not.toContain('docs/ap#1.md')
  })

  it('asks for a decision by its number, so a retitled one is still found', () => {
    const before = model()
    const [pattern] = historyPaths({ what: 'decision', id: 'adr-7' }, before)!
    expect(pattern).toBe('decisions/0007-*.md')
    expect(written(before).some((path) => matches(pattern, path))).toBe(true)

    const retitled = model({ decisions: [decision({ title: 'Two writers, after all' })] })
    const [again] = historyPaths({ what: 'decision', id: 'adr-7' }, retitled)!
    expect(again).toBe(pattern)
    expect(written(retitled).some((path) => matches(pattern, path))).toBe(true)
    // And it does not sweep up the record filed under an application.
    expect(written(model()).filter((path) => matches(pattern, path))).toHaveLength(1)
  })

  it('keeps an application\'s decision in its own folder', () => {
    const [pattern] = historyPaths({ what: 'decision', id: 'adr-app' }, model())!
    expect(pattern).toBe('decisions/billing/0001-*.md')
    expect(written(model()).some((path) => matches(pattern, path))).toBe(true)
  })

  it('has no answer for a decision the model does not hold', () => {
    expect(historyPaths({ what: 'decision', id: 'nobody' }, model())).toBeUndefined()
  })
})

/**
 * An id is organisation-wide, so an element's page is filed in every scope
 * that holds it (ADR-0012 §7): the owner's account where it is defined, and a
 * perspective wherever it is drawn.
 */
describe('everywhere a subject is filed', () => {
  const tree = indexScopes([
    { path: 'acme', model: { elements: [{ id: 'billing', kind: 'application', name: 'Billing', lifecycle: 'live', isManaged: true, aspects: {} }], relations: [] } },
    { path: 'acme/landscape', model: { elements: [{ id: 'billing', kind: 'application', name: 'Billing', ref: 'acme', lifecycle: 'live', isManaged: true, aspects: {} }], relations: [] } },
    { path: 'acme/retail', model: { elements: [{ id: 'billing', kind: 'application', name: 'Billing', ref: 'acme', lifecycle: 'live', isManaged: true, aspects: {} }], relations: [] } },
  ])

  it('takes an element’s page from every scope that holds the id, this one first', () => {
    const places = historyPlaces(
      { what: 'description', id: 'billing' },
      { scope: 'acme/landscape', model: model(), index: tree },
    )
    expect(places).toEqual([
      { path: 'acme/landscape', paths: ['docs/billing.md'] },
      { path: 'acme', paths: ['docs/billing.md'] },
      { path: 'acme/retail', paths: ['docs/billing.md'] },
    ])
    expect(historyScopes(places!)).toEqual(['acme/landscape', 'acme', 'acme/retail'])
  })

  /** A diagram and a decision are one scope's files, whatever the tree says. */
  it('leaves a diagram and a decision where they are', () => {
    const deps = { scope: 'acme/landscape', model: model(), index: tree }
    expect(historyPlaces({ what: 'diagram', id: 'landscape' }, deps)).toHaveLength(1)
    expect(historyPlaces({ what: 'decision', id: 'adr-7' }, deps)).toHaveLength(1)
  })

  it('is this scope’s own answer with no tree to read', () => {
    expect(historyPlaces({ what: 'description', id: 'billing' }, { scope: 'acme/landscape', model: model() }))
      .toEqual([{ path: 'acme/landscape', paths: ['docs/billing.md'] }])
  })

  it('has nothing to ask by for a subject the model no longer holds', () => {
    expect(historyPlaces({ what: 'decision', id: 'gone' }, { scope: '', model: model() })).toBeUndefined()
  })
})
