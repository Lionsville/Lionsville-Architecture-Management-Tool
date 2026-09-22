// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The technology landscape: who uses what, what is offered, and what
 * delivers it, on one page (ADR-0015).
 *
 * The fifth view kind, and laid out like the sheet and the map: nothing on
 * it is dragged, nothing is stored, and every mark is read from the rows
 * every time. Three bands, one question each. **Applications** at the top —
 * every application the rows connect to a service or a platform this scope
 * holds, and the scope's own — grouped by the scope that answers for each,
 * the way the map groups its columns. **Services** in the middle, nested by
 * `parentId`. **Platforms** at the bottom, nested where the tree nests.
 *
 * The lines are the rows: `uses` from an application to a service,
 * `realises` from a platform to a service, `uses` from an application
 * straight to a platform where a team binds to one instance, and `hostedOn`
 * — drawn at rest, because on a scope with no offerings it is the only line
 * an application has (ADR-0020); *fold hosting* drops it where a `uses`,
 * an implied use or a leverage from the same application already reaches
 * the same platform. One line is derived — **leverages**, the `uses` read
 * through the `realises` — and it is drawn only while the service band is
 * hidden, because with the band open the two rows say it better.
 *
 * Twenty applications using five services each is a hundred lines, and an
 * enterprise is thousands, so the page draws none at rest: `landscapeEdges`
 * answers what would be drawn, `touchedBy` answers which of it a chosen card
 * touches, and the page draws that. Above {@link FOLD_ABOVE} applications
 * every group starts folded into one box, and a folded group's lines merge
 * into one per target with a count.
 *
 * **The rows may be another scope's.** The platform scope holds the services
 * and the platforms and not one application; the `uses` and `hostedOn` rows
 * are the landscapes', and reach this through `elsewhere` the way the
 * reports take them. An application is then named off the index through
 * `describe`, and grouped by the scope that answers for it.
 *
 * **And the offerings may be another scope's** (ADR-0020). Every service the
 * index marks `shared` that this scope does not answer for arrives through
 * `sharedElsewhere`, with the scope that does and what realises it there,
 * and joins the services after this scope's own with `where` set — the
 * *Shared in the organisation* row. A `uses` row to one is a line like any
 * other; a stand-in this scope already keeps of one sits in that row too,
 * marked, rather than among the offerings this scope authors.
 */
import { ancestorPlatforms, platformParentOf } from './hosting'
import type { PlatformTree } from './hosting'
import { narrowRealisers } from './leverage'
import type { PlatformDescribe } from './platformReport'
import type { DesignDiagram, DesignElement, ElementId, Lifecycle, PlatformArchetype, Relation } from './types'

/** More applications than this on the board, and every group starts folded. */
export const FOLD_ABOVE = 40

/** An offering another scope marks shared, as the index says it (ADR-0020). */
export type SharedElsewhere = {
  id: ElementId
  name: string
  /** The scope that answers for it. */
  where: string
  /** What realises it there. */
  realisedBy: readonly ElementId[]
}

export type TechnologyLandscapeOptions = {
  /** Rows written in other scopes that name a service or a platform this scope holds (ADR-0012 §2). */
  elsewhere?: readonly Relation[]
  /** Every shared offering the rest of the tree defines, for the shared row (ADR-0020). */
  sharedElsewhere?: readonly SharedElsewhere[]
  /** Names, kinds and owners for the ids the rows name and this scope does not hold. */
  describe?: PlatformDescribe
  /** The platform tree, where a stand-in carries no `parentId` of its own. */
  tree?: PlatformTree
}

export type LandscapeApplication = {
  id: ElementId
  name: string
  /** Somebody in the organisation defines it. False is a dangling end. */
  known: boolean
  /** The scope that answers for it, where that is not this one. */
  where?: string
  /** The services it uses, itself or through its containers, that this scope holds. */
  uses: ElementId[]
  /** The services its hosting implies (ADR-0017): realised by what it is hosted on or anything above, and not said. */
  implied: ElementId[]
  /** The platforms it binds to directly, beside the services. */
  binds: ElementId[]
  /** The platforms it or its containers are hosted on, that this scope holds. */
  hostedOn: ElementId[]
}

/** The applications of one scope: a domain box on the page. */
export type LandscapeGroup = {
  /** The key the page folds by; the empty string is this scope. */
  key: string
  /** What to call the scope, absent for this one. */
  label?: string
  applications: LandscapeApplication[]
}

