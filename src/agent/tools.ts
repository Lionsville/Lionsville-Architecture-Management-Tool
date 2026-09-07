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

/**
 * The read tier: answers built over the model, nothing changes.
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
] as const satisfies readonly { name: string; tier: ToolTier; description: string; inputSchema: InputSchema }[]

export type ToolName = (typeof TOOLS)[number]['name']

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
