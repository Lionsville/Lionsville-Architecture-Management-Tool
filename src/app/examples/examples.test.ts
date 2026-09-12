/**
 * The shipped examples, checked as data.
 *
 * A container diagram nests its components inside the application boundary, and
 * the one thing that makes that happen is `parentId` — Tidy builds the
 * boundary as a compound node whose children are exactly the components parented
 * to it (`tidyContainer`), and everything else on the diagram is context placed
 * around it. A component that names no parent is therefore not "missing a
 * field": it is laid out beside the box it belongs in, and the example that is
 * meant to show what a container view looks like shows the opposite.
 *
 * Nothing but a reader's eye was checking that, and an example is the first
 * thing anyone opens.
 */
import { describe, expect, it } from 'vitest'
import { placedNodes } from '../../model/placement';
import { copyExampleInto, EXAMPLES, exampleFiles, exampleScopes } from '.'
import { fromArrays, toArrays } from '../../model/normalised'
import { scopeFiles, scopeFromFolder } from '../../projects/folderFormat'
import { stableJson } from '../../projects/fileText'
import { syntheticModel } from '../../model/testing/synthetic'
import { computeBusinessCase, readBusinessCase } from '../../documentation/businessCase'
import { sheetPage } from '../../business'
import { buildEdges, buildNodes } from '../../editor/graph'
import type { BuildGraphArgs } from '../../editor/graph'
import type { DesignModel } from '../../model'
import type { ScopeSummary } from '../../projects/scope'

describe.each(EXAMPLES.map((e) => [e.key, e] as const))('example %s', (_key, example) => {
  const scopes = exampleScopes(example)
  const project = scopes[scopes.length - 1]
  const model = project.model
  const byId = new Map(model.elements.map((e) => [e.id, e]))

  it('is a tree of scopes this build reads', () => {
    // The one thing that would make every other check in this file vacuous,
    // and the one an example in a form the tool no longer writes would fail.
    expect(scopes.map((scope) => scope.path))
      .toEqual(['acme-logistics', 'acme-logistics/application-landscape'])
    expect(model.diagrams.length).toBeGreaterThan(0)
  })

  /**
   * The organisation above the landscape: a name, what it is, and nothing else.
   *
   * The model is deliberately NOT split across the two. Every `supports` and
   * `assigned` row joining a capability to an application would dangle at one
   * end, and the stand-ins that make a cross-scope id resolve are ADR-0012 §2's.
   */
  it('names the organisation above the landscape, and keeps the model whole', () => {
    const [organisation] = scopes
    expect(organisation.model.name).toBe('Acme Logistics')
    expect(organisation.kind).toBe('organisation')
    expect(organisation.model.elements).toEqual([])
    expect(organisation.model.diagrams).toEqual([])
    expect(project.kind).toBe('landscape')
  })

  it('parents every component to an application that exists', () => {
    const components = model.elements.filter((e) => e.kind === 'component')
    expect(components.length).toBeGreaterThan(0)
    for (const component of components) {
      expect(
        byId.get(component.parentId ?? '')?.kind,
        `${component.id} has no parent application`,
      ).toBe('application')
    }
  })

  it.each(
    // Empty for an example without one; `describe.each` over EXAMPLES keeps the
    // suite honest when a second example arrives with no container view at all.
    model.diagrams
      .filter((d) => d.kind === 'container')
      .map((d) => [d.name, d] as const),
  )('nests the components of container diagram %s inside its boundary', (_name, diagram) => {
    const placed = placedNodes(diagram)
      .map((p) => byId.get(p.id))
      .filter((e) => e?.kind === 'component')

    expect(placed.length).toBeGreaterThan(0)
    for (const component of placed) {
      expect(
        component!.parentId,
        `${component!.id} would be laid out beside the boundary, not in it`,
      ).toBe(diagram.applicationElementId)
    }
  })
})

