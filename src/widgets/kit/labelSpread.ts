// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Labels that keep clear of each other and of what they would cover. A label sits
 * where its line says, and one that would land on another, or on a box, moves as
 * little as it can, up or down along its line's side. Nothing moves that did not have to, so one new label does not shuffle a page.
 *
 * In whatever units the rectangles are given in, and React-free.
 */
export type LabelBox = { readonly id: string; readonly x: number; readonly y: number; readonly width: number; readonly height: number }

const GAP = 2
/** Enough for a hub: past this a pile cannot be read anyway, and the Lines list is there. */
const TRIES = 24

const overlaps = (a: LabelBox, b: LabelBox) =>
  a.x < b.x + b.width + GAP && b.x < a.x + a.width + GAP && a.y < b.y + b.height + GAP && b.y < a.y + a.height + GAP

/** How far each label has to move, by id; a label that stays where it is has no entry. */
export function spreadLabels(boxes: readonly LabelBox[], keepOff: readonly LabelBox[] = []): ReadonlyMap<string, number> {
  const placed: LabelBox[] = [...keepOff]
  const moved = new Map<string, number>()
  const ordered = [...boxes].sort((a, b) => a.y - b.y || a.x - b.x || a.id.localeCompare(b.id))
  for (const box of ordered) {
    let at = box
    for (let tries = 0; tries < TRIES; tries += 1) {
      const hit = placed.find((other) => overlaps(at, other))
      if (!hit) break
      const down = hit.y + hit.height + GAP - at.y
      const up = hit.y - GAP - (at.y + at.height)
      at = { ...at, y: at.y + (tries === 0 && Math.abs(up) < down ? up : down) }
    }
    if (at.y !== box.y) moved.set(box.id, at.y - box.y)
    placed.push(at)
  }
  return moved
}