export type LandscapeService = {
  id: ElementId
  name: string
  /** The first line of the description, for the card. */
  summary?: string
  lifecycle: Lifecycle
  shared?: true
  /** The scope that answers for it, where that is not this one: a shared offering from elsewhere (ADR-0020). */
  where?: string
  /** This scope keeps a stand-in of it already. */
  standIn?: true
  /** How many applications use it. */
  consumers: number
  realisedBy: ElementId[]
  children: LandscapeService[]
}

export type LandscapePlatform = {
  id: ElementId
  name: string
  archetype: PlatformArchetype
  outside?: true
  lifecycle: Lifecycle
  realises: ElementId[]
  /** How many applications stand on it: leveraging it, bound to it, or hosted on it. */
  applications: number
  children: LandscapePlatform[]
}

export type TechnologyLandscape = {
  diagramId: string
  name: string
  groups: LandscapeGroup[]
  /** The service roots, each with what is filed under it — this scope's own first, then the shared offerings from elsewhere, each with `where`. */
  services: LandscapeService[]
  /** The platform roots, likewise. */
  platforms: LandscapePlatform[]
  /** `services` counts this scope's own; `shared` the offerings from elsewhere. */
  counts: { applications: number; services: number; shared: number; platforms: number }
}

/** A card on the page, addressed the way the edges address it. */
export type NodeKey = `application:${string}` | `group:${string}` | `service:${string}` | `platform:${string}`

export const nodeKey = {
  application: (id: ElementId): NodeKey => `application:${id}`,
  group: (key: string): NodeKey => `group:${key}`,
  service: (id: ElementId): NodeKey => `service:${id}`,
  platform: (id: ElementId): NodeKey => `platform:${id}`,
}

export type LandscapeEdgeKind = 'uses' | 'realises' | 'leverages' | 'binds' | 'hostedOn'

export type LandscapeEdge = {
  from: NodeKey
  to: NodeKey
  kind: LandscapeEdgeKind
  /** How many rows this line stands for — more than one from a folded group. */
  count: number
  /** For a leverage: the services it is read through. */
  via?: ElementId[]
  /** A `uses` nobody wrote: implied by where the application is hosted (ADR-0017). */
  implied?: true
}

/** How the page is showing the landscape: what the edges depend on. */
export type LandscapeView = {
  /** The service band is open. Closed, the leverage is drawn instead of the two rows. */
  services: boolean
  /**
   * Fold a `hostedOn` into a line that already reaches the same platform: a
   * `uses`, an implied use or a leverage from the same application. Off,
   * every hosting row is a line (ADR-0020).
   */
  foldHosting: boolean
  /** The groups folded into one box, by key. */
  folded: ReadonlySet<string>
}

type Rows = { elements: readonly DesignElement[]; relations: readonly Relation[] }

function rowsOf(model: Rows, elsewhere: readonly Relation[] | undefined): Relation[] {
  const seen = new Set<string>()
  const rows: Relation[] = []
  for (const relation of [...model.relations, ...(elsewhere ?? [])]) {
    if (seen.has(relation.id)) continue
    seen.add(relation.id)
    rows.push(relation)
  }
  return rows
}

