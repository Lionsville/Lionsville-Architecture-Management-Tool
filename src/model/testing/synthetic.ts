/**
 * A landscape big enough to be slow, generated from a seed.
 *
 * Everything in this repository that measures cost needs something to measure
 * it against, and the shipped example is thirty-three elements — a size at which
 * every quadratic loop in the tree looks linear. This builds the other end: a
 * few thousand applications, several thousand connections, dozens of diagrams,
 * and real prose on every element, so a budget in a perf test is a statement
 * about a landscape somebody could plausibly have rather than about a fixture.
 *
 * **Deterministic.** One seeded generator, no `Math.random`, no clock: the same
 * spec gives identical output on every machine and every run. A perf budget
 * that fails is then a regression rather than an unlucky draw, and a
 * correctness test may pin an id.
 *
 * **Fictional, and generically so.** The words come from the bank at the bottom
 * of this file — "billing", "gateway", "warehouse" — and name nothing that
 * exists. This repository is public (`CLAUDE.md`); a fixture is one of the
 * easiest places to leak a real landscape into it, so there is no path here
 * that reads a file or takes a name from a caller.
 *
 * **Shaped like a landscape, not like a grid.** Connections are drawn by
 * preferential attachment, so a handful of elements end up with the degree of
 * an integration bus and most have two or three — which is what makes the
 * router and the edge derivation behave the way they do on a real board. The
 * placements deliberately overflow the nominal 1680x1040 canvas: a two-thousand
 * element landscape does not fit one, real ones do not either, and clamping
 * them into it would stack a thousand cards on the same coordinates and make
 * every geometry measurement a lie.
 *
 * Generated models are cached per spec for the life of the process, because
 * building the `xl` one is itself a second of work and several tests want it.
 * Nothing mutates a model in place — every writer in the app returns a new one —
 * so sharing is safe; a test that means to mutate should clone first.
 */
import type { Adr, AdrStatus } from '../adr'
import type {
  DesignConnection, DesignDiagram, DesignElement, DiagramPlacement, DomainGroupRect, ElementId,
  Layer7Zone,
} from '../types'
import type { HostModel } from '../fromInterchange'

export type SyntheticSpec = {
  /** Elements of every kind together, components included. */
  elements: number
  connections: number
  /** One landscape and the rest container views; at least 1. */
  diagrams: number
  /** Roughly this many bytes of markdown as each element's description. */
  descriptionBytes: number
  decisions: number
  seed: number
}

export type SyntheticSize = 'small' | 'large' | 'xl'

/**
 * The three sizes the perf budgets are quoted against.
 *
 * `small` is a big consultancy landscape — the size at which today's code is
 * still comfortable, and the one to assert render counts on. `large` is the
 * target this phase is written for. `xl` is the one that has to stay usable
 * rather than fast: it is where a cap, a cancel or a refusal is the right
 * answer, and it exists so that those are exercised rather than assumed.
 */
export const SIZES: Record<SyntheticSize, SyntheticSpec> = {
  small: { elements: 200, connections: 400, diagrams: 5, descriptionBytes: 1024, decisions: 12, seed: 1 },
  large: { elements: 2_000, connections: 5_000, diagrams: 30, descriptionBytes: 2048, decisions: 36, seed: 2 },
  xl: { elements: 5_000, connections: 12_000, diagrams: 60, descriptionBytes: 2048, decisions: 60, seed: 3 },
}

/**
 * The landscape for a size, built once per process.
 *
 * Read the note at the top before mutating one.
 */
export function syntheticModel(size: SyntheticSize | SyntheticSpec): HostModel {
  const spec = typeof size === 'string' ? SIZES[size] : size
  const key = JSON.stringify(spec)
  const held = cache.get(key)
  if (held) return held
  const built = build(spec)
  cache.set(key, built)
  return built
}

const cache = new Map<string, HostModel>()

// --- the generator -----------------------------------------------------------

/**
 * xorshift32. Small, seeded, and identical everywhere — `Math.random` is none
 * of those and the whole point of this file is that two runs agree.
 */
function random(seed: number): () => number {
  let state = seed | 0 || 0x9e3779b9
  return () => {
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    return (state >>> 0) / 0x100000000
  }
}

type Rng = () => number

const pick = <T>(rng: Rng, from: readonly T[]): T => from[Math.floor(rng() * from.length) % from.length]
const between = (rng: Rng, low: number, high: number) => low + Math.floor(rng() * (high - low + 1))

