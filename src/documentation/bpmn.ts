/**
 * A ```bpmn fence, read (ADR-0012 §4, §7; plan step 14).
 *
 * A process's page holds its BPMN as a fence, the way a plan's page holds its
 * business case: stored as markdown, drawn by a renderer. This file is the
 * reading half — BPMN 2.0 XML in, a **drawing** out: shapes with the
 * coordinates the file's own diagram interchange gives them, and edges with
 * their waypoints. Nothing is laid out here: a BPMN file without a
 * `BPMNDiagram` section has no positions, and the honest answer is a refusal
 * that shows the source, not a layout engine guessing one.
 *
 * Pure, and tested in node, which is why it carries a small XML reader of its
 * own rather than a `DOMParser`: the browser's parser lives on `window`, the
 * rule of the house keeps `document.` behind an adapter, and what a BPMN file
 * needs is elements, attributes and nesting — a hundred lines, not a
 * dependency. Namespaces are read by local name (`bpmn:task` is a `task`),
 * because every tool prefixes them differently and none of them means
 * anything different by it.
 *
 * What is read is the core of the notation as the common tools write it —
 * pools and lanes, the task kinds, events by position and trigger, the
 * gateway kinds, sequence and message flows, data objects, annotations,
 * groups. A shape the reader does not know is still drawn, as a box with its
 * name: a document from a later tool must degrade to something rather than
 * to nothing, the same rule `blocks.tsx` applies to a fence it cannot draw.
 */

// --- a small XML reader --------------------------------------------------------------

export type XmlNode = {
  /** The local name: `task` for `bpmn:task`. */
  name: string
  attributes: Record<string, string>
  children: XmlNode[]
  /** The element's own text, trimmed; children's text is theirs. */
  text: string
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }

function unescape(value: string): string {
  return value.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (whole, code: string) => {
    if (code.startsWith('#x')) return String.fromCodePoint(parseInt(code.slice(2), 16))
    if (code.startsWith('#')) return String.fromCodePoint(parseInt(code.slice(1), 10))
    return ENTITIES[code] ?? whole
  })
}

const localName = (qualified: string) => qualified.slice(qualified.indexOf(':') + 1)

/**
 * The root element of a document, or nothing where the text is not one: an
 * unclosed tag, a close that matches no open, text where an element should be.
 */
export function readXml(source: string): XmlNode | undefined {
  const stack: XmlNode[] = []
  let root: XmlNode | undefined
  let at = 0
  const text = (chunk: string) => {
    const top = stack[stack.length - 1]
    if (top && chunk.trim()) top.text = (top.text ? `${top.text} ` : '') + unescape(chunk.trim())
  }
  while (at < source.length) {
    const open = source.indexOf('<', at)
    if (open === -1) { text(source.slice(at)); break }
    text(source.slice(at, open))
    if (source.startsWith('<?', open)) {
      const end = source.indexOf('?>', open)
      if (end === -1) return undefined
      at = end + 2
    } else if (source.startsWith('<!--', open)) {
      const end = source.indexOf('-->', open)
      if (end === -1) return undefined
      at = end + 3
    } else if (source.startsWith('<![CDATA[', open)) {
      const end = source.indexOf(']]>', open)
      if (end === -1) return undefined
      const top = stack[stack.length - 1]
      if (top) top.text = (top.text ? `${top.text} ` : '') + source.slice(open + 9, end).trim()
      at = end + 3
    } else if (source.startsWith('<!', open)) {
      // A doctype or the like: skipped whole.
      const end = source.indexOf('>', open)
      if (end === -1) return undefined
      at = end + 1
    } else if (source.startsWith('</', open)) {
      const end = source.indexOf('>', open)
      if (end === -1) return undefined
      const name = localName(source.slice(open + 2, end).trim())
      const top = stack.pop()
      if (!top || top.name !== name) return undefined
      at = end + 1
    } else {
      const end = tagEnd(source, open)
      if (end === -1) return undefined
      const selfClosing = source[end - 1] === '/'
      const inside = source.slice(open + 1, selfClosing ? end - 1 : end)
      const node = readTag(inside)
      if (!node) return undefined
      const top = stack[stack.length - 1]
      if (top) top.children.push(node)
      else if (root) return undefined
      else root = node
      if (!selfClosing) stack.push(node)
      at = end + 1
    }
  }
  return stack.length === 0 ? root : undefined
}

