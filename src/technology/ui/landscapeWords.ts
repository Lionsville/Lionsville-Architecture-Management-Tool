// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The four kinds of line a reader learns, out of the five the rows are: what is
 * derived and what binds are the plain *uses* line, whose far end says which.
 */
import type { LandscapeEdge } from '../../model/technologyLandscape'
import type { ColourToken } from '../../widgets/kit/tokens'
import type { LandscapeColour } from '../../model/technologyLandscape'
import type { Lifecycle } from '../../model'
import type { StringKey } from '../../i18n'

export type LineKind = 'uses' | 'implied' | 'runs' | 'delivered'

export const LINE_KINDS: readonly { kind: LineKind; label: StringKey }[] = [
  { kind: 'uses', label: 'landscape.legendUses' },
  { kind: 'implied', label: 'landscape.legendImplied' },
  { kind: 'runs', label: 'landscape.legendRuns' },
  { kind: 'delivered', label: 'landscape.legendDelivered' },
]

export function lineKindOf(edge: Pick<LandscapeEdge, 'kind' | 'implied'>): LineKind {
  if (edge.implied) return 'implied'
  if (edge.kind === 'hostedOn') return 'runs'
  if (edge.kind === 'realises') return 'delivered'
  return 'uses'
}

export const COLOUR_WORD: Record<LandscapeColour, StringKey> = {
  technologyLifecycle: 'landscape.colourStandsOn',
  lifecycle: 'landscape.colourLifecycle',
  category: 'landscape.colourCategory',
  owner: 'landscape.colourOwner',
}

/** What the key calls the rows a lens has no value for, drawn as an empty square on them and in the key. */
export const NONE_WORD: Record<LandscapeColour, StringKey> = {
  technologyLifecycle: 'landscape.noneSaid',
  lifecycle: 'landscape.noneSaid',
  category: 'landscape.noneCategory',
  owner: 'landscape.noneOwner',
}

export const PHASE_WORD: Record<Lifecycle, StringKey> = {
  planned: 'landscape.planned', live: 'landscape.live', retiring: 'landscape.retiring', retired: 'landscape.retired',
}

/** A phase has its status ink; the word beside it is what carries the meaning. */
export const PHASE_SWATCH: Record<Lifecycle, ColourToken> = { live: 'ok', planned: 'ink-3', retiring: 'warn', retired: 'bad' }

const LENSES: readonly ColourToken[] = ['lens-1', 'lens-2', 'lens-3', 'lens-4', 'lens-5', 'lens-6']

/** A value's swatch by its place among the values, largest first; past six a value is an outline. */
export function lensOf(at: number): ColourToken | undefined {
  return LENSES[at]
}
