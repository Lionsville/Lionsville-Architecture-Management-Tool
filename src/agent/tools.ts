/**
 * The agent's vocabulary (ADR-0007): what a coding agent beside the app may
 * ask, and the shape of every ask and every answer.
 *
 * One file, compiled against by both ends. The electron main process registers
 * these tools with whoever connects and relays each call; the renderer answers
 * them against the live session. Because the two share this file they cannot
 * drift, which is the same trick `adapters/desktop/channel.ts` plays for files.
 *
 * **This is a protocol contract, not copy.** The descriptions and the refusal
 * sentences below are English constants, deliberately outside `i18n`: a machine
 * reads them, in the language every MCP client speaks, the way the interchange
 * format's field names are English. It is the one exception to "UI strings are
 * never inline", and the record says it should stay the only one of its kind.
 *
 * **A tool name is published surface.** Renaming one breaks somebody's agent
 * configuration, so the names here are chosen once and listed in `CLAUDE.md`
 * under *Names, decided*.
 *
 * The input schemas are JSON Schema by hand rather than through a library, for
 * two reasons: the desktop ships no runtime dependency it can avoid, and a
 * schema written here is what {@link checkArguments} validates against, so the
 * description a client sees and the check its call meets are the same object.
 */
import type { CommandRefusal } from '../model/reducer'

export type ToolTier = 'read' | 'write' | 'see'

/** One argument, as JSON Schema says it and as {@link checkArguments} checks it. */
export type ArgumentSchema =
  | { readonly type: 'string'; readonly description: string; readonly enum?: readonly string[] }
  | { readonly type: 'integer'; readonly description: string; readonly minimum?: number; readonly maximum?: number }
  | { readonly type: 'number'; readonly description: string }
  | { readonly type: 'boolean'; readonly description: string }
  | { readonly type: 'array'; readonly description: string; readonly items: { readonly type: 'string' } }

export type InputSchema = {
  readonly type: 'object'
  readonly properties: Readonly<Record<string, ArgumentSchema>>
  readonly required?: readonly string[]
  readonly additionalProperties: false
}

export type ToolSpec = {
  readonly name: ToolName
  readonly tier: ToolTier
  readonly description: string
  readonly inputSchema: InputSchema
}

const NO_ARGUMENTS: InputSchema = { type: 'object', properties: {}, additionalProperties: false }

const ID = (what: string): ArgumentSchema => ({ type: 'string', description: `The id of the ${what}.` })

const KINDS = ['actor', 'application', 'externalSystem', 'inputChannel', 'managementTool', 'component'] as const
const LIFECYCLES = ['planned', 'live', 'retiring', 'retired'] as const
const ZONES = ['actors', 'inputChannels', 'externalSystems', 'landscape', 'management'] as const
const LINE_STYLES = ['solid', 'dashed', 'dotted'] as const

/** How a line is drawn. Absent means the theme's own stroke and a solid line. */
const LINE_FIELDS = {
  color: { type: 'string', description: 'The stroke, as a hex colour like #c0392b. The theme\'s own when absent.' },
  lineStyle: { type: 'string', description: 'Solid, dashed or dotted. Solid when absent.', enum: LINE_STYLES },
} as const satisfies Record<string, ArgumentSchema>

/** The fields of an element an agent may set. Description is markdown, the element's page. */
const ELEMENT_FIELDS = {
  name: { type: 'string', description: 'The name.' },
  description: { type: 'string', description: 'The documentation, as markdown. The first paragraph is drawn on the card.' },
  category: { type: 'string', description: 'A business category or capability.' },
  vendor: { type: 'string', description: 'Who makes it.' },
  technology: { type: 'string', description: 'What it is built on.' },
  lifecycle: { type: 'string', description: 'Where it is in its life.', enum: LIFECYCLES },
  isManaged: { type: 'boolean', description: 'Whether the organisation manages it itself.' },
} as const satisfies Record<string, ArgumentSchema>

/**
 * Three tiers, in the order they earn their keep: read, write, see.
 *
 * Written as a tuple literal so {@link ToolName} is derived from it rather than
 * listed twice. The order is the order a client lists them in, which is why the
 * orientation tool comes first.
 */
