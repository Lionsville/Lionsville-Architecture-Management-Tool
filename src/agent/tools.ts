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
import { CHART_LINES, PAGE_FIELDS, PAGE_TABS, pagesKnown } from './screen'
import { OPERATING_RULE_KINDS, RACI_LETTERS } from '../model/operatingModel'
import { CERTAINTIES } from '../model/types'
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
        properties: { person: { type: 'string', description: 'A register id.' } },
        required: ['person'],
        additionalProperties: false,
      },
    ],
    description: `${what} A person: { "person": id } or text (rules.read person).`,
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
  /**
   * A see-tier tool that needs no screen when the diagram it names is a sheet
   * (ADR-0048): placing there is arithmetic on fixed sizes, and a host with no
   * screen offers it, as a write or as a read, and refuses it for a board.
   */
  readonly onASheet?: 'write' | 'read'
  readonly description: string
  readonly inputSchema: InputSchema
}

const NO_ARGUMENTS: InputSchema = { type: 'object', properties: {}, additionalProperties: false }

/** A scope's built-in kinds (`projects/scope.ts`'s `SCOPE_KINDS`, said again: `agent` may not import `projects`). */
const SCOPE_KINDS = ['organisation', 'domain', 'programme', 'team', 'landscape', 'topic'] as const

const ID = (what: string): ArgumentSchema => ({ type: 'string', description: `The id of the ${what}.` })

/** A principle somewhere in the tree. */
export const PRINCIPLE_REF: ArgumentSchema = {
  type: 'object', description: 'The other principle, with the scope that keeps it ("" the organisation). Default: the scope open.',
  properties: { scope: { type: 'string', description: 'The scope that keeps it.' }, id: { type: 'string', description: 'Its id.' } },
  required: ['id'], additionalProperties: false,
}

/** What an aspect says beside its words. */
const ASPECT_FIELDS: Record<string, ArgumentSchema> = {
  nature: { type: 'string', description: 'design: about what is built; behaviour: about how people work. Default design.', enum: ['design', 'behaviour'] },
  signal: { type: 'string', description: 'What would show it holds: a measure, a share, a count.' },
  steering: { type: 'string', description: 'Who or what keeps it true.' },
  note: { type: 'string', description: 'Why, on an accepted principle.' },
}

/** The principles a decision or an observation cites as it is written, in the one step. */
export const PRINCIPLES_CITED: ArgumentSchema = {
  type: 'array', description: 'Principles this record cites, in the same step (ADR-0041 §7; principles.suggest).',
  items: {
    type: 'object', description: 'One principle cited.',
    properties: {
      id: { type: 'string', description: 'The principle\'s id.' },
      scope: { type: 'string', description: 'Where it is kept; default the scope open.' },
      aspect: { type: 'integer', description: 'One aspect, by its number.', minimum: 1 },
      stance: { type: 'string', description: 'decision: supports or deviates; observation: holds, chafes or missing.', enum: ['supports', 'deviates', 'holds', 'chafes', 'missing'] },
      reason: { type: 'string', description: 'Why; required on deviates.' },
    },
    required: ['id'], additionalProperties: false,
  },
}

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
  'unitType', 'role', 'responsibility', 'comment', 'principle', 'person',
] as const
const LINE_STYLES = ['solid', 'dashed', 'dotted'] as const
/**
 * The record a comment is about (ADR-0037 §8): a kind the registry opts in,
 * and an id or a label. Written out for the reason the search's kinds are: a
 * schema is a protocol contract, and the registry is checked against it.
 */
export const COMMENTABLE_TOOL_KINDS = ['observation', 'cause', 'solution', 'experiment', 'element', 'decision', 'transition', 'principle'] as const
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

/**
 * Whether what a record says has been checked (ADR-0047). The word to use in
 * place of writing "(assumed)" into a name or "???" into a protocol.
 */
const CERTAINTY_ARGUMENT: ArgumentSchema = {
  type: 'string',
  description: 'assumed or confirmed: whether somebody checked it, in place of (assumed) in a name. Null: nobody said.',
  enum: ['confirmed', 'assumed'],
}

/** How a line is drawn. Absent means the theme's own stroke and a solid line. */
const LINE_FIELDS = {
  color: { type: 'string', description: 'The stroke, a hex colour; absent the theme\'s.' },
  lineStyle: { type: 'string', description: 'Solid, dashed or dotted. Solid when absent.', enum: LINE_STYLES },
} as const satisfies Record<string, ArgumentSchema>

/**
 * What every relation says and when it is there, whatever it means. Null
 * clears any of them.
 */
const RELATION_FIELDS = {
  label: { type: 'string', description: 'What the row says, in a few words.' },
  certainty: CERTAINTY_ARGUMENT,
  validFrom: { type: 'string', description: 'The first day it holds, yyyy-mm-dd; absent, its ends\' days.' },
  validUntil: { type: 'string', description: 'The last day it holds, inclusive; absent, its ends\' days.' },
  mode: {
    type: 'string',
    description: 'interacts only: collaboration, service or facilitating (ADR-0036 §7).',
    enum: INTERACTION_MODES,
  },
} as const satisfies Record<string, ArgumentSchema>

