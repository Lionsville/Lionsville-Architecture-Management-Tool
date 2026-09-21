/**
 * The screen words for the vocabulary (ADR-0021), published as tables so that a
 * card on the organisation screen or a line in the search can label an impact
 * or a state without naming this module's string keys.
 */
import type { StringKey } from '../i18n'
import type { CauseState, CauseStrength, ObservationEventKind, ObservationImpact } from './observation'

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
}
