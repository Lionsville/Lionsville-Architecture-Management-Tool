// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What a lens's value looks like and is called, said once for the rows, the key,
 * the overview and the panel. A mark's shape carries the meaning, so a value never
 * rests on hue alone; only a rating fills its row, in steps, with its number.
 */
import type { Translate } from '../../i18n'
import type { StringKey } from '../../i18n'
import type { AspectScale } from '../../model/aspectScale'
import type { ColourToken } from '../../widgets/kit/tokens'
import type { MarkKind } from '../../widgets/kit/Mark'
import type { LensValue, SheetLens } from '../lens'

export type Look = {
  mark?: MarkKind
  /** The token a square, a meter or a dot is drawn in. */
  colour?: ColourToken
  /** A square with nothing in it: the value that says nothing is there. */
  hollow?: boolean
}

const COVERED: Record<string, Look> = {
  apps: { mark: 'cov-apps', colour: 'cov-apps' },
  moving: { mark: 'cov-moving', colour: 'cov-moving' },
  people: { mark: 'cov-people', colour: 'cov-people' },
  none: { mark: 'cov-none', colour: 'cov-none', hollow: true },
}
const WHO: Record<string, Look> = {
  held: { mark: 'managed', colour: 'status-managed' },
  nobody: { mark: 'none', colour: 'status-none', hollow: true },
}
const DOMAINS: Record<string, Look> = {
  taken: { mark: 'agree', colour: 'ok' },
  handed: { mark: 'partial', colour: 'status-partial' },
  unasked: { mark: 'exception', colour: 'exception' },
  nobody: { mark: 'none', colour: 'status-none', hollow: true },
}
const LIFE: Record<string, Look> = {
  planned: { colour: 'life-planned' }, live: { colour: 'life-live' },
  retiring: { colour: 'life-retiring' }, retired: { colour: 'life-gone' },
}
const RETIRING: Record<string, Look> = {
  retiring: { mark: 'cov-moving', colour: 'cov-moving' },
  not: { colour: 'line-strong', hollow: true },
}

/** How one value of a lens is drawn. */
export function lookOf(lens: SheetLens, value: LensValue): Look {
  switch (lens) {
    case 'coveredBy': return COVERED[value.value] ?? {}
    case 'who': return WHO[value.value] ?? {}
    case 'domains': return DOMAINS[value.value] ?? {}
    case 'lifecycle': return LIFE[value.value] ?? {}
    case 'retiring': return RETIRING[value.value] ?? {}
    default:
      return value.heat !== undefined ? { colour: `heat-${value.heat}` as ColourToken } : { colour: 'line-strong', hollow: true }
  }
}

/** The word for a value on the key and to a screen reader. */
export function valueWord(lens: SheetLens, value: string, t: Translate): string {
  switch (lens) {
    case 'coveredBy': return t(`sheet.lens.covered.${value}` as StringKey)
    case 'who': return t(`sheet.lens.who.${value}` as StringKey)
    case 'domains': return t(`sheet.lens.domains.${value}` as StringKey)
    case 'lifecycle': return t(`lifecycle.${value}` as StringKey)
    case 'retiring': return t(`sheet.lens.retiring.${value}` as StringKey)
    default: return value === 'unrated' ? t('sheet.lens.unrated') : value
  }
}

/** What a question is called in the Colour menu. */
export function lensWord(lens: SheetLens, scales: readonly AspectScale[], t: Translate): string {
  if (lens.startsWith('aspect:')) return scales.find((scale) => `aspect:${scale.key}` === lens)?.label ?? lens
  return t(`sheet.lens.${lens}` as StringKey)
}

/** A value's order on the key, where its size is not the order that reads: a rating low to high. */
export const heatNumber = (value: string): number => Number(value)
