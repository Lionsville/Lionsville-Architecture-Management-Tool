// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/** What each of a principle's values is called on screen. */
import type { StringKey } from '../../i18n'
import type { AspectNature, CitationRefusal, CitationStance, PrincipleRegime, PrincipleStatus } from '../principle'

export const STANCE_WORD: Record<CitationStance, StringKey> = {
  supports: 'principles.stanceSupports',
  deviates: 'principles.stanceDeviates',
  holds: 'principles.stanceHolds',
  chafes: 'principles.stanceChafes',
  missing: 'principles.stanceMissing',
}

export const STANCE_TIP: Record<CitationStance, StringKey> = {
  supports: 'principles.stanceSupportsTip',
  deviates: 'principles.stanceDeviatesTip',
  holds: 'principles.stanceHoldsTip',
  chafes: 'principles.stanceChafesTip',
  missing: 'principles.stanceMissingTip',
}

export const REGIME_WORD: Record<PrincipleRegime, StringKey> = {
  fixed: 'principles.regimeFixed',
  flexible: 'principles.regimeFlexible',
}

/** The regime said once, in words, in the reader. */
export const REGIME_SENTENCE: Record<PrincipleRegime, StringKey> = {
  fixed: 'principles.regimeFixedSentence',
  flexible: 'principles.regimeFlexibleSentence',
}

export const STATUS_WORD: Record<PrincipleStatus, StringKey> = {
  candidate: 'principles.statusCandidate',
  accepted: 'principles.statusAccepted',
  retired: 'principles.statusRetired',
}

export const NATURE_WORD: Record<AspectNature, StringKey> = {
  design: 'principles.natureDesign',
  behaviour: 'principles.natureBehaviour',
}

export const REFUSAL_WORD: Record<CitationRefusal, StringKey> = {
  principleFixed: 'principles.refusedFixed',
  principleRetired: 'principles.refusedRetired',
  reasonMissing: 'principles.refusedReason',
  stanceNotHere: 'principles.refusedStance',
}