function firstLine(text: string | undefined): string | undefined {
  const line = text?.split('\n').map((one) => one.replace(/^#+\s*/, '').trim()).find(Boolean)
  return line || undefined
}

/**
 * The landscape a scope draws: its services and platforms, and every
 * application the rows connect to them.
 */
export function technologyLandscape(
  model: Rows,
  diagram: Pick<DesignDiagram, 'id' | 'name'>,
  options: TechnologyLandscapeOptions = {},
): TechnologyLandscape {
  const { describe, tree = {}, sharedElsewhere = [] } = options
  const byId = new Map(model.elements.map((element) => [element.id, element]))
  // A shared offering another scope answers for sits in the shared row,
  // whether or not this scope keeps a stand-in of it (ADR-0020).
  const sharedIds = new Set(sharedElsewhere.map((one) => one.id))
  const services = model.elements.filter((element) => element.kind === 'platformService' && !sharedIds.has(element.id))
  const platforms = model.elements.filter((element) => element.kind === 'platform')
  const serviceIds = new Set([...services.map((one) => one.id), ...sharedIds])
  const platformIds = new Set(platforms.map((one) => one.id))
  const rows = rowsOf(model, options.elsewhere)

  // A container's row counts for its application: the scope that holds the
  // container says which, and the index says it for one held elsewhere.
  const applicationOf = (id: ElementId): ElementId => {
    const held = byId.get(id)
    if (held?.kind === 'component' && held.parentId !== undefined) return held.parentId
    const told = describe?.(id)
    if (told?.kind === 'component' && told.parentId !== undefined) return told.parentId
    return id
  }

  const applications = new Map<ElementId, LandscapeApplication>()
  const application = (id: ElementId): LandscapeApplication => {
    let held = applications.get(id)
    if (!held) {
      const own = byId.get(id)
      const told = describe?.(id)
      held = {
        id,
        name: own?.name ?? told?.name ?? id,
        known: own !== undefined || told !== undefined,
        ...(told?.where !== undefined ? { where: told.where } : {}),
        uses: [], implied: [], binds: [], hostedOn: [],
      }
      applications.set(id, held)
    }
    return held
  }
  const once = (list: ElementId[], id: ElementId) => { if (!list.includes(id)) list.push(id) }

  for (const element of model.elements) if (element.kind === 'application') application(element.id)
  for (const row of rows) {
    if (row.type === 'uses' && serviceIds.has(row.targetId)) once(application(applicationOf(row.sourceId)).uses, row.targetId)
    else if (row.type === 'uses' && platformIds.has(row.targetId)) once(application(applicationOf(row.sourceId)).binds, row.targetId)
    else if (row.type === 'hostedOn' && platformIds.has(row.targetId)) once(application(applicationOf(row.sourceId)).hostedOn, row.targetId)
  }

  const realisedBy = new Map<ElementId, ElementId[]>()
  const realiser = (service: ElementId, platform: ElementId) =>
    once(realisedBy.get(service) ?? (realisedBy.set(service, []), realisedBy.get(service)!), platform)
  for (const row of rows) {
    if (row.type !== 'realises' || !serviceIds.has(row.targetId) || !platformIds.has(row.sourceId)) continue
    realiser(row.targetId, row.sourceId)
  }
  // What realises a shared offering is the other scope's row, told here.
  for (const one of sharedElsewhere) for (const platform of one.realisedBy) realiser(one.id, platform)
  const realises = new Map<ElementId, ElementId[]>()
  for (const [service, list] of realisedBy) for (const platform of list) {
    once(realises.get(platform) ?? (realises.set(platform, []), realises.get(platform)!), service)
  }

  const chainOf = (platformId: ElementId) => [platformId, ...ancestorPlatforms(model.elements, platformId, tree).map((one) => one.id)]
  // What the hosting implies (ADR-0017): the services realised by the
  // platform an application stands on, or anything above it — less what it
  // says itself.
  for (const app of applications.values()) {
    const above = new Set<ElementId>()
    for (const id of app.hostedOn) for (const one of chainOf(id)) above.add(one)
    for (const [platform, services] of realises) {
      if (!above.has(platform)) continue
      for (const service of services) if (!app.uses.includes(service)) once(app.implied, service)
    }
  }

  // Which platforms an application stands on: the leverage, narrowed by
  // where it runs when a service is delivered more than once, and beside it
  // what it binds to and what hosts it.
  const standing = new Map<ElementId, Set<ElementId>>()
  const stands = (platform: ElementId, app: ElementId) => {
    const held = standing.get(platform) ?? (standing.set(platform, new Set()), standing.get(platform)!)
    held.add(app)
  }
  for (const app of applications.values()) {
    for (const service of app.uses) {
      for (const platform of narrowRealisers(realisedBy.get(service) ?? [], app.hostedOn, chainOf)) stands(platform, app.id)
    }
    for (const platform of [...app.binds, ...app.hostedOn]) stands(platform, app.id)
  }

  const consumers = new Map<ElementId, number>()
  for (const app of applications.values()) {
    for (const service of [...app.uses, ...app.implied]) consumers.set(service, (consumers.get(service) ?? 0) + 1)
  }

  // The groups: this scope first, then the others by name.
  const groups = new Map<string, LandscapeGroup>()
  for (const app of [...applications.values()].sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id))) {
    const key = app.where ?? ''
    const group = groups.get(key) ?? (groups.set(key, { key, ...(app.where !== undefined ? { label: app.where } : {}), applications: [] }), groups.get(key)!)
    group.applications.push(app)
  }
  const grouped = [...groups.values()].sort((a, b) => (
    Number(a.key !== '') - Number(b.key !== '') || (a.label ?? '').localeCompare(b.label ?? '')
  ))

  const serviceNode = (element: DesignElement): LandscapeService => ({
    id: element.id,
    name: element.name,
    ...(firstLine(element.description) !== undefined ? { summary: firstLine(element.description)! } : {}),
    lifecycle: element.lifecycle,
    ...(element.shared ? { shared: true } : {}),
    consumers: consumers.get(element.id) ?? 0,
    realisedBy: realisedBy.get(element.id) ?? [],
    children: services
      .filter((child) => child.parentId === element.id && child.id !== element.id)
      .map(serviceNode),
  })
  const serviceRoots = services.filter((one) => one.parentId === undefined || !serviceIds.has(one.parentId)).map(serviceNode)
  const sharedRoots = sharedElsewhere.map((one): LandscapeService => {
    const held = byId.get(one.id)
    return {
      id: one.id,
      name: held?.name ?? one.name,
      lifecycle: held?.lifecycle ?? 'live',
      shared: true,
      where: one.where,
      ...(held !== undefined ? { standIn: true } : {}),
      consumers: consumers.get(one.id) ?? 0,
      realisedBy: realisedBy.get(one.id) ?? [],
      children: [],
    }
  })

  const outside = (platform: DesignElement) => platform.outside === true || tree.outsideOf?.(platform.id) === true
  const platformNode = (element: DesignElement, seen: Set<ElementId>): LandscapePlatform => ({
    id: element.id,
    name: element.name,
    archetype: element.platformArchetype ?? tree.archetypeOf?.(element.id) ?? 'service',
    ...(outside(element) ? { outside: true } : {}),
    lifecycle: element.lifecycle,
    realises: realises.get(element.id) ?? [],
    applications: standing.get(element.id)?.size ?? 0,
    children: platforms
      .filter((child) => !seen.has(child.id) && platformParentOf(child, tree) === element.id)
      .map((child) => platformNode(child, new Set([...seen, child.id]))),
  })
  const platformRoots = platforms
    .filter((one) => { const up = platformParentOf(one, tree); return up === undefined || !platformIds.has(up) })
    .map((one) => platformNode(one, new Set([one.id])))

  return {
    diagramId: diagram.id,
    name: diagram.name,
    groups: grouped,
    services: [...serviceRoots, ...sharedRoots],
    platforms: platformRoots,
    counts: { applications: applications.size, services: services.length, shared: sharedRoots.length, platforms: platforms.length },
  }
}