/**
 * The indexed model is an in-memory shape, not a format (ADR-0002). Opening the
 * biggest thing this repository ships, indexing it and writing it back out has
 * to produce the same file down to the byte — key order included — or the first
 * save after the reducer lands is a diff nobody asked for.
 */
describe.each(EXAMPLES.map((e) => [e.key, e] as const))('example %s as a working file', (_key, example) => {
  const scopes = exampleScopes(example)
  const project = scopes[scopes.length - 1]

  it('survives the indexed model byte for byte', () => {
    const indexed = { ...project, model: toArrays(fromArrays(project.model)) }

    expect(stableJson(indexed)).toBe(stableJson(project))
  })

  it('is written back as the files it was read from', () => {
    // The example ships as the folders the format writes, so a save of an
    // untouched copy has to be no diff at all — which is also what says the
    // shipped file is current rather than something a reader forgives.
    const written = scopes.flatMap((scope) => {
      const within = scope.path === example.path
        ? ''
        : `${scope.path.slice(example.path.length + 1)}/`
      return scopeFiles(scope).map((file) => ({ ...file, path: `${within}${file.path}` }))
    })
    expect(written.map((file) => file.path).sort()).toEqual(Object.keys(example.folder).sort())
    for (const file of exampleFiles(example)) {
      expect(written.find((held) => held.path === file.path), file.path).toEqual(file)
    }
  })

  it('round-trips through the format unchanged', () => {
    for (const scope of scopes) {
      expect(stableJson(scopeFromFolder(scopeFiles(scope), scope.path))).toBe(stableJson(scope))
    }
  })
})

/**
 * The generated landscape, held against the hand-written one.
 *
 * Every perf budget in the repository is quoted against `model/testing/synthetic`,
 * so a fixture that is shaped wrong makes every one of them a statement about the
 * generator. Size it cannot be checked against — the example's landscape is
 * thirty-three elements and the point of the fixture is thousands — but the
 * SHAPE can be, and the shape is what the router's and the derive's cost depend
 * on: a long tail of two- and three-link elements with a handful of hubs.
 *
 * This lives here, in `app/`, because it is the one module allowed to read both
 * the example and the model's own test fixtures.
 */
describe('the generated landscape against the shipped one', () => {
  const degrees = (links: readonly { from: string; to: string }[]) => {
    const count = new Map<string, number>()
    for (const link of links) {
      count.set(link.from, (count.get(link.from) ?? 0) + 1)
      count.set(link.to, (count.get(link.to) ?? 0) + 1)
    }
    const all = [...count.values()].sort((a, b) => b - a)
    const mean = all.reduce((sum, n) => sum + n, 0) / all.length
    return { mean, busiest: all[0], hubRatio: all[0] / mean }
  }

  const example = EXAMPLES[0]
  // Flows only. The generator draws a landscape, and the shape being compared
  // is the one the router and the derive pay for — a `supports` row is neither
  // routed nor derived, and counting the business layer in would make this a
  // statement about how many capabilities somebody wrote down.
  const shipped = degrees(exampleScopes(example).at(-1)!.model.relations
    .filter((c) => c.type === 'flow')
    .map((c) => ({ from: c.sourceId, to: c.targetId })))
  const generated = degrees(syntheticModel('small').relations.map((c) => ({
    from: c.sourceId, to: c.targetId,
  })))

  it('links its elements about as densely', () => {
    // Within a factor of two of the example's 2.9 links per element. A landscape
    // is neither a tree nor a mesh, and a fixture that drifted to either would
    // make the router's numbers meaningless in opposite directions.
    expect(generated.mean).toBeGreaterThan(shipped.mean / 2)
    expect(generated.mean).toBeLessThan(shipped.mean * 2)
  })

  it('has hubs, in the same proportion', () => {
    // The example's busiest element carries about four times the average. The
    // generator draws by preferential attachment and lands in the same place —
    // higher, because a bigger landscape has room for a bigger bus.
    expect(shipped.hubRatio).toBeGreaterThan(3)
    expect(generated.hubRatio).toBeGreaterThan(shipped.hubRatio)
    expect(generated.hubRatio).toBeLessThan(shipped.hubRatio * 4)
  })
})