/** What a line says and when it is there. Null clears any of them. */
const CONNECTION_FIELDS = {
  label: { type: 'string', description: 'What flows, in a few words.' },
  certainty: CERTAINTY_ARGUMENT,
  protocol: {
    type: 'string',
    description: 'How: REST, AMQP, SFTP, a file drop; on a container line where refined (ADR-0013).',
  },
  technology: { type: 'string', description: 'What the interface is built out of.' },
  refines: {
    type: 'string',
    description: 'The application-level interface this container line is part of (ADR-0013); null detaches.',
  },
  isBidirectional: { type: 'boolean', description: 'Whether it flows both ways.' },
  validFrom: { type: 'string', description: 'The first day it is there, yyyy-mm-dd; absent, its ends\' days.' },
  validUntil: { type: 'string', description: 'The last day it is there, inclusive; absent, its ends\' days.' },
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
  certainty: CERTAINTY_ARGUMENT,
  description: { type: 'string', description: 'The documentation, as markdown. The first paragraph is drawn on the card.' },
  category: { type: 'string', description: 'A business category or capability.' },
  vendor: { type: 'string', description: 'Who makes it.' },
  technology: { type: 'string', description: 'What it is built on.' },
  platformArchetype: { type: 'string', description: 'A platform: place (hosts things), service (default) or network (ADR-0014).', enum: PLATFORM_ARCHETYPES },
  shared: { type: 'boolean', description: 'A platformService offered beyond its team (ADR-0014); false or null takes it off.' },
  lifecycle: { type: 'string', description: 'Where it is in its life.', enum: LIFECYCLES },
  isManaged: { type: 'boolean', description: 'Kept for older files; nothing reads it.' },
  owner: personArgument('Who answers for it; on an application one field with partyId, a unit there preferred.'),
  outside: { type: 'boolean', description: 'Nobody in this organisation owns it.' },
  partyId: { type: 'string', description: 'The actor it belongs to, kept here or above; on an application, its owner unit.' },
  order: { type: 'number', description: 'Its place among its siblings, low first.' },
  lane: { type: 'string', description: 'A step: the actor whose lane it is; absent, every lane.' },
  liveOn: { type: 'string', description: 'The day it goes live, yyyy-mm-dd. Before it, planned.' },
  retiringOn: { type: 'string', description: 'The day it starts retiring, yyyy-mm-dd.' },
  retiredOn: { type: 'string', description: 'The day it is gone, yyyy-mm-dd.' },
  successorId: { type: 'string', description: 'What replaces it.' },
  aspects: {
    type: 'object',
    description: 'Maturity by aspect key: managed, partial, none or atRisk; only keys given change, null takes one off.',
    additionalProperties: { type: 'string', enum: ASPECT_STATUSES },
  },
  accentColor: { type: 'string', description: 'The card\'s accent, a hex colour; null the theme\'s.' },
  iconKey: { type: 'string', description: 'The card\'s mark, by icon key; null takes it off.' },
  icon: { type: 'string', description: 'A step or actor\'s picture on a poster: an icon name or a content address (images.list); null takes it off.' },
  unitTypeId: {
    type: 'string',
    description: 'An actor: its unit type, which makes it a unit (ADR-0036 §3); null takes it off.',
  },
  scopes: {
    type: 'array',
    description: 'Scope paths, replacing the list: a function\'s domains it is handed to, a unit\'s domains it serves.',
    items: { type: 'string' },
  },
  extraSlots: {
    type: 'array',
    description: 'A unit: roles it holds beyond its type\'s, with counts; replaces the list.',
    items: {
      type: 'object',
      description: 'One role and its count.',
      properties: {
        roleId: { type: 'string', description: 'The role, by id (roles.list).' },
        min: { type: 'integer', description: 'At least this many.', minimum: 0 },
        max: { type: 'integer', description: 'At most this many.', minimum: 0 },
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
  initiative: { type: 'boolean', description: 'Shown on the roadmap of every scope above (ADR-0012 §7).' },
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
  description: 'Accepted records this replaces, replacing the list; accepting it supersedes them.',
  items: { type: 'string' },
}

const PROPOSED_BY = personArgument('Who proposed it.')

/** Who a decision was put to. Given whole: the list replaces the list. */
const SIGNERS: ArgumentSchema = {
  type: 'array',
  description: 'Who it is put to, replacing the list.',
  items: {
    type: 'object',
    description: 'One signer.',
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
  description: 'Per link, by merge.plan\'s key: whether it moves and its strength.',
  items: {
    type: 'object',
    description: 'One link.',
    properties: {
      key: { type: 'string', description: 'The row\'s key, as merge.plan answers it.' },
      move: { type: 'boolean', description: 'false keeps it on the absorbed record.' },
      strength: { type: 'string', description: 'Where it lands; default the stronger.', enum: ['strong', 'normal', 'weak'] },
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
  description: 'solid (a line manager\'s: decides who manages) or dotted (functional). Default solid.',
}

/** A slot's reporting line (ADR-0039 §2). */
/** One reporting line said on a role or on a unit type's slot (ADR-0039 §2, amended 17 October 2026). */
const REPORTS_TO_LINE: RowSchema = {
  type: 'object',
  description: 'One line: where the holders report, of one kind.',
  properties: {
    roleId: {
      type: 'string',
      description: 'The role reported to; left out on a slot, by nesting.',
    },
    kind: LINE_KIND,
    within: { type: 'boolean', description: 'To that role in the same unit.' },
    from: { type: 'string', description: 'The first day of the line, yyyy-mm-dd.' },
    until: { type: 'string', description: 'The last day of the line, yyyy-mm-dd.' },
  },
  additionalProperties: false,
}

const REPORTS_TO = (where: string): ArgumentSchema => ({
  type: 'array',
  description: `Where the holders report, ${where}: at most one line of each kind.`,
  items: REPORTS_TO_LINE,
})

/** One holder a line may land on, in place of every holder of the role there (ADR-0039, amended 17 October 2026). */
const TARGET_PERSON: ArgumentSchema = {
  type: 'string',
  description: 'One holder of that role there, by register id; absent, whoever holds it.',
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
        unitId: { type: 'string', description: 'The unit reported to.' },
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
  description: 'The holder\'s own lines, an exception only at the person\'s word: one of each kind; on update replaces theirs, [] or null the model\'s.',
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
        min: { type: 'integer', description: 'At least this many.', minimum: 0 },
        max: { type: 'integer', description: 'At most this many.', minimum: 0 },
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

/** What is said of a duty beside its letter (ADR-0052): a role's duties and a cell of the RACI share it. */
const DUTY_FIELDS: Readonly<Record<string, ArgumentSchema>> = {
  alsoResponsible: { type: 'boolean', description: 'Beside an A: responsible too (A/R).' },
  certainty: { type: 'string', description: 'Whether the letter was checked. Null: nobody said.', enum: CERTAINTIES },
  source: { type: 'string', description: 'Where the letter was read.' },
}

/** What a role says beside its name (ADR-0036): the fields `role.add` and `role.update` share. */
const ROLE_FIELDS: Readonly<Record<string, ArgumentSchema>> = {
  short: { type: 'string', description: 'A few letters, for the matrix\'s heading.' },
  purpose: { type: 'string', description: 'What the role is for, in the organisation\'s own words.' },
  description: { type: 'string', description: 'The role at length, as markdown.' },
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
        ...DUTY_FIELDS,
      },
      required: ['responsibilityId', 'raci'],
      additionalProperties: false,
    },
  },
  order: { type: 'number', description: 'Where it stands among the roles, low first; those with none follow. Null clears it.' },
  ...DATED_FIELDS('role'),
}

/** What a responsibility says beside its name: the fields `responsibility.add` and `responsibility.update` share. */
const RESPONSIBILITY_FIELDS: Readonly<Record<string, ArgumentSchema>> = {
  description: { type: 'string', description: 'What it comes down to.' },
  group: { type: 'string', description: 'What gathers it with others on the matrix.' },
  order: { type: 'number', description: 'Where it stands, low first; those with none follow. Null clears it.' },
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
    name: 'rules.read',
    tier: 'read',
    description:
      'The rules of a topic or a tool, read when you need them: about is scope, ifRevision, person, paging, batch or '
      + 'sheet, or the name of a tool whose description points here. Without about, what there is to ask.',
    inputSchema: {
      type: 'object',
      properties: { about: { type: 'string', description: 'A topic, or a tool\'s name.' } },
      additionalProperties: false,
    },
  },
  {
    name: 'scopes.list',
    tier: 'read',
    description:
      'Every scope in the organisation (ADR-0012 §1): path, name, kind or unit type, the units serving it (servedBy) '
      + 'and how their types agree (typeLink), its views, and which is open. A path is what scope takes; "" is the '
      + 'organisation. (rules.read)',
    inputSchema: NO_ARGUMENTS,
  },
  {
    name: 'views.list',
    tier: 'read',
    description:
      'Every view in the organisation, scope by scope: boards, sheets, maps, technology landscapes, drawings, '
      + 'organisation charts and Conway maps, with id, name, kind and which is on the tab. app.open takes a row\'s '
      + 'scope and id. Ask once and keep it. (rules.read)',
    inputSchema: {
      type: 'object',
      properties: {
        scope: { type: 'string', description: 'Only this scope and the scopes filed under it, by path; "" is the organisation.' },
        kind: {
          type: 'string',
          description: 'Only views of this kind.',
          enum: ['layer7', 'container', 'sheet', 'map', 'technology', 'drawing', 'chart', 'conway'],
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'register.list',
    tier: 'read',
    description:
      'Every application in the organisation, from the whole tree (ADR-0012 §2): its master, the scopes declaring and '
      + 'drawing it, outside and whose, and its findings. query filters. Services and platforms are '
      + 'technology.list. (rules.read)',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Only applications whose name, id or master contains every word.' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'technology.list',
    tier: 'read',
    description:
      'Every platform service and platform in the organisation, from the whole tree (ADR-0014): who answers for it, who '
      + 'draws it, what its rows say, and its findings. kind and query filter. Beside register.list. (rules.read)',
    inputSchema: {
      type: 'object',
      properties: {
        kind: { type: 'string', description: 'Only services, or only platforms. Default both.', enum: ['platformService', 'platform'] },
        query: { type: 'string', description: 'Only rows whose name, id, master or maintainer contains every word.' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'principles.list',
    tier: 'read',
    description:
      'Architecture principles (ADR-0041): with scope, those in force there with where each is kept and via; with own, '
      + 'only its own and its groups; without, every scope\'s own. Each with number, title, statement, status, '
      + 'regime and aspects. (rules.read)',
    inputSchema: {
      type: 'object',
      properties: { own: { type: 'boolean', description: 'Only the scope\'s own principles, with its groups.' } },
      additionalProperties: false,
    },
  },
  {
    name: 'principle.read',
    tier: 'read',
    description:
      'One principle whole (ADR-0041), in the scope that keeps it: its statement, aspects with their nature, signal and steering, groups, '
      + 'relations, sharpenings, keywords, what it was merged into, how it is used across the tree and every citation of it, with the citation ids principle.uncite takes.',
    inputSchema: {
      type: 'object',
      properties: { id: ID('principle') },
      required: ['id'],
      additionalProperties: false,
    },
  },
  {
    name: 'principles.suggest',
    tier: 'read',
    description:
      'Which principles in force at a scope may apply to a text being written (ADR-0041 §9), best first, with the words '
      + 'that matched: word matching, not understanding. (rules.read)',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'What is being written: a title and a body.' },
        about: {
          type: 'object', description: 'The record it is about, where there is one: what it cites already is left out, and what records about its subject cite counts.',
          properties: { kind: { type: 'string', description: 'decision, observation, solution, transition, element.', enum: ['decision', 'observation', 'solution', 'transition', 'element'] }, id: { type: 'string', description: 'Its id.' } },
          required: ['kind', 'id'], additionalProperties: false,
        },
        limit: { type: 'integer', description: 'At most this many. Default 8.', minimum: 1, maximum: 50 },
      },
      required: ['text'],
      additionalProperties: false,
    },
  },
  {
    name: 'topics.list',
    tier: 'read',
    description:
      'Topics (ADR-0042): scopes under the organisation\'s topics place that are relevant to other scopes by dated links, '
      + 'and their subtopics. Each says its path, name, parent topic, its own links (path, from, until) and relevantTo — '
      + 'where it holds today, through its parents too. A topic\'s principles are in force wherever it is relevant. '
      + 'With scope: only the topics relevant there today.',
    inputSchema: NO_ARGUMENTS,
  },
  {
    name: 'blocks.list',
    tier: 'read',
    description:
      'Building blocks (ADR-0043): each with its scope, capabilities, usage contexts and catalogue, and every scope\'s '
      + 'evaluation with each option\'s fit and failed musts, and the choice. id for one; scope for those kept or '
      + 'evaluated there. evaluation.read says one grid. (rules.read)',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'A building block\'s id.' } },
      additionalProperties: false,
    },
  },
  {
    name: 'evaluation.read',
    tier: 'read',
    description:
      'One scope\'s evaluation of a building block as its grid (ADR-0043): what is needed of each capability and the '
      + 'contexts that drive it, every cell — option by capability — with its level (0–4, absent where unrated) and note, '
      + 'each option\'s fit with its terms and the musts it fails, the ranking and the option chosen.',
    inputSchema: {
      type: 'object',
      properties: {
        block: { type: 'string', description: 'The building block\'s id.' },
        blockScope: { type: 'string', description: 'The scope that keeps the block, where two scopes keep one of that id.' },
        scope: { type: 'string', description: 'The scope that evaluates it, by path. Default: the scope open.' },
      },
      required: ['block'],
      additionalProperties: false,
    },
  },
  {
    name: 'references.list',
    tier: 'read',
    description:
      'What a document may refer to (ADR-0043 §9), in the open or named scope: views, elements, principles and aspects, '
      + 'blocks and evaluations, decisions, observations — each with the markdown to write. query narrows; at most '
      + '50. (rules.read)',
    inputSchema: {
      type: 'object',
      properties: { query: { type: 'string', description: 'Words the label, the detail or the kind must hold.' } },
      additionalProperties: false,
    },
  },
  {
    name: 'checks.list',
    tier: 'read',
    description:
      'What the tree contradicts about itself (ADR-0012 §9): findings, each with its key, weight (fix, review, note), '
      + 'category, why it matters and how to fix it; notes only with notes or their key; those a person marked as '
      + 'intended apart, under marked. on reads a day. No tool marks a finding as intended. (rules.read)',
    inputSchema: {
      type: 'object',
      properties: {
        scope: { type: 'string', description: 'Only findings about this scope, by path; "" is the organisation.' },
        on: { type: 'string', description: 'The day the organisation\'s findings are read on, yyyy-mm-dd. Default: today.' },
        key: { type: 'string', description: 'Only findings with this key.' },
        notes: { type: 'boolean', description: 'Include the notes: findings whose check is weighed a note, information that may well be intended. Default false.' },
        information: { type: 'boolean', description: 'The same as notes, by its older name.' },
      },
      additionalProperties: false,
    },
  },

  // --- the tree (ADR-0040 §1–§2): about the tree, not the scope open; each its scope's own step ---
  {
    name: 'scope.create',
    tier: 'write',
    description:
      'Make a scope under a parent (ADR-0040): name, withBoard for a landscape scope, servedBy a unit, topic for a '
      + 'topic (ADR-0042). Not a step on the scope open, so not in a batch. Answers the path, kind, board and the '
      + 'link. (rules.read)',
    inputSchema: {
      type: 'object',
      properties: {
        parent: { type: 'string', description: 'The scope to file it under, by path; "" is the organisation (scopes.list).' },
        name: { type: 'string', description: 'What it is called. Its address is made from it.' },
        withBoard: { type: 'boolean', description: 'Give it a first board, making it a landscape scope. Default false: a domain.' },
        topic: { type: 'boolean', description: 'Make a topic, filed under the topics place unless parent is in it or is a topic. Default false.' },
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
      'Change what a scope says about itself (ADR-0040): name, description, unitTypeId or kind (one clears the other), '
      + 'client, links, and a topic\'s relevantTo given whole. Only the fields given change. Answers which changed. '
      + '(rules.read)',
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
        relevantTo: {
          type: 'array',
          description: 'A topic\'s links, whole: every link it is to keep, ended ones included. Empty or null clears them.',
          items: {
            type: 'object',
            description: 'One link to a scope it is relevant to.',
            properties: {
              path: { type: 'string', description: 'The scope it is relevant to, by path.' },
              from: { type: 'string', description: 'Its first day, yyyy-mm-dd. Absent: since always.' },
              until: { type: 'string', description: 'Its last day, yyyy-mm-dd, once it ends. Absent: it holds on.' },
            },
            required: ['path'],
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
      'File a scope, and all under it, under another parent (ADR-0040), keeping its last segment. Stand-ins and served '
      + 'scopes pointing into it are re-addressed. Answers from, to, carried, notCarried and units. (rules.read)',
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
      'Remove one scope (ADR-0040), with no undo. Refused scope.scopesBelow while scopes are under it, and '
      + 'scope.notEmpty while it holds work unless removeContents with personSaid, the person\'s own words. Answers '
      + 'what went. (rules.read)',
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
      'The organisation\'s people register (ADR-0036): each entry\'s id, name or pseudonym, kind, state and its days, '
      + 'and whether it has a work address (never the address); redirects of merged entries; possible duplicates '
      + 'for a person to merge. query and state filter. (rules.read)',
    inputSchema: {
      type: 'object',
      properties: {
        state: { type: 'string', description: 'Only entries in this state. Default all.', enum: PERSON_STATES },
        query: { type: 'string', description: 'Only entries whose name as shown, or id, contains every word.' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'person.add',
    tier: 'write',
    description:
      'Add a person to the register (ADR-0036): active, with an id and pseudonym. Not a step. Refused '
      + 'agent.possibleDuplicate with the candidates unless addAnyway. Answers the entry. (rules.read)',
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
      'Mark a person as left on their last day (ADR-0036 §10): their assignments end (endedAssignments), and the name '
      + 'is forgotten after the policy\'s period. Not a step. (rules.read)',
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
    name: 'person.takeBackLeaving',
    tier: 'write',
    description:
      'Take back a leaving that was a mistake, when the person says so: the entry is active again and the assignments '
      + 'the leaving ended run on (restoredAssignments). Refused once the name is forgotten. (rules.read)',
    inputSchema: {
      type: 'object',
      properties: { id: ID('person, from people.list') },
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
      },
      additionalProperties: false,
    },
  },
  {
    name: 'element.describe',
    tier: 'read',
    description:
      'Everything about one element: its fields, its documentation, its connections, where it is drawn, the decisions '
      + 'about it, the open observations on it, and who answers for it. A record with ref is a stand-in: its fields '
      + 'are the defining scope\'s, changed there. (rules.read)',
    inputSchema: { type: 'object', properties: { id: ID('element') }, required: ['id'], additionalProperties: false },
  },
  {
    name: 'connections.list',
    tier: 'read',
    description:
      'The connections: id, source, target, label, protocol, technology, days, the plan that dated it, and an '
      + 'interface\'s refinements nested (ADR-0013). elementId and diagramId filter. (rules.read)',
    inputSchema: {
      type: 'object',
      properties: {
        elementId: { type: 'string', description: 'Only connections that start or end on this element.' },
        diagramId: { type: 'string', description: 'Only connections whose both ends are drawn on this diagram.' },
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
      'This scope\'s observations (ADR-0021): id, label, title, date, where, impact, sightings, tone, recorder and the '
      + 'causes it was analysed into; below for the scopes under this one; merged and archived ones only when '
      + 'asked; tone and recordedBy "me" filter. (rules.read)',
    inputSchema: {
      type: 'object',
      properties: {
        impact: { type: 'string', description: 'Only observations of this impact.', enum: ['minor', 'major', 'critical'] },
        tone: { type: 'string', description: 'Only observations of this tone: bright, something that works; neutral, not said either way; problem, something that goes wrong. Default: every tone. all and problems (everything but the bright spots) are read for one release.', enum: ['bright', 'neutral', 'problem', 'all', 'problems'] },
        recordedBy: { type: 'string', description: 'me: only what the person you act for recorded, or saw, by id or by their full name as typed. Where names are withheld from you, by id alone.', enum: ['me'] },
        analysed: { type: 'boolean', description: 'true: only those linked to a cause; false: only those not yet analysed.' },
        includeMerged: { type: 'boolean', description: 'Also list observations that were merged into another.' },
        includeArchived: { type: 'boolean', description: 'Also list observations that were archived.' },
        below: { type: 'boolean', description: 'true: the observations of the scopes below this one, each with its scope, instead of this scope\'s own.' },
        about: { type: 'string', description: 'Only observations about this element, by id. Each observation answers the elements it is about as about.' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'observation.read',
    tier: 'read',
    description: 'One observation in full: its fields, its dated history, the causes that explain it, and its body as markdown. '
      + 'Who recorded it is said as recordedBy: a person and what they read as, or a name, with the client it came through; '
      + 'where the organisation gives agents pseudonyms and nobody in the register stands for that name, it is withheld from you (nameWithheld).',
    inputSchema: { type: 'object', properties: { id: ID('observation') }, required: ['id'], additionalProperties: false },
  },
  {
    name: 'causes.list',
    tier: 'read',
    description:
      'This scope\'s causes (ADR-0021): id, label (CA-, RC- for a root), title, state, what each explains and what '
      + 'explains it, with strengths. Merged ones only with includeMerged. (rules.read)',
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
      'What observation.merge or cause.merge would do with these arguments, without doing it (ADR-0035): the survivor, '
      + 'every link touched with its key and whether it may move, the scopes it would write, the comments that '
      + 'travel, and the refusal it would meet. (rules.read)',
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
      'What observation.move would do, without doing it (ADR-0038): the number it would have, the scopes it would '
      + 'write, the comments that go with it, every link it would cut or restore, and the refusal it would meet. '
      + '(rules.read)',
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
      'This scope\'s solutions (ADR-0026): label, title, state, phase, benefit and cost, what each addresses, its '
      + 'experiments, decision and plan, and what the next gate needs. Dropped ones with includeDropped; phase and '
      + 'causeId filter. (rules.read)',
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
      'The organisation\'s unit types (ADR-0036): purpose, where a unit of it may sit (top, within), spans, slots, '
      + 'limit, basedOn and alsoBasedOn, by lane and order. Kept at the organisation, read from there. (rules.read)',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'aspectScales.list',
    tier: 'read',
    description:
      'The aspects the organisation rates on a numeric scale (ADR-0046): each key, its name and its lowest and highest value. '
      + 'A function, whether an area, a grouping or a capability, is rated on one with element.rate, and elements.list and element.describe answer its ratings. '
      + 'Kept at the organisation: whatever scope is open, this answers from there.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'roles.list',
    tier: 'read',
    description:
      'The organisation\'s roles (ADR-0036): name, short, purpose, duties (R, A, C, I), manages, reportsTo, the unit '
      + 'types that hold it, basedOn, and the rules that name a role. A description only by id or in fields. (rules.read)',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Only this role, with its description.' },
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
      + 'part in it (R, A, C or I), the roles accountable and responsible, and a finding where it is not exactly one role\'s A: nobody is '
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
      'Who holds which role in which unit (ADR-0036 §4), across the tree: each assignment\'s scope, unit, role, person '
      + '(by id and name or pseudonym), share, days, acting, who manages them and via what, and exception. With '
      + 'unitId, that unit\'s slots and managers. (rules.read)',
    inputSchema: {
      type: 'object',
      properties: {
        scope: { type: 'string', description: 'Only the assignments this scope keeps, by path; "" is the organisation.' },
        unitId: { type: 'string', description: 'Only this unit\'s; the answer then says its slots and who manages it.' },
        roleId: { type: 'string', description: 'Only this role\'s.' },
        personId: { type: 'string', description: 'Only this person\'s, by register id (people.list); an id merged into theirs counts.' },
        on: { type: 'string', description: 'The day, yyyy-mm-dd. Default: today.' },
        all: { type: 'boolean', description: 'Every assignment, over or still to begin as well. Default false.' },
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
      'One platform and what would be left standing if it went (ADR-0013): what is filed under it, what it stands on, '
      + 'what runs on it, what uses it, and the container interfaces that cross it. (rules.read)',
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
      'One platform service and what would be stranded if it were withdrawn (ADR-0014): maintainers, shared, what '
      + 'realises it, consumers by application and scope, and those still on it on the day. platform.report is the '
      + 'platform\'s side. (rules.read)',
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
      'What the dates in this landscape contradict: retirements with live connections or no successor, successors late, '
      + 'connections past an end, plans overdue; and impliedInterface rows interface.accept draws. (rules.read)',
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
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: 'changes.list',
    tier: 'read',
    description:
      'A record\'s changes (ADR-0038): the history\'s entries that wrote it, newest first — when, who, via which client, '
      + 'and what each did to it in the record\'s own terms. The history keeps runs of steps, not each step, so one entry may '
      + 'be several changes. kept is false where the source keeps no history. History… in the app shows the whole scope.',
    inputSchema: {
      type: 'object',
      properties: {
        about: COMMENT_ABOUT,
      },
      required: ['about'],
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
      'Search every kind of record together, as ⌘K does: every word must occur, case and accents ignored. Each hit says '
      + 'its kind, id, title, label, status and a snippet; one held by another scope says scopePath, to read it '
      + 'there. (rules.read)',
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
      'Add an element of a kind, drawn on a diagram where a board draws its kind (the one on screen unless diagramId). '
      + 'Its id comes from its name; it lands in its kind\'s band unless a zone or spot is named. A business kind '
      + 'is a record and is drawn nowhere. Answers the id and whether it was drawn. (rules.read)',
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
      'Change an element\'s fields: only those given change, null clears an optional one. Dates run live, retiring, '
      + 'retired; a loop of parentId is refused; a unit\'s parentId moves it anywhere in the organisation. Where a '
      + 'card sits is element.place. (rules.read)',
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
    name: 'element.rate',
    tier: 'write',
    description:
      'Rate a function, whether an area, a grouping or a capability, on one aspect the organisation keeps a scale for (ADR-0046; aspectScales.list): '
      + 'a whole number on that scale, or null to take the rating away. Call it in the scope that defines the function: a stand-in is rated there. '
      + 'A sheet\'s heat map reads these. Rate what the person gave you a reason for, not a guess.',
    inputSchema: {
      type: 'object',
      properties: {
        id: ID('function'),
        aspect: { type: 'string', description: 'The key of the aspect, from aspectScales.list.' },
        value: { type: 'integer', description: 'The value, on the scale. Null takes it away.' },
      },
      required: ['id', 'aspect', 'value'],
      additionalProperties: false,
    },
  },
  {
    name: 'aspectScale.set',
    tier: 'write',
    description:
      'Give an aspect a numeric scale, or change one, for the whole organisation (ADR-0046): 1 to 5 unless said. At the '
      + 'organisation, open first. Ask before changing one in use. (rules.read)',
    inputSchema: {
      type: 'object',
      properties: {
        key: { type: 'string', description: 'What ratings are filed under. Stable: renaming a scale keeps its key.' },
        label: { type: 'string', description: 'What it is called.' },
        code: { type: 'string', description: 'What a tight cell shows, where a derived code would be wrong.' },
        min: { type: 'integer', description: 'The lowest value. Default 1.' },
        max: { type: 'integer', description: 'The highest value, above min. Default 5.' },
      },
      required: ['key', 'label'],
      additionalProperties: false,
    },
  },
  {
    name: 'aspectScale.remove',
    tier: 'write',
    description: 'Take an aspect\'s scale away (ADR-0046). The ratings stay on the functions and read as unrated; setting the scale again brings them back. Kept at the organisation: open it first.',
    inputSchema: {
      type: 'object',
      properties: { key: { type: 'string', description: 'The key, from aspectScales.list.' } },
      required: ['key'],
      additionalProperties: false,
    },
  },
  {
    name: 'element.remove',
    tier: 'write',
    description:
      'Remove an element with its connections, its places on every view and its container view; for a unit, its '
      + 'assignments too (answered), its units inside moved up where they may sit, else refused agent.unitsInside '
      + 'to ask the person. One undo step. (rules.read)',
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
      'Draw a connection from one element to another, dated when the line is temporary. Answers with the connection\'s '
      + 'id. A line to or from a component is a container-level line: say with "refines" which application-level '
      + 'interface it is part of, or leave it out and it is an interface of its own that roadmap.check will offer '
      + 'to draw the application line for. (rules.read)',
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
      'Change a connection\'s label, protocol, direction, validity, colour or line style; null clears a field. Colour a '
      + 'line by what flows over it and a busy board reads again; "solid" and an empty colour give the theme back '
      + 'its line. (rules.read)',
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
      'connection.update for several lines at once, as one undo step: every change lands or none does. Each item takes '
      + 'what connection.update takes. (rules.read)',
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
      'Join two elements with a typed relation (ADR-0012 §5): supports, serves, realises, assigned, hostedOn, uses or '
      + 'interacts (two units, with a mode). Dated where it holds for a while; one end may be another scope\'s. A '
      + 'flow between applications is connect. Answers the relation\'s id. (rules.read)',
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
      'Make what an application or a component uses equal to a list (ADR-0020): the platformServices it consumes and '
      + 'the platforms it binds to, as one step; another scope\'s target arrives as a stand-in. Answers the rows '
      + 'written and removed. (rules.read)',
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
      'Take up a function (an area, grouping or capability) of a scope above this one, as a stand-in on this scope\'s '
      + 'business sheet (ADR-0040 §5): one step here, nothing written above. Refused claim.notAbove or '
      + 'claim.definedHere. Answers where it landed. (rules.read)',
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
      'Change what a relation means, what it says, or the days it holds; null clears a field. A flow\'s protocol, '
      + 'direction and look are connection.update\'s, because only a flow has them. (rules.read)',
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
      'Add an architecture decision record in the proposed state, numbered after the last one in its list: the '
      + 'landscape\'s, or one application\'s. The body is MADR markdown; leave it out for the template. Name the '
      + 'plans that rest on it and they are linked in the same step. A record is about one application at most — '
      + 'that is its scope, not a list of elements. Answers with the id and the label. (rules.read)',
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
        principles: PRINCIPLES_CITED,
      },
      required: ['title'],
      additionalProperties: false,
    },
  },
  {
    name: 'decision.update',
    tier: 'write',
    description:
      'Correct a record that is still proposed or reviewing: its title, its body, its date, who it was put to, who '
      + 'proposed it, or which accepted records it supersedes. Accepted, rejected and superseded records are '
      + 'locked; a group\'s records are changed on their page. (rules.read)',
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
        principles: PRINCIPLES_CITED,
      },
      required: ['id'],
      additionalProperties: false,
    },
  },
  {
    name: 'principle.add',
    tier: 'write',
    description:
      'Propose an architecture principle in the open scope (ADR-0041): a title, a statement, and its aspects — the parts a '
      + 'record follows or departs from one by one, at least one. A candidate by default, with the question it is about; '
      + 'accepted where the person said it is. It holds in this scope, every scope under it, and where a topic that keeps it is relevant.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Its title.' }, statement: { type: 'string', description: 'What it says, in markdown.' },
        aspects: { type: 'array', description: 'Its aspects, in order: at least one.', items: { type: 'string' } },
        regime: { type: 'string', description: 'fixed: kept to always; flexible (default): weighed.', enum: ['fixed', 'flexible'] },
        status: { type: 'string', description: 'candidate (default) or accepted, where the person said so.', enum: ['candidate', 'accepted'] },
        question: { type: 'string', description: 'What a candidate asks.' },
        rationale: { type: 'string', description: 'Why it holds.' },
        implications: { type: 'string', description: 'What follows from it.' },
        keywords: { type: 'array', description: 'Words it is found by besides its own.', items: { type: 'string' } },
        groups: { type: 'array', description: 'The groups it is filed under, by name. One the scope has not got is made, in the same step.', items: { type: 'string' } },
      },
      required: ['title', 'statement', 'aspects'],
      additionalProperties: false,
    },
  },
  {
    name: 'principle.update',
    tier: 'write',
    description:
      'Change a principle of the open scope: title, statement, regime, status, rationale, implications, question, '
      + 'keywords, groups (the whole list, by name). An accepted principle\'s statement or aspects changed needs '
      + 'note. (rules.read)',
    inputSchema: {
      type: 'object',
      properties: {
        id: ID('principle'), title: { type: 'string', description: 'Its new title.' }, statement: { type: 'string', description: 'Its new statement.' },
        regime: { type: 'string', description: 'fixed or flexible.', enum: ['fixed', 'flexible'] },
        status: { type: 'string', description: 'candidate, accepted or retired.', enum: ['candidate', 'accepted', 'retired'] },
        rationale: { type: 'string', description: 'Why it holds.' },
        implications: { type: 'string', description: 'What follows from it.' },
        question: { type: 'string', description: 'What a candidate asks.' },
        keywords: { type: 'array', description: 'Words it is found by besides its own: the whole list.', items: { type: 'string' } },
        groups: { type: 'array', description: 'The groups it is filed under, by name: the whole list.', items: { type: 'string' } },
        note: { type: 'string', description: 'Why an accepted principle\'s words change.' },
      },
      required: ['id'],
      additionalProperties: false,
    },
  },
  {
    name: 'citation.add',
    tier: 'write',
    description:
      'A record of the open scope cites a principle in force here (principles.list with scope): a decision, solution, plan, '
      + 'element or building block supports it or deviates from it (a reason required); an observation says it holds, '
      + 'chafes or was missing. aspect narrows it to one aspect by its number.',
    inputSchema: {
      type: 'object',
      properties: {
        about: { type: 'object', description: 'The citing record of the open scope.', properties: { kind: { type: 'string', description: 'decision, observation, solution, transition, element.', enum: ['decision', 'observation', 'solution', 'transition', 'element'] }, id: { type: 'string', description: 'Its id.' } }, required: ['kind', 'id'], additionalProperties: false },
        principle: { type: 'object', description: 'The principle, with the scope that keeps it ("" the organisation).', properties: { scope: { type: 'string', description: 'The scope that keeps it.' }, id: { type: 'string', description: 'Its id.' } }, required: ['id'], additionalProperties: false },
        aspect: { type: 'integer', description: 'One aspect, by its number.', minimum: 1 },
        stance: { type: 'string', description: 'supports or deviates for a decision, solution, plan or element; holds, chafes or missing for an observation.', enum: ['supports', 'deviates', 'holds', 'chafes', 'missing'] },
        reason: { type: 'string', description: 'Why; required on deviates.' },
      },
      required: ['about', 'principle', 'stance'],
      additionalProperties: false,
    },
  },
  {
    name: 'principle.uncite',
    tier: 'write',
    description: 'Take a citation back: the record no longer says anything about the principle. principle.read lists a principle\'s citations with their ids.',
    inputSchema: { type: 'object', properties: { id: ID('citation') }, required: ['id'], additionalProperties: false },
  },
  {
    name: 'principleGroups.set',
    tier: 'write',
    description:
      'The open scope\'s groups of principles, whole and in order (ADR-0041 §3): this is how groups are made, renamed, ordered and removed. An entry with an id is that group, under the name it says; '
      + 'one with no id is the group of that name, or a new one. A group left out is removed, and taken off its principles in the same step; none of them goes. principles.list with own says the ids.',
    inputSchema: {
      type: 'object',
      properties: {
        groups: {
          type: 'array', description: 'Every group the scope is to have, in order.',
          items: {
            type: 'object', description: 'One group.',
            properties: { id: { type: 'string', description: 'The group\'s id, to keep it under a new name.' }, name: { type: 'string', description: 'Its name.' }, description: { type: 'string', description: 'What it holds.' } },
            required: ['name'], additionalProperties: false,
          },
        },
      },
      required: ['groups'],
      additionalProperties: false,
    },
  },
  {
    name: 'principle.relate',
    tier: 'write',
    description: 'A principle of the open scope is in tension with another, or refines one, here or in a scope above (ADR-0041 §5). Said on the one that makes it, shown on both.',
    inputSchema: {
      type: 'object',
      properties: {
        id: ID('principle'), kind: { type: 'string', description: 'tension or refines.', enum: ['tension', 'refines'] },
        to: PRINCIPLE_REF,
      },
      required: ['id', 'kind', 'to'],
      additionalProperties: false,
    },
  },
  {
    name: 'principle.unrelate',
    tier: 'write',
    description: 'Take back a relation principle.relate made.',
    inputSchema: {
      type: 'object',
      properties: {
        id: ID('principle'), kind: { type: 'string', description: 'tension or refines.', enum: ['tension', 'refines'] },
        to: PRINCIPLE_REF,
      },
      required: ['id', 'kind', 'to'],
      additionalProperties: false,
    },
  },
  {
    name: 'principle.merge',
    tier: 'write',
    description:
      'One principle of the open scope absorbs others of it (ADR-0041 §6): their aspects come after its own, renumbered, with their groups, relations, keywords, comments and this scope\'s citations; each absorbed one is kept as history. '
      + 'What says the same thing twice is merged. citedElsewhere in the answer names citations other scopes keep, which are theirs to change: tell the person.',
    inputSchema: {
      type: 'object',
      properties: {
        into: ID('principle that stays'),
        from: { type: 'array', description: 'The principles it absorbs.', items: { type: 'string' } },
      },
      required: ['into', 'from'],
      additionalProperties: false,
    },
  },
  {
    name: 'principle.remove',
    tier: 'write',
    description: 'Remove a principle of the open scope, with its comments, while nothing in any scope cites it (agent.principleCited otherwise). One that has been used is retired instead, with principle.update.',
    inputSchema: { type: 'object', properties: { id: ID('principle') }, required: ['id'], additionalProperties: false },
  },
  {
    name: 'aspect.add',
    tier: 'write',
    description: 'A new aspect on a principle of the open scope: one more claim a record can follow or depart from. It gets the next number, never one used before. On an accepted principle this sharpens it and needs note.',
    inputSchema: {
      type: 'object',
      properties: {
        principle: ID('principle'), text: { type: 'string', description: 'What it claims.' }, ...ASPECT_FIELDS,
      },
      required: ['principle', 'text'],
      additionalProperties: false,
    },
  },
  {
    name: 'aspect.update',
    tier: 'write',
    description: 'Change an aspect of a principle of the open scope, by its number. Its words or nature on an accepted principle sharpen it, and need note.',
    inputSchema: {
      type: 'object',
      properties: {
        principle: ID('principle'), number: { type: 'integer', description: 'The aspect\'s number.', minimum: 1 }, text: { type: 'string', description: 'What it claims.' }, ...ASPECT_FIELDS,
      },
      required: ['principle', 'number'],
      additionalProperties: false,
    },
  },
  {
    name: 'aspect.remove',
    tier: 'write',
    description: 'Remove an aspect of a principle of the open scope, by its number, which stays taken. A principle keeps at least one. On an accepted principle this sharpens it and needs note.',
    inputSchema: {
      type: 'object',
      properties: {
        principle: ID('principle'), number: { type: 'integer', description: 'The aspect\'s number.', minimum: 1 },
        note: { type: 'string', description: 'Why, on an accepted principle.' },
      },
      required: ['principle', 'number'],
      additionalProperties: false,
    },
  },
  {
    name: 'evaluation.rate',
    tier: 'write',
    description:
      'Rate options against capabilities in the open scope\'s evaluation of a building block (ADR-0043 §5): one cell by '
      + 'option, capability and level, or several in cells, as one step; level 0 (not covered) to 4 (fully), with how where '
      + 'it helps. An option not yet weighed here is added. evaluation.read says the grid and the fit that follows.',
    inputSchema: {
      type: 'object',
      properties: {
        block: { type: 'object', description: 'The building block, with the scope that keeps it.', properties: { scope: { type: 'string', description: 'The scope that keeps it.' }, id: { type: 'string', description: 'Its id.' } }, required: ['id'], additionalProperties: false },
        option: { type: 'string', description: 'A solution\'s id in the block\'s catalogue.' },
        capability: { type: 'string', description: 'A capability\'s id.' },
        level: { type: 'integer', description: '0 (not covered) to 4 (fully).', minimum: 0, maximum: 4 },
        how: { type: 'string', description: 'How it covers it, where that helps.' },
        cells: {
          type: 'array',
          description: 'Several cells, rated in the same step; with or instead of option, capability and level.',
          items: {
            type: 'object',
            description: 'One cell.',
            properties: {
              option: { type: 'string', description: 'A solution\'s id.' },
              capability: { type: 'string', description: 'A capability\'s id.' },
              level: { type: 'integer', description: '0 to 4.', minimum: 0, maximum: 4 },
              how: { type: 'string', description: 'How it covers it.' },
            },
            required: ['option', 'capability', 'level'],
            additionalProperties: false,
          },
        },
      },
      required: ['block'],
      additionalProperties: false,
    },
  },
  {
    name: 'evaluation.add',
    tier: 'write',
    description:
      'Start the open scope\'s evaluation of a building block (ADR-0043 §4): the contexts that apply (all where none '
      + 'given) and, with copyFrom, another scope\'s options and ratings. One per block per scope. (rules.read)',
    inputSchema: {
      type: 'object',
      properties: {
        block: { type: 'string', description: 'The building block\'s id.' },
        contexts: { type: 'array', description: 'The usage contexts that apply here, by id or name. Absent: all of them.', items: { type: 'string' } },
        copyFrom: { type: 'string', description: 'A scope that evaluates the block already, by path, whose options and ratings this one starts from.' },
      },
      required: ['block'],
      additionalProperties: false,
    },
  },
  {
    name: 'evaluation.propose',
    tier: 'write',
    description:
      'Propose the decision the open scope\'s evaluation of a block becomes (ADR-0043 §7), as the block\'s page drafts '
      + 'it, choosing one option weighed here. Accepting it marks the option chosen. (rules.read)',
    inputSchema: {
      type: 'object',
      properties: {
        block: { type: 'string', description: 'The building block\'s id.' },
        option: { type: 'string', description: 'The solution chosen, by id or name: one of the options weighed here.' },
      },
      required: ['block', 'option'],
      additionalProperties: false,
    },
  },
  {
    name: 'block.update',
    tier: 'write',
    description:
      'Change a building block kept in the open scope (ADR-0043): its capabilities, usage contexts (with needs 0 to 4) '
      + 'and catalogue of solutions, each list whole — an item with its id is kept, one without is new. Answers the '
      + 'ids. (rules.read)',
    inputSchema: {
      type: 'object',
      properties: {
        id: ID('building block'),
        capabilities: {
          type: 'array', description: 'What it must provide, whole.',
          items: {
            type: 'object', description: 'One capability.',
            properties: {
              id: { type: 'string', description: 'Its id, to keep one already there.' },
              text: { type: 'string', description: 'What it provides, in words.' },
              must: { type: 'boolean', description: 'Not covered fully, a solution fails whatever its fit.' },
              function: { type: 'string', description: 'A function on a business sheet it serves, by id.' },
            },
            required: ['text'], additionalProperties: false,
          },
        },
        contexts: {
          type: 'array', description: 'The uses it serves, whole.',
          items: {
            type: 'object', description: 'One usage context.',
            properties: {
              id: { type: 'string', description: 'Its id, to keep one already there.' },
              name: { type: 'string', description: 'What the use is called.' },
              description: { type: 'string', description: 'The use, in a sentence or two.' },
              needs: { type: 'object', description: 'What it needs of each capability, by the capability\'s id or words: a level from 0 (not needed) to 4.', additionalProperties: true },
            },
            required: ['name', 'needs'], additionalProperties: false,
          },
        },
        sbbs: {
          type: 'array', description: 'Its catalogue of solutions, whole: what each is, never how well it fits.',
          items: {
            type: 'object', description: 'One solution.',
            properties: {
              id: { type: 'string', description: 'Its id, to keep one already there.' },
              name: { type: 'string', description: 'What it is called.' },
              supplier: { type: 'string', description: 'Who supplies it.' },
              sort: { type: 'string', description: 'A product, a service, or built in house.', enum: ['product', 'service', 'inHouse'] },
              status: { type: 'string', description: 'Where it stands. Default candidate.', enum: ['candidate', 'evaluated', 'inUse', 'retired'] },
              elements: { type: 'array', description: 'The landscape elements that are this solution, by id.', items: { type: 'string' } },
            },
            required: ['name', 'sort'], additionalProperties: false,
          },
        },
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
      'Move a decision record to its next status: proposed, reviewing, accepted or rejected; accepted to superseded '
      + 'with a successor. Accepting and rejecting are gated, and a refusal names what is missing. Ended records '
      + 'are locked. (rules.read)',
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
      'Write down something that was seen (ADR-0021): a fact, in neutral words, with where and by whom; today unless '
      + 'date. Seen again is observation.seen. Leave the body out for the template. (rules.read)',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'What was seen, in a few neutral words: no cause and no fix in it. Under 80 characters reads whole on the map; the rest belongs in body.' },
        body: { type: 'string', description: 'What was seen, the evidence, and who or what it affected, as markdown. Facts only: the reading of them is a cause.' },
        where: { type: 'string', description: 'Where it was seen: a system, a desk, a job. Prose, not an id. Required.' },
        about: { type: 'array', items: { type: 'string' }, description: 'The elements it is about, by id: elements this scope holds, its own or stand-ins (elements.list). Where stays in words beside it.' },
        by: personArgument('Who saw it, or who wrote it down. Required.'),
        date: { type: 'string', description: 'The day it was seen, yyyy-mm-dd. Default: today. Not in the future.' },
        impact: { type: 'string', description: 'How much it matters to whoever it affected — not how sure anyone is. Default: minor.', enum: ['minor', 'major', 'critical'] },
        tone: { type: 'string', description: 'bright: something that works, analysed the same way — its causes are what make it work, and a solution on its root spreads it; problem: something that goes wrong; neutral: not said either way (ADR-0038). Default: neutral. Who recorded it is never an argument: it is the person you act for.', enum: ['bright', 'neutral', 'problem'] },
        bright: { type: 'boolean', description: 'Deprecated, read for one release: true is tone bright, false tone problem.' },
        principles: PRINCIPLES_CITED,
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
      + 'the elements it is about, who, date, impact or tone. Who recorded it stays as it was. Title, where and who '
      + 'may be corrected, never blanked. The count moves only through observation.seen and observation.merge; '
      + 'closing it is observation.archive. (rules.read)',
    inputSchema: {
      type: 'object',
      properties: {
        id: ID('observation'),
        title: { type: 'string', description: 'A new title.' },
        body: { type: 'string', description: 'The body as markdown.' },
        where: { type: 'string', description: 'Where it was seen. Not blank.' },
        about: { type: 'array', items: { type: 'string' }, description: 'The elements it is about, by id, all of them: an empty list takes them off.' },
        by: personArgument('Who saw it. Not blank.'),
        date: { type: 'string', description: 'The day it was first seen, yyyy-mm-dd.' },
        impact: { type: 'string', description: 'How much it matters.', enum: ['minor', 'major', 'critical'] },
        tone: { type: 'string', description: 'bright, neutral or problem.', enum: ['bright', 'neutral', 'problem'] },
        bright: { type: 'boolean', description: 'Deprecated, read for one release: true is tone bright, false tone problem.' },
        principles: PRINCIPLES_CITED,
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
    name: 'observation.note',
    tier: 'write',
    description:
      'Say an observation was read and wants no cause, or with takeBack put it back on the waiting list. Only when the '
      + 'person said so. Kept in its history. (rules.read)',
    inputSchema: {
      type: 'object',
      properties: {
        id: ID('observation'),
        reason: { type: 'string', description: 'Why it wants no cause, where the person said. Kept beside the day.' },
        takeBack: { type: 'boolean', description: 'true: put it back on the waiting list instead.' },
      },
      required: ['id'],
      additionalProperties: false,
    },
  },
  {
    name: 'observation.merge',
    tier: 'write',
    description:
      'Fold observations of the same thing into one survivor (ADR-0035): into (of this scope or intoScope), absorb '
      + '(each with its scope), values, links. Absorbed ones stay as history; links move where the tree allows. '
      + 'merge.plan first says what would move. (rules.read)',
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
      'Move an observation of this scope to the scope it belongs in (ADR-0038): the same record, renumbered there, a '
      + 'tombstone left here; every link that explains it is cut. move.plan says which first. Answers its new label '
      + 'and the links cut. (rules.read)',
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
      'Say what lies behind observations or other causes (ADR-0021): a new cause, assumed, numbered after the last, '
      + 'linked to what it explains in the same step. root only when a person said so. Leave the body out for the '
      + 'template. (rules.read)',
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
    description:
      'Correct a cause: title, body, state, root. verified and root only when a person said so, verified with the '
      + 'body\'s evidence; a refusal names what stands in the way. (rules.read)',
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
      'A cause explains an observation or a shallower cause of this scope, or a cause of a scope below (explainsScope). '
      + 'Linking again changes the strength. Loops and links the tree forbids are refused. (rules.read)',
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
      'Fold causes that say the same thing into one survivor (ADR-0035): into, absorb, values, links as '
      + 'observation.merge takes them. Absorbed causes stay as history; links move where the tree allows. '
      + 'merge.plan first says what would move. (rules.read)',
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
      'Propose a solution for root causes of this scope (ADR-0026): a new idea, numbered after the last, linked to what '
      + 'it addresses. A cause something deeper explains is refused, naming it. (rules.read)',
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
      'Propose the decision record for a solution as one step, its context drafted from what it addresses and the '
      + 'alternatives. Accepting is the signers\': only when a person says so. (rules.read)',
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
      'Move an experiment on one step: planned, running, then confirmed, refuted or inconclusive with its result; a '
      + 'concluded one may reopen. Conclude only when told the outcome. Answers proofWithdrawn where reopening '
      + 'takes proof back. (rules.read)',
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
      + 'the organisation itself (top; true where within is not given), and under the unit types in within; slots '
      + 'are the roles a unit of it holds, each at least min and at most max. The operating model is kept at the '
      + 'organisation, which must be the scope open. (rules.read)',
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
      + 'top, spans, the limit and the order. A blank name is refused. At the organisation, which must be the scope '
      + 'open. (rules.read)',
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
      'Add a role to the operating model: name, short, purpose, description, duties (R, A, C, I by responsibility), manages, '
      + 'reportsTo, order. Held in a unit type through its slots. At the organisation, which must be open. (rules.read)',
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
      'Change a role. Only the fields given change; duties and reportsTo replace their lists; null clears the short '
      + 'name, the purpose, the description, manages, the order and reportsTo. A blank name is refused. At the organisation, which must be the '
      + 'scope open. (rules.read)',
    inputSchema: {
      type: 'object',
      properties: { id: ID('role'), name: { type: 'string', description: 'A new name.' }, ...ROLE_FIELDS },
      required: ['id'],
      additionalProperties: false,
    },
  },

  {
    name: 'role.remove',
    tier: 'write',
    description: 'Remove a role nothing uses any more; agent.inUse names what does, in any scope. At the organisation. (rules.read)',
    inputSchema: { type: 'object', properties: { id: ID('role') }, required: ['id'], additionalProperties: false },
  },
  {
    name: 'unitType.remove',
    tier: 'write',
    description: 'Remove a unit type nothing uses any more; agent.inUse names what does, in any scope. At the organisation. (rules.read)',
    inputSchema: { type: 'object', properties: { id: ID('unit type') }, required: ['id'], additionalProperties: false },
  },
  {
    name: 'responsibility.add',
    tier: 'write',
    description: 'Add a responsibility to the operating model. Who does it is raci.set. At the organisation.',
    inputSchema: {
      type: 'object',
      properties: { name: { type: 'string', description: 'What has to be done.' }, ...RESPONSIBILITY_FIELDS },
      required: ['name'],
      additionalProperties: false,
    },
  },
  {
    name: 'responsibility.update',
    tier: 'write',
    description: 'Change a responsibility. Only the fields given change; null clears all but the name. At the organisation.',
    inputSchema: {
      type: 'object',
      properties: { id: ID('responsibility'), name: { type: 'string', description: 'A new name.' }, ...RESPONSIBILITY_FIELDS },
      required: ['id'],
      additionalProperties: false,
    },
  },
  {
    name: 'responsibility.remove',
    tier: 'write',
    description: 'Remove a responsibility and every role\'s part in it, answered as partsRemoved. At the organisation. (rules.read)',
    inputSchema: { type: 'object', properties: { id: ID('responsibility') }, required: ['id'], additionalProperties: false },
  },
  {
    name: 'operatingRule.set',
    tier: 'write',
    description: 'Say which role owns: an application, in the unit it belongs to, or a domain, in the unit that serves it. At the organisation.',
    inputSchema: {
      type: 'object',
      properties: {
        kind: { type: 'string', description: 'Which rule.', enum: OPERATING_RULE_KINDS },
        roleId: { type: 'string', description: 'The role, by id. Null clears the rule.' },
      },
      required: ['kind', 'roleId'],
      additionalProperties: false,
    },
  },
  {
    name: 'raci.set',
    tier: 'write',
    description: 'Set cells of the RACI, at most 500, as one step; a field left out and every other cell stay. At the organisation. (rules.read)',
    inputSchema: {
      type: 'object',
      properties: {
        cells: {
          type: 'array',
          description: 'The cells, each once.',
          items: {
            type: 'object',
            description: 'One role\'s part in one responsibility.',
            properties: {
              roleId: { type: 'string', description: 'The role, by id.' },
              responsibilityId: { type: 'string', description: 'The responsibility, by id.' },
              raci: { type: 'string', description: 'R responsible, A accountable, C consulted, I informed. Null clears the cell.', enum: RACI_LETTERS },
              ...DUTY_FIELDS,
            },
            required: ['roleId', 'responsibilityId'],
            additionalProperties: false,
          },
        },
      },
      required: ['cells'],
      additionalProperties: false,
    },
  },

  // --- who holds which role in which unit, in the unit's scope (ADR-0036 §4) --------
  {
    name: 'assignment.add',
    tier: 'write',
    description:
      'Put a person (a register id) in a role of a unit, in the scope that keeps the unit, which must be open. Keep to '
      + 'the unit\'s slots; a role outside them and reportsTo are exceptions only at the person\'s word. Answers '
      + 'the id. (rules.read)',
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
      'Correct an assignment in the scope that keeps it, which must be open: share, acting, days, and reportsTo — the '
      + 'holder\'s own lines, an exception only at the person\'s word; null puts the model\'s back. Only the fields '
      + 'given change. (rules.read)',
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
      'A unit\'s own reporting line for one of its roles (ADR-0039): an exception to the model, written only when the '
      + 'person explicitly asks. With to, to that role in that unit; without, by nesting. In the scope that keeps '
      + 'the unit. (rules.read)',
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
      'The reporting lines on a day (ADR-0039), across the tree: for each role in each unit its kind, where it was '
      + 'said, whether it is an exception (override), its days and where it lands; placements outside the slots '
      + 'apart; then what the lines contradict. (rules.read)',
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
      'Start replacing an application (ADR-0010) as one undo step: the new application beside the old on every view, '
      + 'the dates, the successor, a shadow-run tap and a plan with two milestones. Answers the plan\'s and the new '
      + 'element\'s ids. (rules.read)',
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
      'Move a plan\'s interface onto the element it introduces, on a day (ADR-0010): a twin from that day, the original '
      + 'until the day before. Without connectionId, every interface not yet planned; lines another plan closed are '
      + 'skipped. (rules.read)',
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
      'Add a plan that is not a replacement (ADR-0009): a migration, a platform move, an upgrade. Numbered after the '
      + 'last one, and always a draft: plan.update moves it on. Name the elements it touches by role and the '
      + 'decisions it rests on; the body is markdown and starts from the template — headings and a ```business-case '
      + 'fence — when left out. Answers with the id and the label. (rules.read)',
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
      'Change a plan\'s fields, lists or body in place: only what is given; null clears from, to, owner; a list '
      + 'replaces the list. Status draft, agreed, running, done, abandoned, each forward move gated; a refusal '
      + 'names what the gate needs. (rules.read)',
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
      'Move a unit under a new parent on a day, as part of a plan (ADR-0036 §6): it holds from that day. One move per '
      + 'unit and plan; remove takes it off; no parentId is the top. Answers the plan\'s moves. (rules.read)',
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
      'Add a view: a landscape board, a C4 container view of one application, a business sheet, an enterprise map, a '
      + 'technology landscape, an organisation chart or a Conway map. The app switches to it. Answers the id. '
      + '(rules.read)',
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
      'Change what a laid-out view is of (ADR-0012 §6): a sheet\'s journey, lanes, areas, paper, columns, labels and '
      + 'poster; a map\'s areas; a board\'s asOf. Each list given is whole; null clears. Where a card sits is '
      + 'element.place. (rules.read)',
    inputSchema: {
      type: 'object',
      properties: {
        id: ID('diagram'),
        journeyId: { type: 'string', description: 'A sheet: the root step of the journey drawn across the top. Null takes the band off.' },
        lanes: { type: 'array', description: 'A sheet: the actors that get a row of their own under the phases, in order.', items: { type: 'string' } },
        areas: { type: 'array', description: 'A sheet or a map: the function roots drawn, in order. Null draws every root.', items: { type: 'string' } },
        showActors: { type: 'boolean', description: 'A sheet: whether the stakeholder rail is drawn.' },
        paper: { type: 'string', description: 'A sheet: the canvas it is laid out on; wide is what a new sheet starts on. Null is A2, what a sheet that says nothing means.', enum: ['wide', 'A4', 'A3', 'A2', 'A1', 'A0', 'fit'] },
        labels: { type: 'array', description: 'A sheet: the functions whose answering unit its poster shows on the tile. Replaces the list; null clears it, and no assignment ends by it.', items: { type: 'string' } },
        poster: {
          type: 'object',
          description: 'A sheet: what its poster says of its own. Each field given changes, null clears it; its free items stay, which are posterItem\'s.',
          properties: {
            tile: { type: 'string', description: 'How big its tiles are. Default m.', enum: ['s', 'm', 'l'] },
            bandRows: { type: 'integer', description: 'How many rows its journey takes. Absent: two where one would leave its words too small.', minimum: 1, maximum: 2 },
            foot: { type: 'string', description: 'The free line at the foot of its print.' },
          },
          additionalProperties: false,
        },
        columns: { type: 'integer', description: 'A sheet: the columns its areas are laid out in. Null fits the canvas.' },
        areaSpans: { type: 'object', description: 'A sheet: area id → the whole number of columns that area takes (1 to 4). Null makes every area one column.', additionalProperties: true },
        asOf: { type: 'string', description: 'A board, an organisation chart or a Conway map: the day it draws the model as of, yyyy-mm-dd. Null is today.' },
        colourBy: {
          type: 'string',
          description: 'A landscape: what cards are tinted by — platform, technologyLifecycle, lifecycle, category, owner, vendor, technology, aspect:<key>, one:<id>. Null: nothing.',
        },
        showDeployment: {
          type: 'boolean',
          description: 'A container diagram: whether the deployment boxes are drawn — the platforms its containers '
            + 'are hostedOn, as dashed groups around them, nested the way the platforms nest (ADR-0013). '
            + 'Absent or null: they are not.',
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
      'Put a picture (PNG, JPEG, SVG or WebP, under 2 MB, base64 or a data URL) in the scope\'s library. Answers its '
      + 'name and the markdown that shows it. Not an undo step. (rules.read)',
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
      'Several changes as one undo step, all or nothing: each step a write or placement tool and its arguments, built on '
      + 'the model the steps before it left; a value may be { "$ref": "steps[0].id" }, what an earlier step answered. '
      + 'dryRun answers what would land and lands nothing. At most 200 steps. (rules.read batch)',
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
              args: { type: 'object', description: 'Its arguments, as that tool takes them; any value may be { "$ref": "steps[n].field" }.', additionalProperties: true },
            },
            required: ['tool'],
            additionalProperties: false,
          },
        },
        dryRun: { type: 'boolean', description: 'Build and check every step, answer each step\'s answer and the changes they would make, and land nothing.' },
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
      + 'A person\'s step stops it, and is theirs to undo. With session, the whole of this driving session\'s steps go as one step, while they are the newest (ADR-0019, amended); a person\'s or anybody else\'s step on top refuses it. Answers with what was undone.',
    inputSchema: {
      type: 'object',
      properties: {
        steps: { type: 'integer', description: 'How many steps. Default 1.', minimum: 1, maximum: 200 },
        session: { type: 'boolean', description: 'true: every step of this driving session, as one step. Not with steps.' },
      },
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
    name: 'posterItem.add',
    tier: 'write',
    description:
      'A free note or picture on a sheet\'s poster: on this view only and no fact about the model, so it never stands in for a record. '
      + 'A note takes `text`; a picture takes `image`, a content address from images.list, and `alt`, what it shows in words. Lands in a free place '
      + 'unless x and y say; element.place moves it. First layout leaves it where it is.',
    inputSchema: {
      type: 'object',
      properties: {
        diagramId: { type: 'string', description: 'The sheet. Default: the one on screen.' },
        kind: { type: 'string', description: 'Which it is.', enum: ['note', 'picture'] },
        text: { type: 'string', description: 'A note\'s words.' },
        image: { type: 'string', description: 'A picture\'s content address from images.list.' },
        alt: { type: 'string', description: 'What a picture shows, in words. Required of one.' },
        x: { type: 'number', description: 'Its left, in poster units.' },
        y: { type: 'number', description: 'Its top.' },
        width: { type: 'number', description: 'Its width. Default 220.' },
        height: { type: 'number', description: 'Its height. Default 120.' },
      },
      required: ['kind'],
      additionalProperties: false,
    },
  },
  {
    name: 'posterItem.update',
    tier: 'write',
    description: 'Change what a free note or picture on a sheet\'s poster says or shows. Where it is, is element.place.',
    inputSchema: {
      type: 'object',
      properties: {
        id: ID('free item'),
        diagramId: { type: 'string', description: 'The sheet. Default: the one on screen.' },
        text: { type: 'string', description: 'A note\'s words.' },
        image: { type: 'string', description: 'A picture\'s content address from images.list.' },
        alt: { type: 'string', description: 'What a picture shows, in words.' },
      },
      required: ['id'],
      additionalProperties: false,
    },
  },
  {
    name: 'posterItem.remove',
    tier: 'write',
    description: 'Take a free note or picture off a sheet\'s poster. Its picture stays in the scope\'s images.',
    inputSchema: {
      type: 'object',
      properties: {
        id: ID('free item'),
        diagramId: { type: 'string', description: 'The sheet. Default: the one on screen.' },
      },
      required: ['id'],
      additionalProperties: false,
    },
  },
  {
    name: 'diagram.inspect',
    tier: 'see',
    onASheet: 'read',
    description:
      'A layout report on a diagram in geometry: bands, groups, overlaps, lines through cards, misfiled and orphaned '
      + 'cards, off-board. On a sheet, map, technology landscape, organisation chart or Conway map, what that view '
      + 'lays out and its findings. Read it before and after moving anything. (rules.read)',
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
      'A PNG of a diagram as the app draws it, with the transform a pixel maps back by; crop to elements or a region. '
      + 'Switches the app to it; the window must be visible. A sheet takes pageWidth. Refused for a chart or Conway '
      + 'map where agents get pseudonyms. (rules.read)',
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
    onASheet: 'write',
    description:
      'Lay a diagram out as Tidy does, as one undo step, and answer the layout report. On a sheet, First layout; with '
      + 'tiles, only the hand-placed tiles go back. (rules.read)',
    inputSchema: {
      type: 'object',
      properties: {
        diagramId: { type: 'string', description: 'The diagram. Default: the one on screen.' },
        tiles: { type: 'boolean', description: 'A sheet: only its hand-placed tiles flow again, and its blocks stay.' },
      },
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
    onASheet: 'write',
    description: 'Nudge elements on a diagram by a distance, in flow coordinates. One undo step. On a sheet: blocks (an area, the journey, the stakeholder column as rail) and free items, in poster units.',
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
    onASheet: 'write',
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
    onASheet: 'write',
    description:
      'Put an element at a spot on a diagram in flow coordinates, and on a landscape in a band or group. On a sheet, '
      + 'place a block (an area, the journey, the rail, a free item) in poster units, or a tile in a cell. '
      + '(rules.read)',
    inputSchema: {
      type: 'object',
      properties: {
        id: ID('element'),
        diagramId: { type: 'string', description: 'The diagram. Default: the one on screen.' },
        x: { type: 'number', description: 'The left edge, in flow coordinates.' },
        y: { type: 'number', description: 'The top edge, in flow coordinates.' },
        zone: { type: 'string', description: 'On a landscape: the band to file it in.', enum: ZONES },
        domainGroup: { type: 'string', description: 'On a landscape: the domain group to file it under; null for none.' },
        width: { type: 'number', description: 'On a sheet: a block\'s or a free item\'s width.' },
        height: { type: 'number', description: 'On a sheet: a block\'s or a free item\'s height.' },
        cell: {
          type: 'object',
          description: 'On a sheet: a tile\'s place in its block\'s grid, counted from 0 at the top left. Null lets it flow again.',
          properties: {
            col: { type: 'integer', description: 'The column.', minimum: 0 },
            row: { type: 'integer', description: 'The row.', minimum: 0 },
            span: { type: 'integer', description: 'How many columns it takes. Default 1.', minimum: 1 },
          },
          required: ['col', 'row'],
          additionalProperties: false,
        },
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
    onASheet: 'write',
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
    onASheet: 'write',
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
      'Move the app, as a person does with the tree and the tabs: a scope, and in it a page (home, a view by kind, '
      + 'decisions, observations, roadmap, plan, element, documentation, a report, register, people, operating, '
      + 'checks, principles) with id, tab, select. Never makes a view. Answers app.current once arrived. '
      + '(rules.read)',
    inputSchema: {
      type: 'object',
      properties: {
        scope: { type: 'string', description: 'Which scope, by path; "" is the organisation. Default: the one open.' },
        page: {
          type: 'string',
          description: 'What to show there. Default: the canvas, or the home of a scope with no views — any scope may have none, its last one removed or never made.',
          // Read when the tools are listed: a source's own pages are registered after this table is built.
          get enum() { return pagesKnown() },
        },
        id: { type: 'string', description: 'What the page is about, where it is about one; on checks, a check\'s key.' },
        tab: {
          type: 'string',
          description: 'The page\'s tab: observations register, analysis(-list, -map), solutions(-list, -map), results; people people, review, privacy; register applications, services, platforms; conway grid, lines.',
          get enum() { return [...new Set(Object.values(PAGE_TABS).flat())] },
        },
        look: { type: 'string', description: 'What the page looks at within its tab. Operating model, on responsibilities: part=<group name>, part=* for the whole organisation, unit=<unit id>; select=<id> opens an item. Blocks, tab used: at=<scope path>, that scope\'s comparison. Observations: about=<element id>.' },
        select: { type: 'string', description: 'An element to select on the board, sheet, map, technology landscape, organisation chart or Conway map being opened.' },
        field: {
          type: 'string',
          description: 'A field of the page to give the focus to as it opens. Settings: name, filedUnder (where the scope is filed, which moves it), type, description.',
          get enum() { return [...new Set(Object.values(PAGE_FIELDS).flat())] },
        },
        day: { type: 'string', description: 'A day to look at a view on, yyyy-mm-dd, or today for a view saved on another: the person\'s window only, read-only while it lasts, and nothing is written.' },
        group: { type: 'string', description: 'On a Conway map: the id of the unit type to group it by.' },
        pair: { type: 'string', description: 'On a Conway map: the pair to choose, its two unit ids with a comma between, the side nobody owns left empty.' },
        colour: { type: 'string', description: 'What a sheet is coloured by: coveredBy, who, domains, lifecycle, retiring, aspect:<key>, or none. The reader\'s own, written nowhere.' },
        focus: { type: 'string', description: 'On an organisation chart: the unit to focus on, which draws it and what is under it.' },
        lines: { type: 'string', enum: [...CHART_LINES], description: 'On an organisation chart: which lines to draw. off: none; person: the lines of the person picked; dotted: every dotted line; exceptions: every departure from the model.' },
        edit: { type: 'boolean', description: 'Open it being written: a drawing in its editor, an element\'s page (document) or a building block (blocks) with its text open, each by id. Only where the person can change it; they save or cancel.' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'session.start',
    tier: 'drive',
    description:
      'Start a driving session on purpose, with your reason on the person\'s banner. After the person pressed Stop, '
      + 'call it only when they ask you to continue. (rules.read)',
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
] as const satisfies readonly { name: string; tier: ToolTier; onASheet?: 'write' | 'read'; description: string; inputSchema: InputSchema }[]

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
export const REVISION_GUARD: ArgumentSchema = {
  type: 'integer',
  description: 'Refused if the scope moved past it.',
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
export const SCOPE_ARGUMENT: ArgumentSchema = {
  type: 'string',
  description: 'Scope path; "" the organisation.',
}

/** About the whole tree rather than one scope: `scope` would mean nothing on them. */
export const TREE_WIDE: readonly string[] = [
  'scopes.list', 'register.list', 'technology.list', 'checks.list', 'views.list', 'assignments.list', 'reportingLines.list',
  'principles.list', 'principle.read', 'principles.suggest', 'topics.list', 'blocks.list', 'evaluation.read',
]

/**
 * About the organisation's people register rather than a scope (ADR-0036 §13):
 * no `scope`, and no project revision to guard, because the register is
 * outside the history and has a revision of its own.
 */
export const ON_THE_REGISTER: readonly string[] = ['people.list', 'person.add', 'person.leave', 'person.takeBackLeaving']

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

/** About the vocabulary itself (`rules.ts`): the same wherever it is asked, so no scope and nothing to guard. */
export const ABOUT_THE_VOCABULARY: readonly string[] = ['rules.read']

/** A list read's page: how many rows one answer holds unless asked, and the most it holds when asked. */
export type ListPage = {
  readonly limit: number
  readonly max: number
  /** The answer's keys its rows may be under, first found first; the tool's noun and then `some` when unsaid. */
  readonly rows?: readonly string[]
  /** The read is handed `fields` as well: it gives some field only when asked. */
  readonly readsFields?: true
}

const PAGE: ListPage = { limit: 100, max: 1000 }

/**
 * Every list read, and its page. A list is cut into pages by the handler
 * (`paging.ts`) rather than by each read, so every one of them continues with
 * a `cursor`, answers only the `fields` asked for and has a default and a
 * maximum `limit` — said here once, as `scope` is, and no list can forget it.
 * Where a read had a limit of its own, its default and its most are kept.
 */
export const LISTS: Readonly<Partial<Record<ToolName, ListPage>>> = {
  'scopes.list': { limit: 500, max: 5000 },
  'views.list': { limit: 500, max: 5000, rows: ['some'] },
  'register.list': { limit: 200, max: 2000, rows: ['some'] },
  'technology.list': { limit: 200, max: 2000, rows: ['some'] },
  'checks.list': { limit: 200, max: 2000, rows: ['some'] },
  'principles.list': { ...PAGE, rows: ['principles', 'scopes'] },
  'topics.list': PAGE,
  'blocks.list': PAGE,
  'references.list': PAGE,
  'people.list': { limit: 200, max: 2000 },
  'elements.list': { limit: 200, max: 2000 },
  'connections.list': { limit: 500, max: 5000 },
  'diagrams.list': PAGE,
  'decisions.list': PAGE,
  'observations.list': PAGE,
  'causes.list': PAGE,
  'solutions.list': PAGE,
  'experiments.list': PAGE,
  'comments.list': { limit: 20, max: 200, rows: ['comments', 'thread'] },
  'unitTypes.list': PAGE,
  'aspectScales.list': PAGE,
  'roles.list': { ...PAGE, readsFields: true },
  'responsibilities.list': PAGE,
  'assignments.list': { limit: 500, max: 5000 },
  'plans.list': PAGE,
  'activity.list': { limit: 20, max: 200, rows: ['steps'] },
  'changes.list': { limit: 20, max: 100 },
  'images.list': PAGE,
  'reportingLines.list': { ...PAGE, rows: ['lines'] },
}

/** The three arguments every list read takes, its page's numbers said in its `limit`. */
export function pagingArguments(page: ListPage): Record<'cursor' | 'fields' | 'limit', ArgumentSchema> {
  return {
    cursor: { type: 'string', description: 'The last page\'s next.' },
    fields: { type: 'array', description: 'Only these fields, and id.', items: { type: 'string' } },
    limit: { type: 'integer', description: `Rows per page; default ${page.limit}.`, minimum: 1, maximum: page.max },
  }
}

export const TOOLS: readonly ToolSpec[] = SPECS.map((tool): ToolSpec => {
  const page = LISTS[tool.name]
  const properties = {
    ...tool.inputSchema.properties,
    ...(TREE_WIDE.includes(tool.name) || ABOUT_THE_APP.includes(tool.name) || ON_THE_REGISTER.includes(tool.name)
      || ON_THE_TREE.includes(tool.name) || ABOUT_THE_VOCABULARY.includes(tool.name) ? {} : { scope: SCOPE_ARGUMENT }),
    ...(tool.tier === 'read' || tool.tier === 'drive' || LOOKS_ONLY.includes(tool.name) || ON_THE_REGISTER.includes(tool.name)
      || ON_THE_TREE.includes(tool.name) ? {} : { ifRevision: REVISION_GUARD }),
    ...(page ? pagingArguments(page) : {}),
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
  | 'agent.principleCited'
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
  /**
   * The call was taken and threw where it was answered: not slow, broken.
   * Not `agent.noAnswer`, which is a call nobody answered in time and worth
   * trying again; this one fails the same way until it is put right.
   */
  | 'agent.failed'
  | 'agent.planned'
  | 'agent.stale'
  /**
   * A cursor whose list changed under it, and the row its page ended on is no
   * longer in it: where the next page starts is not known, so it is not guessed.
   */
  | 'agent.pageMoved'
  /** A batch step's `{ "$ref": … }` names no earlier step, or a field that step did not answer. */
  | 'agent.badReference'
  /** A batch of more steps than one may hold (`batchSteps.ts`'s `MOST_STEPS`). */
  | 'agent.tooManySteps'
  /** A script met one of its limits and was stopped (ADR-0051, `code/limits.ts`): the detail names it. */
  | 'agent.scriptLimit'
  /** A script threw, or would not compile: the detail is its own message, cut short. */
  | 'agent.scriptFailed'
  /** A call a script may not make (ADR-0051, `code/api.ts`): the detail says where to make it instead. */
  | 'agent.notInScript'
  /** A simulation's token that is not held: never given, used, discarded, expired, or somebody else's. */
  | 'agent.unknownSimulation'
  | 'agent.notYours'
  | 'agent.saveFailed'
  /**
   * Somebody else's comment, which the person the agent acts for may not
   * remove in this scope (ADR-0037 §5, §8): the source says who moderates
   * (`SessionView.mayModerate`), and the tool refuses before anything is
   * written rather than leave it to the door.
   */
  | 'agent.mayNotModerate'
  /**
   * An argument names a part of a record that the source the scope is kept in
   * cannot keep yet (`SessionView.unkept`): the detail names the argument and
   * says, in the source's words, why and for how long.
   */
  | 'agent.notKeptHere'
  /** The person pressed Stop on the driving banner (ADR-0019), and nobody has asked to start again. */
  | 'agent.stopped'
  /** The person is writing something on screen that moving the app would drop: theirs to keep or leave. */
  | 'agent.draftOpen'
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
  /** A role or a unit type to remove that something still uses; what does is named in the detail (ADR-0036, amended 24 November 2026). */
  | 'agent.inUse'
  /** A removal that needs every scope read, where not every one was; which, in the detail. */
  | 'agent.notAllRead'
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
  'agent.draftOpen':
    'The person is writing something on the screen that is up — a comment, a new record, or a change in an editor — '
    + 'that is not saved yet, and moving the app would drop it. Do not move the app: tell them, and ask them to save '
    + 'or send it, or to leave it, then call again. Reads, and changes to the open scope, still answer.',
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
  'agent.inUse':
    'Something still uses that record; the detail names what. Change each of those first, with the person\'s agreement, '
    + 'or give the record a last day (until) instead.',
  'agent.notAllRead':
    'Whether anything still uses that record cannot be said: not every scope was read, and the detail says which, or why. '
    + 'Nothing was removed. A person can remove it on the operating model\'s page.',
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
  'agent.failed': 'The call failed where it was answered. Asking again fails the same way; tell the person, with the detail, so it can be put right.',
  'agent.planned': 'That interface was already dated by another plan, or by hand. Take that port back first.',
  'agent.stale': 'The project has changed since the revision this call named. Read it again and decide again.',
  'agent.pageMoved':
    'The list changed since the page that answered this cursor, and the row that page ended on is gone, so where the next '
    + 'page starts is not known. Ask again without cursor for the list as it stands now.',
  'agent.badReference':
    'A step\'s { "$ref": "steps[n].field" } names a step that is not before it, or a field that step did not answer; the detail '
    + 'says which. Refer only to an earlier step, by its place in steps counted from 0, and to a field its answer holds: dry-run '
    + 'the batch (dryRun true) to see what each step answers.',
  'agent.tooManySteps':
    'A batch holds at most 200 steps. Split the work into several batches, each one change the person can tell apart, '
    + 'and pass the revision each answers as the next one\'s ifRevision.',
  'agent.scriptLimit': 'The script met one of its limits and was stopped. The detail says which, and what to do instead.',
  'agent.scriptFailed': 'The script threw an error or could not be read as a script, and nothing was changed. The detail is its own message.',
  'agent.notInScript': 'A script may not make that call. The detail says why, and where to make it instead.',
  'agent.unknownSimulation':
    'No simulation is held under that token: it was run or discarded already, it is older than 15 minutes, the app or '
    + 'the server was restarted, or it is another caller\'s. Simulate again.',
  'agent.notYours': 'The newest step is a person\'s, not an agent\'s; it is theirs to undo.',
  'agent.saveFailed': 'The project could not be saved; the app shows why.',
  'agent.principleCited': 'A record cites that principle, so it stays: retire it with principle.update status retired. The detail says which scopes cite it.',
  'agent.notKeptHere':
    'Where this work is kept cannot keep that part of a record yet, so nothing was written or read. The detail names the '
    + 'argument and says why. Call again without it, and tell the person what was left out and why.',
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
  'people.notLeft': 'This person has not left, so there is no leaving to take back.',
  'people.forgotten': 'That entry is forgotten: it has no name left to change.',
  'people.notForgotten': 'Only a forgotten entry is removed, and only by a person.',
  'people.badMerge': 'An entry is merged only into another that still has a name, and only by a person.',
  'people.mergeAsks': 'An active entry merged into one that has left is told whether the person is still here or left; merging is a person\'s, on the People page.',
  'people.badDistinct': 'Two entries are answered as not the same person only of two entries, and only by a person, on the People page.',
  'command.gone': 'Something the change refers to is no longer in the project.',
  'command.datesOutOfOrder': 'The lifecycle dates run backwards: live, then retiring, then retired.',
  'command.refinesEnds': 'A container interface has to sit under the interface it refines: source under source, target under target, each end either the same element or a component of it.',
  'command.refinesLevel': 'The interface named by "refines" is itself a refinement. An interface lands once; refine the application-level line instead.',
  'command.hostedOnContainers': 'An application that has components runs where those run: write the hostedOn row from the component. Only an application with no components — an outside system, a SaaS service, a bought package — says where it runs itself.',
  'command.technologyEnds': 'hostedOn runs from an application or a component to a platform, and nothing else. A platform inside another platform is filed under it with parentId; a service consumed is a uses row.',
  'command.interactsEnds': 'interacts runs from one actor — a unit — to another, never to itself, and its mode is collaboration, service or facilitating.',
  'command.taken': 'Something in the scope already has that id, so the record you meant to add would have overwritten it. Read the scope again and add it under a free id.',
  'command.notAField': 'A patch names a field the record does not have. Nothing was changed; send only the record\'s own fields.',
  'command.ownedElsewhere': 'The record is a stand-in, and that field is written in the scope that defines it. Change it there.',
  'command.aspectsEmpty': 'A principle has at least one aspect; aspect.remove of the last one is refused — change it with aspect.update instead.',
  'command.aspectNumber': 'Aspect numbers are given by the tool, once each, and never again; pass the number an aspect has, not a new one.',
  'command.titleEmpty': 'A principle needs a title.',
  'command.sharpenNote': 'Changing an accepted principle\'s statement or aspects sharpens it: pass note, saying why, with the change.',
  'command.badGroups': 'Every group needs a name, and each is listed once.',
  'command.badScale': 'A scale needs a name and whole numbers with the lowest below the highest, each aspect listed once; a rating is a whole number on a function.',
  'command.notCitable': 'Which kinds cite with which stances: decision supports or deviates; element, plan (transition) and solution support; observation holds, chafes or missing.',
  'command.reasonMissing': 'stance deviates needs reason: why this record departs from the principle.',
  'command.badBlock': 'A building block\'s capabilities, contexts and solutions each need an id of their own and a name; a context needs only the block\'s capabilities, each 0 to 4; a solution\'s sort is product, service or inHouse and its status candidate, evaluated, inUse or retired. Only a buildingBlock has these fields.',
  'command.badEvaluation': 'An evaluation is named by its block, every coverage level is 0 to 4, and chosen must be one of its options.',
  'command.recordedByFixed': 'Who recorded an observation is written once, when it is recorded, from whoever recorded it; it is never an argument.',
  'command.recordedByNotYours': 'A new observation is recorded by whoever sends it: the source refused one said to be recorded by somebody else. It is never an argument.',
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

/**
 * An answer that is data: JSON, compact. It was indented for a person to read,
 * and a model pays for every space of it on every turn: an indented list of a
 * few hundred rows is a third whitespace.
 */
export function json(value: unknown): AgentAnswer {
  return text(JSON.stringify(value))
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
