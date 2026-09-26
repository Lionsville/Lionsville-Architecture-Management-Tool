// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What every handler of the write tier shares: the view a write is built
 * against, what a handler hands back, and the helpers more than one family of
 * tools reads a request with. One place, so a rule about a diagram that was
 * not named or a colour that is not a colour is said once.
 */
import type { Command } from '../../model/commands'
import type { IdPolicy, MakeId } from '../../model/keys'
import type { Diagram } from '../../model/normalised'
import { placedOn, transitionList } from '../../model/normalised'
import { findTransition } from '../../model/transition'
import type { Transition } from '../../model/transition'
import type { DesignElement, ElementId, PlacedNode } from '../../model/types'
import { businessCaseTemplate } from '../../documentation/businessCase'
import type { Translate } from '../../i18n/strings'
import type { ReadView } from '../answer'
import type { AgentAnswer } from '../tools'
import { refused } from '../tools'

/** What a write needs beyond a read: where ids come from, and the day. */
export type WriteView = ReadView & {
  readonly ids: IdPolicy
  readonly makeId: MakeId
  /** Today as `yyyy-mm-dd`, for a decision's date. */
  readonly today: () => string
  /** For the MADR template a new record starts from. */
  readonly translate: Translate
  /** What a container view is called, after its application. The shell owns the words. */
  readonly containerName: (applicationName: string) => string
  /** What a technology view is called, after its platform (ADR-0013). */
  /**
   * Does another scope answer for the fields this patch touches (ADR-0012 §10)?
   *
   * Answers with the owning scope's path — the empty string being the
   * organisation — when the write must be refused, and `undefined` when it may
   * go ahead. The refusal is the same one the inspector greys a field out for,
   * so an agent cannot write what a person is shown as read-only.
   *
   * Handed in rather than worked out here: `agent` may not import `projects`
   * and has no business learning what a scope tree is. The workspace wires
   * `projects/mayEdit.ts` to it. Absent means nothing is refused, which is what
   * a node test with two plain objects in the session wants and what a session
   * opened before the tree was read honestly knows.
   */
  readonly ownedElsewhere?: (
    id: ElementId, patch: Partial<DesignElement>,
  ) => { owner?: string } | undefined
  /**
   * Does some scope in the organisation define this id (ADR-0012 §2)? A
   * relation may reach one end into another scope — an organisation's
   * capability supported by a landscape's application (§5) — and this is how
   * the end is told from a typo. Absent means only this scope's own ids are
   * known, which is what a session with no tree honestly has.
   */
  readonly known?: (id: ElementId) => boolean
  /**
   * The stand-in this scope would keep of a platform or a service another
   * scope defines (ADR-0017, ADR-0020): the two caches and nothing of the
   * owner's detail, written in the same step as the row that names it.
   * Handed in for the reason `known` is; absent, a target this scope does
   * not hold is unknown.
   */
  readonly standInFor?: (id: ElementId) => DesignElement | undefined
}

/** A command, and what to say once it has landed. */
export type Prepared = {
  readonly command: Command
  /** Switch to this diagram with the command, the way the shell does for a new one. */
  readonly activeDiagramId?: string
  readonly answer: AgentAnswer
}

/** A request's arguments, checked against the tool's schema before a handler sees them. */
export type Args = Record<string, unknown>

/** One tool's builder: the command for a request, or the refusal that stops it before the reducer. */
export type Handler = (args: Args, view: WriteView) => Prepared | AgentAnswer

/**
 * A row with a patch laid over it, and every field the patch cleared taken
 * out rather than left as `undefined` — a saved file should look hand-written.
 */
export function merged<T extends object>(held: T, patch: Partial<T>): T {
  const next = { ...held, ...patch }
  for (const key of Object.keys(patch) as (keyof T)[]) if (next[key] === undefined) delete next[key]
  return next
}

// --- which diagram ----------------------------------------------------------------------

function diagramOf(args: Args, view: ReadView): Diagram | undefined {
  const id = typeof args.diagramId === 'string' ? args.diagramId : view.activeDiagramId
  return view.model.diagrams[id]
}

/**
 * The diagram a tool is about, or the refusal that says why there is none.
 * Two different mistakes get two different answers: a diagram that was named
 * and does not exist is an unknown id, while nothing named on a scope whose
 * home is up — no diagram on screen — is a missing argument, and the detail
 * says which one to pass. Eight tools used to answer `diagram undefined` to
 * the second, which an agent read as a bug rather than as a question.
 */
export function diagramOrRefusal(args: Args, view: ReadView): Diagram | AgentAnswer {
  const diagram = diagramOf(args, view)
  if (diagram) return diagram
  return typeof args.diagramId === 'string'
    ? refused('agent.unknownId', `diagram ${args.diagramId}`)
    : refused('agent.badArguments', 'no diagram is on screen: pass diagramId (see diagrams.list)')
}

/** The named elements' placements on the diagram, or the first refusal. */
export function onDiagram(args: Args, view: ReadView): { diagram: Diagram; placements: PlacedNode[] } | AgentAnswer {
  const diagram = diagramOrRefusal(args, view)
  if ('ok' in diagram) return diagram
  const placements: PlacedNode[] = []
  for (const id of args.elementIds as string[]) {
    if (!view.model.elements[id]) return refused('agent.unknownId', `element ${id}`)
    const held = placedOn(diagram, id)!
    if (!held) return refused('agent.notDrawn', id)
    placements.push(held)
  }
  return { diagram, placements }
}

// --- words and values -------------------------------------------------------------------

/** A refusal, with where in a list it came from put in front of its detail. */
export function withDetail(answer: AgentAnswer, where: string): AgentAnswer {
  if (answer.ok) return answer
  return refused(answer.refusal, answer.detail === undefined ? where : `${where}: ${answer.detail}`)
}

/** A hex colour as the model keeps it, '' for "none", or false for something else. */
export function hexColour(value: unknown): string | '' | false {
  if (typeof value !== 'string') return false
  const trimmed = value.trim()
  if (trimmed === '') return ''
  return /^#[0-9a-fA-F]{6}$/.test(trimmed) ? trimmed.toLowerCase() : false
}

// --- plans, which three families start or name ------------------------------------------

export function planOf(idOrLabel: unknown, view: ReadView): Transition | undefined {
  return typeof idOrLabel === 'string' ? findTransition(transitionList(view.model), idOrLabel) : undefined
}

/** What a plan an agent starts says before anybody has written it. */
export function planBody(): string {
  return ['## Goal', '', '## Scope', '', '## Approach and phases', '', '## Business case', '', businessCaseTemplate(), '', '## Risks', '', '## Rollback', ''].join('\n')
}