/** The five landscape kinds, as fractions of everything that is not a component. */
const KIND_MIX = [
  { kind: 'actor', zone: 'actors', share: 0.08 },
  { kind: 'inputChannel', zone: 'inputChannels', share: 0.08 },
  { kind: 'externalSystem', zone: 'externalSystems', share: 0.16 },
  { kind: 'managementTool', zone: 'management', share: 0.06 },
  { kind: 'application', zone: 'landscape', share: 0.62 },
] as const satisfies readonly { kind: DesignElement['kind']; zone: Layer7Zone; share: number }[]

/** Applications per domain group — a group nobody can read is not a group. */
const PER_DOMAIN_GROUP = 24

function build(spec: SyntheticSpec): HostModel {
  const rng = random(spec.seed)
  const containers = Math.max(0, spec.diagrams - 1)

  // Components exist to be on a container view, so their count follows from how
  // many views there are rather than from a share of the total.
  const perContainer = containers === 0 ? 0 : Math.max(3, Math.min(12,
    Math.floor((spec.elements * 0.18) / containers)))
  const componentCount = Math.min(perContainer * containers, Math.floor(spec.elements * 0.3))
  const landscapeCount = Math.max(containers + 1, spec.elements - componentCount)

  const elements: DesignElement[] = []
  const zoneOf = new Map<ElementId, Layer7Zone>()
  const applications: ElementId[] = []

  let made = 0
  for (const [index, entry] of KIND_MIX.entries()) {
    const last = index === KIND_MIX.length - 1
    const count = last ? landscapeCount - made : Math.round(landscapeCount * entry.share)
    for (let n = 0; n < count; n++) {
      const id = `${PREFIX[entry.kind]}-${String(n + 1).padStart(4, '0')}`
      elements.push(describe(rng, spec, {
        id,
        kind: entry.kind,
        name: nameFor(rng, entry.kind, n + 1),
        lifecycle: 'live',
        isManaged: true,
        aspects: {},
        parameters: {},
      }))
      zoneOf.set(id, entry.zone)
      if (entry.kind === 'application') applications.push(id)
    }
    made += count
  }

  // Which applications get a container view, and the components under them. The
  // views go to the first applications rather than to random ones so that a
  // test naming `app-0001` gets the same landscape every time.
  const hosts = applications.slice(0, containers)
  const componentsOf = new Map<ElementId, ElementId[]>()
  for (const [index, host] of hosts.entries()) {
    const ids: ElementId[] = []
    for (let n = 0; n < perContainer; n++) {
      const id = `cmp-${String(index + 1).padStart(4, '0')}-${n + 1}`
      elements.push(describe(rng, spec, {
        id,
        kind: 'component',
        parentApplicationId: host,
        name: `${pick(rng, COMPONENT_WORDS)} ${pick(rng, PARTS)}`,
        lifecycle: 'live',
        isManaged: true,
        aspects: {},
        parameters: {},
      }))
      ids.push(id)
    }
    componentsOf.set(host, ids)
  }

  const domainGroups = groupNames(Math.max(1, Math.ceil(applications.length / PER_DOMAIN_GROUP)))
  const groupOf = new Map<ElementId, string>()
  for (const [index, id] of applications.entries()) {
    groupOf.set(id, domainGroups[index % domainGroups.length])
  }

  const landscapeIds = elements.filter((e) => e.kind !== 'component').map((e) => e.id)
  const connections = connect(rng, spec.connections, landscapeIds, componentsOf)

  const diagrams: DesignDiagram[] = [
    landscapeDiagram(rng, elements, zoneOf, groupOf, domainGroups),
    ...hosts.map((host, index) => containerDiagram(host, componentsOf.get(host) ?? [], index)),
  ]

  return {
    name: 'Synthetic landscape',
    customerName: 'Northwind Group',
    description: 'A generated landscape. Nobody works here.',
    elements,
    connections,
    diagrams,
    decisions: decisions(rng, spec, applications),
  }
}

const PREFIX: Record<DesignElement['kind'], string> = {
  actor: 'who',
  inputChannel: 'chan',
  externalSystem: 'ext',
  managementTool: 'ops',
  application: 'app',
  component: 'cmp',
}