/**
 * The example is the first plan, the first business case and the first
 * accepted decision a new user sees, so each has to be whole: every name in a
 * plan is an element or a record that exists, and every business case works
 * out to an answer rather than to its own source.
 */
describe.each(EXAMPLES.map((e) => [e.key, e] as const))('example %s teaches by example', (_key, example) => {
  const model = exampleScopes(example).at(-1)!.model
  const elementIds = new Set(model.elements.map((e) => e.id))
  const decisionIds = new Set((model.decisions ?? []).map((d) => d.id))
  const plans = model.transitions ?? []

  it('ships at least one plan, one decision and one dated board', () => {
    expect(plans.length).toBeGreaterThan(0)
    expect(model.decisions?.length ?? 0).toBeGreaterThan(0)
    expect(model.diagrams.some((d) => d.asOf)).toBe(true)
  })

  it.each(plans.map((plan) => [plan.title, plan] as const))('plan %s names only what exists', (_title, plan) => {
    for (const { elementId } of plan.elements) expect(elementIds.has(elementId), elementId).toBe(true)
    for (const id of plan.decisions) expect(decisionIds.has(id), id).toBe(true)
  })

  it.each(plans.map((plan) => [plan.title, plan] as const))('plan %s carries a business case that computes', (_title, plan) => {
    const fence = /```business-case\n([\s\S]*?)```/.exec(plan.body)
    expect(fence, 'no business-case fence').toBeTruthy()
    const held = readBusinessCase(fence![1])
    expect(held.lines.length).toBeGreaterThan(0)
    const result = computeBusinessCase(held)
    expect(result.npv).toBeGreaterThan(0)
    expect(result.score?.total).toBeGreaterThan(0)
  })

  it('files its decisions and plans as the folder does, one markdown file each', () => {
    // They used to ride beside the document in TypeScript, because the
    // interchange format has nowhere to put them. The working form does.
    const paths = Object.keys(example.folder)
    expect(paths.filter((path) => path.includes('/decisions/')).length)
      .toBe(model.decisions?.length ?? 0)
    expect(paths.filter((path) => path.includes('/transitions/')).length).toBe(plans.length)
  })
})

/**
 * The business architecture, as the sheet lays it out.
 *
 * The example is what a new user opens to find out what a sheet IS, so the
 * things the page is supposed to show have to be in the data rather than in a
 * screenshot: a journey with a common path and two that leave it, areas with
 * all three coverage answers under them, and a band for what nobody has been
 * given yet.
 *
 * Asserted in rows rather than pixels, which is what `business/sheet.ts` hands
 * back — the page has an opinion about how wide a chevron is and this file has
 * none (ADR-0012 §6).
 */
