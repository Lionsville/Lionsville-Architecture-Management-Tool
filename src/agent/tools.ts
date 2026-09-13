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
  | { readonly type: 'array'; readonly description: string; readonly items: { readonly type: 'string' } | RowSchema }
  | RowSchema
  | MapSchema

/**
 * A row: an object with named fields, the way a milestone or a signer is one.
 * Rows are what the list-taking tools take a list of, and what `batch` takes
 * one of per step.
 */
export type RowSchema = {
  readonly type: 'object'
  readonly description: string
  readonly properties: Readonly<Record<string, ArgumentSchema>>
  readonly required?: readonly string[]
  readonly additionalProperties: false
}

/**
 * A map from a name to one string: an element's aspects, keyed by aspect. Or,
 * with `additionalProperties: true`, any object at all — the arguments of a
 * step inside `batch`, which the named tool checks for itself.
 */
export type MapSchema = {
  readonly type: 'object'
  readonly description: string
  readonly additionalProperties: { readonly type: 'string'; readonly enum?: readonly string[] } | true
}

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
 * What a thing IS (ADR-0012 §4), which stopped being the same question as how
 * it is drawn. `externalSystem`, `inputChannel` and `managementTool` were the
 * drawing and are gone from the vocabulary: say `outside` for a system nobody
 * here owns, and `zone` for the band a card sits in.
 *
 * The four business kinds are records rather than boxes — a sheet is laid out
 * from the tree, not dragged — so `element.add` makes one and draws nothing.
 */
const KINDS = ['actor', 'step', 'function', 'process', 'application', 'component'] as const
const LIFECYCLES = ['planned', 'live', 'retiring', 'retired'] as const
const ZONES = ['actors', 'inputChannels', 'externalSystems', 'landscape', 'management'] as const
const LINE_STYLES = ['solid', 'dashed', 'dotted'] as const
/**
 * ADR-0012 §5. Written out here rather than imported from `model/relations`
 * because a tool schema is a protocol contract: what a client is told and what
 * {@link checkArguments} enforces have to be the same literal, and the model's
 * list is free to grow a member this build has no tool for yet.
 */
const RELATION_TYPES = ['flow', 'supports', 'serves', 'realises', 'assigned'] as const

/** How a line is drawn. Absent means the theme's own stroke and a solid line. */
const LINE_FIELDS = {
  color: { type: 'string', description: 'The stroke, as a hex colour like #c0392b. The theme\'s own when absent.' },
  lineStyle: { type: 'string', description: 'Solid, dashed or dotted. Solid when absent.', enum: LINE_STYLES },
} as const satisfies Record<string, ArgumentSchema>

/**
 * What every relation says and when it is there, whatever it means. Null
 * clears any of them.
 */
const RELATION_FIELDS = {
  label: { type: 'string', description: 'What the row says, in a few words.' },
  validFrom: { type: 'string', description: 'The first day it holds, yyyy-mm-dd (ADR-0009). Absent: it follows its ends.' },
  validUntil: { type: 'string', description: 'The last day it holds, yyyy-mm-dd, inclusive. Absent: it follows its ends.' },
} as const satisfies Record<string, ArgumentSchema>

/** What a line says and when it is there. Null clears any of them. */
const CONNECTION_FIELDS = {
  label: { type: 'string', description: 'What flows, in a few words.' },
  protocol: { type: 'string', description: 'How: REST, AMQP, SFTP, a file drop.' },
  isBidirectional: { type: 'boolean', description: 'Whether it flows both ways.' },
  validFrom: { type: 'string', description: 'The first day the line is there, yyyy-mm-dd (ADR-0009). Absent: it follows its ends.' },
  validUntil: { type: 'string', description: 'The last day it is there, yyyy-mm-dd, inclusive. Absent: it follows its ends.' },
  ...LINE_FIELDS,
} as const satisfies Record<string, ArgumentSchema>

const ASPECT_STATUSES = ['managed', 'partial', 'none', 'atRisk'] as const

/**
 * The fields of an element an agent may set. Description is markdown, the
 * element's page. Every optional field clears with null; the three dates land
 * on the element's lifecycle dates (ADR-0009) and must run in order.
 */
const ELEMENT_FIELDS = {
  name: { type: 'string', description: 'The name.' },
  description: { type: 'string', description: 'The documentation, as markdown. The first paragraph is drawn on the card.' },
  category: { type: 'string', description: 'A business category or capability.' },
  vendor: { type: 'string', description: 'Who makes it.' },
  technology: { type: 'string', description: 'What it is built on.' },
  lifecycle: { type: 'string', description: 'Where it is in its life.', enum: LIFECYCLES },
  isManaged: { type: 'boolean', description: 'Whether the organisation manages it itself.' },
  owner: { type: 'string', description: 'Who answers for it — a person or a team. Which scope owns it is the folder.' },
  outside: { type: 'boolean', description: 'True when nobody in this organisation owns it. What the externalSystem kind used to say, as the fact it always was.' },
  partyId: { type: 'string', description: 'The id of the actor it belongs to, where that has been said. Only meaningful with outside.' },
  order: { type: 'number', description: 'Where it sits among its siblings, low first. Only say it where the order is a decision — a journey reads left to right.' },
  lane: { type: 'string', description: 'A step only: the id of the actor whose own path this step is. Absent means the row every lane shares.' },
  liveOn: { type: 'string', description: 'The day it goes live, yyyy-mm-dd. Before it, planned.' },
  retiringOn: { type: 'string', description: 'The day it starts retiring, yyyy-mm-dd.' },
  retiredOn: { type: 'string', description: 'The day it is gone, yyyy-mm-dd. A board dated after it draws neither the card nor its lines.' },
  successorId: { type: 'string', description: 'The id of what replaces it when it retires. The roadmap\'s checks read this.' },
  aspects: {
    type: 'object',
    description: 'Maturity per aspect, keyed by aspect (platform, cicd, dr, security, monitoring, backup, compliance, cost, or a custom key): '
      + 'managed, partial, none or atRisk. Only the keys given change; null takes an aspect off.',
    additionalProperties: { type: 'string', enum: ASPECT_STATUSES },
  },
  accentColor: { type: 'string', description: 'The card\'s accent, as a hex colour like #2e86c1. Empty or null gives the theme\'s back.' },
  iconKey: { type: 'string', description: 'The mark drawn on the card, by its key in the icon registry. Empty or null takes it off.' },
} as const satisfies Record<string, ArgumentSchema>

