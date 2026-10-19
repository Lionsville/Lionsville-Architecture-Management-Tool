// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

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
import type { MergeLinkRefusal } from '../observations/merge'
import { OBSERVATION_TABS } from '../observations/tabs'
import { isPersonRef } from '../model/person'
import { PERSON_KINDS, PERSON_STATES } from '../people/person'
import type { PeopleRefusal } from '../people/person'

/**
 * Read answers from the model; write is one command; see is what only the
 * renderer can do; drive is the app itself — where it is, and moving it
 * between scopes and pages (ADR-0019).
 */
export type ToolTier = 'read' | 'write' | 'see' | 'drive'

/**
 * A field that names a person (ADR-0036 §8): text — a name, initials, a team —
 * or a person picked from the register, `{ "person": id }` with an id from
 * `people.list`. JSON Schema's `anyOf`, and the one argument that is not a
 * single type.
 */
export type PersonRefSchema = {
  readonly anyOf: readonly [
    { readonly type: 'string' },
    {
      readonly type: 'object'
      readonly properties: { readonly person: { readonly type: 'string'; readonly description: string } }
      readonly required: readonly ['person']
      readonly additionalProperties: false
    },
  ]
  readonly description: string
}

/** A person-naming argument, said as `what` is said of it. */
export function personArgument(what: string): PersonRefSchema {
  return {
    anyOf: [
      { type: 'string' },
      {
        type: 'object',
        properties: { person: { type: 'string', description: 'A register id, from people.list.' } },
        required: ['person'],
        additionalProperties: false,
      },
    ],
    description: `${what} A person from the register as { "person": id } (people.list; person.add asks the four signs first), `
      + 'or text — a name, initials, a team — where nobody in the register is meant. A picked person is answered by name, '
      + 'or by pseudonym where the organisation says so.',
  }
}

/** One argument, as JSON Schema says it and as {@link checkArguments} checks it. */
export type ArgumentSchema =
  | PersonRefSchema
  | { readonly type: 'string'; readonly description: string; readonly enum?: readonly string[] }
  | { readonly type: 'integer'; readonly description: string; readonly minimum?: number; readonly maximum?: number }
  | { readonly type: 'number'; readonly description: string }
  | { readonly type: 'boolean'; readonly description: string }
  | {
    readonly type: 'array'; readonly description: string
    readonly items: { readonly type: 'string'; readonly enum?: readonly string[] } | RowSchema
  }
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

/**
 * One tool as a client is told it. `Name` is this vocabulary's own names by
 * default; a host that answers tools of its own describes them in the same
 * shape with names of its choosing (`mcpProtocol`'s `RespondOptions.hostTools`).
 */
export type ToolSpec<Name extends string = ToolName> = {
  readonly name: Name
  readonly tier: ToolTier
  readonly description: string
  readonly inputSchema: InputSchema
}

const NO_ARGUMENTS: InputSchema = { type: 'object', properties: {}, additionalProperties: false }

/** A scope's built-in kinds (`projects/scope.ts`'s `SCOPE_KINDS`, said again: `agent` may not import `projects`). */
const SCOPE_KINDS = ['organisation', 'domain', 'programme', 'team', 'landscape'] as const

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
const KINDS = ['actor', 'step', 'function', 'process', 'application', 'component', 'platform', 'platformService'] as const
const PLATFORM_ARCHETYPES = ['place', 'service', 'network'] as const
const LIFECYCLES = ['planned', 'live', 'retiring', 'retired'] as const
const ZONES = ['actors', 'inputChannels', 'externalSystems', 'landscape', 'management'] as const

/**
 * What `search` finds, in the protocol's words (ADR-0029): one per kind of
 * record the model declares searchable. A decision record is `adr`, the word
 * the hits said before the other kinds were searched.
 */
export const SEARCH_HIT_KINDS = [
  'element', 'documentation', 'view', 'relation', 'adr', 'plan', 'milestone',
  'observation', 'cause', 'solution', 'experiment',
  'unitType', 'role', 'responsibility', 'comment',
] as const
const LINE_STYLES = ['solid', 'dashed', 'dotted'] as const
/**
 * The record a comment is about (ADR-0037 §8): a kind the registry opts in,
 * and an id or a label. Written out for the reason the search's kinds are: a
 * schema is a protocol contract, and the registry is checked against it.
 */
export const COMMENTABLE_TOOL_KINDS = ['observation', 'cause', 'solution', 'experiment', 'element', 'decision', 'transition'] as const
const COMMENT_ABOUT: RowSchema = {
  type: 'object',
  description: 'The record: its kind (a plan is transition) and its id, or the label people call it by (OB-0007, ADR-0003).',
  properties: {
    kind: { type: 'string', description: 'What kind of record.', enum: COMMENTABLE_TOOL_KINDS },
    id: { type: 'string', description: 'Its id, or its label.' },
  },
  required: ['kind', 'id'],
  additionalProperties: false,
}
/**
 * ADR-0012 §5. Written out here rather than imported from `model/relations`
 * because a tool schema is a protocol contract: what a client is told and what
 * {@link checkArguments} enforces have to be the same literal, and the model's
 * list is free to grow a member this build has no tool for yet.
 */
const RELATION_TYPES = ['flow', 'supports', 'serves', 'realises', 'assigned', 'uses', 'hostedOn', 'interacts'] as const
/** Team Topologies' three modes, for an `interacts` row (ADR-0036 §7) — a protocol literal, for the reason above. */
const INTERACTION_MODES = ['collaboration', 'service', 'facilitating'] as const

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
  mode: {
    type: 'string',
    description: 'interacts only (ADR-0036 §7): how the two units work together — collaboration, service (one '
      + 'provides what the other consumes, X-as-a-Service) or facilitating (one helps the other learn or adopt something).',
    enum: INTERACTION_MODES,
  },
} as const satisfies Record<string, ArgumentSchema>

/** What a line says and when it is there. Null clears any of them. */
const CONNECTION_FIELDS = {
  label: { type: 'string', description: 'What flows, in a few words.' },
  protocol: {
    type: 'string',
    description: 'How: REST, AMQP, SFTP, a file drop. On the CONTAINER line (ADR-0013): an application-level '
      + 'interface with refinements shows the set they carry and keeps none of its own, and the first refinement '
      + 'to land clears it. One with no refinements keeps it.',
  },
  technology: { type: 'string', description: 'What the interface is built out of, in a few words. On the container line, as protocol is.' },
  refines: {
    type: 'string',
    description: 'The id of the application-level interface this container-level line is part of (ADR-0013). '
      + 'Each end must be the corresponding end of that line or a component filed under it — source under source, '
      + 'target under target — and that line must not itself refine one: an interface lands once. Null detaches, '
      + 'leaving the line an interface of its own.',
  },
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
  platformArchetype: { type: 'string', description: 'A platform only: what it is (ADR-0014) — a place something is hostedOn (a cluster, a namespace, an account: the deployment boxes draw these), a service something consumes (a broker, a bus, a vault), or a network. Service when unsaid.', enum: PLATFORM_ARCHETYPES },
  shared: { type: 'boolean', description: 'A platformService only: offered for use beyond the team that maintains it (ADR-0014). False or null takes it off. Where unsaid, a service assigned to one actor and used by an application of another team is reported as check.offeredNotShared rather than assumed.' },
  lifecycle: { type: 'string', description: 'Where it is in its life.', enum: LIFECYCLES },
  isManaged: { type: 'boolean', description: 'Kept on the record for the files that carry it; nothing in the app reads or shows it since 3.7.0. Whose a system is, is `outside`.' },
  owner: personArgument('Who answers for it — a person or a team. Which scope owns it is the scope it is kept in. Where none is written, an application\'s owner may be worked out from the operating model\'s rule (answered as ownerByRule).'),
  outside: { type: 'boolean', description: 'True when nobody in this organisation owns it. What the externalSystem kind used to say, as the fact it always was.' },
  partyId: { type: 'string', description: 'The id of the actor it belongs to, where that has been said: one this scope keeps or one a scope above it keeps. Only meaningful with outside.' },
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
  unitTypeId: {
    type: 'string',
    description: 'An actor only: the organisation\'s kind of unit it is, by the id of a unit type (unitTypes.list) — which makes it a unit '
      + '(ADR-0036 §3), holding the roles its type says. Null or empty takes it off, and it is a party again.',
  },
  scopes: {
    type: 'array',
    description: 'A function: the domains it is handed to, by scope path, each below the scope that defines it — the scope above\'s '
      + 'intent; a domain taking it up is a stand-in in its own sheet, which this does not write. A unit: the domains it serves, by scope path — absent means '
      + 'the scope it is kept in, or no domain where that is the organisation ("" is never a domain, and is dropped); several only where '
      + 'its unit type spans domains (a check says so otherwise). Replaces the list; null clears it. Each domain named takes the unit\'s '
      + 'type as its own (ADR-0036, amended 17 October 2026) unless its type already agrees with a unit serving it; the answer\'s scopeTypes says which did. '
      + 'Every path is checked against the tree (ADR-0040): one it does not hold is agent.unknownScope, naming the entry.',
    items: { type: 'string' },
  },
  extraSlots: {
    type: 'array',
    description: 'A unit only: roles it holds beyond its type\'s, each with how many. Replaces the list; null clears it.',
    items: {
      type: 'object',
      description: 'One role and its count.',
      properties: {
        roleId: { type: 'string', description: 'The role, by id (roles.list).' },
        min: { type: 'integer', description: 'At least this many; 0 for a role it may have and need not.', minimum: 0 },
        max: { type: 'integer', description: 'At most this many; leave it out for no upper bound.', minimum: 0 },
      },
      required: ['roleId', 'min'],
      additionalProperties: false,
    },
  },
} as const satisfies Record<string, ArgumentSchema>

const PLAN_STATUSES = ['draft', 'agreed', 'running', 'done', 'abandoned'] as const

const PLAN_ID: ArgumentSchema = { type: 'string', description: 'The plan: its id, or its label such as TR-0003.' }