describe.each(EXAMPLES.map((e) => [e.key, e] as const))('example %s on a sheet', (_key, example) => {
  const model = exampleScopes(example).at(-1)!.model
  const sheets = model.diagrams.filter((diagram) => diagram.kind === 'sheet')

  it('ships one', () => {
    expect(sheets).toHaveLength(1)
    // A sheet is laid out, so its geometry file is the empty one a save writes
    // rather than coordinates nobody chose.
    expect(sheets[0].geometry.nodes).toEqual([])
  })

  const page = sheetPage(model, sheets[0])

  it('draws the journey in seven phases', () => {
    expect(page.journey?.element.name).toBe('Ship a consignment')
    expect(page.journey?.phases.map((phase) => phase.name)).toEqual(
      ['Quote', 'Book', 'Collect', 'Line-haul', 'Deliver', 'Invoice', 'Aftercare'],
    )
  })

  it('draws three rows under it, the common path first', () => {
    const lanes = page.journey!.lanes
    expect(lanes).toHaveLength(3)
    expect(lanes[0].actorId).toBeUndefined()
    expect(lanes.slice(1).map((lane) => lane.actor?.name))
      .toEqual(['Key accounts', 'Marketplace partner'])
  })

  it('forks the key accounts at Quote and passes them through the middle', () => {
    const lane = page.journey!.lanes[1]
    const named = (id?: string) => page.journey!.phases.find((phase) => phase.id === id)?.name
    expect(named(lane.fork)).toBe('Quote')
    // Where a lane rejoins is derived from where its last own step is, and the
    // key accounts have two of them in Aftercare — a quarterly review and a
    // frame to renew — so that, not Invoice, is where the row ends.
    expect(named(lane.join)).toBe('Aftercare')
    expect(
      lane.cells.filter((cell) => cell.passThrough)
        .map((cell) => named(cell.phaseId)),
    ).toEqual(['Collect', 'Line-haul', 'Deliver'])
  })

  it('marks every step the marketplace partner takes as done outside', () => {
    const lane = page.journey!.lanes[2]
    const steps = lane.cells.flatMap((cell) => cell.steps)
    expect(steps.map((step) => step.element.name)).toEqual([
      'Bulk order via partner', 'Inbound to partner DC', 'Partner fulfils', 'Partner settles',
    ])
    expect(steps.every((step) => step.outside)).toBe(true)
    // And it passes through the leg it does not touch, rather than showing a hole.
    const named = (id?: string) => page.journey!.phases.find((phase) => phase.id === id)?.name
    expect(lane.cells.filter((cell) => cell.passThrough).map((cell) => named(cell.phaseId)))
      .toEqual(['Line-haul'])
  })

  it('draws five areas, and a band of four nobody has been given', () => {
    expect(page.areas.map((area) => area.element.name)).toEqual(
      ['Commercial', 'Operations', 'Finance', 'Assets and fleet', 'Generic services'],
    )
    expect(page.areas.every((area) => area.domain !== undefined)).toBe(true)
    expect(page.unmapped.map((held) => held.name)).toEqual(
      ['Sustainability reporting', 'Returns', 'Customs and compliance', 'Insurance'],
    )
  })

  it('shows every coverage answer at least once', () => {
    const capabilities = page.areas.flatMap((area) =>
      area.groupings.flatMap((grouping) => grouping.capabilities))
    expect(capabilities.length).toBeGreaterThan(20)
    const answers = new Set(capabilities.map((held) => held.coverage.coverage))
    expect([...answers].sort()).toEqual(['covered', 'manual', 'uncovered'])
    // The one the record exists for: people and no system is a complete
    // answer, and the one with neither is the gap (ADR-0012 §9).
    const named = (name: string) =>
      capabilities.find((held) => held.element.name === name)!.coverage.coverage
    expect(named('Rating')).toBe('covered')
    expect(named('Driver compliance')).toBe('manual')
    expect(named('Dangerous goods')).toBe('uncovered')
  })

  it('puts the stakeholders on the rail, with the outside ones marked', () => {
    const roots = page.actors.filter((row) => row.depth === 0)
    expect(roots.map((row) => row.element.name)).toEqual(
      ['Customers', 'Partners', 'Regulators', 'Employees', 'Owners'],
    )
    expect(roots.filter((row) => row.outside).map((row) => row.element.name))
      .toEqual(['Customers', 'Partners', 'Regulators'])
    // The four the landscape already draws sit under Employees, and are still
    // the same records the board places.
    const employees = page.actors.filter((row) => row.element.parentId === 'employees')
    expect(employees.map((row) => row.element.id)).toEqual(
      ['planner', 'support-agent', 'dispatcher', 'warehouse-lead', 'drivers', 'warehouse-staff'],
    )
  })
})

