// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The days worth looking at, offered where a day is chosen: what a plan has on a
 * day, when something goes live or goes away, and where a board is saved. A date
 * field alone makes a person go and find those out and then type them.
 *
 * Soonest first from today, then the latest of what has passed, and a few of them:
 * the rest are one typed date away.
 *
 * Pure, and no words but the ones it is handed.
 */
import type { LifecycleDates } from '../model/types'

export type WorthLooking = { readonly day: string; readonly label: string }

type Says = {
  plan: (plan: string, milestone: string) => string
  phase: (phase: keyof LifecycleDates, name: string) => string
  board: (name: string) => string
}

const SHOWN = 10

export function daysWorthLooking(
  model: {
    elements: readonly { name: string; lifecycleDates?: LifecycleDates }[]
    transitions?: readonly { title: string; milestones: readonly { date: string; name: string }[] }[]
    diagrams: readonly { name: string; asOf?: string }[]
  },
  today: string,
  says: Says,
): readonly WorthLooking[] {
  const all: WorthLooking[] = [
    ...(model.transitions ?? []).flatMap((plan) => plan.milestones.map((one) => ({ day: one.date, label: says.plan(plan.title, one.name) }))),
    ...model.elements.flatMap((element) => (Object.entries(element.lifecycleDates ?? {}) as [keyof LifecycleDates, string][])
      .map(([phase, day]) => ({ day, label: says.phase(phase, element.name) }))),
    ...model.diagrams.flatMap((one) => (one.asOf ? [{ day: one.asOf, label: says.board(one.name) }] : [])),
  ].filter((one) => one.day !== '' && one.day !== today)
  const ahead = all.filter((one) => one.day > today).sort((a, b) => a.day.localeCompare(b.day))
  const past = all.filter((one) => one.day < today).sort((a, b) => b.day.localeCompare(a.day))
  const shown = [...ahead, ...past].slice(0, SHOWN)
  return shown.sort((a, b) => a.day.localeCompare(b.day))
}