/**
 * A fresh technology landscape over what the scope holds. Nothing is ON it
 * the way a card is on a board — it draws the scope's services and
 * platforms and the rows about them — so it has no members and no geometry,
 * as the map has none. `id` and `name` come from outside, as the map's do.
 */
export function seedTechnologyLandscape(make: { id: string; name: string }): DesignDiagram {
  return { id: make.id, kind: 'technology', name: make.name, members: [], geometry: { nodes: [] } }
}

/** Every service, depth first, with its depth. */
export function serviceList(landscape: TechnologyLandscape): { node: LandscapeService; depth: number }[] {
  const out: { node: LandscapeService; depth: number }[] = []
  const walk = (nodes: LandscapeService[], depth: number) => {
    for (const node of nodes) { out.push({ node, depth }); walk(node.children, depth + 1) }
  }
  walk(landscape.services, 0)
  return out
}

/** Every platform, depth first, with its depth and the chain above it. */
export function platformList(landscape: TechnologyLandscape): { node: LandscapePlatform; depth: number; above: LandscapePlatform[] }[] {
  const out: { node: LandscapePlatform; depth: number; above: LandscapePlatform[] }[] = []
  const walk = (nodes: LandscapePlatform[], above: LandscapePlatform[]) => {
    for (const node of nodes) { out.push({ node, depth: above.length, above }); walk(node.children, [node, ...above]) }
  }
  walk(landscape.platforms, [])
  return out
}

/** Every application, across the groups. */
export function applicationList(landscape: TechnologyLandscape): LandscapeApplication[] {
  return landscape.groups.flatMap((group) => group.applications)
}