/** The fields an element carries beyond its identity, and its page. */
function describe(rng: Rng, spec: SyntheticSpec, element: DesignElement): DesignElement {
  const out: DesignElement = {
    ...element,
    lifecycle: pick(rng, LIFECYCLES),
    isManaged: rng() > 0.25,
    description: markdown(rng, spec.descriptionBytes, element.name),
  }
  if (element.kind !== 'actor') {
    out.category = pick(rng, CATEGORIES)
    out.vendor = pick(rng, VENDORS)
    out.technology = pick(rng, TECHNOLOGIES)
  }
  if (element.kind === 'application' || element.kind === 'component') {
    for (const aspect of ASPECTS) {
      if (rng() > 0.4) out.aspects[aspect] = { status: pick(rng, ASPECT_STATUSES) }
    }
    out.parameters = { complexity: between(rng, 1, 5), maturity: between(rng, 1, 5) }
  }
  return out
}

/**
 * Connections by preferential attachment, in the order elements arrive.
 *
 * Each element in turn draws its links from a bag in which every element
 * appears once per connection it already has, so an element that is already
 * busy is the likeliest next target. That is what produces a handful of hubs
 * with the degree of an integration bus and a long tail of two-link
 * applications — the shape a real landscape has, and the shape the router's and
 * the edge derivation's cost actually depend on. Drawing both ends uniformly
 * would give every element the same degree and hide exactly the case that
 * hurts.
 *
 * The arrival order is shuffled first, or the hubs would all be actors: the
 * caller hands the elements over grouped by kind.
 */
function connect(
  rng: Rng,
  wanted: number,
  landscape: readonly ElementId[],
  componentsOf: ReadonlyMap<ElementId, readonly ElementId[]>,
): DesignConnection[] {
  const connections: DesignConnection[] = []
  const seen = new Set<string>()
  const add = (source: ElementId, target: ElementId) => {
    if (source === target) return false
    const key = `${source} ${target}`
    if (seen.has(key)) return false
    seen.add(key)
    connections.push({
      id: `conn-${String(connections.length + 1).padStart(5, '0')}`,
      sourceId: source,
      targetId: target,
      label: rng() > 0.5 ? pick(rng, VERBS) : undefined,
      protocol: rng() > 0.4 ? pick(rng, PROTOCOLS) : undefined,
      isBidirectional: rng() > 0.8,
    })
    return true
  }

  // Every component is wired inside its own view first, so a container diagram
  // is never an unconnected scatter of boxes.
  for (const [host, components] of componentsOf) {
    for (const component of components) add(host, component)
    for (let n = 1; n < components.length; n++) add(components[n - 1], components[n])
  }

  const arriving = shuffle(rng, landscape)
  const draw: ElementId[] = []
  const links = Math.max(1, Math.round(wanted / Math.max(1, arriving.length)))
  for (const id of arriving) {
    for (let n = 0; n < links && connections.length < wanted; n++) {
      const target = pick(rng, draw)
      if (target && add(id, target)) draw.push(id, target)
    }
    draw.push(id)
  }

  // Whatever the arrival pass did not place — it stops at the first element and
  // refuses a repeat — drawn from the bag at both ends.
  let guard = wanted * 8
  while (connections.length < wanted && guard-- > 0) {
    const source = pick(rng, draw)
    const target = pick(rng, draw)
    if (add(source, target)) draw.push(source, target)
  }
  return connections
}

function shuffle<T>(rng: Rng, rows: readonly T[]): T[] {
  const out = [...rows]
  for (let n = out.length - 1; n > 0; n--) {
    const swap = Math.floor(rng() * (n + 1))
    ;[out[n], out[swap]] = [out[swap], out[n]]
  }
  return out
}

// --- diagrams ----------------------------------------------------------------

const CARD = { width: 200, height: 130 }
const GAP = 40

