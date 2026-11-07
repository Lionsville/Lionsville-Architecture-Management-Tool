// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A numeric scale on an aspect (ADR-0046): what lets a capability map be read
 * as a heat map, on whatever the organisation chooses to rate.
 *
 * **The organisation's, one list.** The scales are said on the organisation's
 * own scope, so one number means one thing on every sheet below it. Any aspect
 * may have one: a key of the aspect superset, or one somebody named. A range
 * nobody said is 1 to 5.
 *
 * **On a function.** An area, a grouping and a capability are one kind told
 * apart by where they sit, so all three take a value (`DesignElement.ratings`),
 * and nothing else does. The reducer holds a value to being a whole number on
 * a function. It cannot hold it to the scale, which another scope may keep, so
 * a value outside its scale stands as written and reads as unrated
 * ({@link ratingOn}), which is also what narrowing a scale does to one.
 *
 * Pure, with no words: a heat map's colours are the theme's, and its legend
 * the screen's.
 */
import type { DesignElement } from './types'

export type AspectScale = {
  /** What a value is filed under: stable for the life of the scale, as an aspect column's key is. */
  key: string
  label: string
  /** What a tight cell shows, where the derived code is wrong. */
  code?: string
  /** The lowest value, a whole number. */
  min: number
  /** The highest value, a whole number above `min`. */
  max: number
}

/** The range a scale has where nobody said another (the owner, 7 November 2026). */
export const DEFAULT_SCALE_RANGE = { min: 1, max: 5 } as const

/** How many steps a scale may have: past this nobody is rating, they are measuring, and no heat map reads it. */
export const MOST_SCALE_STEPS = 101

/** A scale as it is said, with the range filled in. */
export function aspectScale(key: string, label: string, range: { min?: number; max?: number; code?: string } = {}): AspectScale {
  const code = range.code?.trim()
  return {
    key, label: label.trim(),
    min: range.min ?? DEFAULT_SCALE_RANGE.min,
    max: range.max ?? DEFAULT_SCALE_RANGE.max,
    ...(code ? { code } : {}),
  }
}

/** Whether one scale holds together. */
function scaleHolds(scale: AspectScale): boolean {
  return Boolean(scale.key) && Boolean(scale.label?.trim())
    && Number.isInteger(scale.min) && Number.isInteger(scale.max)
    && scale.min < scale.max && scale.max - scale.min < MOST_SCALE_STEPS
}

/** Whether a list of scales cannot be: a scale that does not hold together, or an aspect said twice. */
export function aspectScalesRefusal(scales: readonly AspectScale[]): boolean {
  return !Array.isArray(scales) || !scales.every(scaleHolds) || new Set(scales.map((one) => one.key)).size !== scales.length
}

/** The scale an aspect has, where it has one. */
export function scaleOf(scales: readonly AspectScale[] | undefined, key: string): AspectScale | undefined {
  return scales?.find((one) => one.key === key)
}

/** Whether a value is on a scale: a whole number between its ends. */
export function onScale(scale: AspectScale, value: number): boolean {
  return Number.isInteger(value) && value >= scale.min && value <= scale.max
}

/** What an element is rated on an aspect, read against its scale: nothing where it is unrated, or off the scale. */
export function ratingOn(element: Pick<DesignElement, 'ratings'>, scale: AspectScale): number | undefined {
  const value = element.ratings?.[scale.key]
  return value !== undefined && onScale(scale, value) ? value : undefined
}

/** How far up its scale a value stands, from 0 to 1: what a heat map colours by. */
export function heatOf(scale: AspectScale, value: number): number {
  return (value - scale.min) / (scale.max - scale.min)
}

/** Whether a record's ratings cannot be: on anything but a function, or anything but whole numbers. */
export function ratingsRefusal(element: Pick<DesignElement, 'kind' | 'ratings'>): boolean {
  const ratings = element.ratings
  if (ratings === undefined) return false
  return element.kind !== 'function' || !Object.values(ratings).every((value) => Number.isInteger(value))
}

/** The ratings with one value set or, with `undefined`, taken away; absent once none is left, as a saved file reads. */
export function withRating(
  ratings: Readonly<Record<string, number>> | undefined, key: string, value: number | undefined,
): Record<string, number> | undefined {
  const { [key]: _was, ...rest } = ratings ?? {}
  const next = value === undefined ? rest : { ...rest, [key]: value }
  return Object.keys(next).length > 0 ? next : undefined
}