export const TOOLS = [
  {
    name: 'project.current',
    tier: 'read',
    description:
      'The project that is open: its name, the group it is filed under, its description, '
      + 'how many elements, connections, diagrams and decisions it holds, and which diagram is on screen.',
    inputSchema: NO_ARGUMENTS,
  },
  {
    name: 'elements.list',
    tier: 'read',
    description:
      'The elements of the landscape, one line each: id, name, kind, lifecycle and the '
      + 'category, vendor and technology where set. Filter by kind, by the diagram they are '
      + 'drawn on, or by a free-text query over name, category, vendor and technology.',
    inputSchema: {
      type: 'object',
      properties: {
        kind: {
          type: 'string',
          description: 'Only elements of this kind.',
          enum: ['actor', 'application', 'externalSystem', 'inputChannel', 'managementTool', 'component'],
        },
        diagramId: { type: 'string', description: 'Only elements drawn on this diagram.' },
        query: { type: 'string', description: 'Only elements whose name, category, vendor or technology contains every word.' },
        limit: { type: 'integer', description: 'At most this many. Default 200.', minimum: 1, maximum: 2000 },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'element.describe',
    tier: 'read',
    description:
      'Everything about one element: its fields, its documentation as markdown, the '
      + 'connections that end on it, where it is drawn on each diagram, and the decisions recorded about it.',
    inputSchema: { type: 'object', properties: { id: ID('element') }, required: ['id'], additionalProperties: false },
  },
  {
    name: 'connections.list',
    tier: 'read',
    description:
      'The connections between elements: id, source, target, label and protocol. '
      + 'Filter to those ending on one element, or to those drawn on one diagram.',
    inputSchema: {
      type: 'object',
      properties: {
        elementId: { type: 'string', description: 'Only connections that start or end on this element.' },
        diagramId: { type: 'string', description: 'Only connections whose both ends are drawn on this diagram.' },
        limit: { type: 'integer', description: 'At most this many. Default 500.', minimum: 1, maximum: 5000 },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'diagrams.list',
    tier: 'read',
    description:
      'The diagrams of the project: id, name, kind (a layer-7 landscape or a C4 container view), '
      + 'which application a container view is about, and how many elements each draws.',
    inputSchema: NO_ARGUMENTS,
  },
  {
    name: 'decisions.list',
    tier: 'read',
    description:
      'The architecture decision records: id, number, title, status and date. Three scopes: '
      + 'the group the project is filed under, the landscape, and each application.',
    inputSchema: {
      type: 'object',
      properties: {
        scope: { type: 'string', description: 'Only records of this scope.', enum: ['group', 'landscape', 'application'] },
        applicationId: { type: 'string', description: 'Only records about this application.' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'decision.read',
    tier: 'read',
    description: 'One decision record in full: its fields, its signers, and its body as MADR markdown.',
    inputSchema: { type: 'object', properties: { id: ID('decision record') }, required: ['id'], additionalProperties: false },
  },
  {
    name: 'search',
    tier: 'read',
    description:
      'Search elements, their documentation and the decision records together, the way ⌘K does in the app. '
      + 'Every word of the query must occur; case and accents do not matter.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'What to look for.' },
        limit: { type: 'integer', description: 'At most this many hits per kind. Default 8.', minimum: 1, maximum: 100 },
      },
      required: ['query'],
      additionalProperties: false,
    },
  },

  // --- the write tier: one command each, one undo step, one Activity line ------
  {
    name: 'element.add',
    tier: 'write',
    description:
      'Add an element to the landscape and draw it on a diagram (the one on screen unless said otherwise). '
      + 'It gets the id the file would give it, derived from the name, and lands in its kind\'s own band '
      + 'unless a zone or a spot is named. Answers with the id.',
    inputSchema: {
      type: 'object',
      properties: {
        name: ELEMENT_FIELDS.name,
        kind: { type: 'string', description: 'What kind of element. Default application.', enum: KINDS },
        description: ELEMENT_FIELDS.description,
        category: ELEMENT_FIELDS.category,
        vendor: ELEMENT_FIELDS.vendor,
        technology: ELEMENT_FIELDS.technology,
        lifecycle: ELEMENT_FIELDS.lifecycle,
        parentApplicationId: { type: 'string', description: 'For a component: the application it is part of.' },
        diagramId: { type: 'string', description: 'The diagram to draw it on. Default: the one on screen.' },
        zone: { type: 'string', description: 'On a landscape: the band to draw it in. Default: the kind\'s own.', enum: ZONES },
        domainGroup: { type: 'string', description: 'On a landscape: the domain group to file it under.' },
        x: { type: 'number', description: 'Where to draw it, in flow coordinates. Prefer placeNextTo over guessing.' },
        y: { type: 'number', description: 'Where to draw it, in flow coordinates.' },
      },
      required: ['name'],
      additionalProperties: false,
    },
  },
  {
    name: 'element.update',
    tier: 'write',
    description: 'Change an element\'s fields. Only the fields given change; the rest stay as they are.',
    inputSchema: {
      type: 'object',
      properties: { id: ID('element'), ...ELEMENT_FIELDS },
      required: ['id'],
      additionalProperties: false,
    },
  },
  {
    name: 'element.remove',
    tier: 'write',
    description:
      'Remove an element from the landscape, with every connection that ends on it, its place on every '
      + 'diagram, and any container view about it. One undo step puts all of it back.',
    inputSchema: { type: 'object', properties: { id: ID('element') }, required: ['id'], additionalProperties: false },
  },
  {
    name: 'connect',
    tier: 'write',
    description: 'Draw a connection from one element to another. Answers with the connection\'s id.',
    inputSchema: {
      type: 'object',
      properties: {
        sourceId: ID('element the connection starts at'),
        targetId: ID('element it ends at'),
        label: { type: 'string', description: 'What flows, in a few words.' },
        protocol: { type: 'string', description: 'How: REST, AMQP, SFTP, a file drop.' },
        isBidirectional: { type: 'boolean', description: 'Whether it flows both ways. Default false.' },
        ...LINE_FIELDS,
      },
      required: ['sourceId', 'targetId'],
      additionalProperties: false,
    },
  },
  {
    name: 'connection.update',
    tier: 'write',
    description:
      'Change a connection\'s label, protocol, direction, colour or line style. Colour a line by what '
      + 'flows over it and a busy board reads again; "solid" and an empty colour give the theme back its line.',
    inputSchema: {
      type: 'object',
      properties: {
        id: ID('connection'),
        label: { type: 'string', description: 'What flows, in a few words.' },
        protocol: { type: 'string', description: 'How: REST, AMQP, SFTP, a file drop.' },
        isBidirectional: { type: 'boolean', description: 'Whether it flows both ways.' },
        ...LINE_FIELDS,
      },
      required: ['id'],
      additionalProperties: false,
    },
  },
  {
    name: 'connection.remove',
    tier: 'write',
    description: 'Cut a connection, and its route on every diagram.',
    inputSchema: { type: 'object', properties: { id: ID('connection') }, required: ['id'], additionalProperties: false },
  },
  {
    name: 'decision.propose',
    tier: 'write',
    description:
      'Add an architecture decision record in the proposed state, numbered after the last one in its list: '
      + 'the landscape\'s, or one application\'s. The body is MADR markdown; leave it out for the template. '
      + 'Answers with the id and the number.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'What was decided, as a title.' },
        body: { type: 'string', description: 'The record as MADR markdown. Title, status, date and signers are fields, not text.' },
        applicationId: { type: 'string', description: 'The application the decision is about. Absent: the landscape.' },
      },
      required: ['title'],
      additionalProperties: false,
    },
  },
  {
    name: 'decision.transition',
    tier: 'write',
    description:
      'Move a decision record to its next status: proposed → reviewing → accepted or rejected, '
      + 'accepted → superseded (naming the successor). Accepted, rejected and superseded records are locked.',
    inputSchema: {
      type: 'object',
      properties: {
        id: ID('decision record'),
        status: { type: 'string', description: 'The status to move to.', enum: ['proposed', 'reviewing', 'accepted', 'rejected', 'superseded'] },
        supersededBy: { type: 'string', description: 'For superseded: the id of the record that replaces it.' },
      },
      required: ['id', 'status'],
      additionalProperties: false,
    },
  },
  {
    name: 'diagram.create',
    tier: 'write',
    description:
      'Add a diagram and switch to it: a new landscape by name, or a C4 container view of one application, '
      + 'seeded with its components and laid out on first open. Answers with the id.',
    inputSchema: {
      type: 'object',
      properties: {
        kind: { type: 'string', description: 'A layer-7 landscape or a container view.', enum: ['layer7', 'container'] },
        name: { type: 'string', description: 'For a landscape: its name.' },
        applicationId: { type: 'string', description: 'For a container view: the application it is about.' },
      },
      required: ['kind'],
      additionalProperties: false,
    },
  },

  // --- the see tier: structure first, then pixels, then relational placement ------
  {
    name: 'diagram.inspect',
    tier: 'see',
    description:
      'A layout report on a diagram, in geometry rather than pixels: the box around everything, '
      + 'cards that overlap and by how much, lines that cut through a card, cards drawn in another band '
      + 'than they are filed in, group members outside their group, cards off the board, cards nothing '
      + 'connects to, and how full each band is. Lists are capped; totals are whole. Read this before '
      + 'and after moving anything.',
    inputSchema: {
      type: 'object',
      properties: {
        diagramId: { type: 'string', description: 'The diagram. Default: the one on screen.' },
        limit: { type: 'integer', description: 'How many of each finding to list. Default 40.', minimum: 1, maximum: 500 },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'diagram.render',
    tier: 'see',
    description:
      'A picture of a diagram as the app draws it, as a PNG, with the transform it was drawn with so a '
      + 'pixel maps back to a flow coordinate. Crop to some elements or to a region: a whole landscape '
      + 'within the pixel budget is a thumbnail. Switches the app to that diagram; the window must be visible.',
    inputSchema: {
      type: 'object',
      properties: {
        diagramId: { type: 'string', description: 'The diagram. Default: the one on screen.' },
        elementIds: { type: 'array', description: 'Crop to these elements and their surroundings.', items: { type: 'string' } },
        x: { type: 'number', description: 'Crop to a region: its left, in flow coordinates.' },
        y: { type: 'number', description: 'Crop to a region: its top.' },
        width: { type: 'number', description: 'Crop to a region: its width.' },
        height: { type: 'number', description: 'Crop to a region: its height.' },
        maxPixels: { type: 'integer', description: 'The most image pixels to hand over. Default 4,000,000.', minimum: 10000, maximum: 16000000 },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'diagram.tidy',
    tier: 'see',
    description:
      'Lay a diagram out, as the Tidy button does: the app\'s layout engine places every card and routes '
      + 'every line. One undo step. Refuses a board over the cap. Answers with the layout report afterwards.',
    inputSchema: {
      type: 'object',
      properties: { diagramId: { type: 'string', description: 'The diagram. Default: the one on screen.' } },
      additionalProperties: false,
    },
  },
  {
    name: 'diagram.route',
    tier: 'see',
    description:
      'Route the lines of a diagram around its cards without moving any card, as the Route button does. '
      + 'Hand-drawn and pinned routes are kept. One undo step. Answers with the layout report afterwards.',
    inputSchema: {
      type: 'object',
      properties: { diagramId: { type: 'string', description: 'The diagram. Default: the one on screen.' } },
      additionalProperties: false,
    },
  },
  {
    name: 'focus',
    tier: 'see',
    description:
      'Point at an element: select it in the app and bring it into view, switching diagram if it is drawn '
      + 'elsewhere, so the person sees which one you mean.',
    inputSchema: {
      type: 'object',
      properties: { elementId: ID('element') },
      required: ['elementId'],
      additionalProperties: false,
    },
  },
  {
    name: 'moveBy',
    tier: 'see',
    description: 'Nudge elements on a diagram by a distance, in flow coordinates. One undo step.',
    inputSchema: {
      type: 'object',
      properties: {
        elementIds: { type: 'array', description: 'Which elements.', items: { type: 'string' } },
        dx: { type: 'number', description: 'Right is positive.' },
        dy: { type: 'number', description: 'Down is positive.' },
        diagramId: { type: 'string', description: 'The diagram. Default: the one on screen.' },
      },
      required: ['elementIds', 'dx', 'dy'],
      additionalProperties: false,
    },
  },
  {
    name: 'placeNextTo',
    tier: 'see',
    description:
      'Put an element beside another one on a diagram — to its right, left, above or below — with a gap, '
      + 'in the same band and domain group. The way to place something without inventing a coordinate.',
    inputSchema: {
      type: 'object',
      properties: {
        elementId: ID('element to move'),
        anchorId: ID('element to put it beside'),
        side: { type: 'string', description: 'Which side of the anchor. Default right.', enum: ['right', 'left', 'above', 'below'] },
        gap: { type: 'number', description: 'Space between them in flow pixels. Default 40.' },
        diagramId: { type: 'string', description: 'The diagram. Default: the one on screen.' },
      },
      required: ['elementId', 'anchorId'],
      additionalProperties: false,
    },
  },
  {
    name: 'group',
    tier: 'see',
    description:
      'File elements under a domain group on a landscape and draw its box: a new box hugs the members, '
      + 'an existing one grows to take them in and keeps its place. Only cards in the landscape band group. '
      + 'Name an existing group with no elements to recolour its box. One undo step.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'The group. Its name is its key: the same name is the same box.' },
        elementIds: { type: 'array', description: 'The elements to file under it.', items: { type: 'string' } },
        color: { type: 'string', description: 'The box\'s tint, as a hex colour like #2e86c1. The theme\'s neutral when absent.' },
        diagramId: { type: 'string', description: 'The landscape. Default: the one on screen.' },
      },
      required: ['name'],
      additionalProperties: false,
    },
  },
  {
    name: 'align',
    tier: 'see',
    description: 'Align two or more elements to a shared edge or centre line of their bounding box.',
    inputSchema: {
      type: 'object',
      properties: {
        elementIds: { type: 'array', description: 'Which elements; at least two.', items: { type: 'string' } },
        axis: { type: 'string', description: 'The edge or centre to align to.', enum: ['left', 'centerX', 'right', 'top', 'centerY', 'bottom'] },
        diagramId: { type: 'string', description: 'The diagram. Default: the one on screen.' },
      },
      required: ['elementIds', 'axis'],
      additionalProperties: false,
    },
  },
  {
    name: 'distribute',
    tier: 'see',
    description: 'Space three or more elements evenly along an axis, keeping the first and last where they are.',
    inputSchema: {
      type: 'object',
      properties: {
        elementIds: { type: 'array', description: 'Which elements; at least three.', items: { type: 'string' } },
        axis: { type: 'string', description: 'Along which axis.', enum: ['horizontal', 'vertical'] },
        diagramId: { type: 'string', description: 'The diagram. Default: the one on screen.' },
      },
      required: ['elementIds', 'axis'],
      additionalProperties: false,
    },
  },
] as const satisfies readonly { name: string; tier: ToolTier; description: string; inputSchema: InputSchema }[]

export type ToolName = (typeof TOOLS)[number]['name']

/**
 * The two pseudo-tools the protocol relays for MCP resources: not in the list
 * a client sees, answered by the same handler as everything else.
 */
export const RESOURCE_LIST = 'resources.list'
export const RESOURCE_READ = 'resources.read'

export const TOOL_NAMES: readonly ToolName[] = TOOLS.map((tool) => tool.name)

export function isToolName(value: unknown): value is ToolName {
  return typeof value === 'string' && (TOOL_NAMES as readonly string[]).includes(value)
}

export function toolSpec(name: ToolName): ToolSpec {
  return TOOLS.find((tool) => tool.name === name)!
}

// --- what crosses the seam ------------------------------------------------------

/** One call, as main hands it to the renderer. The id correlates the answer. */
export type AgentRequest = {
  readonly id: string
  readonly tool: string
  readonly args: unknown
}

/** What a tool answers with: text a model can read, or an image it can look at. */
export type ToolContent =
  | { readonly type: 'text'; readonly text: string }
  | { readonly type: 'image'; readonly data: string; readonly mimeType: string }

export type AgentAnswer =
  | { readonly ok: true; readonly content: readonly ToolContent[] }
  | { readonly ok: false; readonly refusal: AgentRefusal; readonly detail?: string }

/**
 * Every way a call can be told no. Keys, like every refusal in this codebase,
 * and the reducer's own two pass straight through. The sentence for each is
 * in {@link REFUSAL_SENTENCE}; the agent is handed both.
 */
export type AgentRefusal =
  | 'agent.off'
  | 'agent.noProject'
  | 'agent.readOnly'
  | 'agent.conflict'
  | 'agent.unknownTool'
  | 'agent.badArguments'
  | 'agent.unknownId'
  | 'agent.tooLarge'
  | 'agent.windowHidden'
  | 'agent.locked'
  | 'agent.notDrawn'
  | 'agent.busy'
  | 'agent.cancelled'
  | 'agent.noAnswer'
  | CommandRefusal

export const REFUSAL_SENTENCE: Record<AgentRefusal, string> = {
  'agent.off': 'The app is not accepting agent connections. Turn them on in Connect an agent.',
  'agent.noProject': 'No project is open in the app.',
  'agent.readOnly': 'The project is read-only; nothing can be changed.',
  'agent.conflict': 'The project changed on disk and the person is deciding which version stands. Try again afterwards.',
  'agent.unknownTool': 'No such tool.',
  'agent.badArguments': 'The arguments do not match the tool\'s schema.',
  'agent.unknownId': 'Nothing in the project has that id.',
  'agent.tooLarge': 'The board is too large for this operation.',
  'agent.locked': 'The decision record is accepted, rejected or superseded, and locked; nothing about it may change.',
  'agent.notDrawn': 'That element is not drawn on that diagram.',
  'agent.busy': 'A layout pass is already running. Try again when it has finished.',
  'agent.cancelled': 'The person cancelled the layout pass.',
  'agent.windowHidden': 'The window is hidden or minimised, so nothing can be drawn. Bring it to the front.',
  'agent.noAnswer': 'The app did not answer in time.',
  'command.gone': 'Something the change refers to is no longer in the project.',
  'command.lastLandscape': 'The last landscape diagram cannot be deleted.',
}

export function refused(refusal: AgentRefusal, detail?: string): AgentAnswer {
  return detail === undefined ? { ok: false, refusal } : { ok: false, refusal, detail }
}

/** One text block, which is what most answers are. */
export function text(value: string): AgentAnswer {
  return { ok: true, content: [{ type: 'text', text: value }] }
}

/** An answer that is data: JSON, indented, so a model and a person both read it. */
export function json(value: unknown): AgentAnswer {
  return text(JSON.stringify(value, undefined, 2))
}

// --- checking a call against its own schema ------------------------------------

/**
 * Does `args` fit the tool's schema? Answers with what is wrong, or nothing.
 *
 * Small on purpose: object with known keys, scalars of the declared type, a
 * closed enum, an integer within its bounds, an array of strings. That is all
 * the schemas above use, and a check that understands exactly what the schemas
 * say cannot quietly accept what they do not.
 */
export function checkArguments(schema: InputSchema, args: unknown): string | undefined {
  if (args === undefined || args === null) args = {}
  if (typeof args !== 'object' || Array.isArray(args)) return 'arguments must be an object'
  const held = args as Record<string, unknown>
  for (const key of schema.required ?? []) {
    if (held[key] === undefined) return `"${key}" is required`
  }
  for (const [key, value] of Object.entries(held)) {
    const spec = schema.properties[key]
    if (!spec) return `"${key}" is not an argument of this tool`
    if (value === undefined || value === null) continue
    const wrong = checkValue(spec, value)
    if (wrong) return `"${key}" ${wrong}`
  }
  return undefined
}

function checkValue(spec: ArgumentSchema, value: unknown): string | undefined {
  switch (spec.type) {
    case 'string':
      if (typeof value !== 'string') return 'must be a string'
      if (spec.enum && !spec.enum.includes(value)) return `must be one of ${spec.enum.join(', ')}`
      return undefined
    case 'integer':
      if (typeof value !== 'number' || !Number.isInteger(value)) return 'must be an integer'
      if (spec.minimum !== undefined && value < spec.minimum) return `must be at least ${spec.minimum}`
      if (spec.maximum !== undefined && value > spec.maximum) return `must be at most ${spec.maximum}`
      return undefined
    case 'number':
      return typeof value === 'number' && Number.isFinite(value) ? undefined : 'must be a number'
    case 'boolean':
      return typeof value === 'boolean' ? undefined : 'must be true or false'
    case 'array':
      return Array.isArray(value) && value.every((item) => typeof item === 'string')
        ? undefined
        : 'must be a list of strings'
  }
}