function landscapeDiagram(
  rng: Rng,
  elements: readonly DesignElement[],
  zoneOf: ReadonlyMap<ElementId, Layer7Zone>,
  groupOf: ReadonlyMap<ElementId, string>,
  domainGroups: readonly string[],
): DesignDiagram {
  const placements: DiagramPlacement[] = []
  const perZone = new Map<Layer7Zone, number>()
  for (const element of elements) {
    const zone = zoneOf.get(element.id)
    if (!zone) continue
    const index = perZone.get(zone) ?? 0
    perZone.set(zone, index + 1)
    const columns = ZONE_COLUMNS[zone]
    placements.push({
      elementId: element.id,
      zone,
      domainGroup: groupOf.get(element.id),
      x: ZONE_ORIGIN[zone].x + (index % columns) * (CARD.width + GAP),
      y: ZONE_ORIGIN[zone].y + Math.floor(index / columns) * (CARD.height + GAP),
    })
  }

  // Rectangles wide enough to hold their share of the cards, in two columns, so
  // the group layer has real geometry to hit-test against.
  const rects: DomainGroupRect[] = domainGroups.map((name, index) => ({
    name,
    x: 40 + (index % 2) * 1200,
    y: 400 + Math.floor(index / 2) * 520,
    width: 1120,
    height: 460,
    color: rng() > 0.6 ? pick(rng, COLORS) : undefined,
  }))

  return {
    id: 'landscape',
    kind: 'layer7',
    name: 'Application landscape',
    author: 'The generator',
    placements,
    layoutConfig: { canvas: { width: 4800, height: 3200 }, domainGroups: rects },
  }
}

const ZONE_COLUMNS: Record<Layer7Zone, number> = {
  actors: 12,
  inputChannels: 3,
  externalSystems: 3,
  management: 12,
  landscape: 18,
}

const ZONE_ORIGIN: Record<Layer7Zone, { x: number; y: number }> = {
  actors: { x: 40, y: 20 },
  inputChannels: { x: 20, y: 400 },
  externalSystems: { x: 4200, y: 400 },
  landscape: { x: 320, y: 400 },
  management: { x: 40, y: 3000 },
}

function containerDiagram(host: ElementId, components: readonly ElementId[], index: number): DesignDiagram {
  const placements: DiagramPlacement[] = [
    { elementId: host, x: 0, y: 0, width: 900, height: 620 },
    ...components.map((id, n) => ({
      elementId: id,
      x: 80 + (n % 3) * (CARD.width + GAP),
      y: 100 + Math.floor(n / 3) * (CARD.height + GAP),
    })),
  ]
  return {
    id: `container-${String(index + 1).padStart(3, '0')}`,
    kind: 'container',
    name: `Inside ${host}`,
    applicationElementId: host,
    placements,
  }
}

// --- prose -------------------------------------------------------------------

/**
 * Roughly `bytes` of markdown, with the constructs the renderer actually has to
 * deal with: headings, paragraphs, a list, a fenced block, a link and a wiki
 * link. Deterministic, so the same element has the same page in every run.
 */
function markdown(rng: Rng, bytes: number, name: string): string {
  const out: string[] = [`## ${name}`, '', sentence(rng, 3), '']
  let length = out.join('\n').length
  while (length < bytes) {
    const before = out.length
    switch (between(rng, 0, 4)) {
      case 0:
        out.push(`### ${pick(rng, HEADINGS)}`, '')
        break
      case 1:
        out.push(sentence(rng, between(rng, 2, 5)), '')
        break
      case 2:
        out.push(...Array.from({ length: between(rng, 2, 5) }, () => `- ${sentence(rng, 1)}`), '')
        break
      case 3:
        out.push('```yaml', `service: ${pick(rng, DOMAINS)}`, `owner: ${pick(rng, TEAMS)}`, '```', '')
        break
      default:
        out.push(`See [[${pick(rng, DOMAINS)}]] and [the runbook](https://example.invalid/runbook).`, '')
    }
    for (let n = before; n < out.length; n++) length += out[n].length + 1
  }
  return out.join('\n')
}

function sentence(rng: Rng, clauses: number): string {
  const parts: string[] = []
  for (let n = 0; n < clauses; n++) {
    parts.push(`the ${pick(rng, DOMAINS)} ${pick(rng, VERBS)} the ${pick(rng, PARTS)} `
      + `${pick(rng, QUALIFIERS)}`)
  }
  const said = parts.join(', and ')
  return `${said[0].toUpperCase()}${said.slice(1)}.`
}

// --- decisions ---------------------------------------------------------------

