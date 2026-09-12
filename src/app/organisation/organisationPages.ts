/**
 * What the organisation's own pages have in them, read once.
 *
 * The cards on the organisation screen each say a count line and one finding
 * line, and every number in them comes from the **root scope's own document** —
 * not from the listing, which carries a view count and deliberately nothing
 * else (`ScopeSummary`), and not from a load per card, which is the shape
 * ADR-0004 caught four times over. One `load(root)`, one pass, here.
 *
 * Pure, so the sums that a screen would otherwise do in three `useMemo`s have a
 * node test instead. `today` is passed in for the same reason the roadmap's
 * checks take it: a card whose finding depends on the clock is a card that
 * cannot be tested.
 *
 * The register card is not here on purpose. It is derived over the whole tree
 * and arrives in beta 3 (ADR-0012 §9); a number invented for it now would be
 * the one thing on this screen that is not true.
 */
import { unmappedFunctions } from '../../business'
import type { Adr, AdrStatus } from '../../decisions'
import { ADR_STATUSES } from '../../decisions'
import { findings } from '../../model/checks'
import type { Finding } from '../../model/checks'
import { TRANSITION_STATUSES } from '../../model/transition'
import type { TransitionStatus } from '../../model/transition'
import type { ScopeSnapshot } from '../../projects/scope'

/** How many of each, in the vocabulary's own order and without the zeroes. */
export type StatusTally<T extends string> = readonly { status: T; count: number }[]

export type OrganisationPages = {
  /**
   * The root holds nothing at all.
   *
   * The state a folder somebody chose a minute ago is in, and the state the
   * shipped example's organisation is in — it is a name above a landscape, and
   * the sheet does not move up to it until cross-scope ids exist. The cards say
   * so in a sentence rather than showing four zeroes, which read as a fault.
   */
  empty: boolean
  business: {
    journeys: number
    areas: number
    /** Every capability at any depth, not only the roots the areas are. */
    functions: number
    stakeholders: number
    /** Capabilities nobody has handed to a domain yet (ADR-0012 §9). */
    unmapped: number
    /** The sheet to open. Absent means there is one to make, not one missing. */
    sheetId?: string
  }
  decisions: {
    total: number
    byStatus: StatusTally<AdrStatus>
    /**
     * The newest record. By number rather than by date: numbers are sequential
     * within a list and never reused, where a date is the day of the last
     * status change and moves backwards when an old record is finally rejected.
     */
    latest?: Adr
  }
  roadmap: {
    total: number
    byStatus: StatusTally<TransitionStatus>
    /** The first thing the dates disagree about — `findings` answers worst first. */
    finding?: Finding
  }
}

function tally<T extends string>(
  order: readonly T[], of: readonly { status: T }[],
): StatusTally<T> {
  return order
    .map((status) => ({ status, count: of.filter((one) => one.status === status).length }))
    .filter((held) => held.count > 0)
}

export function organisationPages(
  scope: ScopeSnapshot | undefined,
  today: string,
): OrganisationPages {
  const model = scope?.model
  const elements = model?.elements ?? []
  const relations = model?.relations ?? []
  const diagrams = model?.diagrams ?? []
  const decisions = model?.decisions ?? []
  const transitions = model?.transitions ?? []
  const of = (kind: string) => elements.filter((element) => element.kind === kind).length

  return {
    empty: elements.length === 0 && relations.length === 0 && diagrams.length === 0
      && decisions.length === 0 && transitions.length === 0,
    business: {
      // A journey is a `step` root; an area is a `function` root. The same
      // reading `seedSheet` makes, and for the same reason — what a tree's
      // roots are is the business layer's answer to "what is a top-level one".
      journeys: elements.filter((element) => element.kind === 'step' && !element.parentId).length,
      areas: elements.filter((element) => element.kind === 'function' && !element.parentId).length,
      functions: of('function'),
      stakeholders: of('actor'),
      unmapped: unmappedFunctions(elements).length,
      ...(diagrams.find((diagram) => diagram.kind === 'sheet')
        ? { sheetId: diagrams.find((diagram) => diagram.kind === 'sheet')!.id }
        : {}),
    },
    decisions: {
      total: decisions.length,
      byStatus: tally(ADR_STATUSES, decisions),
      ...(decisions.length
        ? { latest: [...decisions].sort((a, b) => a.number - b.number)[decisions.length - 1] }
        : {}),
    },
    roadmap: {
      total: transitions.length,
      byStatus: tally(TRANSITION_STATUSES, transitions),
      // Over the scope's own model, which is what this card is about. The
      // checks read plans and elements together, so a root with plans and no
      // landscape can still be told its plan is overdue.
      ...(model ? nextFinding(model, transitions, today) : {}),
    },
  }
}

function nextFinding(
  model: NonNullable<ScopeSnapshot['model']>,
  transitions: readonly { status: TransitionStatus }[],
  today: string,
): { finding?: Finding } {
  if (model.elements.length === 0 && transitions.length === 0) return {}
  const first = findings({ model, today })[0]
  return first ? { finding: first } : {}
}