/** A plan's scalar fields, beyond title and status. Null clears any of them. */
const PLAN_FIELDS = {
  from: { type: 'string', description: 'The day the work starts, yyyy-mm-dd.' },
  to: { type: 'string', description: 'The day it is due to end, yyyy-mm-dd.' },
  owner: personArgument('Who answers for it.'),
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

/** The accepted records a proposal replaces (ADR-0008, amended 28 September 2026). */
const SUPERSEDES: ArgumentSchema = {
  type: 'array',
  description: 'The ids of accepted records this one replaces, replacing the list. Accepting this record moves each of them to superseded in the same step; rejecting it leaves them accepted.',
  items: { type: 'string' },
}

const PROPOSED_BY = personArgument(
  'Who proposed it. When the only approving signer is the same person, accepting it answers with a warning. Once anybody has signed, the proposer\'s name is fixed beside the id.',
)

/** Who a decision was put to. Given whole: the list replaces the list. */
const SIGNERS: ArgumentSchema = {
  type: 'array',
  description: 'The people the decision is put to, replacing the list. Each has a name and may have a role, a verdict and the day of it.',
  items: {
    type: 'object',
    description: 'One signer. A person from the register who gives a verdict keeps the name they signed with, beside the id: it stays after they are forgotten. '
      + 'Where the organisation gives agents pseudonyms, that name is withheld from you (signedAsWithheld, proposedAsWithheld).',
    properties: {
      name: personArgument('Who.'),
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
/** The records a merge folds into its survivor (ADR-0035 §6), each with its scope where it is not the survivor's. */
const MERGE_ABSORB = (what: string, labels: string): ArgumentSchema => ({
  type: 'array',
  description: `The ${what}s folded into the survivor.`,
  items: {
    type: 'object',
    description: `One ${what} to fold in.`,
    properties: {
      id: { type: 'string', description: `The ${what}, by id or ${labels} label.` },
      scope: { type: 'string', description: 'The path of the scope it lives in, when it is not the survivor\'s.' },
    },
    required: ['id'],
    additionalProperties: false,
  },
})

/** What is chosen for the links a merge touches: by the key merge.plan answers. */
const MERGE_LINKS: ArgumentSchema = {
  type: 'array',
  description: 'What to do with a link the merge touches, by the key merge.plan answers. A row not named moves where it may, at the strength offered.',
  items: {
    type: 'object',
    description: 'One link.',
    properties: {
      key: { type: 'string', description: 'The row\'s key, as merge.plan answers it.' },
      move: { type: 'boolean', description: 'false: it stays on the absorbed record, as history. true for a row that may not move is refused.' },
      strength: { type: 'string', description: 'Its strength where it lands. Default: the stronger of the links that land there.', enum: ['strong', 'normal', 'weak'] },
    },
    required: ['key'],
    additionalProperties: false,
  },
}

/** What a surviving observation may be given to say. */
const OBSERVATION_VALUES = {
  title: { type: 'string', description: 'The title. Not blank.' },
  where: { type: 'string', description: 'Where it was seen. Not blank.' },
  by: personArgument('Who saw it. Not blank.'),
  impact: { type: 'string', description: 'How much it matters.', enum: ['minor', 'major', 'critical'] },
  date: { type: 'string', description: 'The day it was first seen, yyyy-mm-dd: usually the earliest of the set.' },
  body: { type: 'string', description: 'The body as markdown: the survivor\'s, with what the others add.' },
} as const satisfies Record<string, ArgumentSchema>

/** What a surviving cause may be given to say. */
const CAUSE_VALUES = {
  title: { type: 'string', description: 'The title. Not blank.' },
  state: { type: 'string', description: 'Assumed or verified; verified only when a person says it was checked, with the evidence in the body.', enum: ['assumed', 'verified'] },
  root: { type: 'boolean', description: 'Whether it is a root cause. Only when a person said so.' },
  body: { type: 'string', description: 'The body as markdown.' },
} as const satisfies Record<string, ArgumentSchema>

/**
 * A unit type's or a role's days and what follows it (ADR-0036 §6): a change
 * with a day. A new name is an edit; one that stops existing ends on a day
 * and names its successors, which a reorganisation suggests in its place.
 */
const DATED_FIELDS = (what: string): Readonly<Record<string, ArgumentSchema>> => ({
  from: { type: 'string', description: `The first day of the ${what}, yyyy-mm-dd; null clears it.` },
  until: { type: 'string', description: `The last day of the ${what}, yyyy-mm-dd; null clears it.` },
  successors: {
    type: 'array',
    description: `What follows the ${what} when it ends, by id, of the same kind; null or an empty list clears it.`,
    items: { type: 'string' },
  },
})

/** Solid, a line manager's; dotted, functional (ADR-0039 §1). */
const LINE_KIND: ArgumentSchema = {
  type: 'string', enum: ['solid', 'dotted'],
  description: 'solid: the holders of the target role manage these, in place of the nesting, and a right a host grants from managing '
    + 'follows it. dotted: functional, shown and answered, and deciding nothing. Default solid.',
}

/** A slot's reporting line (ADR-0039 §2). */
/** One reporting line said on a role or on a unit type's slot (ADR-0039 §2, amended 17 October 2026). */
const REPORTS_TO_LINE: RowSchema = {
  type: 'object',
  description: 'One line: where the holders report, of one kind.',
  properties: {
    roleId: {
      type: 'string',
      description: 'The role reported to, by id (roles.list). Leave it out on a slot to say the holders report by nesting in units '
        + 'of this type, whatever the role says for itself.',
    },
    kind: LINE_KIND,
    within: { type: 'boolean', description: 'True: the holders report to that role in the same unit (a developer to the team\'s tech lead).' },
    from: { type: 'string', description: 'The first day of the line, yyyy-mm-dd.' },
    until: { type: 'string', description: 'The last day of the line, yyyy-mm-dd.' },
  },
  additionalProperties: false,
}

const REPORTS_TO = (where: string): ArgumentSchema => ({
  type: 'array',
  description: `Where the holders of this role report, ${where}: at most one line of each kind, solid (a line manager's, which `
    + 'decides who manages them) and dotted (functional, shown and deciding nothing). Each lands on the holders of roleId in the same '
    + 'unit where within is true, else in the nearest unit above that has the role, else in the one unit of the organisation that has '
    + 'it. The nearest place that says anything wins, kind by kind: a unit\'s own line (reportingLine.set) over the unit type\'s slot, '
    + 'over the role. An empty list says nothing. A solid line that would close a loop is refused (reportingLine.loop), and one from a '
    + 'role to itself in the same unit (reportingLine.self).',
  items: REPORTS_TO_LINE,
})

/** One holder a line may land on, in place of every holder of the role there (ADR-0039, amended 17 October 2026). */
const TARGET_PERSON: ArgumentSchema = {
  type: 'string',
  description: 'One holder of that role in that unit, by register id (assignments.list): the line lands on them alone, and who manages '
    + 'in turn goes on from them. Leave it out for whoever holds the role there. Where they no longer hold it on a day, the line is '
    + 'vacant that day (a finding) and the model\'s answer stands.',
}

/** One line of a holder's own (ADR-0039, amended 17 October 2026): to a role in a unit, of one kind, on its days. */
const PERSON_LINE: RowSchema = {
  type: 'object',
  description: 'One line of the holder\'s own: to the holders of a role in a unit, of one kind.',
  properties: {
    to: {
      type: 'object',
      description: 'Where they report: a unit anywhere in the organisation, and its role.',
      properties: {
        unitId: { type: 'string', description: 'The unit reported to, anywhere in the organisation (assignments.list, elements.list).' },
        roleId: { type: 'string', description: 'Its role reported to, by id (roles.list).' },
        person: TARGET_PERSON,
      },
      required: ['unitId', 'roleId'],
      additionalProperties: false,
    },
    kind: LINE_KIND,
    from: { type: 'string', description: 'The first day of the line, yyyy-mm-dd. Leave it out for as long as the assignment runs.' },
    until: { type: 'string', description: 'The last day of the line, yyyy-mm-dd. It ends with the assignment in any case.' },
  },
  required: ['to'],
  additionalProperties: false,
}

/** A holder's own lines, as `assignment.add` and `assignment.update` take them. */
const PERSON_LINES: ArgumentSchema = {
  type: 'array',
  description: 'An EXCEPTION to the model, for this holder only: where they report in place of what their role, their unit\'s type, '
    + 'their unit and nesting say. Write it only when the person you act for explicitly asks for this exception, and say in your answer '
    + 'that it is one; otherwise leave it out and the model\'s lines hold. At most one line of each kind: a solid one decides who manages '
    + 'this holder (and the managing right a host grants follows it); a dotted one is functional and replaces their role\'s dotted line '
    + 'for them. A line to their own role in their own unit is refused (reportingLine.self), and a solid one that would close a loop '
    + '(reportingLine.loop). On assignment.update the list replaces theirs; an empty list or null goes back to the model\'s.',
  items: PERSON_LINE,
}

/** What a unit type says beside its name (ADR-0036): the fields `unitType.add` and `unitType.update` share. */
const UNIT_TYPE_FIELDS: Readonly<Record<string, ArgumentSchema>> = {
  purpose: { type: 'string', description: 'What a unit of this type is for, in the organisation\'s own words.' },
  top: { type: 'boolean', description: 'A unit of it may sit at the top, under the organisation itself.' },
  within: { type: 'array', description: 'The unit types a unit of it may sit in, by id.', items: { type: 'string' } },
  spans: { type: 'boolean', description: 'A unit of it may serve more than one domain.' },
  slots: {
    type: 'array',
    description: 'The roles a unit of it holds, and how many of each.',
    items: {
      type: 'object',
      description: 'One role and its count.',
      properties: {
        roleId: { type: 'string', description: 'The role, by id (roles.list).' },
        min: { type: 'integer', description: 'At least this many; 0 for a role it may have and need not.', minimum: 0 },
        max: { type: 'integer', description: 'At most this many; leave it out for no upper bound.', minimum: 0 },
        reportsTo: REPORTS_TO('in every unit of the type, in place of what the role says'),
      },
      required: ['roleId', 'min'],
      additionalProperties: false,
    },
  },
  limit: { type: 'integer', description: 'How many applications a unit of it should own at most. A check reads it; nothing refuses it.', minimum: 0 },
  order: {
    type: 'number',
    description: 'Where it stands among the unit types of its lane, low first; those with none follow, by name. Null clears it.',
  },
  ...DATED_FIELDS('unit type'),
}

/** What a role says beside its name (ADR-0036): the fields `role.add` and `role.update` share. */
const ROLE_FIELDS: Readonly<Record<string, ArgumentSchema>> = {
  short: { type: 'string', description: 'A few letters, for the matrix\'s heading.' },
  purpose: { type: 'string', description: 'What the role is for, in the organisation\'s own words.' },
  manages: { type: 'boolean', description: 'Whoever holds it manages the people of the unit and of the units below it. The app holds the flag and grants nothing.' },
  reportsTo: REPORTS_TO('wherever the role is held'),
  duties: {
    type: 'array',
    description: 'Its part in each responsibility it has one in.',
    items: {
      type: 'object',
      description: 'One responsibility and the part the role plays in it.',
      properties: {
        responsibilityId: { type: 'string', description: 'The responsibility, by id (responsibilities.list).' },
        raci: { type: 'string', description: 'R responsible, A accountable, C consulted, I informed.', enum: ['R', 'A', 'C', 'I'] },
      },
      required: ['responsibilityId', 'raci'],
      additionalProperties: false,
    },
  },
  ...DATED_FIELDS('role'),
}

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
    name: 'app.current',
    tier: 'drive',
    description:
      'Where the app is: the scope open in the workspace with the view on its tab and the page over it, or '
      + '— with nothing open — whose home screen is up; plus who is connected, whether a driving session is '
      + 'running and whether the person stopped one. Call this first when a tool was refused with '
      + 'agent.noProject or agent.scopeNotOpen: app.open moves the app, and this says where it stands.',
    inputSchema: NO_ARGUMENTS,
  },
  {
    name: 'scopes.list',
    tier: 'read',
    description:
      'Every scope in the organisation (ADR-0012 §1): its path, its name, what it says it is — a unit type of the '
      + 'operating model (unitTypeId and unitType, ADR-0036) or a built-in kind (organisation, domain, programme, team '
      + 'or landscape — a landscape scope, which is not the same thing as a landscape board) — the units that serve it '
      + 'today with their types (servedBy), how its type stands to theirs (typeLink: agrees, disagrees, unserved, gone '
      + 'or unsaid), how many views it holds, and which one is open in the app. The tree is kept with scope.create, '
      + 'scope.update, scope.move and scope.remove (ADR-0040). A scope\'s type follows the unit linked to it: '
      + 'a unit\'s scopes written by element.add or element.update give each scope the unit\'s type where this host writes '
      + 'other scopes, and the answer\'s scopeTypes says which did. A path is what `scope` takes on every other tool; '
      + '"" is the organisation itself. A function of a business sheet and the tree are linked three ways, told apart: a unit '
      + 'answers for it (relation.add, assigned), it is handed to a domain (element.update, its scopes), and a domain takes it up '
      + '(a stand-in of it in that domain\'s sheet).',
    inputSchema: NO_ARGUMENTS,
  },
  {
    name: 'views.list',
    tier: 'read',
    description:
      'Every view in the organisation, scope by scope: boards (layer7 and container), business sheets, '
      + 'enterprise maps, technology landscapes, drawings, organisation charts (chart) and Conway maps (conway), each with '
      + 'its id, name and kind, and which is on the tab '
      + 'in its scope. A drawing also says the element it is anchored to, when it has one, and the element ids its '
      + 'shapes point at. The overview a person gets from the organisation screen and the tabs, in one answer; '
      + 'app.open takes a row\'s scope and id. Reads every scope that holds a view, so ask once and keep it.',
    inputSchema: {
      type: 'object',
      properties: {
        scope: { type: 'string', description: 'Only this scope and the scopes filed under it, by path; "" is the organisation.' },
        kind: {
          type: 'string',
          description: 'Only views of this kind.',
          enum: ['layer7', 'container', 'sheet', 'map', 'technology', 'drawing', 'chart', 'conway'],
        },
        limit: { type: 'integer', description: 'At most this many. Default 500.', minimum: 1, maximum: 5000 },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'register.list',
    tier: 'read',
    description:
      'Every application in the organisation, derived from the whole tree (ADR-0012 §2): the scope that '
      + 'answers for it (its master), the scopes above that declare it, the scopes that draw it as a '
      + 'stand-in, whether it is outside the organisation and whose it is, and the keys of the findings '
      + 'about it — defined twice, a stale cache, unattributed. Filter by a free-text query over name, id '
      + 'and master. The services and platforms are technology.list, beside it.',
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
    name: 'technology.list',
    tier: 'read',
    description:
      'Every platform service and platform in the organisation, derived from the whole tree (ADR-0014): '
      + 'the scope that answers for it, the scopes that draw it, and what the rows say. A service: who '
      + 'maintains it (assigned), whether it is shared, how many applications consume it and from how many '
      + 'scopes, and what realises it — empty is a real gap. A platform: what it is, what it realises, how '
      + 'many things are hosted on it or on anything filed under it, what it sits in, and the service it '
      + 'belongs to. With the keys of the findings about it, including check.offeredNotShared. Beside '
      + 'register.list, which is the applications. Filter by kind, or by a free-text query over name, id, '
      + 'master and maintainer.',
    inputSchema: {
      type: 'object',
      properties: {
        kind: { type: 'string', description: 'Only services, or only platforms. Default both.', enum: ['platformService', 'platform'] },
        query: { type: 'string', description: 'Only rows whose name, id, master or maintainer contains every word.' },
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
      + 'check.unmapped and check.uncovered (the business layer\'s two), check.causeExplainsObservationBelow (a '
      + 'cause explains an observation of a scope below, which nothing makes any more: link the cause there that '
      + 'explains it, named in the detail, instead), check.drawingLinkMissing (a shape on a drawing '
      + 'points at an element this scope does not hold), and check.notDrawn (a master drawn on no view). The operating model\'s, at the organisation: '
      + 'check.accountability (a responsibility not exactly one role\'s A) and check.unitTypeNowhere (a unit type '
      + 'neither at the top nor in a unit type that sits anywhere, so no unit of it can be placed). The organisation\'s own (ADR-0036): '
      + 'check.roleVacant, check.roleOverMax, check.unitMisplaced, check.unitSpans, check.unitOverLimit, '
      + 'check.assignmentEnded, check.assignmentOrphaned (an assignment, running or over, in a unit that is not there: '
      + 'the person in person; a person removes it, from the Checks page — tell them), check.unitTypeEnded, check.personOverloaded and check.unitNotServing (an area, grouping or '
      + 'capability assigned to a unit that serves neither its domain nor sits under a unit that does; the unit in detail); '
      + 'check.servedScopeGone (a unit that serves a path no scope is at — a scope removed, or moved before 3.7.5 — '
      + 'the path in detail: put it right with element.update on the unit\'s scopes); '
      + 'and the reporting lines\' (ADR-0039), about the unit a line runs from: check.reportingLoop (solid lines that come '
      + 'back to where they started, the chain in detail), check.reportingDangling, check.reportingAmbiguous and '
      + 'check.reportingVacant (reportingLines.list says each line), '
      + 'read on a day — today, or the day '
      + 'given as on, with every plan\'s moves of that day. Beside its key each finding answers its weight — fix (the '
      + 'model contradicts itself), review (worth a look) or note (information, often intended) — its category '
      + '(landscape, plans, organisation, teams, analysis), and why its check matters and how to fix it, in English, '
      + 'from the one catalogue of checks. A note — check.notDrawn, check.proposal — is listed only when the notes are '
      + 'asked for (notes), or when its key is. A finding is never a '
      + 'refusal and never a reason a save fails. A review or a note a person marked as intended is answered apart, '
      + 'under marked (its total, and each finding with mark: the day it was marked and the reason given), and is not '
      + 'among total and some. No tool marks a finding as intended or takes a mark back: that is a person\'s, so an '
      + 'agent cannot silence a check. The Checks page on a home (app.open page checks) lists these beside the dates\' '
      + 'findings of every scope (roadmap.check) and the Conway map\'s (diagram.inspect), by check and category, in the '
      + 'same weights and words.',
    inputSchema: {
      type: 'object',
      properties: {
        scope: { type: 'string', description: 'Only findings about this scope, by path; "" is the organisation.' },
        on: { type: 'string', description: 'The day the organisation\'s findings are read on, yyyy-mm-dd. Default: today.' },
        key: { type: 'string', description: 'Only findings with this key.' },
        notes: { type: 'boolean', description: 'Include the notes: findings whose check is weighed a note, information that may well be intended. Default false.' },
        information: { type: 'boolean', description: 'The same as notes, by its older name.' },
        limit: { type: 'integer', description: 'At most this many. Default 200.', minimum: 1, maximum: 2000 },
      },
      additionalProperties: false,
    },
  },

  // --- the tree (ADR-0040 §1–§2): about the tree, not the scope open; each its scope's own step ---
  {
    name: 'scope.create',
    tier: 'write',
    description:
      'Make a scope under another (ADR-0040), as the organisation screen\'s new-scope dialog does, with or without a scope open: '
      + 'at the address the dialog gives it — the name\'s slug under the parent, suffixed where that is taken or a reserved word '
      + '(the answer says the path). withBoard makes a landscape scope with one board; without, a domain, which files others '
      + 'and draws nothing itself. servedBy links a unit (an actor with a unit type, element.describe) to serve it from the '
      + 'start: the unit\'s scopes are written in the scope that keeps the unit and the new scope takes the unit\'s type, as '
      + 'Served by does; a link refused leaves the scope made and the answer says where the link is made instead. Refused '
      + 'agent.unknownScope for a parent that is not there. Not a step on the scope open, so not in a batch and not undone '
      + 'with undo. Answers the path, the name, the kind, the board and what the link came to.',
    inputSchema: {
      type: 'object',
      properties: {
        parent: { type: 'string', description: 'The scope to file it under, by path; "" is the organisation (scopes.list).' },
        name: { type: 'string', description: 'What it is called. Its address is made from it.' },
        withBoard: { type: 'boolean', description: 'Give it a first board, making it a landscape scope. Default false: a domain.' },
        servedBy: ID('unit to serve it from the start'),
      },
      required: ['parent', 'name'],
      additionalProperties: false,
    },
  },
  {
    name: 'scope.update',
    tier: 'write',
    description:
      'Change what a scope says about itself (ADR-0040), as its settings dialog does: its name and description, and what it '
      + 'is — a unit type of the operating model (unitTypeId, unitTypes.list) or a built-in kind, never both: the one given '
      + 'clears the other — the client its drawings are made out to, and its links. Only the fields given change; null clears '
      + 'an optional one. The organisation is described like any scope. The address stays: scope.move files it elsewhere. '
      + 'Answers which fields changed.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'The scope, by path; "" is the organisation.' },
        name: { type: 'string', description: 'What it is called. A scope keeps a name.' },
        description: { type: 'string', description: 'What it is, in a sentence or two. Null or empty clears it.' },
        kind: { type: 'string', description: 'A built-in kind. Clears unitTypeId. Null clears it.', enum: SCOPE_KINDS },
        unitTypeId: { type: 'string', description: 'A unit type of the operating model, by id (unitTypes.list). Clears kind. Null clears it.' },
        client: { type: 'string', description: 'Who drawings made here are addressed to, where not the scope itself. Null or empty clears it.' },
        links: {
          type: 'array',
          description: 'Where its material lives, whole. Empty or null clears them.',
          items: {
            type: 'object',
            description: 'One link.',
            properties: {
              label: { type: 'string', description: 'What it is called.' },
              url: { type: 'string', description: 'Where it is: an http, https or mailto address.' },
            },
            required: ['label', 'url'],
            additionalProperties: false,
          },
        },
      },
      required: ['path'],
      additionalProperties: false,
    },
  },
  {
    name: 'scope.move',
    tier: 'write',
    description:
      'File a scope, and everything filed under it, under another parent (ADR-0040): its last address segment kept, '
      + 'suffixed where taken. Every identity, state and history goes with it, and every stand-in elsewhere that named an '
      + 'address in it is re-addressed as that scope\'s own step, and so is every unit whose served scopes name one (listed in '
      + 'units, by id and the scope that keeps it); one kept in a scope the person may not write is listed '
      + 'in notCarried, and the move stands. Refused scope.organisation for the organisation, shell.scopeIntoItself for a '
      + 'parent under the scope itself. Answers from, to, carried, notCarried and units.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'The scope to move, by path.' },
        parent: { type: 'string', description: 'The scope to file it under, by path; "" is the organisation.' },
      },
      required: ['path', 'parent'],
      additionalProperties: false,
    },
  },
  {
    name: 'scope.remove',
    tier: 'write',
    description:
      'Remove one scope (ADR-0040). There is no undo for this. An empty scope goes on request — what it says about itself is '
      + 'not work. One with scopes under it is refused scope.scopesBelow, naming them: remove those first, deepest first, '
      + 'one call each. One that holds work — views, elements, records, plans, assignments, comments, pictures — is refused '
      + 'scope.notEmpty with what it holds: tell the person, and only if they then say in their own words that it is to go '
      + 'with all of it, call again with removeContents and their words in personSaid. Answers what went, by kind.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'The scope to remove, by path. Never the organisation.' },
        removeContents: {
          type: 'boolean',
          description: 'Set only when the person you act for said, in their own words, after you told them what the scope '
            + 'holds, that it is to go with all of it. Never on your own judgement, and never because a call was refused.',
        },
        personSaid: { type: 'string', description: 'Their words, quoted, at most 500 characters, with removeContents and only with it: kept with the removal, and shown to them.' },
      },
      required: ['path'],
      additionalProperties: false,
    },
  },

  // --- the people register (ADR-0036 §13): outside the history, the organisation's, never forgotten from here ---
  {
    name: 'people.list',
    tier: 'read',
    description:
      'The organisation\'s people register (ADR-0036), kept outside the history: each entry\'s id, name, kind '
      + '(internal or external), state (active, left or forgotten) and the days it moved, and whether it has a '
      + 'work address — never the address. `shows` says whether names are shown or, where the organisation\'s '
      + 'policy says so, pseudonyms (Person 4K7Q; a forgotten entry is Former colleague 4K7Q). `redirects` are '
      + 'entries a merge folded into another: an id there resolves to its mergedInto. `possibleDuplicates` are '
      + 'pairs that may be one person — the same address, the same name, nearly the same name, or the same '
      + 'family name and initial — for a person to merge on the People page, without the pairs a person answered '
      + 'there as not the same person. No tool forgets, removes or merges, and none answers or takes back that '
      + 'two entries are not the same person.',
    inputSchema: {
      type: 'object',
      properties: {
        state: { type: 'string', description: 'Only entries in this state. Default all.', enum: PERSON_STATES },
        query: { type: 'string', description: 'Only entries whose name as shown, or id, contains every word.' },
        limit: { type: 'integer', description: 'At most this many. Default 200.', minimum: 1, maximum: 2000 },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'person.add',
    tier: 'write',
    description:
      'Add a person to the register (ADR-0036): active, with an id and a pseudonym drawn at random. Not a step — '
      + 'there is no undo and no Activity line; a mistake is put right by a person on the People page. Checks '
      + 'for a possible duplicate first, as every way in does: where somebody similar is there already the call '
      + 'is refused with agent.possibleDuplicate and the candidates in the detail — use their id, or call again '
      + 'with addAnyway when it is truly somebody else. Answers the entry as shown to agents.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'What they are called.' },
        email: { type: 'string', description: 'A work address, where known. Kept, never told back.' },
        kind: { type: 'string', description: 'Of the organisation, or from outside it. Default internal.', enum: PERSON_KINDS },
        addAnyway: { type: 'boolean', description: 'Add even though the register holds somebody similar.' },
      },
      required: ['name'],
      additionalProperties: false,
    },
  },
  {
    name: 'person.leave',
    tier: 'write',
    description:
      'Mark a person as left on their last day (ADR-0036 §10): the register says left, the name stays shown for '
      + 'the period the organisation\'s policy sets and is then forgotten, and everything leaving does beyond the '
      + 'register is done — `endedAssignments` says how many of their assignments ended. Not a step. Only '
      + 'someone active leaves, and not on a day further back than the policy keeps a name, which would forget it at once. '
      + 'Forgetting and removing are a person\'s, on the People page.',
    inputSchema: {
      type: 'object',
      properties: {
        id: ID('person, from people.list'),
        on: { type: 'string', description: 'Their last day, yyyy-mm-dd. Default today.' },
      },
      required: ['id'],
      additionalProperties: false,
    },
  },
  {
    name: 'elements.list',
    tier: 'read',
    description:
      'The elements of the landscape, one line each: id, name, kind, lifecycle, and the '
      + 'category, vendor, technology, owner, lifecycle dates, successor, parent, order, lane and '
      + 'outside flag where set. Filter by kind, by parent (the capabilities under a function, the steps '
      + 'under a phase), by the diagram they are drawn on, or by a free-text query over name, category, '
      + 'vendor and technology.',
    inputSchema: {
      type: 'object',
      properties: {
        kind: {
          type: 'string',
          description: 'Only elements of this kind. A step is a journey, a phase or a step; a function an area, a grouping or a capability.',
          enum: KINDS,
        },
        parentId: { type: 'string', description: 'Only the elements filed directly under this one: a function\'s capabilities, a phase\'s steps, an application\'s components, an actor group\'s actors.' },
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
      + 'and `ref` are caches of what is written there, and its description is the owner\'s, shown here and changed there. '
      + 'Everything else on a stand-in — lifecycle, dates, owner, vendor, technology, aspects — belongs to the '
      + 'owning scope and cannot be changed from here.',
    inputSchema: { type: 'object', properties: { id: ID('element') }, required: ['id'], additionalProperties: false },
  },
  {
    name: 'connections.list',
    tier: 'read',
    description:
      'The connections between elements: id, source, target, label, protocol, technology, the days it is valid '
      + 'where dated, and which plan dated it where a port did. '
      + 'An application-level interface that has landed a level down carries its "refinements" nested — the container '
      + 'lines that are part of it, each with its ends and its own protocol — and a container line says which '
      + 'interface it "refines" (ADR-0013). '
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
      'The diagrams of the project: id, name, kind (a layer-7 landscape, a C4 container view, a sheet, '
      + 'a map, a technology landscape or a drawing), which application a container view is about, '
      + 'and how many elements each draws. A drawing also says the element it is anchored to, when it '
      + 'has one, and the element ids its shapes point at.',
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
    name: 'observations.list',
    tier: 'read',
    description:
      'What was observed in this scope (ADR-0021): id, label, title, date, where, impact, how often it was seen, '
      + 'and the causes it was analysed into. With below true, the observations of every scope under this one '
      + 'instead (ADR-0032): local to those scopes, each with the path of the scope it lives in and the causes of '
      + 'that scope that explain it. An observation merged into another is listed only when includeMerged is true, '
      + 'with mergedInto — and mergedIntoScope where the survivor lives in another scope (ADR-0035); '
      + 'an archived one — fixed, addressed, no longer relevant — only when includeArchived is true. A bright spot — '
      + 'something that works (ADR-0038) — says bright: true; tone lists the problems or the bright spots alone.',
    inputSchema: {
      type: 'object',
      properties: {
        impact: { type: 'string', description: 'Only observations of this impact.', enum: ['minor', 'major', 'critical'] },
        tone: { type: 'string', description: 'problems: only what goes wrong; bright: only the bright spots, what works; all (the default): both.', enum: ['all', 'problems', 'bright'] },
        analysed: { type: 'boolean', description: 'true: only those linked to a cause; false: only those not yet analysed.' },
        includeMerged: { type: 'boolean', description: 'Also list observations that were merged into another.' },
        includeArchived: { type: 'boolean', description: 'Also list observations that were archived.' },
        below: { type: 'boolean', description: 'true: the observations of the scopes below this one, each with its scope, instead of this scope\'s own.' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'observation.read',
    tier: 'read',
    description: 'One observation in full: its fields, its dated history, the causes that explain it, and its body as markdown.',
    inputSchema: { type: 'object', properties: { id: ID('observation') }, required: ['id'], additionalProperties: false },
  },
  {
    name: 'causes.list',
    tier: 'read',
    description:
      'The causes this scope\'s analysis found (ADR-0021): id, label (CA-, or RC- for a root cause), title, assumed '
      + 'or verified, what each explains (observations and shallower causes here, causes of the scopes below, with '
      + 'the strength of each link), what explains it, and whether it is a root cause — one a person said is '
      + '(ADR-0032), where the chain ends. A cause merged into another (cause.merge) is history: listed only when '
      + 'includeMerged is true, with mergedInto — and mergedIntoScope where the survivor lives in another scope.',
    inputSchema: {
      type: 'object',
      properties: {
        state: { type: 'string', description: 'Only causes in this state.', enum: ['assumed', 'verified'] },
        root: { type: 'boolean', description: 'true: only root causes, as said on the cause.' },
        includeMerged: { type: 'boolean', description: 'Also list causes that were merged into another.' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'cause.read',
    tier: 'read',
    description: 'One cause in full: its state, what it explains, what explains it, its body as markdown, and its history — what it absorbed, and where it was merged to.',
    inputSchema: { type: 'object', properties: { id: ID('cause') }, required: ['id'], additionalProperties: false },
  },
  {
    name: 'merge.plan',
    tier: 'read',
    description:
      'What observation.merge or cause.merge would do with these arguments, without doing it (ADR-0035): the '
      + 'survivor and the records it would absorb, every link that names an absorbed record — its key, the record '
      + 'it lives on and the one it names, where it would land, whether it may move and, where not, why in the '
      + 'link form\'s words, whether both records had it and the strength offered — the scopes the merge would '
      + 'write, and the refusal it would meet, if any — and how many comments travel with the absorbed records\' '
      + 'threads, counted for the scope this call is for; those of records in another scope are carried all the same '
      + 'and counted in the merge\'s answer, and commentsNotCounted names those scopes. Pass the key back in links to keep a row where it is or '
      + 'choose its strength. A read: it changes nothing, and answers for a scope that is not open.',
    inputSchema: {
      type: 'object',
      properties: {
        kind: { type: 'string', description: 'Which records are merged.', enum: ['observation', 'cause'] },
        into: { type: 'string', description: 'The survivor, by id or label.' },
        intoScope: { type: 'string', description: 'The path of the scope the survivor lives in, when it is not the one this call is for.' },
        absorb: MERGE_ABSORB('record', 'OB-, CA- or RC-'),
        values: {
          type: 'object',
          description: 'What the survivor would say, as the merge tool of that kind takes it.',
          properties: { ...OBSERVATION_VALUES, ...CAUSE_VALUES },
          additionalProperties: false,
        },
        links: MERGE_LINKS,
      },
      required: ['kind', 'into', 'absorb'],
      additionalProperties: false,
    },
  },
  {
    name: 'move.plan',
    tier: 'read',
    description:
      'What observation.move would do with these arguments, without doing it (ADR-0038): the number the '
      + 'observation would have in the scope it goes to, whether it moves back over its own tombstone there, the '
      + 'scopes it would write, how many comments go with it, and every link it would cut — each cause that '
      + 'explains it, with the solutions on a root cause the link leads to — or, moving back, the links that '
      + 'would explain it again; and the refusal it would meet, if any. A read: it changes nothing, and answers '
      + 'for a scope that is not open.',
    inputSchema: {
      type: 'object',
      properties: {
        id: ID('observation'),
        to: { type: 'string', description: 'The path of the scope it would go to: "" is the organisation (see scopes.list).' },
      },
      required: ['id', 'to'],
      additionalProperties: false,
    },
  },
  {
    name: 'solutions.list',
    tier: 'read',
    description:
      'What this scope is doing about its causes (ADR-0026): each solution with its label, title, state and phase '
      + '(idea, shaped, testing, proven, adopted, implemented — implemented is read off its plan being done — or '
      + 'dropped), benefit and cost, the causes it addresses and whether each is a root, who it was checked with, '
      + 'earlier attempts, its experiments, its decision record and plan, what the next gate still needs '
      + '(next.open), the questions its record asks (worksAround: it treats no root cause; addsOnly: its plan '
      + 'retires nothing; adoptedUnplanned), and, once implemented, any observation seen again since. Dropped '
      + 'ones only with includeDropped.',
    inputSchema: {
      type: 'object',
      properties: {
        phase: { type: 'string', description: 'Only solutions in this phase.', enum: ['idea', 'shaped', 'testing', 'proven', 'adopted', 'implemented', 'dropped'] },
        causeId: { type: 'string', description: 'Only solutions that address this cause (id or CA- label).' },
        includeDropped: { type: 'boolean', description: 'Also list dropped solutions: the alternatives that were considered.' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'solution.read',
    tier: 'read',
    description: 'One solution in full: everything solutions.list says, the alternatives on the same causes, its dated history, and its body as markdown.',
    inputSchema: { type: 'object', properties: { id: ID('solution') }, required: ['id'], additionalProperties: false },
  },
  {
    name: 'experiments.list',
    tier: 'read',
    description: 'The experiments run to find out whether a solution works (ADR-0026): hypothesis, measure, where, by whom, the window, the outcome and the result, and the solutions each tests.',
    inputSchema: {
      type: 'object',
      properties: {
        outcome: { type: 'string', description: 'Only experiments with this outcome.', enum: ['planned', 'running', 'confirmed', 'refuted', 'inconclusive'] },
        solutionId: { type: 'string', description: 'Only experiments that test this solution (id or SO- label).' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'experiment.read',
    tier: 'read',
    description: 'One experiment in full, with its body as markdown.',
    inputSchema: { type: 'object', properties: { id: ID('experiment') }, required: ['id'], additionalProperties: false },
  },

  // --- comments on any record (ADR-0037) ----------------------------------------
  {
    name: 'comments.list',
    tier: 'read',
    description:
      'The comments about one record — its thread, oldest first, each reply under the comment it answers, a removed '
      + 'comment as a tombstone — or, without about, the scope\'s newest comments with the record each is about. A '
      + 'comment is about a record and never changes it: what the record should say is changed in the record. '
      + 'Authors are named as people are named to an agent.',
    inputSchema: {
      type: 'object',
      properties: {
        about: COMMENT_ABOUT,
        limit: { type: 'integer', description: 'Without about: how many of the newest. Default 20.', minimum: 1, maximum: 200 },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'comment.add',
    tier: 'write',
    description:
      'Comment on a record: a question, a doubt, a pointer to more evidence — something said about it, never a change to '
      + 'it. Signed by the person you act for, via your name. replyTo answers a comment; answering a reply answers the '
      + 'comment it is under, so a thread is one level deep.',
    inputSchema: {
      type: 'object',
      properties: {
        about: COMMENT_ABOUT,
        body: { type: 'string', description: 'What it says, as markdown.' },
        replyTo: { type: 'string', description: 'The comment it answers, by id (comments.list).' },
      },
      required: ['about', 'body'],
      additionalProperties: false,
    },
  },
  {
    name: 'comment.update',
    tier: 'write',
    description: 'Change what a comment of your person\'s says. Only its author edits a comment, and a removed one stays removed.',
    inputSchema: {
      type: 'object',
      properties: { id: ID('comment'), body: { type: 'string', description: 'What it says now, as markdown.' } },
      required: ['id', 'body'],
      additionalProperties: false,
    },
  },
  {
    name: 'comment.remove',
    tier: 'write',
    description:
      'Remove a comment: it leaves the thread and a mark stays where it stood, so the replies keep their place. Your '
      + 'person\'s own, or anybody\'s where your person may moderate the scope. Its words stay in the history, as any edit\'s do.',
    inputSchema: { type: 'object', properties: { id: ID('comment') }, required: ['id'], additionalProperties: false },
  },

  // --- the operating model, at the organisation (ADR-0036) --------------------
  {
    name: 'unitTypes.list',
    tier: 'read',
    description:
      'The organisation\'s kinds of unit (ADR-0036), in its own words: each unit type\'s purpose, where a unit of it may sit '
      + '(at the top, under the organisation, and under the unit types listed in within), whether it may serve more than '
      + 'one domain (spans), the roles it holds with how many of each (slots: min, and max where there is one), how many '
      + 'applications a unit of it should own at most (limit), the library entry it was based on (basedOn, with the name '
      + 'it was given then where that was not the library\'s, and where it was put then, placed, where that was not where '
      + 'the library puts it), and the library entries it was matched to when a library was brought in (alsoBasedOn). '
      + 'Listed as the structure stands: by lane — 1 for a type that may sit at the top, and below the deepest type it may '
      + 'sit in — then by its order in the lane, then by name; a type that sits nowhere has no lane, says sitsNowhere and '
      + 'comes last. The operating model is kept at the organisation: whatever scope is open, this answers from there.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'roles.list',
    tier: 'read',
    description:
      'The organisation\'s roles (ADR-0036): name, short name and purpose, its duties — a responsibility each, marked R, '
      + 'A, C or I — whether whoever holds it manages the people of the unit and of the units below (manages), where its '
      + 'holders report wherever it is held (reportsTo, ADR-0039; reportingLines.list lands each line on a unit), the unit '
      + 'types that hold it, the library entry it was based on (basedOn) and those it was matched to when a library was '
      + 'brought in (alsoBasedOn), and the rules that name a role. Kept at the organisation, and answered from there.',
    inputSchema: {
      type: 'object',
      properties: {
        unitTypeId: { type: 'string', description: 'Only the roles this unit type holds.' },
        responsibilityId: { type: 'string', description: 'Only the roles with a part in this responsibility.' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'responsibilities.list',
    tier: 'read',
    description:
      'What somebody in the organisation has to do (ADR-0036), grouped — by value stream, for example — with every role\'s '
      + 'part in it (R, A, C or I), the roles accountable, and a finding where it is not exactly one role\'s A: nobody is '
      + 'accountable, or several are. Kept at the organisation, and answered from there.',
    inputSchema: {
      type: 'object',
      properties: { group: { type: 'string', description: 'Only the responsibilities in this group.' } },
      additionalProperties: false,
    },
  },
  {
    name: 'assignments.list',
    tier: 'read',
    description:
      'Who holds which role in which unit (ADR-0036 §4), across the whole tree: each assignment with the scope that keeps it, '
      + 'its unit and role by id and by name, its person by register id and by name — or by pseudonym where the organisation\'s '
      + 'policy gives agents pseudonyms, and never an address — its share in per cent, its days and whether the person is acting. '
      + 'Those running on the day unless all is asked. Asked about one unit, it also says the unit\'s slots against how many '
      + 'hold each on the day, the roles held there outside them (exceptions), and who manages it: whoever holds a role that '
      + 'manages, in it or a unit above it. Each assignment says who manages its holder, each with via — nesting, line where a '
      + 'solid line of the model\'s decides it (the role\'s or the unit type\'s), override where an exception does (the unit\'s own '
      + 'line, or the holder\'s own) — and the dotted lines apart; the holder\'s own lines as written (reportsTo); and exception: true '
      + 'where the role is not one of the unit\'s slots (ADR-0039, amended 17 October 2026). Core grants nothing from that; it is said.',
    inputSchema: {
      type: 'object',
      properties: {
        scope: { type: 'string', description: 'Only the assignments this scope keeps, by path; "" is the organisation.' },
        unitId: { type: 'string', description: 'Only this unit\'s; the answer then says its slots and who manages it.' },
        roleId: { type: 'string', description: 'Only this role\'s.' },
        personId: { type: 'string', description: 'Only this person\'s, by register id (people.list); an id merged into theirs counts.' },
        on: { type: 'string', description: 'The day, yyyy-mm-dd. Default: today.' },
        all: { type: 'boolean', description: 'Every assignment, over or still to begin as well. Default false.' },
        limit: { type: 'integer', description: 'At most this many. Default 500.', minimum: 1, maximum: 5000 },
      },
      additionalProperties: false,
    },
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
    name: 'platform.report',
    tier: 'read',
    description:
      'One platform, and what would be left standing if it went (ADR-0013): what is filed under it, what it '
      + 'stands on, what runs on it — the containers, each named beside its application, and the applications '
      + 'that have no containers and say where they run themselves — what uses it, and the container-level '
      + 'interfaces that cross it, each with the application-level interface it is part of. A report, not a '
      + 'view: there is no diagram to inspect or render.',
    inputSchema: {
      type: 'object',
      properties: { platformId: ID('platform') },
      required: ['platformId'],
      additionalProperties: false,
    },
  },
  {
    name: 'service.report',
    tier: 'read',
    description:
      'One platform service, and what would be stranded if it were withdrawn (ADR-0014): who maintains it, '
      + 'whether it is shared, what realises it this year — empty is a real gap — who consumes it by '
      + 'application (a container\'s row counts for its application, said beside it) and from which '
      + 'scopes, and which consumers are still on it on the day it goes, or all of them where no day is '
      + 'set. A report, not a view: there is no diagram to inspect or render. The platform\'s side is '
      + 'platform.report.',
    inputSchema: {
      type: 'object',
      properties: { serviceId: ID('platformService') },
      required: ['serviceId'],
      additionalProperties: false,
    },
  },
  {
    name: 'roadmap.check',
    tier: 'read',
    description:
      'What the dates in this landscape contradict: a retirement with connections still live, a '
      + 'successor that goes live after the thing it replaces is gone, a retirement with no '
      + 'successor named, a connection valid after one of its ends has retired, and a plan past '
      + 'the day it was due to finish. It reports contradictions only — it cannot tell you a '
      + 'landscape is out of date. It also reports an "impliedInterface": container-level lines '
      + 'running between two applications with no application-level interface written for them, '
      + 'which interface.accept draws.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'activity.list',
    tier: 'read',
    description:
      'The steps taken in this session, newest first, as the app\'s Activity list shows them: when, by '
      + 'whom (the person, an agent, or another author by name), and what. A step another author made '
      + 'may also say `via`, the client they made it with. Read it to see what stuck; undo takes back '
      + 'the newest steps while they are an agent\'s.',
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
      'The pictures the scope holds for its documents (ADR-0009, ADR-0031): the name each is in its library, '
      + 'the reference a document shows it by (`image:<name>`), its size, and which documents show it.',
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
      'Search every kind of record together, the way ⌘K does in the app: elements and their documentation, views, '
      + 'relations, decision records, plans and their milestones, observations, causes, solutions and experiments — '
      + 'in this scope, the decision records of the scopes above, and the observations and initiatives the scopes '
      + 'below share with it. Every word of the query must occur; case and accents do not matter. Each hit says its '
      + 'kind, its id, its title and, where it has one, its label (OB-0007), status and a snippet of the prose that '
      + 'matched; a hit held by another scope says so as scopePath — read it there by passing that as scope. '
      + 'A hit of kind adr also carries adrId and scope (group, landscape or application), an element or its '
      + 'documentation elementId and name, and a plan planId, as they did before the other kinds were searched.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'What to look for.' },
        limit: { type: 'integer', description: 'At most this many hits per kind. Default 8.', minimum: 1, maximum: 100 },
        kinds: {
          type: 'array',
          description: 'Only these kinds of hit. Default: every kind.',
          items: { type: 'string', enum: SEARCH_HIT_KINDS },
        },
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
      + 'than dragged, so it needs no diagram and can be added while a scope\'s home is on screen. '
      + 'A platform — a cluster, a broker, a bus, the tooling (ADR-0013) — is drawn as the chip of the '
      + 'management band and lands there; what runs on it and what passes through it are rows, not lines. '
      + 'A platformService (ADR-0014) is the offering a platform realises — container platform, message '
      + 'brokering, managed database — what a team asks for and a platform team is accountable for; the same '
      + 'chip, a tree by parentId like every kind. '
      + 'Answers with the id, and with whether it was drawn.',
    inputSchema: {
      type: 'object',
      properties: {
        ...ELEMENT_FIELDS,
        kind: { type: 'string', description: 'What kind of element. Default application.', enum: KINDS },
        parentId: { type: 'string', description: 'What contains it: a component\'s application, a function\'s area, a step\'s phase, an actor\'s group.' },
        diagramId: { type: 'string', description: 'The diagram to draw it on. Default: the one on screen. Not needed for a business kind.' },
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
      + 'not this. Order among siblings is `order`, low first — a sheet lays its trees out by it. '
      + 'A unit\'s parentId may be any unit in the organisation, kept in any scope, found by its id: the unit moves '
      + 'there with its people, its reporting lines, the scopes it serves and the units inside it, its order among its '
      + 'new siblings starts afresh, and a loop over the organisation — today or on a later day a plan\'s move reaches — '
      + 'is refused. Where its type may not sit there it is moved all the same and the answer says misplaced: true. '
      + 'Call it in the scope that keeps the unit. This is a correction, with no day; a move on a day is plan.move.',
    inputSchema: {
      type: 'object',
      properties: {
        id: ID('element'),
        ...ELEMENT_FIELDS,
        parentId: { type: 'string', description: 'What contains it now: a component\'s application, a function\'s area or grouping, a step\'s phase, an actor\'s group, a unit\'s parent unit anywhere in the organisation. Null makes it a root — a unit at the top.' },
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
      + 'diagram, and any container view about it — and, for a unit, every assignment in it, ended ones included: '
      + 'deleting a unit is a correction, so its people\'s roles in it go as if never held, and the answer lists them '
      + '(assignmentsRemoved). To keep who held what, retire the unit on a day with element.update instead. '
      + 'The units inside a unit move up into its parent where their type may sit there (unitsMoved); where it may '
      + 'not, the call is refused with agent.unitsInside and the choices named — never pick one yourself: ask the '
      + 'person, then call again with units. Applications that name the unit as their team are cleared (teamCleared), '
      + 'and its rows kept in other scopes go there too (alsoChanged), as one change. '
      + 'One undo step puts all of it back, unless other scopes were changed: then it is undone scope by scope.',
    inputSchema: {
      type: 'object',
      properties: {
        id: ID('element'),
        units: {
          type: 'string',
          description: 'A unit only, where the units inside it may not move up: "into:<id>" moves them into another unit '
            + 'of its type, "up" moves them up anyway (they show as misplaced), "delete" removes them too, with '
            + 'everything under them and their assignments. Only what the person chose.',
        },
      },
      required: ['id'],
      additionalProperties: false,
    },
  },
  {
    name: 'connect',
    tier: 'write',
    description:
      'Draw a connection from one element to another, dated when the line is temporary. Answers with the connection\'s id. '
      + 'A line to or from a component is a container-level line: say with "refines" which application-level interface it is '
      + 'part of, or leave it out and it is an interface of its own that roadmap.check will offer to draw the application '
      + 'line for.',
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
    name: 'interface.accept',
    tier: 'write',
    description:
      'Draw the application-level interface that a set of container-level lines implies, and land every one of '
      + 'them on it, as ONE step (ADR-0013). Name any one of those lines — roadmap.check reports them as an '
      + '"impliedInterface" finding and names the first. The new line takes the label of the first line that has '
      + 'one, and runs both ways if any of them does.',
    inputSchema: { type: 'object', properties: { id: ID('container-level connection') }, required: ['id'], additionalProperties: false },
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
      + 'capability), serves, realises (a process is how a capability is done — or, ADR-0014, a platform is '
      + 'how a platformService is delivered), assigned (an actor is responsible for a function, a step, or '
      + 'maintains a platformService or a platform), hostedOn (an application or a component runs on a '
      + 'platform — never a platform on a platform, which is parentId) or uses (an application or a '
      + 'component consumes a platformService, or binds to one platform), or interacts (ADR-0036 §7: one unit — an '
      + 'actor with a unit type — works with another, in a mode: collaboration, service or facilitating; the Conway '
      + 'map holds the interfaces between their applications against these rows). Dated when it only holds for '
      + 'a while — the roadmap draws the window. One end may be an element another scope defines, as '
      + 'long as register.list or scopes.list knows the id: an organisation\'s capability supported by a '
      + 'landscape\'s application is written on the organisation. For a flow between two applications use '
      + 'connect, which also takes a protocol and a direction. assigned from a unit to an area, a grouping or a capability of a '
      + 'business sheet says the unit answers for that function, and is written in the scope that defines the function, the unit '
      + 'kept anywhere; which domain the function is handed to is its scopes (element.update). Answers with the relation\'s id.',
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
    name: 'technology.use',
    tier: 'write',
    description:
      'Make what an application or a component uses equal to a list (ADR-0020): the platformServices it '
      + 'consumes and the platforms it binds to, as one step — rows for targets no longer named are removed, '
      + 'rows for new ones written, and a kept row left exactly as it was. A target another scope defines '
      + '(technology.list knows it) arrives as a stand-in in the same step. This is what the inspector\'s Uses '
      + 'picker and a drop on the technology landscape write; relation.add with type uses writes one row at '
      + 'a time. Refused command.technologyEnds for a target that is neither a platformService nor a platform, '
      + 'or an element that is neither an application nor a component, and agent.unknownId for a target '
      + 'nobody in the organisation defines. Answers with the rows written and removed.',
    inputSchema: {
      type: 'object',
      properties: {
        elementId: ID('application or component'),
        targetIds: { type: 'array', description: 'The platformServices and platforms it uses, whole. Empty takes every row off.', items: { type: 'string' } },
      },
      required: ['elementId', 'targetIds'],
      additionalProperties: false,
    },
  },
  {
    name: 'function.claim',
    tier: 'write',
    description:
      'Take up an area, a grouping or a capability of a scope above this one (ADR-0040 §5): the domain says it '
      + 'does that function, by keeping a stand-in of it on its own business sheet — what From above… on a sheet '
      + 'does. One step in this scope, nothing written in the scope above. It is filed under its parent where this '
      + 'scope holds the parent, and otherwise is a root of the sheet, drawn as one of its areas (diagramId says which sheet where '
      + 'there are several); what this scope took up under it before is filed under it in the same step. The domain\'s own '
      + 'capabilities go under it with element.add parentId, which is its refinement. Three links between the '
      + 'business sheet and the tree, told apart: who answers for a function is relation.add assigned from a unit, in '
      + 'the scope that defines the function; which domain it is handed to is element.update scopes on the '
      + 'definition, in that scope; which domain took it up is this tool, in the scope below. element.describe of '
      + 'a function says its domains and claimedBy. Refused claim.notAbove for a function defined beside or below '
      + 'this scope, claim.definedHere for one this scope defines; one it holds already is answered with already. '
      + 'Taking it back is element.remove of the stand-in. Answers with where it landed.',
    inputSchema: {
      type: 'object',
      properties: {
        id: ID('area, grouping or capability of a scope above, as elements.list with that scope names it'),
        diagramId: { type: 'string', description: 'The business sheet to draw it on, where this scope has several (diagrams.list).' },
      },
      required: ['id'],
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
        supersedes: SUPERSEDES,
        proposedBy: PROPOSED_BY,
      },
      required: ['title'],
      additionalProperties: false,
    },
  },
  {
    name: 'decision.update',
    tier: 'write',
    description:
      'Correct a record that is still proposed or reviewing: its title, its body, its date, who it was '
      + 'put to, who proposed it, or which accepted records it supersedes. Accepted, rejected and superseded '
      + 'records are locked; a group\'s records are changed on their page.',
    inputSchema: {
      type: 'object',
      properties: {
        id: ID('decision record'),
        title: { type: 'string', description: 'A new title.' },
        body: { type: 'string', description: 'The record as MADR markdown.' },
        date: { type: 'string', description: 'The day the record carries, yyyy-mm-dd.' },
        signers: SIGNERS,
        supersedes: SUPERSEDES,
        proposedBy: { ...PROPOSED_BY, description: `${PROPOSED_BY.description} null clears it.` },
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
      'Move a decision record to its next status: proposed → reviewing → accepted or rejected, a proposal '
      + 'withdrawn (proposed → rejected, with a reason), review sent back to proposed, and accepted → superseded '
      + '(naming an accepted successor). Accepting is gated: the body has its context, at least two considered '
      + 'options, an outcome naming one of them and a consequence, not the template\'s placeholders; a signer '
      + 'approved and none rejected; and every record it supersedes is accepted — those move to superseded in the '
      + 'same step. Rejecting needs a reason or a rejecting signer. A refusal names what the gate still needs. '
      + 'Accepted, rejected and superseded records are locked; superseding is the one move an accepted record has.',
    inputSchema: {
      type: 'object',
      properties: {
        id: ID('decision record'),
        status: { type: 'string', description: 'The status to move to.', enum: ['proposed', 'reviewing', 'accepted', 'rejected', 'superseded'] },
        supersededBy: { type: 'string', description: 'For superseded: the id of the accepted record that replaces it.' },
        reason: { type: 'string', description: 'For rejected: why. Required to withdraw a proposal, and to reject one no signer rejected.' },
      },
      required: ['id', 'status'],
      additionalProperties: false,
    },
  },
  {
    name: 'observation.record',
    tier: 'write',
    description:
      'Write down something that was seen (ADR-0021), numbered after the last observation in this scope, seen once. '
      + 'Where it was seen and who saw it are required, and the day is today unless date says another. '
      + 'An observation is a fact: what was seen, where, when, by whom and the evidence, '
      + 'in neutral words — no explanation, no opinion, no blame and no fix. Why it happens is a cause (cause.add); '
      + 'what to do about it is a solution (solution.propose). When a person\'s account mixes them, record the facts '
      + 'here, put the rest where it belongs and say so. Seen again is observation.seen, not a new record; check '
      + 'observations.list first. It is local to the scope it is recorded in, and every scope above reads it '
      + '(ADR-0032): nothing is shared. Leave the body out for the template.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'What was seen, as one neutral sentence: no cause and no fix in it.' },
        body: { type: 'string', description: 'What was seen, the evidence, and who or what it affected, as markdown. Facts only: the reading of them is a cause.' },
        where: { type: 'string', description: 'Where it was seen: a system, a desk, a job. Prose, not an id. Required.' },
        by: personArgument('Who saw it, or who wrote it down. Required.'),
        date: { type: 'string', description: 'The day it was seen, yyyy-mm-dd. Default: today. Not in the future.' },
        impact: { type: 'string', description: 'How much it matters to whoever it affected — not how sure anyone is. Default: minor.', enum: ['minor', 'major', 'critical'] },
        bright: { type: 'boolean', description: 'true: a bright spot — something that works, analysed the same way: its causes are what make it work, and a solution on its root spreads it (ADR-0038). Default: a problem.' },
      },
      required: ['title', 'where', 'by'],
      additionalProperties: false,
    },
  },
  {
    name: 'observation.update',
    tier: 'write',
    description:
      'Correct an observation — keeping it a fact, with any reading of it moved to a cause: its title, body, where, '
      + 'who, date or impact, or whether it is a bright spot. Title, where and who may be corrected, never blanked. The count moves only through '
      + 'observation.seen and observation.merge; closing it is observation.archive.',
    inputSchema: {
      type: 'object',
      properties: {
        id: ID('observation'),
        title: { type: 'string', description: 'A new title.' },
        body: { type: 'string', description: 'The body as markdown.' },
        where: { type: 'string', description: 'Where it was seen. Not blank.' },
        by: personArgument('Who saw it. Not blank.'),
        date: { type: 'string', description: 'The day it was first seen, yyyy-mm-dd.' },
        impact: { type: 'string', description: 'How much it matters.', enum: ['minor', 'major', 'critical'] },
        bright: { type: 'boolean', description: 'true: a bright spot, something that works; false: a problem.' },
      },
      required: ['id'],
      additionalProperties: false,
    },
  },
  {
    name: 'observation.seen',
    tier: 'write',
    description: 'The same thing was seen again: the count goes up by one and the day is kept in its history. Today unless date says another day, which is never in the future and never before it was first seen.',
    inputSchema: {
      type: 'object',
      properties: {
        id: ID('observation'),
        date: { type: 'string', description: 'The day it was seen, yyyy-mm-dd. Default: today. Not in the future, not before it was first seen.' },
        note: { type: 'string', description: 'A word about this sighting, kept beside the day.' },
      },
      required: ['id'],
      additionalProperties: false,
    },
  },
  {
    name: 'observation.archive',
    tier: 'write',
    description:
      'Close an observation that was fixed, addressed or is no longer relevant — or, with restore, bring one back. '
      + 'Archive what has stopped being seen, not what nobody has explained yet: an unexplained observation wants a cause. '
      + 'The record stays where it is, as history, with the day and the note; archived, it is out of the analysis: '
      + 'not drawn, not queued, not a merge target. Nothing is deleted.',
    inputSchema: {
      type: 'object',
      properties: {
        id: ID('observation'),
        note: { type: 'string', description: 'Why: what fixed it, or why it stopped mattering. Kept beside the day.' },
        restore: { type: 'boolean', description: 'true: bring an archived observation back instead.' },
      },
      required: ['id'],
      additionalProperties: false,
    },
  },
  {
    name: 'observation.merge',
    tier: 'write',
    description:
      'Several observations are the same thing: fold them into one survivor (ADR-0035). into is the survivor, '
      + 'of this scope or of intoScope; absorb lists the records folded in, each with its scope where it is not the '
      + 'survivor\'s — above, below or beside. The survivor keeps its own title, where, by, impact, day and body '
      + 'unless values says otherwise, and its sightings are the sum; every record says so in its history, and an '
      + 'absorbed one stays as history, never deleted. Every link that names an absorbed record moves to the '
      + 'survivor where the tree allows it — a cause explains observations of its own scope only — and stays on '
      + 'the absorbed record where it does not. merge.plan says what would move, by key, before anything is '
      + 'written; links unticks a row or chooses its strength. A merge that writes only the scope this call is '
      + 'for is one step, which undo takes back. One that writes other scopes is one step on each, all or none, '
      + 'where the host can write several scopes as one, and is refused agent.scopeNotOpen where it cannot. '
      + 'id and fromScope are the old way to say it, accepted for one beta: id is one observation to absorb, and '
      + 'with fromScope (a scope below) only this scope\'s survivor is written, as before. Use absorb.',
    inputSchema: {
      type: 'object',
      properties: {
        into: { type: 'string', description: 'The survivor: the observation that keeps standing, by id or OB- label.' },
        intoScope: { type: 'string', description: 'The path of the scope the survivor lives in, when it is not the one this call is for.' },
        absorb: MERGE_ABSORB('observation', 'OB-'),
        values: {
          type: 'object',
          description: 'What the survivor says after the merge; a field left out stays as the survivor has it.',
          properties: OBSERVATION_VALUES,
          additionalProperties: false,
        },
        links: MERGE_LINKS,
        id: { type: 'string', description: 'The old name for one record in absorb. Accepted for one beta; use absorb.' },
        fromScope: { type: 'string', description: 'With id, the old way to fold in an observation of a scope below, writing only this scope. Accepted for one beta; use absorb with its scope.' },
      },
      required: ['into'],
      additionalProperties: false,
    },
  },
  {
    name: 'observation.move',
    tier: 'write',
    description:
      'Move an observation of this scope to another scope it belongs in — above, below or beside (ADR-0038). '
      + 'It is the same record under the same id, with the next number of the scope it goes to, and its title, '
      + 'place, observer, impact, day, body, sightings, history and comments go with it; where it was keeps it '
      + 'as a tombstone that says where it went, so a link to it still leads there. A cause explains '
      + 'observations of its own scope only, so every link that explains it is cut: the link stays on its '
      + 'cause as history, and the analysis starts again in the scope it goes to. move.plan says which links, '
      + 'before anything is written: tell the person. Moving it back to a scope that holds its tombstone '
      + 'brings that back under its old number, and the links cut there explain it again. An archived '
      + 'observation is restored first; a merged one is not moved. It writes two scopes, one step on each, '
      + 'all or none, where the host can write several scopes as one, and is refused agent.scopeNotOpen where '
      + 'it cannot; undo does not take it back — moving it back does. Not solution.move, which moves a '
      + 'solution\'s state. Answers its new label and the links cut.',
    inputSchema: {
      type: 'object',
      properties: {
        id: ID('observation'),
        to: { type: 'string', description: 'The path of the scope it goes to: "" is the organisation (see scopes.list).' },
      },
      required: ['id', 'to'],
      additionalProperties: false,
    },
  },
  {
    name: 'observation.remove',
    tier: 'write',
    description: 'Throw an observation away, and every link a cause had to it. Its number is never reused. Merging is usually the better answer.',
    inputSchema: { type: 'object', properties: { id: ID('observation') }, required: ['id'], additionalProperties: false },
  },
  {
    name: 'cause.add',
    tier: 'write',
    description:
      'Say what lies behind one or more observations, or behind other causes (ADR-0021): a new cause, assumed until '
      + 'verified, numbered after the last one here. This is where the analysis goes — the team\'s explanation, '
      + 'one statement per cause, with no remedy in it (a remedy is a solution). Then ask why again: a deeper cause '
      + 'explains this one (explains: this cause\'s id), until the team says one is the root cause, where the '
      + 'chain ends and solutions go (ADR-0032). root: true makes it one as it is made — only when a person said '
      + 'so. Name what it explains and the links are made in the same step: observations and causes of this '
      + 'scope, and causes of a scope below (with its scope) — never an observation below, which that scope '
      + 'explains, and never a root cause. Leave the body out for the template.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'The cause, as one sentence.' },
        body: { type: 'string', description: 'Why the team thinks so and how to verify it, as markdown.' },
        state: { type: 'string', description: 'Default: assumed. Verified only when a person says it was checked, and only with the body\'s "Why we think so" and "How to verify" filled in.', enum: ['assumed', 'verified'] },
        root: { type: 'boolean', description: 'true: it is a root cause, labelled RC-. Only when a person said so; never on your own judgement.' },
        explains: {
          type: 'array',
          description: 'What this cause explains: observations or shallower causes of this scope, or non-root causes of a scope below (with scope).',
          items: {
            type: 'object',
            description: 'One thing this cause explains.',
            properties: {
              id: { type: 'string', description: 'The observation or cause.' },
              scope: { type: 'string', description: 'The path of the scope below, for one of its causes.' },
              strength: { type: 'string', description: 'How firmly. Default: normal.', enum: ['strong', 'normal', 'weak'] },
            },
            required: ['id'],
            additionalProperties: false,
          },
        },
      },
      required: ['title'],
      additionalProperties: false,
    },
  },
  {
    name: 'cause.update',
    tier: 'write',
    description: 'Correct a cause: its title, its body, or its state — verified once a person says the team has checked it against evidence, never on your own reasoning, and only with the body\'s "Why we think so" and "How to verify" filled in (the same call may write them); back to assumed when it has not. root makes it a root cause or a cause again (ADR-0032), only when a person said so: a root cause is refused while a cause explains it, and a cause again while a solution addresses it, and the refusal names them.',
    inputSchema: {
      type: 'object',
      properties: {
        id: ID('cause'),
        title: { type: 'string', description: 'A new title.' },
        body: { type: 'string', description: 'The body as markdown.' },
        state: { type: 'string', description: 'Assumed or verified.', enum: ['assumed', 'verified'] },
        root: { type: 'boolean', description: 'true: make it a root cause; false: make it a cause again. Only when a person said so.' },
      },
      required: ['id'],
      additionalProperties: false,
    },
  },
  {
    name: 'cause.link',
    tier: 'write',
    description:
      'A cause explains something: an observation or a shallower cause of this scope, or a cause of a scope below '
      + '(explainsScope: its path; ADR-0032). Linking to what it already explains changes the strength: how firmly '
      + 'the team believes this cause explains it. Refused: a loop between causes, a root cause as the thing '
      + 'explained, a cause of this scope or one above named as below, a scope beside this one, and an observation '
      + 'of a scope below — that scope explains its own observations, and this one explains its causes.',
    inputSchema: {
      type: 'object',
      properties: {
        id: ID('cause'),
        explains: { type: 'string', description: 'The observation or cause it explains, by id or label.' },
        explainsScope: { type: 'string', description: 'The path of the scope below that cause lives in, when it is not this one.' },
        strength: { type: 'string', description: 'How firmly. Default: normal.', enum: ['strong', 'normal', 'weak'] },
      },
      required: ['id', 'explains'],
      additionalProperties: false,
    },
  },
  {
    name: 'cause.unlink',
    tier: 'write',
    description: 'A cause no longer explains something.',
    inputSchema: {
      type: 'object',
      properties: {
        id: ID('cause'),
        explains: { type: 'string', description: 'The observation or cause it stops explaining.' },
        explainsScope: { type: 'string', description: 'The path of the scope below it lives in, when it is not this one.' },
      },
      required: ['id', 'explains'],
      additionalProperties: false,
    },
  },
  {
    name: 'cause.remove',
    tier: 'write',
    description: 'Throw a cause away, and every link from it and to it. Its number is never reused.',
    inputSchema: { type: 'object', properties: { id: ID('cause') }, required: ['id'], additionalProperties: false },
  },
  {
    name: 'cause.merge',
    tier: 'write',
    description:
      'Several causes say the same thing: fold them into one survivor (ADR-0035), as observation.merge does for '
      + 'observations. into is the survivor, of this scope or of intoScope; absorb lists the causes folded in, '
      + 'each with its scope where it is not the survivor\'s. The survivor keeps its own title, state, root and '
      + 'body unless values says otherwise — verified only with the evidence written, and root only when a person '
      + 'said so; an absorbed cause stays as history, labelled as merged, and is no longer drawn, linked or '
      + 'addressed. Three kinds of link move where the survivor may hold them: what an absorbed cause explains, '
      + 'the causes that explain it, and the solutions that address it (of the survivor\'s scope, and only while '
      + 'it is a root cause). A link that would loop, point up or sideways, or name a root cause is not moved and '
      + 'stays on the absorbed cause; merge.plan says which, by key, before anything is written. Refused, with '
      + 'the root steps\' keys, where the survivor would be a root cause something still explains, or a cause '
      + 'again that a solution still addresses. Lands as observation.merge does: one step on this scope, which '
      + 'undo takes back, or one step on every scope it writes where the host can, and agent.scopeNotOpen where '
      + 'it cannot.',
    inputSchema: {
      type: 'object',
      properties: {
        into: { type: 'string', description: 'The survivor: the cause that keeps standing, by id or CA-/RC- label.' },
        intoScope: { type: 'string', description: 'The path of the scope the survivor lives in, when it is not the one this call is for.' },
        absorb: MERGE_ABSORB('cause', 'CA-/RC-'),
        values: {
          type: 'object',
          description: 'What the survivor says after the merge; a field left out stays as the survivor has it.',
          properties: CAUSE_VALUES,
          additionalProperties: false,
        },
        links: MERGE_LINKS,
      },
      required: ['into', 'absorb'],
      additionalProperties: false,
    },
  },
  {
    name: 'solution.propose',
    tier: 'write',
    description:
      'Propose a solution for one or more causes of this scope (ADR-0026): a new idea, numbered after the last one '
      + 'here, linked to what it addresses in the same step. A solution addresses root causes only: a cause a deeper '
      + 'cause explains is refused, naming the deeper one — keep asking why until the analysis reaches a root. '
      + 'Proposing is cheap on purpose; the vetting is the gates after it. Propose the alternatives too, and drop '
      + 'the ones not pursued with the reason rather than removing them: they are what was considered. A cause that '
      + 'later gains a deeper one keeps its solutions, which are then asked whether they work around the problem.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'What would take the cause away, as one sentence.' },
        addresses: {
          type: 'array',
          description: 'The root causes it addresses.',
          items: {
            type: 'object',
            description: 'One cause.',
            properties: {
              id: { type: 'string', description: 'The cause, by id or CA- label.' },
              strength: { type: 'string', description: 'How directly. Default: strong on a root cause, normal otherwise.', enum: ['strong', 'normal', 'weak'] },
            },
            required: ['id'],
            additionalProperties: false,
          },
        },
        body: { type: 'string', description: 'The idea, costs and benefits, why this scope, alternatives and risks, as markdown. Leave out for the template.' },
      },
      required: ['title'],
      additionalProperties: false,
    },
  },
  {
    name: 'solution.update',
    tier: 'write',
    description:
      'Answer what a solution\'s gates ask, or correct it: title, body, benefit and cost, who it was checked with '
      + '(the whole list), earlier attempts (the whole list), noneKnown when nothing like it was tried, and why it '
      + 'works now when something was. Fill these from what people said — ask who it was checked with and whether it '
      + 'was tried before rather than assuming. Never with filler to get past a gate.',
    inputSchema: {
      type: 'object',
      properties: {
        id: ID('solution'),
        title: { type: 'string', description: 'A new title.' },
        body: { type: 'string', description: 'The body as markdown.' },
        benefit: { type: 'string', description: 'What it is expected to bring. Drawn as its width.', enum: ['small', 'medium', 'large'] },
        cost: { type: 'string', description: 'Roughly what it costs.', enum: ['small', 'medium', 'large'] },
        validatedWith: { type: 'array', description: 'Who it was checked with: names, roles or teams. Replaces the list.', items: { type: 'string' } },
        attempts: {
          type: 'array',
          description: 'Earlier attempts at something like it. Replaces the list.',
          items: {
            type: 'object',
            description: 'One earlier attempt.',
            properties: {
              when: { type: 'string', description: 'When, as people say it: a year, a quarter.' },
              what: { type: 'string', description: 'What was tried.' },
              why: { type: 'string', description: 'Why it did not stick.' },
            },
            required: ['what', 'why'],
            additionalProperties: false,
          },
        },
        noneKnown: { type: 'boolean', description: 'true: nothing like it was tried before, as far as anyone knows.' },
        whyNow: { type: 'string', description: 'Why it works now, when an earlier attempt did not.' },
      },
      required: ['id'],
      additionalProperties: false,
    },
  },
  {
    name: 'solution.address',
    tier: 'write',
    description: 'A solution addresses a cause of this scope; addressing one it already addresses changes the strength. A new cause only while the solution is an idea or shaped; past that, propose another solution.',
    inputSchema: {
      type: 'object',
      properties: {
        id: ID('solution'),
        cause: { type: 'string', description: 'The cause, by id or CA- label.' },
        strength: { type: 'string', description: 'How directly. Default: strong on a root cause, normal otherwise.', enum: ['strong', 'normal', 'weak'] },
      },
      required: ['id', 'cause'],
      additionalProperties: false,
    },
  },
  {
    name: 'solution.unaddress',
    tier: 'write',
    description: 'A solution no longer addresses a cause.',
    inputSchema: {
      type: 'object',
      properties: { id: ID('solution'), cause: { type: 'string', description: 'The cause, by id or CA- label.' } },
      required: ['id', 'cause'],
      additionalProperties: false,
    },
  },
  {
    name: 'solution.move',
    tier: 'write',
    description:
      'Move a solution one step: forward (idea → shaped → testing → proven → adopted) when its gate is clear, or '
      + 'back one step at any time — except out of adopted while its decision record stands accepted. A refused move '
      + 'names what the gate still needs; answer those with solution.update, experiment.plan, experiment.conclude, '
      + 'solution.waive or solution.decide, not by moving again.',
    inputSchema: {
      type: 'object',
      properties: {
        id: ID('solution'),
        to: { type: 'string', description: 'The state one step forward or back.', enum: ['idea', 'shaped', 'testing', 'proven', 'adopted'] },
      },
      required: ['id', 'to'],
      additionalProperties: false,
    },
  },
  {
    name: 'solution.waive',
    tier: 'write',
    description:
      'Say that no experiment is needed, and why: it stands in for a confirmed one at the testing gate. The reason '
      + 'must be one a person gave. An empty reason takes a waiver back.',
    inputSchema: {
      type: 'object',
      properties: { id: ID('solution'), reason: { type: 'string', description: 'Why no experiment is needed.' } },
      required: ['id', 'reason'],
      additionalProperties: false,
    },
  },
  {
    name: 'solution.drop',
    tier: 'write',
    description:
      'Stop a solution, with the reason. It stays as the record of an alternative that was considered. An adopted '
      + 'solution cannot be dropped: supersede its decision record first, then move it back.',
    inputSchema: {
      type: 'object',
      properties: { id: ID('solution'), note: { type: 'string', description: 'Why, so the next person does not try it blind.' } },
      required: ['id', 'note'],
      additionalProperties: false,
    },
  },
  {
    name: 'solution.restore',
    tier: 'write',
    description: 'Bring a dropped solution back to the state it was dropped from.',
    inputSchema: { type: 'object', properties: { id: ID('solution') }, required: ['id'], additionalProperties: false },
  },
  {
    name: 'solution.decide',
    tier: 'write',
    description:
      'Propose the decision record for a solution, as one step: a new record on the Decisions page, its context '
      + 'written from what the solution addresses and what else was considered, and the link. It is then taken '
      + 'through its status and signers on the Decisions page (decision.transition); adopted needs it accepted. '
      + 'Accepting is the signers\' decision: move the record to accepted only when a person says it was.',
    inputSchema: {
      type: 'object',
      properties: { id: ID('solution'), body: { type: 'string', description: 'The whole MADR body, when you have it. Leave out for the pre-filled one.' } },
      required: ['id'],
      additionalProperties: false,
    },
  },
  {
    name: 'solution.plan',
    tier: 'write',
    description:
      'Start the plan that builds an adopted solution, as one step: a draft plan resting on its decision record, '
      + 'and the link. What it introduces and retires is then written with plan.update. When that plan is done the '
      + 'solution reads as implemented, and the observations under it should stop being seen: one seen again after '
      + 'that is flagged against the solution.',
    inputSchema: { type: 'object', properties: { id: ID('solution') }, required: ['id'], additionalProperties: false },
  },
  {
    name: 'solution.remove',
    tier: 'write',
    description: 'Throw a solution away, and take it out of every experiment that tested it. Its number is never reused. Dropping is usually the better answer.',
    inputSchema: { type: 'object', properties: { id: ID('solution') }, required: ['id'], additionalProperties: false },
  },
  {
    name: 'experiment.plan',
    tier: 'write',
    description: 'Plan an experiment for one or more solutions (ADR-0026): how the team finds out whether a solution works before it is built. A hypothesis that could turn out wrong, what is counted to decide it, where, by whom and when — small and bounded. Only for shaped or testing solutions. It starts planned, and every shaped solution it tests moves on to testing in the same step.',
    inputSchema: {
      type: 'object',
      properties: {
        tests: { type: 'array', description: 'The solutions it tests, by id or SO- label.', items: { type: 'string' } },
        title: { type: 'string', description: 'The experiment, as one line.' },
        hypothesis: { type: 'string', description: 'What should happen if the solution is right.' },
        measure: { type: 'string', description: 'What is counted to decide it.' },
        where: { type: 'string', description: 'Where it runs.' },
        by: personArgument('Who runs it.'),
        from: { type: 'string', description: 'yyyy-mm-dd. Default: today.' },
        to: { type: 'string', description: 'yyyy-mm-dd.' },
        body: { type: 'string', description: 'How it is set up, as markdown.' },
        strength: {
          type: 'object',
          description: 'How firmly it bears on a solution it tests, by solution id or SO- label: strong, normal or weak. Normal where unsaid. The line between them on the picture.',
          additionalProperties: { type: 'string', enum: ['strong', 'normal', 'weak'] },
        },
      },
      required: ['tests', 'title', 'hypothesis'],
      additionalProperties: false,
    },
  },
  {
    name: 'experiment.update',
    tier: 'write',
    description: 'Correct an experiment: its title, hypothesis, measure, where, by whom, window, result, body, what it tests, or how firmly it bears on each of those. Blank optional text is removed; a blank hypothesis is refused.',
    inputSchema: {
      type: 'object',
      properties: {
        id: ID('experiment'),
        title: { type: 'string', description: 'A new title.' },
        hypothesis: { type: 'string', description: 'What should happen if the solution is right.' },
        measure: { type: 'string', description: 'What is counted.' },
        where: { type: 'string', description: 'Where it runs.' },
        by: personArgument('Who runs it.'),
        from: { type: 'string', description: 'yyyy-mm-dd.' },
        to: { type: 'string', description: 'yyyy-mm-dd.' },
        result: { type: 'string', description: 'What happened.' },
        body: { type: 'string', description: 'The body as markdown.' },
        tests: { type: 'array', description: 'The solutions it tests. Replaces the list.', items: { type: 'string' } },
        strength: {
          type: 'object',
          description: 'How firmly it bears on a solution it tests, by solution id or SO- label: strong, normal or weak. Normal where unsaid. The line between them on the picture.',
          additionalProperties: { type: 'string', enum: ['strong', 'normal', 'weak'] },
        },
      },
      required: ['id'],
      additionalProperties: false,
    },
  },
  {
    name: 'experiment.conclude',
    tier: 'write',
    description:
      'Move an experiment on, one step at a time: planned → running (which sets from to today), running → planned, '
      + 'running → confirmed, refuted or inconclusive (a conclusion needs the result — counted, where there are numbers '
      + '— and ends on to, today unless given, never before from), and a concluded one → running, which reopens it. '
      + 'The outcome is what the team observed, so conclude only when told it. Reopening a confirmed experiment may '
      + 'take the proof from the solutions it proved: the answer lists them in proofWithdrawn, so tell the person. '
      + 'A refuted one stays; it is the evidence the next person asks for.',
    inputSchema: {
      type: 'object',
      properties: {
        id: ID('experiment'),
        outcome: { type: 'string', description: 'Where it moves to.', enum: ['planned', 'running', 'confirmed', 'refuted', 'inconclusive'] },
        result: { type: 'string', description: 'What happened, in numbers where there are numbers. Needed to conclude, unless already written.' },
        to: { type: 'string', description: 'For a conclusion: the day it ended, yyyy-mm-dd. Default: today. Not before from.' },
      },
      required: ['id', 'outcome'],
      additionalProperties: false,
    },
  },
  {
    name: 'experiment.remove',
    tier: 'write',
    description: 'Throw an experiment away. Its number is never reused. Concluding it is usually the better answer.',
    inputSchema: { type: 'object', properties: { id: ID('experiment') }, required: ['id'], additionalProperties: false },
  },

  // --- the operating model, at the organisation (ADR-0036) --------------------
  {
    name: 'unitType.add',
    tier: 'write',
    description:
      'Add a kind of unit to the organisation\'s operating model, in its own word for it. It may sit at the top, under '
      + 'the organisation itself (top; true where within is not given), and under the unit types in within; slots are the '
      + 'roles a unit of it holds, each at least min and at most max. The operating model is kept at the organisation, '
      + 'which must be the scope open (app.open with scope "").',
    inputSchema: {
      type: 'object',
      properties: { name: { type: 'string', description: 'What the organisation calls this kind of unit.' }, ...UNIT_TYPE_FIELDS },
      required: ['name'],
      additionalProperties: false,
    },
  },
  {
    name: 'unitType.update',
    tier: 'write',
    description:
      'Change a unit type. Only the fields given change; within and slots replace the lists; null clears the purpose, '
      + 'top, spans, the limit and the order. A blank name is refused. At the organisation, which must be the scope open.',
    inputSchema: {
      type: 'object',
      properties: { id: ID('unit type'), name: { type: 'string', description: 'A new name.' }, ...UNIT_TYPE_FIELDS },
      required: ['id'],
      additionalProperties: false,
    },
  },
  {
    name: 'role.add',
    tier: 'write',
    description:
      'Add a role to the organisation\'s operating model, in its own words: a purpose, its duties — a responsibility '
      + 'each from responsibilities.list, marked R (responsible), A (accountable), C (consulted) or I (informed) — and '
      + 'whether its holder manages the people of the unit (manages), and where its holders report wherever it is held '
      + '(reportsTo). A role is held in a unit type through that type\'s slots (unitType.update). At the organisation, which must be the scope open.',
    inputSchema: {
      type: 'object',
      properties: { name: { type: 'string', description: 'What the organisation calls the role.' }, ...ROLE_FIELDS },
      required: ['name'],
      additionalProperties: false,
    },
  },
  {
    name: 'role.update',
    tier: 'write',
    description:
      'Change a role. Only the fields given change; duties and reportsTo replace their lists; null clears the short name, '
      + 'the purpose, manages and reportsTo. A blank name is refused. At the organisation, which must be the scope open.',
    inputSchema: {
      type: 'object',
      properties: { id: ID('role'), name: { type: 'string', description: 'A new name.' }, ...ROLE_FIELDS },
      required: ['id'],
      additionalProperties: false,
    },
  },

  // --- who holds which role in which unit, in the unit's scope (ADR-0036 §4) --------
  {
    name: 'assignment.add',
    tier: 'write',
    description:
      'Put a person in a role of a unit, as one step in the scope that keeps the unit — which must be the scope open. '
      + 'Keep to the model: place them in a role the unit\'s slots give (assignments.list with unitId lists them) and let their '
      + 'reporting line follow the role, the unit type and nesting. A role outside the slots is an exception placement — allowed, '
      + 'answered exception: true, shown as an exception wherever the holder is, and no finding — to write only when the person '
      + 'you act for explicitly asks for it, saying in your answer that it is one; so is reportsTo, the holder\'s own line. '
      + 'The assignment holds the person\'s register id, never a name: add someone new with person.add first, which checks '
      + 'the register for duplicates. Someone who has left or been forgotten is refused. A slot over its maximum and a person '
      + 'over 100% are findings (checks.list), not refusals. Answers with the id.',
    inputSchema: {
      type: 'object',
      properties: {
        unitId: { type: 'string', description: 'The unit: an actor with a unit type, kept in the scope open (elements.list).' },
        roleId: { type: 'string', description: 'The role, by id (roles.list).' },
        personId: { type: 'string', description: 'The person, by register id (people.list); a merged id is written as the entry it was merged into.' },
        share: { type: 'integer', description: 'The part of their time, in per cent. Default 100.', minimum: 1, maximum: 100 },
        from: { type: 'string', description: 'The first day, yyyy-mm-dd. Default: today.' },
        until: { type: 'string', description: 'The last day, yyyy-mm-dd, where it is known.' },
        acting: { type: 'boolean', description: 'Holding the role until somebody is appointed to it.' },
        reportsTo: PERSON_LINES,
      },
      required: ['unitId', 'roleId', 'personId'],
      additionalProperties: false,
    },
  },
  {
    name: 'assignment.update',
    tier: 'write',
    description:
      'Correct an assignment, as one step in the scope that keeps it — which must be the scope open: its share, whether the '
      + 'person is acting, its first and last day, and the holder\'s own reporting lines (reportsTo). Only the fields given change; '
      + 'null clears the share (all of their time), acting, the last day and reportsTo. Days run forwards (command.datesOutOfOrder). '
      + 'Ending one is assignment.end; another unit or role is a new assignment (assignment.end, then assignment.add). '
      + 'Keep to the model\'s defaults: reportsTo is an exception for this holder alone, written only when the person you act for '
      + 'explicitly asks for it — say in your answer that it is one — and reportsTo null puts the model\'s lines back.',
    inputSchema: {
      type: 'object',
      properties: {
        id: ID('assignment, from assignments.list'),
        share: { type: 'integer', description: 'The part of their time, in per cent. Null is all of it.', minimum: 1, maximum: 100 },
        acting: { type: 'boolean', description: 'Holding the role until somebody is appointed to it. False or null: appointed.' },
        from: { type: 'string', description: 'The first day, yyyy-mm-dd.' },
        until: { type: 'string', description: 'The last day, yyyy-mm-dd. Null: open-ended.' },
        reportsTo: PERSON_LINES,
      },
      required: ['id'],
      additionalProperties: false,
    },
  },
  {
    name: 'assignment.end',
    tier: 'write',
    description:
      'End an assignment on its last day, as one step in the scope that keeps it — which must be the scope open. It stays, '
      + 'as what the person held; undo takes the day off again. One that begins after that day was never held and is refused: '
      + 'a person removes it. Someone leaving is person.leave, which ends all of theirs at once.',
    inputSchema: {
      type: 'object',
      properties: {
        id: ID('assignment, from assignments.list'),
        on: { type: 'string', description: 'The last day, yyyy-mm-dd. Default: today.' },
      },
      required: ['id'],
      additionalProperties: false,
    },
  },
  // --- reporting lines, on a unit (ADR-0039 §3, §8) -----------------------------------
  {
    name: 'reportingLine.set',
    tier: 'write',
    description:
      'Say where the holders of a role in one unit report, as one step in the scope that keeps the unit — which must be the '
      + 'scope open. This is an OVERRIDE of the model for that unit: by default a role\'s holders report where the role and the '
      + 'unit type say (role.update, unitType.update) and otherwise by nesting, and that is what to keep to; write a unit\'s own '
      + 'line only when the person you act for explicitly asks for this exception, and say in your answer that it is one. For one '
      + 'person rather than everybody in the role there, the holder\'s own line is assignment.update with reportsTo. '
      + 'With to, they report to the holders of to.roleId in the unit to.unitId; without it, the role reports by '
      + 'nesting here, whatever the unit type says. It replaces the unit\'s own line of that role and kind, and its type\'s on '
      + 'the days it runs. A line from a role to itself in the same unit is refused (reportingLine.self), and so is a solid one '
      + 'that would close a loop on the day it is written or on its first day (reportingLine.loop, the chain in the detail). '
      + 'reportingLines.list says each line and where it lands.',
    inputSchema: {
      type: 'object',
      properties: {
        unitId: { type: 'string', description: 'The unit: an actor with a unit type, kept in the scope open.' },
        roleId: { type: 'string', description: 'The role whose holders report, by id (roles.list).' },
        to: {
          type: 'object',
          description: 'Where they report: the unit and its role. Leave it out to say the role reports by nesting here.',
          properties: {
            unitId: { type: 'string', description: 'The unit reported to, anywhere in the organisation (assignments.list, elements.list).' },
            roleId: { type: 'string', description: 'Its role reported to, by id (roles.list).' },
            person: TARGET_PERSON,
          },
          required: ['unitId', 'roleId'],
          additionalProperties: false,
        },
        kind: LINE_KIND,
        from: { type: 'string', description: 'The first day, yyyy-mm-dd. Leave it out for always.' },
        until: { type: 'string', description: 'The last day, yyyy-mm-dd, where it is known.' },
      },
      required: ['unitId', 'roleId'],
      additionalProperties: false,
    },
  },
  {
    name: 'reportingLine.remove',
    tier: 'write',
    description:
      'Take away a unit\'s own line for a role — of one kind, where kind is given, else both — so the model\'s line (the unit '
      + 'type\'s, else the role\'s, else nesting) applies again. '
      + 'One step in the scope that keeps the unit, which must be the scope open.',
    inputSchema: {
      type: 'object',
      properties: {
        unitId: { type: 'string', description: 'The unit.' },
        roleId: { type: 'string', description: 'The role whose own line goes.' },
        kind: { type: 'string', enum: ['solid', 'dotted'], description: 'Only the line of this kind.' },
      },
      required: ['unitId', 'roleId'],
      additionalProperties: false,
    },
  },
  {
    name: 'reportingLines.list',
    tier: 'read',
    description:
      'The reporting lines on a day (ADR-0039), across the whole tree: for each role in each unit that has one, its kind (solid, '
      + 'a line manager\'s; dotted, functional), where it was said (said: role, for every unit that holds the role; type, on the '
      + 'unit type\'s slot; unit, the unit\'s own; person, one holder\'s own, with the assignmentId and personId it holds for), '
      + 'whether it is an exception to the model (override: true for a unit\'s own line and a holder\'s own; the role\'s and the '
      + 'type\'s lines and nesting are the model\'s defaults), whether its target is in the same unit (within), its days, and how it '
      + 'stands — lands (on a role in a unit, named with the scope that keeps it), nesting (the unit says the role reports by '
      + 'nesting here), dangling (no unit has the target role) or ambiguous (several do and none is above; the candidates '
      + 'named). A holder\'s own solid line holds for them in place of their role\'s there; a role held outside the unit\'s slots '
      + 'takes the role\'s own line, and such placements are listed apart (exceptions). Then what the lines contradict: a loop '
      + '(the chain, and the first day it is there), and a line that is dangling, ambiguous or lands on a role nobody holds that day.',
    inputSchema: {
      type: 'object',
      properties: {
        unitId: { type: 'string', description: 'Only the lines from this unit.' },
        roleId: { type: 'string', description: 'Only the lines from this role, in whichever unit.' },
        toUnitId: { type: 'string', description: 'Only the lines that land on this unit: who reports into it.' },
        personId: { type: 'string', description: 'Only the lines that hold for this person, by register id: their own, and their roles\'.' },
        on: { type: 'string', description: 'The day, yyyy-mm-dd. Default: today.' },
      },
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
      + 'after the last one, and always a draft: plan.update moves it on. Name the elements it touches by role and the '
      + 'decisions it rests on; the body is markdown and starts from the template — headings and a '
      + '```business-case fence — when left out. Answers with the id and the label.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'What the plan does, as a title.' },
        status: { type: 'string', description: 'Where it starts, which is always draft.', enum: ['draft'] },
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
      + 'The three forward moves are gated, over the plan as the call leaves it: agreed needs from and to '
      + '(to not before from), an owner, an element it names and every decision it rests on accepted; running '
      + 'the same and from not in the future; done every introduced element dated live, every retired one '
      + 'dated gone and no interface left unported. A refusal names what the gate still needs. '
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
    name: 'plan.move',
    tier: 'write',
    description:
      'Put a unit under a new parent on a day, as part of a plan (ADR-0036 §6): a reorganisation is a plan, and the move '
      + 'holds wherever the organisation is read on that day or after it — assignments.list with on, checks.list with on, '
      + 'who manages a unit — and not before. One move per unit and plan: moving it again changes the move, and remove takes '
      + 'it off; parentId left out puts it at the top, under the organisation itself. A parent below the unit on that day is '
      + 'refused. The move is shifted with the plan. A move outside a plan is a correction: element.update with parentId. '
      + 'The people of a unit or a role that ends are moved on the plan\'s page, or with assignment.end and assignment.add '
      + 'in one batch. Answers with the plan\'s moves.',
    inputSchema: {
      type: 'object',
      properties: {
        planId: PLAN_ID,
        unitId: { type: 'string', description: 'The unit that moves: an actor with a unit type, kept anywhere in the tree.' },
        parentId: { type: 'string', description: 'The unit it sits under from that day. Left out: the top.' },
        on: { type: 'string', description: 'The first day under its new parent, yyyy-mm-dd. Needed unless remove is given.' },
        remove: { type: 'boolean', description: 'Take this plan\'s move of the unit off it.' },
      },
      required: ['planId', 'unitId'],
      additionalProperties: false,
    },
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
      + 'areas this project already holds, an enterprise map — every function against the applications '
      + 'that support it, with the gaps — or a technology landscape: the applications, the services they '
      + 'use and the platforms that deliver them, in three bands (ADR-0015) — or, ADR-0036 §7, an organisation chart '
      + '(chart: the units filed here and below, and those serving here, as a tree with their roles, holders and '
      + 'vacancies on the view\'s day) or a Conway map (conway: those units over the applications they own, the '
      + 'interfaces between them and the interactions declared between the units, with what they contradict). Every '
      + 'kind is switched to once made: the laid-out ones are drawn in their tab like a board (ADR-0016). Answers with the id.',
    inputSchema: {
      type: 'object',
      properties: {
        kind: { type: 'string', description: 'A layer-7 landscape, a container view, a business architecture sheet, an enterprise map, a technology landscape, a drawing, an organisation chart or a Conway map.', enum: ['layer7', 'container', 'sheet', 'map', 'technology', 'drawing', 'chart', 'conway'] },
        name: { type: 'string', description: 'For a landscape, a sheet, a map, a technology landscape, a drawing, a chart or a Conway map: its name.' },
        applicationId: { type: 'string', description: 'For a container view: the application it is about.' },
        elementId: { type: 'string', description: 'For a drawing: the element it is anchored to. Optional.' },
        level: { type: 'string', description: 'For a drawing: the C4 level it shows.', enum: ['context', 'container', 'component'] },
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
      + '`areaSpans` maps an area id to the columns it takes, its capabilities side by side inside it — on '
      + 'paper an area not named there is widened until the page fits the paper\'s short side. '
      + 'A map takes `areas` as its sections. Absent journeyId or areas is the honest default: no '
      + 'journey band, every root. A technology landscape takes nothing here: everything on it is derived. Each list given replaces that list whole; null clears a field. A board '
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
        asOf: { type: 'string', description: 'A board, an organisation chart or a Conway map: the day it draws the model as of, yyyy-mm-dd. Null is today.' },
        colourBy: {
          type: 'string',
          description: 'A landscape: what the application cards are tinted by (ADR-0013) — "platform" groups them '
            + 'by what they run on, "technologyLifecycle" by the worst phase among the platforms they stand on, '
            + '"lifecycle", "category", "owner", "vendor" or "technology" by what each card\'s record says, '
            + '"aspect:<key>" by the status in one of the board\'s aspect columns, '
            + 'and "one:<id>" (ADR-0020) colours every application that uses, is hosted on or leverages the '
            + 'platform or platformService with that id and fades the rest. Null: nothing. Presentation only; '
            + 'no rows change.',
        },
        showDeployment: {
          type: 'boolean',
          description: 'A container diagram: whether the deployment boxes are drawn — the platforms its containers '
            + 'are hostedOn, as dashed groups around them, nested the way the platforms nest (ADR-0013). '
            + 'Absent or null: they are.',
        },
        xml: {
          type: 'string',
          description: 'A drawing: its draw.io XML, uncompressed. Replaces the drawing. Every cell whose link '
            + 'is element:<id> becomes a link, at the cell\'s place. The picture is left unset.',
        },
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
      + 'under two megabytes, as base64 or a data URL. Answers with its name and the markdown line that '
      + 'shows it from a description, a decision or a plan: `![alt](image:<name>)`. Not an undo step: the '
      + 'picture is in the scope\'s library beside the model, and a document that stops referring to it is '
      + 'what removes it from view.',
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
      + 'autosaves; call this before a step that could take the app down, or when what you did has to be kept.',
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
      + 'instead: the stakeholder rail (the parties, then the units the sheet uses, with a count of the '
      + 'units it leaves out), the journey with a row per lane, and every area with what '
      + 'covers each capability. On an enterprise map it reports the rows — every function in tree '
      + 'order with the applications supporting it, rolled up on the sections — and the columns. On a '
      + 'technology landscape it reports the three bands — the applications by the scope that answers for '
      + 'each, the services nested by parent, the platforms nested where the tree nests — and the lines '
      + 'between them, every one a row that exists. On an organisation chart (ADR-0036 §7) it reports the units '
      + 'as a tree on the view\'s day, each role with its holders by person id, their share, who is over 100% and '
      + 'the vacancies; on a Conway map, the units over their applications, every interface that crosses between '
      + 'units with whether an interaction covers it, the interactions that hold, and the findings, each with its key '
      + '(check.interfaceUndeclared, check.interactionUnused, check.applicationUnowned, check.unitOverLimit), weight '
      + 'and category as checks.list says them.',
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
      + 'An organisation chart or a Conway map shows people by name, and is refused where the organisation gives agents pseudonyms: '
      + 'diagram.inspect reads either. '
      + 'A business architecture sheet, an enterprise map or a technology landscape is drawn whole — none has coordinates to '
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

  // --- the drive tier: the app as a screen, and the session the person can stop (ADR-0019) ------
  {
    name: 'app.open',
    tier: 'drive',
    description:
      'Move the app: open a scope, and in it a view or a page — what a person does with the tree, the tabs '
      + 'and the cards. `scope` is a path from scopes.list (default: the open one); `page` is what to show '
      + 'there: home (the scope\'s own screen, nothing open), board / sheet / map / technology / drawing / chart / '
      + 'conway (a view, by id, or the only one of that kind), decisions (optionally on one record), observations (optionally '
      + 'on one record, and on one of its tabs with `tab`), roadmap, plan (by id), '
      + 'element (selected on a board that draws it), document or documentation (a record\'s page), '
      + 'platform or service (a report, by id), register, technologyRegister or people (the organisation-wide '
      + 'lists and the people register, on the home), operating (the operating model: unit types, roles, '
      + 'responsibilities and the libraries — kept at the organisation, so its scope is "" and may be left out; '
      + 'optionally on one unit type, role or responsibility), checks (every check by category over the scope\'s home — '
      + 'what it finds there, why each matters and how to fix it, and what was marked as intended — optionally on one '
      + 'check, its key as id). `select` names an element to select on the board, sheet, map, technology '
      + 'landscape, organisation chart (a unit) or Conway map (a unit or an application) being opened; where that view does not '
      + 'draw it, nothing is selected. Opening never '
      + 'makes a view. With no page a scope opens on its canvas, or on its home when it draws '
      + 'nothing. Answers with app.current once the app has arrived. Starts a driving session, which the '
      + 'person sees as a banner and can stop.',
    inputSchema: {
      type: 'object',
      properties: {
        scope: { type: 'string', description: 'Which scope, by path; "" is the organisation. Default: the one open.' },
        page: {
          type: 'string',
          description: 'What to show there. Default: the canvas, or the home of a scope with no views.',
          enum: [
            'home', 'board', 'sheet', 'map', 'technology', 'drawing', 'chart', 'conway',
            'decisions', 'observations', 'roadmap', 'plan', 'element', 'document', 'documentation',
            'platform', 'service', 'register', 'technologyRegister', 'people', 'operating', 'checks',
          ],
        },
        id: { type: 'string', description: 'The view, element, plan, decision, observation, cause, solution, experiment, unit type, role or responsibility the page is about, where it is about one; on checks, a check\'s key (check.roleVacant).' },
        tab: {
          type: 'string',
          description: 'Which tab of the observations page: the register, the analysis or the solutions. Only with page observations.',
          enum: OBSERVATION_TABS,
        },
        select: { type: 'string', description: 'An element to select on the board, sheet, map, technology landscape, organisation chart or Conway map being opened.' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'session.start',
    tier: 'drive',
    description:
      'Say what you are about to do. A driving session starts by itself on the first call that moves the '
      + 'app or changes the model; this one starts it on purpose and puts your reason on the banner the '
      + 'person sees, which is the courteous way to begin. After the person pressed Stop, every driving '
      + 'call is refused with agent.stopped until this is called again — do that only when they have asked '
      + 'you to continue.',
    inputSchema: {
      type: 'object',
      properties: {
        purpose: { type: 'string', description: 'What you are doing, in one short sentence for the person to read.' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'session.end',
    tier: 'drive',
    description:
      'You are done driving: the banner goes, and the person has the app to themselves. Reads keep working; '
      + 'the next call that drives starts a new session.',
    inputSchema: NO_ARGUMENTS,
  },
] as const satisfies readonly { name: string; tier: ToolTier; description: string; inputSchema: InputSchema }[]

export type ToolName = (typeof SPECS)[number]['name']

/** The tools of one tier, as a type: what a table over a tier is checked against, whole. */
export type ToolOfTier<T extends ToolTier> = Extract<(typeof SPECS)[number], { readonly tier: T }>['name']

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
    'Which scope to answer for, as its path: "" is the organisation, "acme/retail" a scope filed under '
    + 'another — a domain, a team, a landscape scope (see scopes.list). Default: the scope open in the app. A read over another scope is answered from its '
    + 'document as it is kept; a change, a picture, undo and the session\'s own lists need that scope open in the '
    + 'app, and are refused otherwise.',
}

/** About the whole tree rather than one scope: `scope` would mean nothing on them. */
export const TREE_WIDE: readonly string[] = [
  'scopes.list', 'register.list', 'technology.list', 'checks.list', 'views.list', 'assignments.list', 'reportingLines.list',
]

/**
 * About the organisation's people register rather than a scope (ADR-0036 §13):
 * no `scope`, and no project revision to guard, because the register is
 * outside the history and has a revision of its own.
 */
export const ON_THE_REGISTER: readonly string[] = ['people.list', 'person.add', 'person.leave']

/**
 * About the tree of scopes rather than the scope open (ADR-0040 §1): each
 * names the scope it is about by `path`, and lands as that scope's own step,
 * never on the open session — so no `scope`, and no project revision to guard.
 */
export const ON_THE_TREE: readonly string[] = ['scope.create', 'scope.update', 'scope.move', 'scope.remove']

/**
 * About the app rather than a document (ADR-0019): `app.open` spells `scope`
 * as its destination, and the other three are about whatever is on screen.
 * No revision to guard either — none of them writes the model.
 */
export const ABOUT_THE_APP: readonly string[] = ['app.current', 'app.open', 'session.start', 'session.end']

export const TOOLS: readonly ToolSpec[] = SPECS.map((tool): ToolSpec => {
  const properties = {
    ...tool.inputSchema.properties,
    ...(TREE_WIDE.includes(tool.name) || ABOUT_THE_APP.includes(tool.name) || ON_THE_REGISTER.includes(tool.name)
      || ON_THE_TREE.includes(tool.name) ? {} : { scope: SCOPE_ARGUMENT }),
    ...(tool.tier === 'read' || tool.tier === 'drive' || LOOKS_ONLY.includes(tool.name) || ON_THE_REGISTER.includes(tool.name)
      || ON_THE_TREE.includes(tool.name) ? {} : { ifRevision: REVISION_GUARD }),
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
  /**
   * This build has no window at all, so there is nothing to draw on, nothing
   * to move and nowhere to keep a picture. Not `agent.windowHidden`, which is a
   * window that exists and is behind something: that one is worth retrying
   * after asking the person to bring it forward, and this one never is.
   */
  | 'agent.noScreen'
  | 'agent.locked'
  | 'agent.notDrawn'
  | 'agent.busy'
  | 'agent.cancelled'
  | 'agent.noAnswer'
  | 'agent.planned'
  | 'agent.stale'
  | 'agent.notYours'
  | 'agent.saveFailed'
  /**
   * Somebody else's comment, which the person the agent acts for may not
   * remove in this scope (ADR-0037 §5, §8): the source says who moderates
   * (`SessionView.mayModerate`), and the tool refuses before anything is
   * written rather than leave it to the door.
   */
  | 'agent.mayNotModerate'
  /** The person pressed Stop on the driving banner (ADR-0019), and nobody has asked to start again. */
  | 'agent.stopped'
  /** A change, a picture or undo addressed to a scope that is not the one open in the app (ADR-0012, step 13). */
  | 'agent.scopeNotOpen'
  /** `scope` names a path the tree has no scope at. */
  | 'agent.unknownScope'
  /** No tree of scopes answers here: the host lent the agent none (ADR-0040 §1). */
  | 'agent.noTree'
  /**
   * The scope open in the workspace, or one above it, has its place in the
   * tree changed only from a home: the open session's to change (ADR-0040 §3).
   */
  | 'scope.isOpen'
  /** The organisation is the root of the tree: neither moved nor removed. */
  | 'scope.organisation'
  /** Scopes are filed under the one to remove; the detail names those the person may see and counts the rest (ADR-0040 §2). */
  | 'scope.scopesBelow'
  /** The scope holds work, counted in the detail: it goes only at the person's own words (ADR-0040 §2). */
  | 'scope.notEmpty'
  /** The scope was not read whole — part unreadable, a later version's, or no document — so it is not removed from here (ADR-0040 §2). */
  | 'scope.unreadable'
  /** The repository's own refusals of a scope's address, passed through (ADR-0040 §1). */
  | 'shell.scopeTaken'
  | 'shell.scopeIntoItself'
  | 'shell.badScopePath'
  /**
   * A unit removed has units inside it whose type may not sit in its parent
   * (3.6.2): where they go is the person's to say, and the detail names the
   * choices for `units`.
   */
  | 'agent.unitsInside'
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
  /**
   * A merge refused as a whole (ADR-0035, `observations/merge.ts`'s
   * `MergeRefusal`): nothing to absorb, a record already merged or archived,
   * the survivor among the absorbed, a first day that is not a day, a cause
   * made verified without its evidence, a problem and a bright spot in one
   * set, or a row of `links` asked to move
   * where the tree forbids it. A record that is not there is
   * `agent.unknownId`, and the two root steps' keys pass through.
   */
  | 'merge.nothing'
  | 'merge.merged'
  | 'merge.archived'
  | 'merge.survivorAbsorbed'
  | 'merge.notADay'
  | 'merge.unverified'
  /** A problem and a bright spot in one merge (ADR-0038 §6). */
  | 'merge.mixedTone'
  | 'merge.linkForbidden'
  /**
   * An observation that may not move (ADR-0038 §1): to the scope it is in, one
   * merged or moved already, one archived, or to a scope that is not there.
   * A record that is not there is `agent.unknownId`, and a scope holding
   * another record of its id `command.taken`.
   */
  | 'move.sameScope'
  | 'move.merged'
  | 'move.moved'
  | 'move.archived'
  | 'move.unknownScope'
  /** A unit's line from a role to the same role in the same unit (ADR-0039 §5). */
  | 'reportingLine.self'
  /** A solid line that would close a loop of managers, on the day it is written or its first day; the chain in the detail (ADR-0039 §5). */
  | 'reportingLine.loop'
  /** A function taken up from a scope that is not above this one (ADR-0040 §5); where it is defined in the detail. */
  | 'claim.notAbove'
  /** A function this scope defines: it is handed on from here, not taken up (ADR-0040 §5). */
  | 'claim.definedHere'
  /** No people register answers here: the host lent the agent none (ADR-0036 §13). */
  | 'agent.noRegister'
  /** `person.add` met somebody similar in the register, said in the detail (ADR-0036 §9). */
  | 'agent.possibleDuplicate'
  /** The register's own refusals pass straight through, as the reducer's do (`people/person.ts`). */
  | PeopleRefusal
  | CommandRefusal

export const REFUSAL_SENTENCE: Record<AgentRefusal, string> = {
  'agent.off': 'The app is not accepting agent connections. Turn them on in Connect an agent.',
  'agent.noProject':
    'No scope is open in the app. app.current says whose home is up, scopes.list and views.list say what '
    + 'there is, and app.open opens one; a read with scope set is answered without opening anything.',
  'agent.stopped':
    'The person pressed Stop on the agent banner and ended the session. Do not carry on by yourself: tell '
    + 'them where you got to, and call session.start only when they ask you to continue. Reads still answer.',
  'agent.readOnly': 'The project is read-only; nothing can be changed.',
  'agent.conflict': 'The project changed elsewhere and the person is deciding which version stands. Try again afterwards.',
  'agent.unknownTool': 'No such tool.',
  'agent.badArguments': 'The arguments do not match the tool\'s schema.',
  'agent.unknownId': 'Nothing in the project has that id.',
  'agent.scopeNotOpen': 'That scope is not the one open in the app. Reads over it are answered; a change, a picture or undo needs a person to open it.',
  'agent.unknownScope': 'No scope in the organisation has that path. scopes.list says which there are.',
  'agent.noTree': 'This app lends no tree of scopes to an agent here: a person makes, describes, moves and removes scopes on the organisation screen.',
  'scope.isOpen':
    'That scope is open in the workspace, or is filed above the one that is, and its place in the tree is the open session\'s to '
    + 'change. Call app.open with page home on the scope — or on the one above it, for a move or a removal — then call again.',
  'scope.organisation': 'The organisation is the root of the tree: it is neither moved nor removed. scope.update describes it.',
  'scope.scopesBelow':
    'Scopes are filed under this one; the detail names those you can see and counts those you cannot. A scope is removed one '
    + 'at a time: remove the ones below first, deepest first, one call each, each meeting this rule itself — or move them elsewhere.',
  'scope.notEmpty':
    'The scope holds work, counted by kind in the detail, and removing it cannot be undone. Tell the person what is in it and '
    + 'ask; never decide it yourself. Only if they then say, in their own words, that it is to go with all of it, call again '
    + 'with removeContents true and their words, quoted, in personSaid.',
  'scope.unreadable':
    'Part of that scope could not be read, or a later version of the app wrote it, so what it holds is not known and it is '
    + 'not removed from here. Tell the person: they open it in the app, where it can be put back or kept, and decide there.',
  'shell.scopeTaken': 'A scope is at that address already, or one nobody can read is in the way. Read scopes.list again and choose another.',
  'shell.scopeIntoItself': 'A scope cannot be filed under itself or under a scope filed under it. Choose a parent outside it.',
  'shell.badScopePath': 'No scope may have that address. Use a path from scopes.list.',
  'agent.unitsInside':
    'The unit has units inside it whose type may not sit where it sits, so where they go is the person\'s to say. '
    + 'Ask them, naming the choices in the detail, then call element.remove again with units: "into:<id>" for '
    + 'another unit of its type, "up" to move them up anyway (they show as misplaced), or "delete" to remove them too. '
    + 'Do not choose for them.',
  'agent.tooLarge': 'The board is too large for this operation.',
  'agent.locked': 'The decision record is accepted, rejected or superseded, and locked; nothing about it may change.',
  'agent.notDrawn': 'That element is not drawn on that diagram.',
  'agent.busy': 'A layout pass is already running. Try again when it has finished.',
  'agent.cancelled': 'The person cancelled the layout pass.',
  'agent.windowHidden': 'The window is hidden or minimised, so nothing can be drawn. Bring it to the front.',
  'agent.noScreen':
    'This build has no window, so it draws nothing, has nowhere to move and keeps no pictures. The read tier '
    + 'answers everything about the landscape; app.current says what there is.',
  'agent.noAnswer': 'The app did not answer in time.',
  'agent.planned': 'That interface was already dated by another plan, or by hand. Take that port back first.',
  'agent.stale': 'The project has changed since the revision this call named. Read it again and decide again.',
  'agent.notYours': 'The newest step is a person\'s, not an agent\'s; it is theirs to undo.',
  'agent.saveFailed': 'The project could not be saved; the app shows why.',
  'agent.mayNotModerate':
    'That comment is somebody else\'s, and the person you act for may not remove other people\'s comments in this scope. '
    + 'Its author may remove it, or someone who moderates the scope; ask the person whether to reply to it instead.',
  'check.ownedElsewhere': 'This record is a stand-in: the scope named in the detail defines the thing and answers for its lifecycle, dates, owner, vendor, technology, aspects and category. Its description is the owner\'s too: shown here, and changed in that scope.',
  'gesture.barrier': 'That step wrote two scopes — a record moved between them — so it cannot be undone from here. Move the record back with a gesture of its own.',
  'merge.nothing': 'A merge needs at least one record to fold into the survivor: name them in absorb.',
  'merge.merged': 'One of the records was merged into another already and is history. Merge the one it was merged into instead.',
  'merge.archived': 'One of the observations is archived, and an archived observation is out of the analysis. Restore it first (observation.archive with restore), or leave it out.',
  'merge.survivorAbsorbed': 'The survivor is among the records to absorb. A record cannot be folded into itself; leave it out of absorb.',
  'merge.notADay': 'The day the survivor was first seen is not a day: write it yyyy-mm-dd.',
  'merge.unverified': 'The survivor would be verified, and its body does not say why the team thinks so and how it was verified. Ask the person what confirmed it and write that into values.body in the same call.',
  'merge.mixedTone': 'A problem and a bright spot are not one thing seen twice, so they are never merged. The detail names the record of the other kind; leave it out of absorb.',
  'merge.linkForbidden': 'A link named in links may not move: the tree forbids it where the survivor lives, and the detail says why. Leave it out of links, or say move false; it stays on the absorbed record as history.',
  'move.sameScope': 'The observation is in that scope already. Name another scope in to.',
  'move.merged': 'The observation was merged into another and is history. Move the one it was merged into instead.',
  'move.moved': 'The observation was moved to another scope already, and what is left here is its tombstone. Move it from where it is now: observation.read says where.',
  'move.archived': 'The observation is archived, and an archived observation is out of the analysis. Restore it first (observation.archive with restore), then move it.',
  'move.unknownScope': 'No scope in the organisation has that path, or it cannot be read here. scopes.list says which there are.',
  'reportingLine.self': 'A role does not report to itself in the same unit, and a holder does not report to their own role in their own unit. Name another role, or another unit.',
  'reportingLine.loop':
    'The solid line would close a loop: following who manages whom from it, along the lines and the nesting, comes back to '
    + 'where it started — the chain, and the day, are in the detail. Ask the person which line in the chain is wrong; a dotted '
    + 'line decides nothing and is never refused.',
  'claim.notAbove':
    'Only a function of a scope above this one can be taken up here; the detail says where it is defined. A function '
    + 'beside or below is that scope\'s to take up or hand on: open the scope above both, or the one that defines it.',
  'claim.definedHere':
    'This scope defines that function, so there is nothing above to take up. To hand it to a domain below, write its '
    + 'scopes with element.update; the domain then takes it up with function.claim in its own scope.',
  'agent.noRegister': 'This app lends no people register to an agent here.',
  'agent.possibleDuplicate':
    'The register holds somebody who may be this person; the detail lists them. Use their id, or call again with '
    + 'addAnyway when it is truly somebody else — a duplicate made by mistake is merged by a person, not by you.',
  'people.unknown': 'Nobody in the register has that id. people.list says who there is.',
  'people.merged': 'That entry was merged into another and is a redirect now; use the id it was merged into.',
  'people.nameRequired': 'A person needs a name.',
  'people.badEmail': 'That is not a work address: one @, something either side of it, no spaces.',
  'people.badDay': 'That is not a day: write it yyyy-mm-dd.',
  'people.notActive': 'Only someone active can leave; this one has left already, or been forgotten.',
  'people.forgotten': 'That entry is forgotten: it has no name left to change.',
  'people.notForgotten': 'Only a forgotten entry is removed, and only by a person.',
  'people.badMerge': 'An entry is merged only into another that still has a name, and only by a person.',
  'people.mergeAsks': 'An active entry merged into one that has left is told whether the person is still here or left; merging is a person\'s, on the People page.',
  'people.badDistinct': 'Two entries are answered as not the same person only of two entries, and only by a person, on the People page.',
  'command.gone': 'Something the change refers to is no longer in the project.',
  'command.lastLandscape': 'The last landscape diagram cannot be deleted.',
  'command.datesOutOfOrder': 'The lifecycle dates run backwards: live, then retiring, then retired.',
  'command.refinesEnds': 'A container interface has to sit under the interface it refines: source under source, target under target, each end either the same element or a component of it.',
  'command.refinesLevel': 'The interface named by "refines" is itself a refinement. An interface lands once; refine the application-level line instead.',
  'command.hostedOnContainers': 'An application that has components runs where those run: write the hostedOn row from the component. Only an application with no components — an outside system, a SaaS service, a bought package — says where it runs itself.',
  'command.technologyEnds': 'hostedOn runs from an application or a component to a platform, and nothing else. A platform inside another platform is filed under it with parentId; a service consumed is a uses row.',
  'command.interactsEnds': 'interacts runs from one actor — a unit — to another, never to itself, and its mode is collaboration, service or facilitating.',
  'command.taken': 'Something in the scope already has that id, so the record you meant to add would have overwritten it. Read the scope again and add it under a free id.',
  'command.notAField': 'A patch names a field the record does not have. Nothing was changed; send only the record\'s own fields.',
  'command.ownedElsewhere': 'The record is a stand-in, and that field is written in the scope that defines it. Change it there.',
  'command.rootExplained': 'A root cause ends the chain, and another cause explains this one. Unlink that cause first, or make it the root cause instead.',
  'command.rootAddressed': 'A solution addresses this root cause, and a solution addresses root causes only. Move the solution to another root cause, or unaddress it, first.',
  'command.markFix': 'A fix is never marked as intended: the model contradicts itself, and the answer is a change to the model. A review or a note is marked by a person, never by a tool.',
  'command.notCommentable': 'That kind of record is not commented on. Comments are on observations, causes, solutions, experiments, elements, decisions and plans.',
  'command.unknownRecord': 'The record the comment is about is not in this scope. Comment on it in the scope that keeps it.',
  'command.badReply': 'replyTo must name a comment on the same record that is not a reply itself: a thread is one level deep.',
  'command.commentRemoved': 'That comment was removed, and a removed comment is not changed again. Write a new one.',
}

/**
 * Why a link a merge touches cannot move to the survivor (ADR-0035 §3), in
 * the link form's words and the three more a merge meets: what `merge.plan`
 * says beside each row that stays, and what `merge.linkForbidden` says of a
 * row asked to move all the same.
 */
export const MERGE_LINK_SENTENCE: Record<MergeLinkRefusal, string> = {
  self: 'It would name the record it lives on: the survivor cannot explain itself.',
  loop: 'It would close a loop between causes once the records are one, and a loop is not an explanation.',
  root: 'It would explain a root cause, and nothing explains a root cause.',
  upward: 'It would point up: a cause explains the causes of the scopes below its own, never one of its own scope or above it.',
  sideways: 'It would point sideways: a cause explains the causes of the scopes below its own only.',
  observationBelow: 'It would name an observation of a scope below, and that scope explains its own observations.',
  merged: 'It names a cause that was merged into another and is history.',
  unknown: 'It names a record of a scope that was not read, or that holds no such record.',
  observationElsewhere: 'A cause explains observations of its own scope only, and the survivor lives in another.',
  solutionElsewhere: 'A solution addresses causes of its own scope only, and the survivor lives in another.',
  notRoot: 'A solution addresses a root cause only, and the survivor will not be one.',
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

/** A list of strings, each one of `allowed` where it says. */
function stringsWrong(value: readonly unknown[], allowed: readonly string[] | undefined): string | undefined {
  if (!value.every((item) => typeof item === 'string')) return 'must be a list of strings'
  const odd = allowed ? value.find((item) => !allowed.includes(item as string)) : undefined
  return odd === undefined ? undefined : `holds ${String(odd)}, which is not one of ${allowed?.join(', ')}`
}

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
  if ('anyOf' in spec) return isPersonRef(value) ? undefined : 'must be text, or { "person": id } with an id from people.list'
  return checkTyped(spec, value)
}

/** A value against a schema of one type. */
function checkTyped(spec: Exclude<ArgumentSchema, PersonRefSchema>, value: unknown): string | undefined {
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
      if (spec.items.type === 'string') return stringsWrong(value, spec.items.enum)
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