/**
 * The stakeholder tree, and the board that was already there.
 *
 * The four actors the landscape draws gained a `parentId` when the rail did —
 * they are the organisation's employees, and a rail with them missing would be
 * an org chart with a hole in it. `parentId` is one field for every kind of
 * containment since ADR-0012 §3, though, and on a `layer7` board it used to
 * mean exactly one thing: a component inside its application. Every reader of
 * it in `editor/` and `layout/` is guarded by `kind === 'component'`, so
 * nothing moves — and that is worth a test rather than a reading, because the
 * cost of being wrong is the first screen a new user opens.
 */
describe('a stakeholder tree over a landscape that already drew its actors', () => {
  const model = exampleScopes(EXAMPLES[0]).at(-1)!.model
  const flat: DesignModel = {
    ...model,
    elements: model.elements.map((element) => (element.kind === 'actor'
      ? { ...element, parentId: undefined, order: undefined }
      : element)),
  }
  const diagram = model.diagrams.find((held) => held.id === 'landscape')!
  const args = (over: DesignModel): BuildGraphArgs =>
    ({ model: over, diagram, readOnly: false, edgeColor: '#000' })

  /** Where a node ended up, and nothing about what it says. */
  const where = (nodes: ReturnType<typeof buildNodes>) => nodes.map((node) => ({
    id: node.id,
    type: node.type,
    position: node.position,
    width: node.width,
    height: node.height,
    zIndex: node.zIndex,
    placement: (node.data as { placement: unknown }).placement,
  }))

  it('lays every node out in the same place', () => {
    expect(where(buildNodes(args(model)))).toEqual(where(buildNodes(args(flat))))
  })

  it('draws the same lines between them', () => {
    expect(JSON.stringify(buildEdges(args(model)))).toBe(JSON.stringify(buildEdges(args(flat))))
  })
})

describe('where a copy lands', () => {
  const example = EXAMPLES[0]
  const root = (over: Partial<ScopeSummary> = {}): ScopeSummary => ({
    path: '', name: '', diagrams: 0, children: [], ...over,
  })

  /** The common case: an empty folder, and somebody who wants to see the tool. */
  it('makes the example the organisation when the root is unnamed and empty', () => {
    const copied = copyExampleInto(example, root())
    expect(copied.map((scope) => scope.path)).toEqual(['', 'application-landscape'])
    expect(copied[0].model.name).toBe('Acme Logistics')
    expect(copied[0].kind).toBe('organisation')
  })

  it('files it under a child of a root that already has a name', () => {
    const copied = copyExampleInto(example, root({ name: 'Globex' }))
    expect(copied.map((scope) => scope.path))
      .toEqual(['acme-logistics', 'acme-logistics/application-landscape'])
  })

  it('files it under a child of a root that already has scopes in it', () => {
    const copied = copyExampleInto(example, root({ children: [
      { path: 'retail', name: 'Retail', diagrams: 0, children: [] },
    ] }))
    expect(copied[0].path).toBe('acme-logistics')
  })

  /** Not in the design's sentence; overwriting a board is the unrecoverable one. */
  it('files it under a child of an unnamed root that already draws something', () => {
    expect(copyExampleInto(example, root({ diagrams: 1 }))[0].path).toBe('acme-logistics')
  })

  it('gives a second copy its own address rather than writing over the first', () => {
    const copied = copyExampleInto(example, root({ name: 'Globex', children: [
      { path: 'acme-logistics', name: 'Acme Logistics', diagrams: 0, children: [] },
    ] }))
    expect(copied.map((scope) => scope.path))
      .toEqual(['acme-logistics-2', 'acme-logistics-2/application-landscape'])
  })

  it('carries the content over unchanged, wherever it lands', () => {
    const asRoot = copyExampleInto(example, root())
    const asChild = copyExampleInto(example, root({ name: 'Globex' }))
    expect(asChild[1].model).toEqual(asRoot[1].model)
  })
})
