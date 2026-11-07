// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/** How far a person dragged the guide's dock from its place. */
export type GuideOffset = { readonly x: number; readonly y: number }

export const hasAPlace = (offset: GuideOffset): boolean => offset.x !== 0 || offset.y !== 0

/** A dock dragged is kept on the screen: its head stays where a press can reach it. */
export function keptOnScreen(offset: GuideOffset, dock: { readonly width: number; readonly height: number }, view: { readonly width: number; readonly height: number }, gutter = 16): GuideOffset {
  return {
    x: Math.min(gutter, Math.max(offset.x, gutter * 2 + dock.width - view.width)),
    y: Math.min(gutter, Math.max(offset.y, gutter * 2 + dock.height - view.height)),
  }
}