/** Whether the groups start folded, for this many applications on the board. */
export function startsFolded(applications: number): boolean {
  return applications > FOLD_ABOVE
}

/**
 * The lines the page would draw, for how it is showing the landscape: every
 * row once, a folded group's rows merged into one line per target with the
 * count on it, and the leverage in place of the two rows while the service
 * band is hidden.
 */
export function landscapeEdges(landscape: TechnologyLandscape, view: LandscapeView): LandscapeEdge[] {
  const platforms = platformList(landscape)
  const chainOf = (id: ElementId) => {
    const held = platforms.find((one) => one.node.id === id)
    return held ? [id, ...held.above.map((one) => one.id)] : [id]
  }
  const realisedBy = new Map<ElementId, ElementId[]>()
  for (const { node } of serviceList(landscape)) realisedBy.set(node.id, node.realisedBy)

  const merged = new Map<string, LandscapeEdge>()
  const add = (from: NodeKey, to: NodeKey, kind: LandscapeEdgeKind, via?: ElementId, implied?: true) => {
    const key = `${from}|${to}|${kind}${implied ? '|implied' : ''}`
    const held = merged.get(key)
    if (held) {
      held.count += 1
      if (via !== undefined && held.via && !held.via.includes(via)) held.via.push(via)
      return
    }
    merged.set(key, { from, to, kind, count: 1, ...(via !== undefined ? { via: [via] } : {}), ...(implied ? { implied } : {}) })
  }

  for (const group of landscape.groups) {
    for (const app of group.applications) {
      const from = view.folded.has(group.key) ? nodeKey.group(group.key) : nodeKey.application(app.id)
      // The platforms a use reaches, through what realises the service or
      // straight to it: what a hosting line folds into.
      const reached = new Set<ElementId>(app.binds)
      const behind = (service: ElementId) => narrowRealisers(realisedBy.get(service) ?? [], app.hostedOn, chainOf)
      for (const service of app.uses) {
        for (const platform of behind(service)) reached.add(platform)
        if (view.services) add(from, nodeKey.service(service), 'uses')
        else for (const platform of behind(service)) add(from, nodeKey.platform(platform), 'leverages', service)
      }
      // Implied by hosting: drawn as a use nobody wrote, with the band open;
      // with it hidden, the hosting itself is the line.
      for (const service of app.implied) {
        for (const platform of behind(service)) reached.add(platform)
        if (view.services) add(from, nodeKey.service(service), 'uses', undefined, true)
      }
      for (const platform of app.binds) add(from, nodeKey.platform(platform), 'binds')
      // Hosting is a line at rest (ADR-0020); folded, only where nothing else
      // from this application reaches the platform.
      for (const platform of app.hostedOn) {
        if (!view.foldHosting || !reached.has(platform)) add(from, nodeKey.platform(platform), 'hostedOn')
      }
    }
  }
  if (view.services) {
    for (const { node } of platforms) for (const service of node.realises) add(nodeKey.service(service), nodeKey.platform(node.id), 'realises')
  }
  return [...merged.values()]
}

/**
 * What one card touches: itself, and every card an edge joins it to — and
 * for an application, the platforms behind its services as well, so a pinned
 * application lights its whole chain through the middle band.
 */
export function touchedBy(landscape: TechnologyLandscape, key: NodeKey, view: LandscapeView): Set<NodeKey> {
  const edges = landscapeEdges(landscape, view)
  const touched = new Set<NodeKey>([key])
  const kind = key.slice(0, key.indexOf(':'))
  const neighbours = (of: NodeKey) => edges.filter((edge) => edge.from === of || edge.to === of).map((edge) => (edge.from === of ? edge.to : edge.from))

  for (const near of neighbours(key)) touched.add(near)
  if (kind === 'application' || kind === 'group') {
    // Through the services to the platforms behind them, with the band open.
    for (const near of [...touched]) {
      if (near.startsWith('service:')) for (const far of neighbours(near)) if (far.startsWith('platform:')) touched.add(far)
    }
  }
  if (kind === 'platform') {
    // Up through the services to the applications that lean on them, with the band open.
    for (const near of [...touched]) {
      if (near.startsWith('service:')) for (const far of neighbours(near)) if (!far.startsWith('platform:')) touched.add(far)
    }
  }
  return touched
}