const PLAN_STATUSES = ['draft', 'agreed', 'running', 'done', 'abandoned'] as const

const PLAN_ID: ArgumentSchema = { type: 'string', description: 'The plan: its id, or its label such as TR-0003.' }

/** A plan's scalar fields, beyond title and status. Null clears any of them. */
const PLAN_FIELDS = {
  from: { type: 'string', description: 'The day the work starts, yyyy-mm-dd.' },
  to: { type: 'string', description: 'The day it is due to end, yyyy-mm-dd.' },
  owner: { type: 'string', description: 'Who answers for it.' },
  initiative: { type: 'boolean', description: 'An initiative the organisation follows (ADR-0012 §7): shown on the roadmap of every scope above this one, read there and edited here. False takes it off them.' },
  body: { type: 'string', description: 'The plan as markdown: goal, approach, phases, the ```business-case fence, risks, rollback.' },
} as const satisfies Record<string, ArgumentSchema>

/** What a plan names. Each list, when given, replaces that list whole. */
const PLAN_LISTS = {
  introduces: { type: 'array', description: 'The ids of the elements it brings in.', items: { type: 'string' } },
  retires: { type: 'array', description: 'The ids of the elements it takes out.', items: { type: 'string' } },
  changes: { type: 'array', description: 'The ids of the elements it changes without either.', items: { type: 'string' } },
  decisionIds: { type: 'array', description: 'The ids of the decision records it rests on.', items: { type: 'string' } },
} as const satisfies Record<string, ArgumentSchema>

/** Who a decision was put to. Given whole: the list replaces the list. */
const SIGNERS: ArgumentSchema = {
  type: 'array',
  description: 'The people the decision is put to, replacing the list. Each has a name and may have a role, a verdict and the day of it.',
  items: {
    type: 'object',
    description: 'One signer.',
    properties: {
      name: { type: 'string', description: 'Their name.' },
      role: { type: 'string', description: 'Their role, in a few words.' },
      verdict: { type: 'string', description: 'What they said, once they have.', enum: ['approved', 'rejected'] },
      signedAt: { type: 'string', description: 'The day of the verdict, yyyy-mm-dd.' },
    },
    required: ['name'],
    additionalProperties: false,
  },
}

/**
 * Three tiers, in the order they earn their keep: read, write, see.
 *
 * Written as a tuple literal so {@link ToolName} is derived from it rather than
 * listed twice. The order is the order a client lists them in, which is why the
 * orientation tool comes first.
 */