function decisions(rng: Rng, spec: SyntheticSpec, applications: readonly ElementId[]): Adr[] {
  const out: Adr[] = []
  // Numbers are per list: the landscape's own run from 1, and so does each
  // application's, which is the rule `decisions/adr.ts` enforces.
  const nextNumber = new Map<string, number>()
  for (let n = 0; n < spec.decisions; n++) {
    const applicationId = n % 3 === 0 && applications.length > 0
      ? applications[(n * 7) % applications.length]
      : undefined
    const list = applicationId ?? 'landscape'
    const number = (nextNumber.get(list) ?? 0) + 1
    nextNumber.set(list, number)
    out.push({
      id: `adr-${String(n + 1).padStart(4, '0')}`,
      number,
      title: `${pick(rng, VERBS)} the ${pick(rng, PARTS)} ${pick(rng, QUALIFIERS)}`,
      status: pick(rng, STATUSES),
      date: `2026-0${between(rng, 1, 9)}-1${between(rng, 0, 9)}`,
      body: markdown(rng, 1200, 'Context and Problem Statement'),
      applicationId,
      signers: [{ name: pick(rng, PEOPLE), role: pick(rng, TEAMS), verdict: 'approved' }],
    })
  }
  return out
}

// --- the word bank -----------------------------------------------------------
//
// Generic architecture vocabulary and invented names. Nothing here comes from
// anybody's landscape; see the note at the top of the file.

const LIFECYCLES = ['planned', 'live', 'live', 'live', 'retiring', 'retired'] as const
const ASPECTS = ['platform', 'cicd', 'dr', 'security', 'monitoring', 'backup', 'compliance', 'cost']
const ASPECT_STATUSES = ['managed', 'partial', 'none', 'atRisk'] as const
const STATUSES: readonly AdrStatus[] = ['proposed', 'reviewing', 'accepted', 'rejected', 'superseded']

const DOMAINS = [
  'billing', 'invoicing', 'warehouse', 'dispatch', 'catalogue', 'pricing', 'identity',
  'onboarding', 'settlement', 'reconciliation', 'scheduling', 'telemetry', 'archive',
  'reporting', 'procurement', 'fulfilment', 'returns', 'contracts', 'payroll', 'ledger',
]
const PARTS = [
  'gateway', 'service', 'store', 'queue', 'index', 'cache', 'workflow', 'register', 'adapter',
  'importer', 'exporter', 'scheduler', 'portal', 'console', 'ledger', 'router',
]
const COMPONENT_WORDS = ['Request', 'Batch', 'Event', 'Command', 'Query', 'Rule', 'Policy', 'Audit']
const VERBS = ['publishes', 'consumes', 'reconciles', 'validates', 'enriches', 'archives', 'replays']
const QUALIFIERS = ['nightly', 'on demand', 'per tenant', 'in order', 'once settled', 'per region']
const HEADINGS = ['Context', 'Decision', 'Consequences', 'Interfaces', 'Operations', 'Data']
const CATEGORIES = ['Order to cash', 'Plan to produce', 'Hire to retire', 'Record to report', 'Source to pay']
const VENDORS = ['Kestrel', 'Marlow', 'Ardent', 'Brightwater', 'Calder', 'Dunmore', 'in-house']
const TECHNOLOGIES = ['Java', 'TypeScript', 'Go', 'Python', 'C#', 'Kotlin', 'SQL']
const PROTOCOLS = ['REST', 'AMQP', 'SFTP', 'gRPC', 'JDBC', 'SOAP', 'Kafka']
const TEAMS = ['Platform', 'Integration', 'Data', 'Security', 'Operations', 'Architecture']
const PEOPLE = ['A. Vance', 'B. Okoro', 'C. Lindqvist', 'D. Moreau', 'E. Tanaka', 'F. Alarcon']
const COLORS = ['#4f6d7a', '#c0d6df', '#dbe9ee', '#8d99ae', '#a3b18a']

function nameFor(rng: Rng, kind: DesignElement['kind'], n: number): string {
  const domain = DOMAINS[(n - 1) % DOMAINS.length]
  const part = PARTS[(n - 1) % PARTS.length]
  const capital = domain[0].toUpperCase() + domain.slice(1)
  switch (kind) {
    case 'actor':
      return `${pick(rng, TEAMS)} ${n}`
    case 'inputChannel':
      return `${capital} channel ${n}`
    case 'externalSystem':
      return `${pick(rng, VENDORS)} ${part} ${n}`
    case 'managementTool':
      return `${capital} console ${n}`
    default:
      return `${capital} ${part} ${n}`
  }
}

function groupNames(count: number): string[] {
  return Array.from({ length: count }, (_, n) => {
    const domain = DOMAINS[n % DOMAINS.length]
    const capital = domain[0].toUpperCase() + domain.slice(1)
    return n < DOMAINS.length ? capital : `${capital} ${Math.floor(n / DOMAINS.length) + 1}`
  })
}
