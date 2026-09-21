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
import { derivedPlatformAspect } from '../../model/aspects'
import { deploymentBoxes } from '../../model/deployment'
import { hostingOf } from '../../model/hosting'
import { documentFindings, identityFindings } from '../../projects/checks'
import { registerRows, registerSummary } from '../organisation/register'
import { technologyRows, technologySummary } from '../../projects/technologyRegister'
import { offeredBeyond } from '../../projects/checks'
import { describeLeverage, leverageOf } from '../../model/leverage'
import { scopeFiles, scopeFromFolder } from '../../projects/folderFormat'
import { indexScopes } from '../../projects/scopeIndex'
import { stableJson } from '../../projects/fileText'
import { syntheticModel } from '../../model/testing/synthetic'
import { computeBusinessCase, readBusinessCase } from '../../documentation/businessCase'
import { sheetPage } from '../../business'
import { buildEdges, buildNodes } from '../../editor/graph'
import type { BuildGraphArgs } from '../../editor/graph'
import type { DesignModel } from '../../model'
import type { ScopeSummary } from '../../projects/scope'

/** The scope with the applications in it — by what it is, since the platforms sit beside it (ADR-0013). */
const landscapeOf = (example: (typeof EXAMPLES)[number]) =>
  exampleScopes(example).find((scope) => scope.kind === 'landscape')!.model