/** Where a tag ends, honouring `>` inside a quoted attribute. */
function tagEnd(source: string, open: number): number {
  let quote: string | undefined
  for (let i = open + 1; i < source.length; i++) {
    const char = source[i]
    if (quote) { if (char === quote) quote = undefined; continue }
    if (char === '"' || char === "'") quote = char
    else if (char === '>') return i
  }
  return -1
}

function readTag(inside: string): XmlNode | undefined {
  const match = /^\s*([^\s/>]+)\s*/.exec(inside)
  if (!match) return undefined
  const attributes: Record<string, string> = {}
  const rest = inside.slice(match[0].length)
  const pattern = /([^\s=]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g
  for (let found = pattern.exec(rest); found; found = pattern.exec(rest)) {
    attributes[localName(found[1])] = unescape(found[2] ?? found[3] ?? '')
  }
  return { name: localName(match[1]), attributes, children: [], text: '' }
}

/** Every element under a node, depth first, the node included. */
function walk(node: XmlNode, into: XmlNode[] = []): XmlNode[] {
  into.push(node)
  for (const child of node.children) walk(child, into)
  return into
}

// --- what a drawing is made of ------------------------------------------------------

export type Bounds = { x: number; y: number; width: number; height: number }
export type Point = { x: number; y: number }

export type ShapeKind =
  | 'participant' | 'lane' | 'group'
  | 'task' | 'subProcess'
  | 'event' | 'gateway'
  | 'dataObject' | 'dataStore' | 'annotation'
  | 'unknown'

export type TaskType =
  | 'task' | 'userTask' | 'serviceTask' | 'scriptTask' | 'manualTask' | 'sendTask' | 'receiveTask'
  | 'businessRuleTask' | 'callActivity'
export type EventPosition = 'start' | 'end' | 'intermediate' | 'boundary'
export type EventTrigger = 'message' | 'timer' | 'error' | 'signal' | 'terminate' | 'conditional' | 'escalation' | 'none'
export type GatewayType = 'exclusive' | 'parallel' | 'inclusive' | 'eventBased' | 'complex'

export type Shape = {
  id: string
  kind: ShapeKind
  name?: string
  bounds: Bounds
  /** Where the file puts the label, when it says. */
  label?: Bounds
  taskType?: TaskType
  /** A sub-process drawn open, with its contents; absent is a collapsed box with a `+`. */
  expanded?: boolean
  eventPosition?: EventPosition
  eventTrigger?: EventTrigger
  /** A throwing intermediate or an end event: the trigger is drawn filled. */
  throwing?: boolean
  gatewayType?: GatewayType
  /** A pool or lane written top to bottom rather than left to right. */
  vertical?: boolean
}

export type EdgeKind = 'sequence' | 'message' | 'association' | 'dataAssociation'

export type Edge = {
  id: string
  kind: EdgeKind
  name?: string
  waypoints: Point[]
  label?: Bounds
  /** The gateway's default path: a slash at the start. */
  isDefault?: boolean
  /** A sequence flow with a condition on it: a small diamond at the start. */
  conditional?: boolean
  /** A data association drawn with an arrow; an ordinary association is drawn without. */
  directed?: boolean
}

export type BpmnDrawing = {
  /** Pools and lanes first, then groups, then everything else: the order they are painted in. */
  shapes: Shape[]
  edges: Edge[]
  /** Around everything, label boxes and waypoints included. */
  bounds: Bounds
}

export type BpmnRefusal =
  /** Not a BPMN document: no `definitions` at the root. */
  | 'bpmn.notBpmn'
  /** The XML does not parse. */
  | 'bpmn.malformed'
  /** BPMN without diagram interchange: nothing says where anything goes. */
  | 'bpmn.noDiagram'

export type BpmnReading = { ok: true; drawing: BpmnDrawing } | { ok: false; refusal: BpmnRefusal }

const TASK_TYPES: readonly TaskType[] = [
  'task', 'userTask', 'serviceTask', 'scriptTask', 'manualTask', 'sendTask', 'receiveTask',
  'businessRuleTask', 'callActivity',
]
const SUB_PROCESSES = ['subProcess', 'adHocSubProcess', 'transaction']
const GATEWAYS: Record<string, GatewayType> = {
  exclusiveGateway: 'exclusive', parallelGateway: 'parallel', inclusiveGateway: 'inclusive',
  eventBasedGateway: 'eventBased', complexGateway: 'complex',
}
const EVENTS: Record<string, { position: EventPosition; throwing: boolean }> = {
  startEvent: { position: 'start', throwing: false },
  endEvent: { position: 'end', throwing: true },
  intermediateCatchEvent: { position: 'intermediate', throwing: false },
  intermediateThrowEvent: { position: 'intermediate', throwing: true },
  boundaryEvent: { position: 'boundary', throwing: false },
}
const TRIGGERS: Record<string, EventTrigger> = {
  messageEventDefinition: 'message', timerEventDefinition: 'timer', errorEventDefinition: 'error',
  signalEventDefinition: 'signal', terminateEventDefinition: 'terminate',
  conditionalEventDefinition: 'conditional', escalationEventDefinition: 'escalation',
}

const number = (value: string | undefined) => {
  const held = Number(value)
  return Number.isFinite(held) ? held : 0
}

function boundsOf(node: XmlNode | undefined): Bounds | undefined {
  if (!node) return undefined
  const { x, y, width, height } = node.attributes
  if (x === undefined || y === undefined) return undefined
  return { x: number(x), y: number(y), width: number(width), height: number(height) }
}

export function readBpmn(source: string): BpmnReading {
  const root = readXml(source)
  if (!root) return { ok: false, refusal: 'bpmn.malformed' }
  if (root.name !== 'definitions') return { ok: false, refusal: 'bpmn.notBpmn' }

  // Every semantic element by id, from the process and collaboration trees —
  // and not from the DI, which names them.
  const byId = new Map<string, XmlNode>()
  const diagrams: XmlNode[] = []
  for (const child of root.children) {
    if (child.name === 'BPMNDiagram') diagrams.push(child)
    else for (const node of walk(child)) if (node.attributes.id) byId.set(node.attributes.id, node)
  }
  /** Which gateway names which flow as its default: read once, off the source. */
  const defaults = new Set<string>()
  for (const node of byId.values()) if (node.attributes.default) defaults.add(node.attributes.default)

  const shapes: Shape[] = []
  const edges: Edge[] = []
  for (const diagram of diagrams) {
    for (const node of walk(diagram)) {
      if (node.name === 'BPMNShape') {
        const shape = shapeOf(node, byId.get(node.attributes.bpmnElement))
        if (shape) shapes.push(shape)
      }
      if (node.name === 'BPMNEdge') {
        const edge = edgeOf(node, byId.get(node.attributes.bpmnElement), defaults)
        if (edge) edges.push(edge)
      }
    }
  }
  if (shapes.length === 0) return { ok: false, refusal: 'bpmn.noDiagram' }

  // Painted back to front: a pool under its lanes, lanes under the boxes on
  // them, groups over pools and under boxes.
  const rank: Record<ShapeKind, number> = {
    participant: 0, lane: 1, group: 2, subProcess: 3, task: 4, event: 4, gateway: 4,
    dataObject: 4, dataStore: 4, annotation: 4, unknown: 4,
  }
  shapes.sort((a, b) => rank[a.kind] - rank[b.kind]
    || (a.kind === 'subProcess' && b.kind === 'subProcess' ? b.bounds.width * b.bounds.height - a.bounds.width * a.bounds.height : 0))

  return { ok: true, drawing: { shapes, edges, bounds: around(shapes, edges) } }
}

function shapeOf(di: XmlNode, element: XmlNode | undefined): Shape | undefined {
  const bounds = boundsOf(di.children.find((child) => child.name === 'Bounds'))
  if (!bounds) return undefined
  const id = di.attributes.bpmnElement ?? di.attributes.id
  const label = boundsOf(di.children.find((child) => child.name === 'BPMNLabel')?.children.find((child) => child.name === 'Bounds'))
  const base: Shape = { id, kind: 'unknown', bounds, ...(label ? { label } : {}) }
  const name = element?.attributes.name?.trim() || (element?.name === 'textAnnotation' ? element.children.find((child) => child.name === 'text')?.text : undefined)
  if (name) base.name = name
  if (!element) return base
  const type = element.name
  if (type === 'participant' || type === 'lane') {
    return { ...base, kind: type, ...(di.attributes.isHorizontal === 'false' ? { vertical: true } : {}) }
  }
  if (type === 'group') return { ...base, kind: 'group' }
  if ((TASK_TYPES as readonly string[]).includes(type)) return { ...base, kind: 'task', taskType: type as TaskType }
  if (SUB_PROCESSES.includes(type)) {
    return { ...base, kind: 'subProcess', ...(di.attributes.isExpanded === 'true' ? { expanded: true } : {}) }
  }
  if (type in GATEWAYS) return { ...base, kind: 'gateway', gatewayType: GATEWAYS[type] }
  if (type in EVENTS) {
    const { position, throwing } = EVENTS[type]
    const definition = element.children.find((child) => child.name in TRIGGERS)
    return {
      ...base, kind: 'event', eventPosition: position,
      eventTrigger: definition ? TRIGGERS[definition.name] : 'none',
      ...(throwing ? { throwing: true } : {}),
    }
  }
  if (type === 'dataObjectReference' || type === 'dataObject' || type === 'dataInput' || type === 'dataOutput') {
    return { ...base, kind: 'dataObject' }
  }
  if (type === 'dataStoreReference' || type === 'dataStore') return { ...base, kind: 'dataStore' }
  if (type === 'textAnnotation') return { ...base, kind: 'annotation' }
  return base
}

function edgeOf(di: XmlNode, element: XmlNode | undefined, defaults: ReadonlySet<string>): Edge | undefined {
  const waypoints = di.children
    .filter((child) => child.name === 'waypoint')
    .map((child) => ({ x: number(child.attributes.x), y: number(child.attributes.y) }))
  if (waypoints.length < 2) return undefined
  const id = di.attributes.bpmnElement ?? di.attributes.id
  const label = boundsOf(di.children.find((child) => child.name === 'BPMNLabel')?.children.find((child) => child.name === 'Bounds'))
  const type = element?.name
  const kind: EdgeKind = type === 'messageFlow' ? 'message'
    : type === 'association' ? 'association'
      : type === 'dataInputAssociation' || type === 'dataOutputAssociation' ? 'dataAssociation'
        : 'sequence'
  const name = element?.attributes.name?.trim()
  return {
    id, kind, waypoints,
    ...(name ? { name } : {}),
    ...(label ? { label } : {}),
    ...(kind === 'sequence' && defaults.has(id) ? { isDefault: true } : {}),
    ...(kind === 'sequence' && element?.children.some((child) => child.name === 'conditionExpression') ? { conditional: true } : {}),
    ...(kind === 'dataAssociation' || (kind === 'association' && element?.attributes.associationDirection && element.attributes.associationDirection !== 'None')
      ? { directed: true } : {}),
  }
}

function around(shapes: readonly Shape[], edges: readonly Edge[]): Bounds {
  let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity
  const take = (box: Bounds) => {
    minX = Math.min(minX, box.x); minY = Math.min(minY, box.y)
    maxX = Math.max(maxX, box.x + box.width); maxY = Math.max(maxY, box.y + box.height)
  }
  for (const shape of shapes) { take(shape.bounds); if (shape.label) take(shape.label) }
  for (const edge of edges) {
    for (const point of edge.waypoints) take({ ...point, width: 0, height: 0 })
    if (edge.label) take(edge.label)
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

/**
 * A label broken into lines that fit a width, by a plain estimate of how
 * wide a character is: an SVG has no layout engine to ask, and a task's name
 * is a few words. A word longer than the line is kept whole and overflows,
 * which is better than cutting it.
 */
export function wrapLabel(text: string, width: number, charWidth = 6.4): string[] {
  const perLine = Math.max(1, Math.floor(width / charWidth))
  const lines: string[] = []
  for (const paragraph of text.split(/\r?\n/)) {
    let line = ''
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      if (!line) line = word
      else if (line.length + 1 + word.length <= perLine) line = `${line} ${word}`
      else { lines.push(line); line = word }
    }
    lines.push(line)
  }
  return lines.filter((line, index) => line || index === 0)
}

/** The fence's name in a document, as `blocks.tsx` lists it. */
export const BPMN_FENCE = 'bpmn'
