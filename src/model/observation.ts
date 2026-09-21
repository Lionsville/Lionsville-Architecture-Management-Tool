/**
 * What an observation IS, and what a cause is — the shapes and the vocabulary.
 *
 * An observation is something a team saw in a landscape or a domain: a batch
 * that overruns, a customer who exists three times, a change released twice.
 * It is a numbered record with a body, the way a decision and a plan are, and
 * it arrives in the folder, in git, in the diff, in the Activity list and at
 * the agent by being one.
 *
 * A cause is what the team, analysing, says lies behind one or more
 * observations — and behind other causes, because a cause has causes. The
 * links run from a cause to what it **explains**: an observation, or a
 * shallower cause. A cause nobody explains is a **root cause**, and that is
 * derived from the links rather than written on the record, so a cause stops
 * being a root the moment somebody finds what lies behind it.
 *
 * The rules — numbering, merging, sharing, what a link may name, which cause
 * is a root — are `observations/observation.ts`. The split is the one every
 * record has: a scope's observations live on its model, and the model has to
 * say what it holds without importing the module that decides what may happen
 * to one.
 */

/** How much it matters when it is seen. Drawn as the size of the mark. */
export type ObservationImpact = 'minor' | 'major' | 'critical'

/** In order of weight, which is the order a picker shows them in. */
export const OBSERVATION_IMPACTS: readonly ObservationImpact[] = ['minor', 'major', 'critical']

/**
 * One dated thing that happened to an observation.
 *
 * `recorded` — the day it was written down. `seen` — seen again; the count
 * went up by one. `shared` / `unshared` — offered to the scopes above, or
 * taken back. `absorbed` — another observation was judged to be the same
 * thing and folded into this one: `id` (and `scope`, when it lived in a scope
 * below) say which, and `seen` how many sightings came with it. `merged` —
 * this one was folded into `id`, and is history from then on. `archived` —
 * fixed, addressed or no longer relevant: the record stays, as history, and
 * leaves the analysis; `restored` brings it back. A note on either says why.
 *
 * The record's own count moves with the events; the events are why it stands
 * where it does, kept because "seen seven times" is worth less than "seen on
 * these seven days, four of them under another title".
 */
export type ObservationEvent = {
  /** `yyyy-mm-dd`. */
  date: string
  kind: ObservationEventKind
  /** The other observation, for `absorbed` and `merged`. */
  id?: string
  /** Its scope, when it is not this one — an absorbed observation from a scope below. */
  scope?: string
  /** How many sightings an absorbed observation brought. */
  seen?: number
  note?: string
}

export type ObservationEventKind =
  'recorded' | 'seen' | 'shared' | 'unshared' | 'absorbed' | 'merged' | 'archived' | 'restored'

export const OBSERVATION_EVENT_KINDS: readonly ObservationEventKind[] =
  ['recorded', 'seen', 'shared', 'unshared', 'absorbed', 'merged', 'archived', 'restored']

export type Observation = {
  /** Stable, never shown. The number is what people call it. */
  id: string
  /** Sequential within the scope; `OB-0007` on screen. Never reused. */
  number: number
  title: string
  /** The day it was first seen, `yyyy-mm-dd`. */
  date: string
  /** Where it was seen: a system, a desk, a job, a meeting. Prose, not an id. */
  where?: string
  /** Who saw it, or who wrote it down. Free text: a name, initials, a team. */
  by?: string
  impact: ObservationImpact
  /** How often it has been seen, this record's own sightings and the absorbed ones together. */
  seen: number
  /**
   * Offered to the scopes above this one: every ancestor reads it and may
   * link it to a cause of its own, or fold it into an observation of its own.
   * Absent is local, which is the default — a domain says which of its
   * observations are the enterprise's business; the enterprise does not go
   * and pick them.
   */
  shared?: true
  /**
   * Fixed, addressed, or no longer relevant. The record stays where it is,
   * for the history, and is out of the analysis until it is restored.
   */
  archived?: true
  /** Markdown: what was seen, the evidence, first thoughts. */
  body: string
  /** What happened to it, oldest first. */
  history: ObservationEvent[]
}

export type CauseState = 'assumed' | 'verified'

export const CAUSE_STATES: readonly CauseState[] = ['assumed', 'verified']

/** How firmly a cause explains the thing it is linked to. Drawn as the weight of the line. */
export type CauseStrength = 'strong' | 'normal' | 'weak'

export const CAUSE_STRENGTHS: readonly CauseStrength[] = ['strong', 'normal', 'weak']

/**
 * One thing a cause explains: an observation of this scope, an observation a
 * scope below shared (`scope` present), or a shallower cause of this scope.
 */
export type CauseLink = {
  id: string
  /** The scope the observation lives in, when it is not this one. */
  scope?: string
  strength: CauseStrength
}

export type Cause = {
  /** Stable, never shown. The number is what people call it. */
  id: string
  /** Sequential within the scope; `CA-0003` on screen. Never reused. */
  number: number
  title: string
  /** Assumed when first written down; verified once the team has checked it. */
  state: CauseState
  /** Markdown: the reasoning, the evidence, what verifying it took. */
  body: string
  /** What lies behind, said from this side: everything this cause explains. */
  explains: CauseLink[]
}
