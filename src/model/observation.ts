// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

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

/**
 * What a team does about a cause (ADR-0026).
 *
 * A **solution** addresses one or more causes of this scope and matures:
 * an `idea` is written down, `shaped` once it has been vetted, `testing`
 * while an experiment runs, `proven` when one confirmed it, `adopted` when a
 * decision record accepted it. It can be `dropped` from anywhere short of
 * adopted, with a reason, and restored. *Implemented* is not a state: it is
 * read off the plan that builds it being done, the way a root cause is read
 * off the links.
 *
 * An **experiment** tests a solution against a hypothesis and ends with an
 * outcome. It is a record of its own because one solution can need several
 * and a refuted one is the evidence the next person asks for.
 */
export type SolutionState = 'idea' | 'shaped' | 'testing' | 'proven' | 'adopted' | 'dropped'

/** In workflow order, which is the order a picker shows them in. */
export const SOLUTION_STATES: readonly SolutionState[] = ['idea', 'shaped', 'testing', 'proven', 'adopted', 'dropped']

/** Rough and relative, for sizing and ordering. The money is in the plan's business case. */
export type SolutionSize = 'small' | 'medium' | 'large'

export const SOLUTION_SIZES: readonly SolutionSize[] = ['small', 'medium', 'large']

/** One cause of this scope a solution addresses, and how directly. */
export type SolutionLink = {
  id: string
  strength: CauseStrength
}

/** Something like it that was tried before, and why it did not stick. */
export type EarlierAttempt = {
  /** Free text: a year, a quarter, a date. People remember "2023", not a day. */
  when?: string
  what: string
  why: string
}

/**
 * One dated thing that happened to a solution. `moved` names the state it
 * moved to; `waived` carries the reason no experiment was needed; `linked`
 * names the decision record or the plan (`to` says which, `id` the record);
 * `dropped` and `restored` carry a note.
 */
export type SolutionEvent = {
  /** `yyyy-mm-dd`. */
  date: string
  kind: SolutionEventKind
  to?: string
  id?: string
  note?: string
}

export type SolutionEventKind = 'proposed' | 'moved' | 'waived' | 'linked' | 'dropped' | 'restored'

export const SOLUTION_EVENT_KINDS: readonly SolutionEventKind[] =
  ['proposed', 'moved', 'waived', 'linked', 'dropped', 'restored']

export type Solution = {
  /** Stable, never shown. The number is what people call it. */
  id: string
  /** Sequential within the scope; `SO-0001` on screen. Never reused. */
  number: number
  title: string
  state: SolutionState
  /** The causes of this scope it addresses, at any depth. */
  addresses: SolutionLink[]
  /** What it is expected to bring. Drawn as the width of the mark. */
  benefit?: SolutionSize
  cost?: SolutionSize
  /** Who it was checked with: names, roles, teams. Free text, as an observation's `by` is. */
  validatedWith: string[]
  attempts: EarlierAttempt[]
  /** The answer to "was this tried before?" when the answer is no. Absent is unanswered. */
  noneKnown?: true
  /** Why it will work now, when something like it did not before. */
  whyNow?: string
  /** Why no experiment is needed. Stands in for a confirmed one. */
  waived?: string
  /** The state it was dropped from, so a restore puts it back there. */
  droppedFrom?: SolutionState
  /** Why it was dropped. */
  dropNote?: string
  /** The decision record (ADR id, this scope) that accepts it. */
  decision?: string
  /** The plan (TR id, this scope) that builds it. */
  plan?: string
  /** Markdown: the idea, costs and benefits, why this scope, alternatives, risks. */
  body: string
  history: SolutionEvent[]
}

export type ExperimentOutcome = 'planned' | 'running' | 'confirmed' | 'refuted' | 'inconclusive'

export const EXPERIMENT_OUTCOMES: readonly ExperimentOutcome[] =
  ['planned', 'running', 'confirmed', 'refuted', 'inconclusive']

export type Experiment = {
  /** Stable, never shown. */
  id: string
  /** Sequential within the scope; `EX-0001` on screen. Never reused. */
  number: number
  title: string
  /** The solutions of this scope it tests. Usually one. */
  tests: string[]
  /**
   * How firmly it bears on each solution it tests, by solution id, where that
   * is not `normal` — so a file written before this existed reads the same.
   */
  strength?: Record<string, CauseStrength>
  /** What should happen if the solution is right. Never blank. */
  hypothesis: string
  /** What is counted to decide it. */
  measure?: string
  where?: string
  by?: string
  /** The window it runs over, `yyyy-mm-dd`. */
  from?: string
  to?: string
  outcome: ExperimentOutcome
  /** What happened, in numbers where there are numbers. */
  result?: string
  body: string
}