const SPECS = [
  {
    name: 'project.current',
    tier: 'read',
    description:
      'The project that is open: its name, the group it is filed under, its description, '
      + 'how many elements, connections, diagrams and decisions it holds, which diagram is on screen, '
      + 'and its revision — a counter that moves with every change, for ifRevision on a write.',
    inputSchema: NO_ARGUMENTS,
  },
  {
    name: 'scopes.list',
    tier: 'read',
    description:
      'Every scope in the organisation (ADR-0012 §1): its path, its name, what it says it is, how many views '
      + 'it holds, and which one is open in the app. A path is what `scope` takes on every other tool; "" is '
      + 'the organisation itself.',
    inputSchema: NO_ARGUMENTS,
  },
  {
    name: 'register.list',
    tier: 'read',
    description:
      'Every application in the organisation, derived from the whole tree (ADR-0012 §2): the scope that '
      + 'answers for it (its master), the scopes above that declare it, the scopes that draw it as a '
      + 'stand-in, whether it is outside the organisation and whose it is, and the keys of the findings '
      + 'about it — defined twice, a stale cache, unattributed. Filter by a free-text query over name, id '
      + 'and master.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Only applications whose name, id or master contains every word.' },
        limit: { type: 'integer', description: 'At most this many. Default 200.', minimum: 1, maximum: 2000 },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'checks.list',
    tier: 'read',
    description:
      'What the tree contradicts about itself (ADR-0012 §9), as findings with a key: check.conflict (two '
      + 'scopes define one id), check.drift (a stand-in\'s cached name disagrees with its master), '
      + 'check.dangling (a stand-in nobody defines), check.danglingEnd (a relation end nobody holds), '
      + 'check.proposal (a domain names a function no ancestor has), check.ownedElsewhere (the owner\'s '
      + 'detail written on a stand-in), check.unattributed (outside, and nobody has said whose), '
      + 'check.unmapped and check.uncovered (the business layer\'s two), and check.notDrawn, which is '
      + 'information rather than a fault and is listed only when asked. A finding is never a refusal and '
      + 'never a reason a save fails.',
    inputSchema: {
      type: 'object',
      properties: {
        scope: { type: 'string', description: 'Only findings about this scope, by path; "" is the organisation.' },
        key: { type: 'string', description: 'Only findings with this key.' },
        information: { type: 'boolean', description: 'Include check.notDrawn. Default false.' },
        limit: { type: 'integer', description: 'At most this many. Default 200.', minimum: 1, maximum: 2000 },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'elements.list',
    tier: 'read',
    description:
      'The elements of the landscape, one line each: id, name, kind, lifecycle, and the '
      + 'category, vendor, technology, owner, lifecycle dates, successor, parent, order, lane and '
      + 'outside flag where set. Filter by kind, '
      + 'by the diagram they are drawn on, or by a free-text query over name, category, vendor and technology.',
    inputSchema: {
      type: 'object',
      properties: {
        kind: {
          type: 'string',
          description: 'Only elements of this kind. A step is a journey, a phase or a step; a function an area, a grouping or a capability.',
          enum: KINDS,
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
      + 'connections that end on it, where it is drawn on each diagram, and the decisions recorded about it. '
      + 'A record carrying `ref` is a STAND-IN: the thing is defined in the scope that `ref` names, its `name` '
      + 'and `ref` are caches of what is written there, and its description is this scope\'s own account of it. '
      + 'Everything else on a stand-in — lifecycle, dates, owner, vendor, technology, aspects — belongs to the '
      + 'owning scope and cannot be changed from here.',
    inputSchema: { type: 'object', properties: { id: ID('element') }, required: ['id'], additionalProperties: false },
  },
  {
    name: 'connections.list',
    tier: 'read',
    description:
      'The connections between elements: id, source, target, label, protocol, the days it is valid '
      + 'where dated, and which plan dated it where a port did. '
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
      'The architecture decision records: id, number, label, title, status and date. Three scopes: '
      + 'a scope above this one ("group"), this scope itself ("landscape"), and each subject a record '
      + 'is about ("application") — and numbers are per scope, so name a record in text by its label '
      + 'and scope (ADR-0001 of the landscape), never by the number alone.',
    inputSchema: {
      type: 'object',
      properties: {
        scope: { type: 'string', description: 'Only records of this scope.', enum: ['group', 'landscape', 'application'] },
        subjectId: { type: 'string', description: 'Only records about this element.' },
        applicationId: { type: 'string', description: 'The old name for subjectId. Accepted for one beta; use subjectId.' },
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
    name: 'plans.list',
    tier: 'read',
    description:
      'The plans for changing the landscape (ADR-0009): number, title, status, the window they '
      + 'run over, who owns them, the elements they introduce, retire or change, the decisions '
      + 'they rest on, their milestones, and their interfaces — every line on what they retire, with '
      + 'where it has moved to and when (ADR-0010). The body is markdown and is returned in full.',
    inputSchema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          description: 'Only plans in this state.',
          enum: ['draft', 'agreed', 'running', 'done', 'abandoned'],
        },
        elementId: { type: 'string', description: 'Only plans that touch this element.' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'plan.read',
    tier: 'read',
    description:
      'One plan in full, the same shape as a plans.list entry: fields, elements by role, decisions, '
      + 'milestones, interfaces, body, and the business case computed from the ```business-case fence in '
      + 'the body where there is one. The id may be the plan\'s label, TR-0003.',
    inputSchema: { type: 'object', properties: { id: PLAN_ID }, required: ['id'], additionalProperties: false },
  },
  {
    name: 'roadmap.check',
    tier: 'read',
    description:
      'What the dates in this landscape contradict: a retirement with connections still live, a '
      + 'successor that goes live after the thing it replaces is gone, a retirement with no '
      + 'successor named, a connection valid after one of its ends has retired, and a plan past '
      + 'the day it was due to finish. It reports contradictions only — it cannot tell you a '
      + 'landscape is out of date.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'activity.list',
    tier: 'read',
    description:
      'The steps taken in this session, newest first, as the app\'s Activity list shows them: when, by '
      + 'whom (the person or an agent), and what. Read it to see what stuck; undo takes back the '
      + 'newest steps while they are an agent\'s.',
    inputSchema: {
      type: 'object',
      properties: { limit: { type: 'integer', description: 'At most this many. Default 20.', minimum: 1, maximum: 200 } },
      additionalProperties: false,
    },
  },
  {
    name: 'images.list',
    tier: 'read',
    description:
      'The pictures the project holds for its documents (ADR-0009): the file name to refer to each by, '
      + 'its size, and which documents show it.',
    inputSchema: NO_ARGUMENTS,
  },
  {
    name: 'project.export',
    tier: 'read',
    description:
      'The whole project in one answer, for diffing against a document: as the JSON the working file '
      + 'holds, or as one markdown document with a table per kind of thing. Large for a large landscape; '
      + 'the list tools are the way to read a part.',
    inputSchema: {
      type: 'object',
      properties: { format: { type: 'string', description: 'json or markdown. Default markdown.', enum: ['json', 'markdown'] } },
      additionalProperties: false,
    },
  },
  {
    name: 'search',
    tier: 'read',
    description:
      'Search elements, their documentation, the decision records and the plans together, the way ⌘K does in the app. '
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
      'Add an element to the landscape, and draw it on a diagram (the one on screen unless said otherwise) '
      + 'where its kind is one a board can draw. It gets the id the file would give it, derived from the '
      + 'name, and lands in its kind\'s own band unless a zone or a spot is named. A business kind — a step, '
      + 'a function, a process — is a record and is drawn nowhere: a sheet is laid out from the tree rather '
      + 'than dragged. Answers with the id, and with whether it was drawn.',
    inputSchema: {
      type: 'object',
      properties: {
        ...ELEMENT_FIELDS,
        kind: { type: 'string', description: 'What kind of element. Default application.', enum: KINDS },
        parentId: { type: 'string', description: 'What contains it: a component\'s application, a function\'s area, a step\'s phase, an actor\'s group.' },
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
    description:
      'Change an element\'s fields. Only the fields given change; the rest stay as they are, and null '
      + 'clears an optional one. The dates go live → retiring → retired and are refused out of order; '
      + 'a parentId that would make a loop is refused; where a card sits on a diagram is element.place, '
      + 'not this. Order among siblings is `order`, low first — a sheet lays its trees out by it.',
    inputSchema: {
      type: 'object',
      properties: {
        id: ID('element'),
        ...ELEMENT_FIELDS,
        parentId: { type: 'string', description: 'What contains it now: a component\'s application, a function\'s area or grouping, a step\'s phase, an actor\'s group. Null makes it a root.' },
      },
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
    description:
      'Draw a connection from one element to another, dated when the line is temporary. Answers with the connection\'s id.',
    inputSchema: {
      type: 'object',
      properties: {
        sourceId: ID('element the connection starts at'),
        targetId: ID('element it ends at'),
        ...CONNECTION_FIELDS,
      },
      required: ['sourceId', 'targetId'],
      additionalProperties: false,
    },
  },
  {
    name: 'connection.update',
    tier: 'write',
    description:
      'Change a connection\'s label, protocol, direction, validity, colour or line style; null clears a '
      + 'field. Colour a line by what flows over it and a busy board reads again; "solid" and an empty '
      + 'colour give the theme back its line.',
    inputSchema: {
      type: 'object',
      properties: { id: ID('connection'), ...CONNECTION_FIELDS },
      required: ['id'],
      additionalProperties: false,
    },
  },
  {
    name: 'connections.update',
    tier: 'write',
    description:
      'connection.update for several lines at once, as one undo step: every change lands or none does. '
      + 'Each item takes what connection.update takes.',
    inputSchema: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          description: 'The changes, one per line.',
          items: {
            type: 'object',
            description: 'One connection and what changes on it.',
            properties: { id: ID('connection'), ...CONNECTION_FIELDS },
            required: ['id'],
            additionalProperties: false,
          },
        },
      },
      required: ['items'],
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
    name: 'connections.remove',
    tier: 'write',
    description: 'Cut several connections as one undo step — a clean-up of duplicate twins in one call rather than twenty.',
    inputSchema: {
      type: 'object',
      properties: { ids: { type: 'array', description: 'The connections to cut.', items: { type: 'string' } } },
      required: ['ids'],
      additionalProperties: false,
    },
  },
  {
    name: 'relation.add',
    tier: 'write',
    description:
      'Join two elements with a typed relation (ADR-0012): supports (an application covers a '
      + 'capability), serves, realises, or assigned (who is responsible). Dated when it only holds for '
      + 'a while — the roadmap draws the window. For a flow between two applications use connect, which '
      + 'also takes a protocol and a direction. Answers with the relation\'s id.',
    inputSchema: {
      type: 'object',
      properties: {
        type: { type: 'string', description: 'What the row means.', enum: RELATION_TYPES },
        sourceId: ID('element the relation starts at'),
        targetId: ID('element it ends at'),
        ...RELATION_FIELDS,
      },
      required: ['type', 'sourceId', 'targetId'],
      additionalProperties: false,
    },
  },
  {
    name: 'relation.update',
    tier: 'write',
    description:
      'Change what a relation means, what it says, or the days it holds; null clears a field. A flow\'s '
      + 'protocol, direction and look are connection.update\'s, because only a flow has them.',
    inputSchema: {
      type: 'object',
      properties: {
        id: ID('relation'),
        type: { type: 'string', description: 'What the row means.', enum: RELATION_TYPES },
        ...RELATION_FIELDS,
      },
      required: ['id'],
      additionalProperties: false,
    },
  },
  {
    name: 'relation.remove',
    tier: 'write',
    description: 'Remove a relation of any type, and its route on every diagram.',
    inputSchema: { type: 'object', properties: { id: ID('relation') }, required: ['id'], additionalProperties: false },
  },
  {
    name: 'decision.propose',
    tier: 'write',
    description:
      'Add an architecture decision record in the proposed state, numbered after the last one in its list: '
      + 'the landscape\'s, or one application\'s. The body is MADR markdown; leave it out for the template. '
      + 'Name the plans that rest on it and they are linked in the same step. A record is about one '
      + 'application at most — that is its scope, not a list of elements. Answers with the id and the label.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'What was decided, as a title.' },
        body: { type: 'string', description: 'The record as MADR markdown. Title, status, date and signers are fields, not text.' },
        subjectId: { type: 'string', description: 'The element the decision is about \u2014 an application, a capability, a journey step. Absent: the scope itself.' },
        applicationId: { type: 'string', description: 'The old name for subjectId. Accepted for one beta; use subjectId.' },
        signers: SIGNERS,
        planIds: { type: 'array', description: 'Plans that rest on this decision; each is linked to it.', items: { type: 'string' } },
      },
      required: ['title'],
      additionalProperties: false,
    },
  },
  {
    name: 'decision.update',
    tier: 'write',
    description:
      'Correct a record that is still proposed or reviewing: its title, its body, its date, or who it was '
      + 'put to. Accepted, rejected and superseded records are locked; a group\'s records are changed on their page.',
    inputSchema: {
      type: 'object',
      properties: {
        id: ID('decision record'),
        title: { type: 'string', description: 'A new title.' },
        body: { type: 'string', description: 'The record as MADR markdown.' },
        date: { type: 'string', description: 'The day the record carries, yyyy-mm-dd.' },
        signers: SIGNERS,
      },
      required: ['id'],
      additionalProperties: false,
    },
  },
  {
    name: 'decision.remove',
    tier: 'write',
    description: 'Throw away a record that is still proposed or reviewing. A locked record stays; its number is never reused.',
    inputSchema: { type: 'object', properties: { id: ID('decision record') }, required: ['id'], additionalProperties: false },
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
    name: 'plan.replace',
    tier: 'write',
    description:
      'Start replacing an application (ADR-0010), as one undo step: the new application in the image of '
      + 'the old, drawn beside it on every diagram the old is on; the dates on both; the successor; a '
      + 'dashed tap from old to new for the shadow run, closing the day before cutover; and a plan naming all of it '
      + 'with two milestones. Which interface moves when is not decided here — use plan.port afterwards. '
      + 'Answers with the plan\'s id and the new element\'s id.',
    inputSchema: {
      type: 'object',
      properties: {
        elementId: { type: 'string', description: 'The application being replaced.' },
        newName: { type: 'string', description: 'The name of the new application to make. Give this or existingId.' },
        existingId: { type: 'string', description: 'An element that already exists and becomes the successor. Give this or newName.' },
        stays: { type: 'boolean', description: 'True for a split: part of it moves and the element stays. Default false: it goes on cutover.' },
        alsoRetiring: { type: 'array', items: { type: 'string' }, description: 'For a merge: other elements that retire into the same successor.' },
        shadowFrom: { type: 'string', description: 'The day the shadow run starts, yyyy-mm-dd: the new one is live and taps the old.' },
        cutover: { type: 'string', description: 'The day the old one is gone and the tap closes, yyyy-mm-dd.' },
      },
      required: ['elementId', 'shadowFrom', 'cutover'],
      additionalProperties: false,
    },
  },
  {
    name: 'plan.port',
    tier: 'write',
    description:
      'Move an interface of a plan onto the element it introduces, on a day (ADR-0010): a twin of the line '
      + 'on the new end valid from that day, and the original valid until the day before. Without a '
      + 'connectionId, every interface of the plan not yet planned moves on that day, as one step — and a '
      + 'line another plan has already closed is skipped and listed, never re-dated. Naming such a line '
      + 'is refused; plan.unport it under its own plan first. plan.read shows the interfaces and where each has gone.',
    inputSchema: {
      type: 'object',
      properties: {
        planId: ID('plan'),
        connectionId: { type: 'string', description: 'The line on the retiring element to move. Absent: every one not yet planned.' },
        toId: { type: 'string', description: 'Which introduced element it moves to. Needed only when the plan introduces more than one.' },
        on: { type: 'string', description: 'The day it moves, yyyy-mm-dd.' },
      },
      required: ['planId', 'on'],
      additionalProperties: false,
    },
  },
  {
    name: 'plan.unport',
    tier: 'write',
    description:
      'Take a port back: the twin goes and the original is open-ended again, as one undo step. Only a '
      + 'line this plan dated; one closed by another plan is refused.',
    inputSchema: {
      type: 'object',
      properties: {
        planId: PLAN_ID,
        connectionId: { type: 'string', description: 'The line on the retiring element whose port to take back.' },
      },
      required: ['planId', 'connectionId'],
      additionalProperties: false,
    },
  },
  {
    name: 'plan.create',
    tier: 'write',
    description:
      'Add a plan that is not a replacement (ADR-0009): a migration, a platform move, an upgrade. Numbered '
      + 'after the last one; draft unless said otherwise. Name the elements it touches by role and the '
      + 'decisions it rests on; the body is markdown and starts from the template — headings and a '
      + '```business-case fence — when left out. Answers with the id and the label.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'What the plan does, as a title.' },
        status: { type: 'string', description: 'Where it starts. Default draft.', enum: PLAN_STATUSES },
        ...PLAN_FIELDS,
        ...PLAN_LISTS,
      },
      required: ['title'],
      additionalProperties: false,
    },
  },
  {
    name: 'plan.update',
    tier: 'write',
    description:
      'Change a plan\'s fields, its lists or its body in place. Only what is given changes; null clears '
      + 'from, to and owner; a list given replaces that list whole. The status follows draft → agreed → '
      + 'running → done, with abandoned reachable from any of the first three and every arrow reversible. '
      + 'When the body holds a ```business-case fence the answer carries what it computes — read plan.read '
      + 'for the fence\'s shape. The dates on the elements a plan introduces or retires are the elements\' '
      + 'own: set them with element.update.',
    inputSchema: {
      type: 'object',
      properties: {
        id: PLAN_ID,
        title: { type: 'string', description: 'A new title.' },
        status: { type: 'string', description: 'The status to move to.', enum: PLAN_STATUSES },
        ...PLAN_FIELDS,
        ...PLAN_LISTS,
      },
      required: ['id'],
      additionalProperties: false,
    },
  },
  {
    name: 'plan.remove',
    tier: 'write',
    description:
      'Throw a plan away. Only the record goes: the elements, the dates on them and the twins a port drew '
      + 'stay, because they are facts about the landscape rather than about the plan. One undo step puts it back.',
    inputSchema: { type: 'object', properties: { id: PLAN_ID }, required: ['id'], additionalProperties: false },
  },
  {
    name: 'milestone.add',
    tier: 'write',
    description: 'Add a milestone to a plan: a day and a name. Milestones are what the roadmap draws on the plan\'s band.',
    inputSchema: {
      type: 'object',
      properties: {
        planId: PLAN_ID,
        date: { type: 'string', description: 'The day, yyyy-mm-dd.' },
        name: { type: 'string', description: 'What happens that day.' },
      },
      required: ['planId', 'date', 'name'],
      additionalProperties: false,
    },
  },
  {
    name: 'milestone.update',
    tier: 'write',
    description: 'Move or rename a milestone of a plan, found by its name.',
    inputSchema: {
      type: 'object',
      properties: {
        planId: PLAN_ID,
        name: { type: 'string', description: 'The milestone, by its current name.' },
        date: { type: 'string', description: 'The new day, yyyy-mm-dd.' },
        newName: { type: 'string', description: 'The new name.' },
      },
      required: ['planId', 'name'],
      additionalProperties: false,
    },
  },
  {
    name: 'milestone.remove',
    tier: 'write',
    description: 'Take a milestone off a plan, by its name.',
    inputSchema: {
      type: 'object',
      properties: {
        planId: PLAN_ID,
        name: { type: 'string', description: 'The milestone, by name.' },
      },
      required: ['planId', 'name'],
      additionalProperties: false,
    },
  },
  {
    name: 'diagram.create',
    tier: 'write',
    description:
      'Add a diagram: a new landscape by name, a C4 container view of one application seeded with its '
      + 'components and laid out on first open, a business architecture sheet over the journey and the '
      + 'areas this project already holds, or an enterprise map — every function against the applications '
      + 'that support it, with the gaps. The first two are switched to; a sheet and a map are pages rather '
      + 'than boards, so they are made and left for a person to open. Answers with the id.',
    inputSchema: {
      type: 'object',
      properties: {
        kind: { type: 'string', description: 'A layer-7 landscape, a container view, a business architecture sheet, or an enterprise map.', enum: ['layer7', 'container', 'sheet', 'map'] },
        name: { type: 'string', description: 'For a landscape, a sheet or a map: its name.' },
        applicationId: { type: 'string', description: 'For a container view: the application it is about.' },
      },
      required: ['kind'],
      additionalProperties: false,
    },
  },

  {
    name: 'diagram.update',
    tier: 'write',
    description:
      'Change what a laid-out view is OF (ADR-0012 §6). A sheet draws the journey `journeyId` names — a '
      + 'root step, whose children are the phases and their children the steps — with a row per actor in '
      + '`lanes`, and the function roots in `areas` in that order; `showActors` false hides the stakeholder '
      + 'rail; `paper` is the canvas it is laid out on — A4 to A0 landscape, A2 by default, or fit for the '
      + 'window; `columns` fixes how many columns its areas are laid out in (absent fits the canvas) and '
      + '`areaSpans` maps an area id to the columns it takes, its capabilities side by side inside it. '
      + 'A map takes `areas` as its sections. Absent journeyId or areas is the honest default: no '
      + 'journey band, every root. Each list given replaces that list whole; null clears a field. A board '
      + 'takes `asOf`, the day it draws the model as of. Where a card sits is element.place, not this.',
    inputSchema: {
      type: 'object',
      properties: {
        id: ID('diagram'),
        journeyId: { type: 'string', description: 'A sheet: the root step of the journey drawn across the top. Null takes the band off.' },
        lanes: { type: 'array', description: 'A sheet: the actors that get a row of their own under the phases, in order.', items: { type: 'string' } },
        areas: { type: 'array', description: 'A sheet or a map: the function roots drawn, in order. Null draws every root.', items: { type: 'string' } },
        showActors: { type: 'boolean', description: 'A sheet: whether the stakeholder rail is drawn.' },
        paper: { type: 'string', description: 'A sheet: the canvas it is laid out on. Null is the default, A2.', enum: ['A4', 'A3', 'A2', 'A1', 'A0', 'fit'] },
        columns: { type: 'integer', description: 'A sheet: the columns its areas are laid out in. Null fits the canvas.' },
        areaSpans: { type: 'object', description: 'A sheet: area id → the whole number of columns that area takes (1 to 4). Null makes every area one column.', additionalProperties: true },
        asOf: { type: 'string', description: 'A board: the day it draws the model as of, yyyy-mm-dd. Null is today.' },
      },
      required: ['id'],
      additionalProperties: false,
    },
  },
  {
    name: 'image.upload',
    tier: 'write',
    description:
      'Put a picture into the project for its documents to show (ADR-0009): a PNG, JPEG, SVG or WebP '
      + 'under two megabytes, as base64 or a data URL. Answers with the file name and the markdown line '
      + 'that shows it from a description, a decision or a plan. Not an undo step: the picture is a '
      + 'file beside the model, and a document that stops referring to it is what removes it from view.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'What to call it; the file name is derived from this.' },
        data: { type: 'string', description: 'The bytes, base64-encoded, or a data: URL carrying them.' },
        type: { type: 'string', description: 'The media type. Needed unless the data is a data: URL.', enum: ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'] },
      },
      required: ['name', 'data'],
      additionalProperties: false,
    },
  },
  {
    name: 'batch',
    tier: 'write',
    description:
      'Several changes as one undo step, all or nothing: each step names a write or placement tool and '
      + 'its arguments, and is built against the model as the steps before it left it, so a step may use an '
      + 'id an earlier one answered with. A step that is refused stops the whole batch before anything lands. '
      + 'Answers with each step\'s answer.',
    inputSchema: {
      type: 'object',
      properties: {
        steps: {
          type: 'array',
          description: 'The changes, in order.',
          items: {
            type: 'object',
            description: 'One tool call.',
            properties: {
              tool: { type: 'string', description: 'The tool, by name: any write tool, or moveBy, placeNextTo, element.place, element.draw, element.undraw, group, ungroup, align, distribute.' },
              args: { type: 'object', description: 'Its arguments, as that tool takes them.', additionalProperties: true },
            },
            required: ['tool'],
            additionalProperties: false,
          },
        },
      },
      required: ['steps'],
      additionalProperties: false,
    },
  },
  {
    name: 'undo',
    tier: 'write',
    description:
      'Take back the newest step, or several, as ⌘Z does — but only while the newest step is an agent\'s. '
      + 'A person\'s step stops it, and is theirs to undo. Answers with what was undone.',
    inputSchema: {
      type: 'object',
      properties: { steps: { type: 'integer', description: 'How many steps. Default 1.', minimum: 1, maximum: 200 } },
      additionalProperties: false,
    },
  },
  {
    name: 'project.save',
    tier: 'write',
    description:
      'Write the project to wherever it is kept, now, rather than at the next idle moment. The app '
      + 'autosaves; call this before a step that could take the app down, or when what you did has to be on disk.',
    inputSchema: NO_ARGUMENTS,
  },

  // --- the see tier: structure first, then pixels, then relational placement ------
  {
    name: 'diagram.inspect',
    tier: 'see',
    description:
      'A layout report on a diagram, in geometry rather than pixels: the box around everything, on a '
      + 'landscape the rectangle of every band and of every domain group with its members, '
      + 'cards that overlap and by how much, lines that cut through a card, cards drawn in another band '
      + 'than they are filed in, group members outside their group, cards off the board, cards nothing '
      + 'connects to, and how full each band is. Lists are capped; totals are whole. Read this before '
      + 'and after moving anything, and read the band rectangles before choosing a coordinate. '
      + 'On a business architecture sheet, which is laid out and has no geometry, it reports the page '
      + 'instead: the stakeholder rail, the journey with a row per lane, and every area with what '
      + 'covers each capability. On an enterprise map it reports the rows — every function in tree '
      + 'order with the applications supporting it, rolled up on the sections — and the columns.',
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
      + 'within the pixel budget is a thumbnail. Switches the app to that diagram; the window must be visible. '
      + 'A business architecture sheet or an enterprise map is drawn whole — neither has coordinates to '
      + 'crop to — and the crop arguments are ignored for one. A sheet takes `pageWidth`: the CSS width it is '
      + 'laid out at before drawing, so its areas tile as they would on paper (A1 is 3179, A0 is 4494); '
      + 'raise maxPixels with it, or the picture is scaled down to fit the budget.',
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
        pageWidth: { type: 'integer', description: 'A sheet: lay the page out this many CSS pixels wide before drawing it. Default: as the window shows it.', minimum: 320, maximum: 8000 },
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
      + 'in the same band and domain group: kept inside the band, and the group\'s box grown to hold it. '
      + 'The way to place something without inventing a coordinate.',
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
    name: 'element.place',
    tier: 'see',
    description:
      'Put an element at a spot on a diagram, in flow coordinates, and on a landscape file it in a band '
      + 'or a domain group. A spot in another band than the one it is filed in is refused unless the band '
      + 'is named too; a card put in a band is kept inside it; a group named grows its box to hold the card, '
      + 'and null takes the card out of its group. With only a group given the card lands at a free slot inside its box.',
    inputSchema: {
      type: 'object',
      properties: {
        id: ID('element'),
        diagramId: { type: 'string', description: 'The diagram. Default: the one on screen.' },
        x: { type: 'number', description: 'The left edge, in flow coordinates.' },
        y: { type: 'number', description: 'The top edge, in flow coordinates.' },
        zone: { type: 'string', description: 'On a landscape: the band to file it in.', enum: ZONES },
        domainGroup: { type: 'string', description: 'On a landscape: the domain group to file it under; null for none.' },
      },
      required: ['id'],
      additionalProperties: false,
    },
  },
  {
    name: 'element.draw',
    tier: 'see',
    description:
      'Draw an element that already exists on a diagram it is not on yet, the way dragging it from the '
      + 'palette\'s existing list does. Lands in its kind\'s band, or where told. Answers with where it landed.',
    inputSchema: {
      type: 'object',
      properties: {
        id: ID('element'),
        diagramId: { type: 'string', description: 'The diagram. Default: the one on screen.' },
        x: { type: 'number', description: 'Where to draw it, in flow coordinates. Prefer placeNextTo afterwards over guessing.' },
        y: { type: 'number', description: 'Where to draw it, in flow coordinates.' },
        zone: { type: 'string', description: 'On a landscape: the band to draw it in. Default: the kind\'s own.', enum: ZONES },
        domainGroup: { type: 'string', description: 'On a landscape: the domain group to file it under.' },
      },
      required: ['id'],
      additionalProperties: false,
    },
  },
  {
    name: 'element.undraw',
    tier: 'see',
    description:
      'Take an element off a diagram without removing it from the landscape: its card and its lines '
      + 'leave that board and nothing else changes. element.remove is the other thing.',
    inputSchema: {
      type: 'object',
      properties: {
        id: ID('element'),
        diagramId: { type: 'string', description: 'The diagram. Default: the one on screen.' },
      },
      required: ['id'],
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
    name: 'ungroup',
    tier: 'see',
    description:
      'Take elements out of a domain group, or with no elements named, dissolve the group: its box goes '
      + 'and every member is filed under none. The cards stay where they are either way.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'The group, by name.' },
        elementIds: { type: 'array', description: 'Which members to take out. Absent: the whole group goes.', items: { type: 'string' } },
        diagramId: { type: 'string', description: 'The diagram. Default: the one on screen.' },
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

export type ToolName = (typeof SPECS)[number]['name']

/**
 * Every tool that changes something also takes `ifRevision`: the project's
 * revision the caller last saw, so two writers do not clobber each other. The
 * revision is on every mutation's answer and on project.current; a call whose
 * revision is not the current one is refused with `agent.stale` and nothing
 * lands. Added here rather than written into thirty schemas, so no write can
 * forget it.
 */
const REVISION_GUARD: ArgumentSchema = {
  type: 'integer',
  description: 'The project revision this call was decided against; refused when the project has moved on since.',
  minimum: 0,
}

/** The tools that only look: no revision to guard. */
const LOOKS_ONLY: readonly string[] = ['diagram.inspect', 'diagram.render', 'focus']

/**
 * Every tool also takes `scope` (ADR-0012, step 13): which scope of the tree
 * to answer for, by path. A read addressed to another scope is answered over
 * that scope's document as it stands on disk; a write, a picture, undo and the
 * session's own lists need the scope open in the app, and are refused with
 * `agent.scopeNotOpen` rather than landed on the wrong scope. Added here for
 * the reason the guard is: so no tool can forget it.
 *
 * The three tree-wide reads are the exception — they are about every scope at
 * once — and `checks.list` spells its own `scope` as a filter.
 */
const SCOPE_ARGUMENT: ArgumentSchema = {
  type: 'string',
  description:
    'Which scope to answer for, as its path: "" is the organisation, "acme/retail" a landscape under a domain '
    + '(see scopes.list). Default: the scope open in the app. A read over another scope is answered from its '
    + 'document on disk; a change, a picture, undo and the session\'s own lists need that scope open in the '
    + 'app, and are refused otherwise.',
}

/** About the whole tree rather than one scope: `scope` would mean nothing on them. */
export const TREE_WIDE: readonly string[] = ['scopes.list', 'register.list', 'checks.list']

export const TOOLS: readonly ToolSpec[] = SPECS.map((tool): ToolSpec => {
  const properties = {
    ...tool.inputSchema.properties,
    ...(TREE_WIDE.includes(tool.name) ? {} : { scope: SCOPE_ARGUMENT }),
    ...(tool.tier === 'read' || LOOKS_ONLY.includes(tool.name) ? {} : { ifRevision: REVISION_GUARD }),
  }
  return { ...tool, inputSchema: { ...tool.inputSchema, properties } }
})

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
  | 'agent.planned'
  | 'agent.stale'
  | 'agent.notYours'
  | 'agent.saveFailed'
  /** A change, a picture or undo addressed to a scope that is not the one open in the app (ADR-0012, step 13). */
  | 'agent.scopeNotOpen'
  /** `scope` names a path the tree has no scope at. */
  | 'agent.unknownScope'
  /**
   * A field on a stand-in that the scope defining the thing answers for
   * (ADR-0012 §10). A `check.` key rather than an `agent.` one because it is
   * the same refusal the inspector greys a field out for — one rule, said in
   * one word, wherever a write arrives from.
   */
  | 'check.ownedElsewhere'
  /**
   * A step that wrote two scopes cannot be taken back from here (ADR-0012
   * §10). A `gesture.` key for the same reason the one above is a `check.`
   * one: it is the refusal the person meets at ⌘Z, said in one word wherever
   * the undo arrives from.
   */
  | 'gesture.barrier'
  | CommandRefusal

export const REFUSAL_SENTENCE: Record<AgentRefusal, string> = {
  'agent.off': 'The app is not accepting agent connections. Turn them on in Connect an agent.',
  'agent.noProject': 'No project is open in the app.',
  'agent.readOnly': 'The project is read-only; nothing can be changed.',
  'agent.conflict': 'The project changed on disk and the person is deciding which version stands. Try again afterwards.',
  'agent.unknownTool': 'No such tool.',
  'agent.badArguments': 'The arguments do not match the tool\'s schema.',
  'agent.unknownId': 'Nothing in the project has that id.',
  'agent.scopeNotOpen': 'That scope is not the one open in the app. Reads over it are answered; a change, a picture or undo needs a person to open it.',
  'agent.unknownScope': 'No scope in the organisation has that path. scopes.list says which there are.',
  'agent.tooLarge': 'The board is too large for this operation.',
  'agent.locked': 'The decision record is accepted, rejected or superseded, and locked; nothing about it may change.',
  'agent.notDrawn': 'That element is not drawn on that diagram.',
  'agent.busy': 'A layout pass is already running. Try again when it has finished.',
  'agent.cancelled': 'The person cancelled the layout pass.',
  'agent.windowHidden': 'The window is hidden or minimised, so nothing can be drawn. Bring it to the front.',
  'agent.noAnswer': 'The app did not answer in time.',
  'agent.planned': 'That interface was already dated by another plan, or by hand. Take that port back first.',
  'agent.stale': 'The project has changed since the revision this call named. Read it again and decide again.',
  'agent.notYours': 'The newest step is a person\'s, not an agent\'s; it is theirs to undo.',
  'agent.saveFailed': 'The project could not be saved; the app shows why.',
  'check.ownedElsewhere': 'This record is a stand-in: the scope named in the detail defines the thing and answers for its lifecycle, dates, owner, vendor, technology, aspects and category. Its description here is this scope\'s own and can be changed.',
  'gesture.barrier': 'That step wrote two scopes — a record moved between them — so it cannot be undone from here. Move the record back with a gesture of its own.',
  'command.gone': 'Something the change refers to is no longer in the project.',
  'command.lastLandscape': 'The last landscape diagram cannot be deleted.',
  'command.datesOutOfOrder': 'The lifecycle dates run backwards: live, then retiring, then retired.',
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
export function checkArguments(schema: InputSchema | RowSchema, args: unknown): string | undefined {
  if (args === undefined || args === null) args = {}
  if (typeof args !== 'object' || Array.isArray(args)) return 'arguments must be an object'
  const held = args as Record<string, unknown>
  for (const key of schema.required ?? []) {
    if (held[key] === undefined) return `"${key}" is required`
  }
  for (const [key, value] of Object.entries(held)) {
    const spec = schema.properties[key]
    if (!spec) return `"${key}" is not an argument of this tool`
    // Null stands for "not given" here; the write tools that can clear a field
    // read the null for themselves, because only they know which fields may go.
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
    case 'array': {
      if (!Array.isArray(value)) return spec.items.type === 'string' ? 'must be a list of strings' : 'must be a list'
      if (spec.items.type === 'string') {
        return value.every((item) => typeof item === 'string') ? undefined : 'must be a list of strings'
      }
      for (const [index, item] of value.entries()) {
        const wrong = checkValue(spec.items, item)
        if (wrong) return `[${index}] ${wrong}`
      }
      return undefined
    }
    case 'object': {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return 'must be an object'
      if ('properties' in spec) {
        const wrong = checkArguments(spec, value)
        return wrong === undefined ? undefined : `has a problem: ${wrong}`
      }
      if (spec.additionalProperties === true) return undefined
      for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
        if (item === null) continue
        const wrong = checkValue({ ...spec.additionalProperties, description: '' }, item)
        if (wrong) return `.${key} ${wrong}`
      }
      return undefined
    }
  }
}