describe.each(EXAMPLES.map((e) => [e.key, e] as const))('example %s', (_key, example) => {
  const scopes = exampleScopes(example)
  // The landscape is the scope with the applications; since ADR-0013 the
  // platforms are a sibling of it, so it is found by what it is rather than
  // by being last.
  const project = scopes.find((scope) => scope.kind === 'landscape')!
  const model = project.model
  const byId = new Map(model.elements.map((e) => [e.id, e]))

  it('is a tree of scopes this build reads', () => {
    // The one thing that would make every other check in this file vacuous,
    // and the one an example in a form the tool no longer writes would fail.
    expect(scopes.map((scope) => scope.path))
      .toEqual(['acme-logistics', 'acme-logistics/application-landscape', 'acme-logistics/platforms'])
    expect(model.diagrams.length).toBeGreaterThan(0)
  })

  /**
   * The physical view (ADR-0013): the platforms are a scope of their own,
   * the landscape draws stand-ins of the ones it stands on, and its containers
   * say what runs them — which is what the bus's report is made of.
   */
  it('keeps the platforms in a scope of their own, and the landscape says what it stands on', () => {
    const platforms = scopes.find((scope) => scope.path === 'acme-logistics/platforms')!
    expect(platforms.kind).toBe('domain')
    const own = platforms.model.elements.filter((e) => e.ref === undefined)
    expect(own.every((e) => e.kind === 'platform' || e.kind === 'platformService')).toBe(true)
    expect(own.map((e) => e.platformArchetype)).toContain('place')
    const standIns = model.elements.filter((e) => (e.kind === 'platform' || e.kind === 'platformService') && e.ref !== undefined)
    expect(standIns.length).toBeGreaterThan(0)
    expect(standIns.every((e) => e.ref === 'acme-logistics/platforms')).toBe(true)
    // A technology the applications use is a service they use, never a line
    // on the landscape: nothing flows FROM the identity service.
    expect(model.relations.some((r) => r.type === 'flow' && (r.sourceId === 'identity' || r.sourceId === 'observability'))).toBe(false)
    expect(model.relations.filter((r) => r.type === 'uses' && r.targetId === 'identity').length).toBeGreaterThan(0)
    expect(model.relations.some((r) => r.type === 'hostedOn')).toBe(true)
    expect(model.diagrams.filter((d) => d.kind === 'layer7')
      .every((d) => d.members.some((m) => m.id === 'esb' && m.zone === 'management'))).toBe(true)
  })

  /**
   * The technology layer with its offerings (ADR-0014 §4): the platform scope
   * shows what is offered and what delivers it, each offering maintained by
   * the platform team and shared; the consumers say which service; the
   * platform tree is `parentId` and nothing else; and the two team-specific
   * services show the contrast, one of them across a team boundary.
   */
  it('offers services in the platform scope, each maintained, shared and realised — but one', () => {
    const platforms = scopes.find((scope) => scope.path === 'acme-logistics/platforms')!.model
    const services = platforms.elements.filter((e) => e.kind === 'platformService')
    expect(services.map((e) => e.name)).toEqual([
      'Cloud environment', 'Container platform', 'Identity', 'Integration', 'Managed database', 'Message brokering', 'Observability',
    ])
    expect(services.every((e) => e.shared === true)).toBe(true)
    for (const service of services) {
      expect(platforms.relations.some((r) => r.type === 'assigned' && r.sourceId === 'platform-team' && r.targetId === service.id), service.id).toBe(true)
    }
    const realises = Object.fromEntries(platforms.relations.filter((r) => r.type === 'realises').map((r) => [r.sourceId, r.targetId]))
    expect(realises).toEqual({
      openshift: 'container-platform', kafka: 'message-brokering', esb: 'integration-service', 'landing-zone': 'cloud-environment',
      iam: 'identity', 'monitoring-stack': 'observability',
    })
    // A subdivision of a place is not an offering; and one offering has nothing behind it yet.
    expect(realises['ns-logistics']).toBeUndefined()
    expect(Object.values(realises)).not.toContain('managed-database')
    // The platform scope draws its stack as the technology landscape alone
    // (ADR-0016): no board, and nothing is a line there.
    expect(platforms.diagrams.map((d) => d.kind)).toEqual(['technology'])
    expect(platforms.relations.some((r) => r.type === 'flow')).toBe(false)
  })

  it('files the platforms under each other by parentId, and hosts nothing platform-on-platform', () => {
    const platforms = scopes.find((scope) => scope.path === 'acme-logistics/platforms')!.model
    const parent = (id: string) => platforms.elements.find((e) => e.id === id)?.parentId
    expect(parent('openshift')).toBe('landing-zone')
    expect(parent('kafka')).toBe('landing-zone')
    expect(parent('esb')).toBe('openshift')
    expect(parent('ns-logistics')).toBe('openshift')
    for (const scope of scopes) {
      const kinds = new Map(scope.model.elements.map((e) => [e.id, e.kind]))
      expect(scope.model.relations.some((r) => r.type === 'hostedOn' && kinds.get(r.sourceId) === 'platform'), scope.path).toBe(false)
    }
  })

  it('lets its applications say which service they use, and keeps where a container runs on the platform', () => {
    const kinds = new Map(model.elements.map((e) => [e.id, e.kind]))
    for (const row of model.relations.filter((r) => r.type === 'uses')) {
      expect(kinds.get(row.targetId), row.id).toBe('platformService')
    }
    expect(model.relations.filter((r) => r.type === 'hostedOn').every((r) => kinds.get(r.targetId) === 'platform')).toBe(true)
    // The WMS's record: derived through the services it uses, with nothing typed on it.
    const line = describeLeverage(leverageOf(model, 'wms', {
      elsewhere: scopes.flatMap((scope) => scope.model.relations.filter((r) => r.type === 'realises')),
    }), (id) => scopes.flatMap((scope) => scope.model.elements).find((e) => e.id === id && e.ref === undefined)?.name)
    expect(line.services.map((one) => one.name)).toEqual(['Container platform', 'Message brokering', 'Identity', 'Observability'])
    expect(line.services.map((one) => one.platforms.map((p) => p.name))).toEqual([['OpenShift'], ['Event broker'], ['Identity & access'], ['Monitoring stack']])
    expect(line.platforms).toEqual([])
  })

  it('keeps one service for the warehouse team alone, and shows one offered across a team boundary unmarked', () => {
    const index = indexScopes(scopes.map((scope) => ({ path: scope.path, model: scope.model })))
    const own = offeredBeyond(index, 'label-printing')
    expect(own.maintainers).toEqual(['warehouse-team'])
    expect(own.outside).toEqual([])
    expect(model.elements.find((e) => e.id === 'label-printing')?.shared).toBeUndefined()
    const offered = identityFindings(index).filter((f) => f.key === 'check.offeredNotShared')
    expect(offered).toEqual([{
      key: 'check.offeredNotShared', scope: 'acme-logistics/application-landscape', id: 'address-validation',
      name: 'Address validation', fields: ['order-management'], detail: 'Order Management',
    }])
    // And the register reads all of it off the same index.
    const rows = technologyRows(index, identityFindings(index))
    expect(technologySummary(rows)).toMatchObject({ services: 9, platforms: 7, shared: 7, offeredNotShared: 1, unrealised: 3 })
    expect(rows.find((row) => row.id === 'openshift')).toMatchObject({ hosts: 22, partOf: { id: 'landing-zone' }, service: { id: 'container-platform' } })
    expect(rows.find((row) => row.id === 'container-platform')?.consumers).toEqual({ applications: 2, scopes: 1 })
  })

  /**
   * An interface landing a level down (ADR-0013, redone), on the one landscape
   * this repository ships — so the acceptance the record describes can be read
   * off the example rather than performed.
   */
  it('lands its interfaces on the WMS containers, and shows the interface with two', () => {
    const landings = model.relations.filter((r) => r.refines === 'c#16')
    expect(landings.map((r) => [r.targetId, r.protocol])).toEqual([
      ['wms-api', 'REST'], ['wms-events', 'AMQP'],
    ])
    // The interface keeps its label and its ends, and loses the protocol it
    // can no longer answer for.
    const held = model.relations.find((r) => r.id === 'c#16')!
    expect(held).toMatchObject({ sourceId: 'order-management', targetId: 'wms' })
    expect(held.protocol).toBeUndefined()
    // Every landing sits under the interface it names.
    const byId = new Map(model.elements.map((e) => [e.id, e]))
    for (const landing of model.relations.filter((r) => r.refines !== undefined)) {
      const held2 = model.relations.find((r) => r.id === landing.refines)!
      expect(held2, landing.id).toBeDefined()
      expect(held2.refines, landing.id).toBeUndefined()
      const under = (end: string, over: string) =>
        end === over || byId.get(end)?.parentId === over
      expect(under(landing.sourceId, held2.sourceId), landing.id).toBe(true)
      expect(under(landing.targetId, held2.targetId), landing.id).toBe(true)
    }
  })

  it('says where its containers run, and leaves the outside systems to their owners', () => {
    const on = (id: string) => model.relations
      .filter((r) => r.type === 'hostedOn' && r.sourceId === id).map((r) => r.targetId)
    // The namespace nested in the cluster, with the database on the cluster
    // itself — which is what makes the deployment boxes nest.
    expect(on('wms-api')).toEqual(['ns-logistics'])
    expect(on('wms-db')).toEqual(['openshift'])
    // An application with containers does not say where it runs; one without
    // says it itself; a partner system is somebody else's to run.
    expect(on('wms')).toEqual([])
    expect(on('customer-portal')).toEqual(['openshift'])
    expect(on('driver-app')).toEqual(['openshift'])
    for (const id of ['partner-carriers', 'payments', 'customs', 'traffic-feed']) {
      expect(on(id), id).toEqual([])
    }
  })

  it('reads the WMS as managed off its containers, with nothing typed', () => {
    const wms = model.elements.find((e) => e.id === 'wms')!
    expect(wms.aspects.platform).toBeUndefined()
    expect(hostingOf(model, 'wms')).toMatchObject({ from: 'containers', containers: 7 })
    expect(derivedPlatformAspect(wms, model)).toMatchObject({ status: 'managed', derived: true })
  })

  it('nests the deployment boxes on the WMS container diagram', () => {
    const diagram = model.diagrams.find((d) => d.id === 'wms-containers')!
    const placed = new Set(diagram.members.map((m) => m.id))
    // The tree is the platform scope's: a stand-in carries a name and a `ref`
    // and nothing the owner answers for (§3), so the boxes are handed what the
    // index says, exactly as the workspace hands the canvas.
    const tree = indexScopes(scopes.map((scope) => ({ path: scope.path, model: scope.model })))
    const boxes = deploymentBoxes(model, diagram, placed, {
      parentOf: (id) => tree.lookup(id)?.parentId,
      archetypeOf: (id) => tree.lookup(id)?.platformArchetype,
    })
    expect(boxes.map((box) => [box.id, box.depth])).toEqual([['openshift', 0], ['ns-logistics', 1]])
    // The database is in the cluster's box and outside the namespace's.
    expect(boxes.find((box) => box.id === 'openshift')!.memberIds).toContain('wms-db')
    expect(boxes.find((box) => box.id === 'ns-logistics')!.memberIds).not.toContain('wms-db')
  })

  it('leaves one container interface for the roadmap to offer an interface for', () => {
    const loose = model.relations.filter((r) => r.id === 'c#51')[0]
    expect(loose).toMatchObject({ sourceId: 'billing', targetId: 'wms-integration' })
    expect(loose.refines).toBeUndefined()
    // Nobody has drawn the application line it implies.
    expect(model.relations.some((r) => r.type === 'flow'
      && ((r.sourceId === 'billing' && r.targetId === 'wms') || (r.sourceId === 'wms' && r.targetId === 'billing'))))
      .toBe(false)
    // And Billing is on the WMS's container diagram, so the line has an end to draw to.
    expect(model.diagrams.find((d) => d.id === 'wms-containers')!.members.some((m) => m.id === 'billing')).toBe(true)
  })

  /**
   * The split ADR-0012 §1 puts the sheet on the other side of.
   *
   * The business layer is the ORGANISATION's: the journey, the stakeholder
   * rail, the areas and the capabilities under them, and the sheet that draws
   * them. The applications are the landscape's. Neither could say the other's
   * half until ids crossed scopes — which is why the model was one document
   * through beta 2 and is two now.
   */
  it('puts the business layer at the organisation and the applications under it', () => {
    const [organisation] = scopes
    expect(organisation.model.name).toBe('Acme Logistics')
    expect(organisation.kind).toBe('organisation')
    expect(project.kind).toBe('landscape')

    const kinds = (held: DesignModel) =>
      [...new Set(held.elements.filter((e) => e.ref === undefined).map((e) => e.kind))].sort()
    // A process beside the capabilities: its page holds the BPMN (ADR-0012 §7).
    expect(kinds(organisation.model)).toEqual(['actor', 'function', 'process', 'step'])
    // The landscape's own services beside its applications (ADR-0014): the
    // two the warehouse team runs for itself; every platform is the platform
    // scope's.
    expect(kinds(model)).toEqual(['application', 'component', 'platformService'])
    // The map beside the sheet: the organisation's capabilities against the
    // landscape's systems is the view ADR-0012 §6 was written for.
    expect(organisation.model.diagrams.map((d) => d.kind)).toEqual(['sheet', 'map'])
    expect(model.diagrams.every((d) => d.kind !== 'sheet')).toBe(true)
  })

  /**
   * A domain's refinement (ADR-0012 §3): the landscape draws capabilities and
   * people the organisation defines, and holds a stand-in of each so its own
   * rows resolve inside its own document.
   *
   * **The organisation owns every actor**, and the landscape holds stand-ins of
   * the four it draws — not the other way round. §4 settles it in a sentence:
   * "a landscape's actor is a stand-in of one of them". The rail is the
   * organisation's page, its tree is one tree, and four leaves defined in a
   * landscape would leave *Employees* with no children in the scope that draws
   * it — and a second landscape drawing the same dispatcher would define a
   * second one, which is a conflict finding about two records of one person.
   */
  it('holds a stand-in of every capability and person it draws', () => {
    const standIns = model.elements.filter((e) => e.ref !== undefined)
    const owned = new Set(scopes.filter((scope) => scope !== project)
      .flatMap((scope) => scope.model.elements.filter((e) => e.ref === undefined).map((e) => e.id)))
    expect(standIns.length).toBeGreaterThan(0)
    expect(standIns.every((e) => owned.has(e.id))).toBe(true)
    // Every `supports` row the landscape wrote lands on a record it holds.
    const held = new Set(model.elements.map((e) => e.id))
    expect(model.relations.filter((r) => r.type === 'supports')
      .every((r) => held.has(r.sourceId) && held.has(r.targetId))).toBe(true)
    expect(standIns.filter((e) => e.kind === 'actor').map((e) => e.id))
      .toEqual(['commercial-team', 'dispatcher', 'planner', 'support-agent', 'warehouse-lead', 'warehouse-team'])
  })

  /**
   * A stand-in's `name` and `ref` are caches and everything else on it belongs
   * to the scope that defines it (§3). A shipped example carrying a lifecycle
   * on one would be the reference tree demonstrating a finding.
   */
  it('carries nothing on a stand-in that the organisation answers for', () => {
    for (const standIn of model.elements.filter((e) => e.ref !== undefined)) {
      // The three fields every record carries are on it and at their
      // defaults — a stand-in is a `DesignElement` like any other, and what
      // makes it one is saying nothing rather than leaving fields out.
      expect(Object.keys(standIn).sort(), standIn.id)
        .toEqual(['aspects', 'id', 'isManaged', 'kind', 'lifecycle', 'name', 'ref'])
      expect(standIn.lifecycle, standIn.id).toBe('live')
      expect(standIn.isManaged, standIn.id).toBe(false)
      expect(standIn.aspects, standIn.id).toEqual({})
    }
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
  const project = scopes.find((scope) => scope.kind === 'landscape')!

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
  const shipped = degrees(landscapeOf(example).relations
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
  const model = landscapeOf(example)
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
  const tree = exampleScopes(example)
  const model = tree[0].model
  const sheets = model.diagrams.filter((diagram) => diagram.kind === 'sheet')

  it('ships one, at the organisation', () => {
    expect(sheets).toHaveLength(1)
    // A sheet is laid out, so its geometry file is the empty one a save writes
    // rather than coordinates nobody chose.
    expect(sheets[0].geometry.nodes).toEqual([])
  })

  /**
   * The rows behind "2 apps" under a capability are a LANDSCAPE's — the
   * applications are down there and so are the rows to them (ADR-0012 §2).
   * Handed in the way the workspace hands them in, from the index.
   */
  const elsewhere = tree.slice(1).flatMap((scope) => scope.model.relations)
  const page = sheetPage(model, sheets[0], elsewhere)

  /**
   * The guard against the coverage assertions below being vacuous: without the
   * landscape's rows the organisation's own page would say nothing is covered,
   * which is the state the split would leave it in if nobody carried the rows
   * across (ADR-0012 §2).
   */
  it('has nothing covered without the rows the landscape wrote', () => {
    const alone = sheetPage(model, sheets[0])
    const capabilities = alone.areas.flatMap((area) =>
      area.groupings.flatMap((grouping) => grouping.capabilities))
    expect(capabilities.some((held) => held.coverage.coverage === 'covered')).toBe(false)
    expect(capabilities.some((held) => held.coverage.coverage === 'manual')).toBe(true)
  })

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
      ['planner', 'support-agent', 'dispatcher', 'warehouse-lead', 'drivers', 'warehouse-staff', 'platform-team', 'warehouse-team', 'commercial-team'],
    )
  })
})

