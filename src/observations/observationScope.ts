// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The screen words for the vocabulary (ADR-0021), published as tables so that a
 * card on the organisation screen or a line in the search can label an impact
 * or a state without naming this module's string keys.
 */
import type { StringKey } from '../i18n'
import type { CauseState, CauseStrength, ObservationEventKind, ObservationImpact } from './observation'
import type { ExperimentOutcome, GateItem, SolutionPhase, SolutionQuestion, SolutionSize } from './solution'

export const IMPACT_LABEL: Record<ObservationImpact, StringKey> = {
  minor: 'observation.impactMinor',
  major: 'observation.impactMajor',
  critical: 'observation.impactCritical',
}

/** MUI chip colours per impact: the critical one stands out, the rest are quiet. */
export const IMPACT_COLOR: Record<ObservationImpact, 'default' | 'warning' | 'error'> = {
  minor: 'default',
  major: 'warning',
  critical: 'error',
}

/** What a bright spot is called, on its chip and in the form (ADR-0038 §6). */
export const BRIGHT_LABEL: StringKey = 'observation.bright'

/** The tone filter's three choices, in the order the toolbar shows them. */
export const TONE_LABEL: Record<'all' | 'problems' | 'bright', StringKey> = {
  all: 'observation.toneAll',
  problems: 'observation.toneProblems',
  bright: 'observation.toneBright',
}

/** What an archived observation is marked with, in a list that shows the impact otherwise. */
export const ARCHIVED_LABEL: StringKey = 'observation.archivedMark'

export const STATE_LABEL: Record<CauseState, StringKey> = {
  assumed: 'observation.stateAssumed',
  verified: 'observation.stateVerified',
}

export const STATE_COLOR: Record<CauseState, 'default' | 'success'> = {
  assumed: 'default',
  verified: 'success',
}

export const STRENGTH_LABEL: Record<CauseStrength, StringKey> = {
  strong: 'observation.strengthStrong',
  normal: 'observation.strengthNormal',
  weak: 'observation.strengthWeak',
}

export const EVENT_LABEL: Record<ObservationEventKind, StringKey> = {
  recorded: 'observation.eventRecorded',
  seen: 'observation.eventSeen',
  shared: 'observation.eventShared',
  unshared: 'observation.eventUnshared',
  absorbed: 'observation.eventAbsorbed',
  merged: 'observation.eventMerged',
  archived: 'observation.eventArchived',
  restored: 'observation.eventRestored',
  moved: 'observation.eventMoved',
  movedIn: 'observation.eventMovedIn',
}

// --- solutions and experiments (ADR-0026) -----------------------------------------

export const PHASE_LABEL: Record<SolutionPhase, StringKey> = {
  idea: 'solution.phaseIdea',
  shaped: 'solution.phaseShaped',
  testing: 'solution.phaseTesting',
  proven: 'solution.phaseProven',
  adopted: 'solution.phaseAdopted',
  implemented: 'solution.phaseImplemented',
  dropped: 'solution.phaseDropped',
}

/** MUI chip colours per phase: quiet while it is an idea, green once it is decided. */
export const PHASE_COLOR: Record<SolutionPhase, 'default' | 'info' | 'warning' | 'success' | 'primary'> = {
  idea: 'default',
  shaped: 'info',
  testing: 'warning',
  proven: 'primary',
  adopted: 'success',
  implemented: 'success',
  dropped: 'default',
}

export const SIZE_LABEL: Record<SolutionSize, StringKey> = {
  small: 'solution.sizeSmall',
  medium: 'solution.sizeMedium',
  large: 'solution.sizeLarge',
}

export const OUTCOME_LABEL: Record<ExperimentOutcome, StringKey> = {
  planned: 'solution.outcomePlanned',
  running: 'solution.outcomeRunning',
  confirmed: 'solution.outcomeConfirmed',
  refuted: 'solution.outcomeRefuted',
  inconclusive: 'solution.outcomeInconclusive',
}

export const OUTCOME_COLOR: Record<ExperimentOutcome, 'default' | 'warning' | 'success' | 'error'> = {
  planned: 'default',
  running: 'warning',
  confirmed: 'success',
  refuted: 'error',
  inconclusive: 'default',
}

export const GATE_LABEL: Record<GateItem, StringKey> = {
  addresses: 'solution.gateAddresses',
  benefit: 'solution.gateBenefit',
  cost: 'solution.gateCost',
  validatedWith: 'solution.gateValidatedWith',
  triedBefore: 'solution.gateTriedBefore',
  whyNow: 'solution.gateWhyNow',
  experimentPlanned: 'solution.gateExperimentPlanned',
  experimentConfirmed: 'solution.gateExperimentConfirmed',
  decisionAccepted: 'solution.gateDecisionAccepted',
}

/**
 * What each line of a solution's gate asks, on hover and on focus: where on
 * the page it is answered. A `Record` over every item, so a gate line added
 * without words for its hint does not compile.
 */
export const GATE_HINT: Record<GateItem, StringKey> = {
  addresses: 'solution.gateHint.addresses',
  benefit: 'solution.gateHint.benefit',
  cost: 'solution.gateHint.cost',
  validatedWith: 'solution.gateHint.validatedWith',
  triedBefore: 'solution.gateHint.triedBefore',
  whyNow: 'solution.gateHint.whyNow',
  experimentPlanned: 'solution.gateHint.experimentPlanned',
  experimentConfirmed: 'solution.gateHint.experimentConfirmed',
  decisionAccepted: 'solution.gateHint.decisionAccepted',
}

export const QUESTION_LABEL: Record<SolutionQuestion, StringKey> = {
  proofWithdrawn: 'solution.questionProofWithdrawn',
  worksAround: 'solution.questionWorksAround',
  addsOnly: 'solution.questionAddsOnly',
  adoptedUnplanned: 'solution.questionAdoptedUnplanned',
}