/**
 * The stakeholder tree, and the board that was already there.
 *
 * The four actors the landscape draws are stand-ins now, and a stand-in sits
 * on no tree of this scope's — so the example's own board carries no
 * `parentId` on an actor at all. The guard is still worth keeping and is
 * stated the other way round: `parentId` is one field for every kind of
 * containment since ADR-0012 §3, and on a `layer7` board it used to mean
 * exactly one thing — a component inside its application. Every reader of it
 * in `editor/` and `layout/` is guarded by `kind === 'component'`, so giving
 * an actor one must move nothing. The cost of being wrong is the first screen
 * a new user opens.
 */
describe('a stakeholder tree over a landscape that already drew its actors', () => {
  const model = landscapeOf(EXAMPLES[0])
  const flat: DesignModel = {
    ...model,
    elements: model.elements.map((element) => (element.kind === 'actor'
      ? { ...element, parentId: 'employees', order: 3 }
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

  it('lays every node out in the same place, with the same lines between them', () => {
    expect(where(buildNodes(args(model)))).toEqual(where(buildNodes(args(flat))))
    expect(JSON.stringify(buildEdges(args(model)))).toBe(JSON.stringify(buildEdges(args(flat))))
  })

})

/**
 * The example is the reference tree, so a finding on it is a bug.
 *
 * Not a style preference: it is the first thing anybody opens, and an example
 * that ships a conflict or a drifting stand-in is the tool teaching the wrong
 * thing on the first screen. Information is not a fault and is allowed — a
 * capability nobody has drawn on a board is an ordinary state and the whole
 * point of `check.notDrawn` being information (ADR-0012 §9).
 */
describe.each(EXAMPLES.map((e) => [e.key, e] as const))('example %s contradicts nothing', (_key, example) => {
  const scopes = exampleScopes(example)
  const index = indexScopes(scopes.map((scope) => ({ path: scope.path, model: scope.model })))

  it('has one master per id, every stand-in resolving, and no cache stale', () => {
    // The one finding the example ships on purpose (ADR-0014 §4): a service
    // used across a team boundary and not marked shared.
    expect(identityFindings(index).map((finding) => finding.key)).toEqual(['check.offeredNotShared'])
  })

  it('says the landscape owns every application and the organisation every function', () => {
    const master = (id: string) => index.lookup(id)?.master
    for (const scope of scopes) {
      for (const element of scope.model.elements) {
        if (element.ref !== undefined) continue
        expect(master(element.id), element.id).toBe(scope.path)
      }
    }
  })

  /**
   * The register is the same index, filtered to applications (ADR-0012 §2).
   * A row on it with a finding, or with nobody answering for it, is the first
   * screen teaching the wrong thing.
   */
  it('lists every application in the register, each answered for and settled', () => {
    const rows = registerRows(index, identityFindings(index))
    const applications = scopes
      .flatMap((scope) => scope.model.elements)
      .filter((element) => element.kind === 'application' && element.ref === undefined)
    expect(rows.map((row) => row.id).sort()).toEqual(applications.map((one) => one.id).sort())
    for (const row of rows) {
      expect(row.master, row.id).toBe(`${example.path}/application-landscape`)
      expect(row.findings, row.id).toEqual([])
    }
    expect(registerSummary(rows)).toMatchObject({ definedTwice: 0, unattributed: 0, stale: 0 })
  })

  it('reports nothing but information about either scope\'s own records', () => {
    for (const scope of scopes) {
      const found = documentFindings({ scope: scope.path, model: scope.model, index })
        .filter((finding) => !finding.information)
      expect(found, scope.path).toEqual([])
    }
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
    expect(copied.map((scope) => scope.path)).toEqual(['', 'application-landscape', 'platforms'])
    expect(copied[0].model.name).toBe('Acme Logistics')
    expect(copied[0].kind).toBe('organisation')
  })

  it('files a copy under a child of the root it lands in, and gives a second one its own address', () => {
    const copied = copyExampleInto(example, root({ name: 'Globex' }))
    expect(copied.map((scope) => scope.path))
      .toEqual(['acme-logistics', 'acme-logistics/application-landscape', 'acme-logistics/platforms'])
    const copied2 = copyExampleInto(example, root({ children: [
      { path: 'retail', name: 'Retail', diagrams: 0, children: [] },
    ] }))
    expect(copied2[0].path).toBe('acme-logistics')
    // Not in the design's sentence; overwriting a board is the unrecoverable one.
    expect(copyExampleInto(example, root({ diagrams: 1 }))[0].path).toBe('acme-logistics')
    const copied3 = copyExampleInto(example, root({ name: 'Globex', children: [
      { path: 'acme-logistics', name: 'Acme Logistics', diagrams: 0, children: [] },
    ] }))
    expect(copied3.map((scope) => scope.path))
      .toEqual(['acme-logistics-2', 'acme-logistics-2/application-landscape', 'acme-logistics-2/platforms'])
  })

  /**
   * The content travels; the ADDRESSES in it travel with it (ADR-0012 §3). A
   * stand-in's `ref` is a path, and a copy that carried the old one would land
   * a tree whose every stand-in points at a folder that is not there — which
   * the drift check found the afternoon it existed.
   */
  it('carries the content over unchanged, and re-addresses what is an address', () => {
    const asRoot = copyExampleInto(example, root())
    const asChild = copyExampleInto(example, root({ name: 'Globex' }))
    const withoutRefs = (scope: typeof asRoot[number]) => ({
      ...scope.model,
      elements: scope.model.elements.map(({ ref: _held, ...rest }) => rest),
    })
    expect(withoutRefs(asChild[1])).toEqual(withoutRefs(asRoot[1]))

    const refs = (scope: typeof asRoot[number]) =>
      [...new Set(scope.model.elements.map((e) => e.ref).filter((ref) => ref !== undefined))]
    expect(refs(asRoot[1])).toEqual(['', 'platforms'])
    expect(refs(asChild[1])).toEqual(['acme-logistics', 'acme-logistics/platforms'])
  })
})
