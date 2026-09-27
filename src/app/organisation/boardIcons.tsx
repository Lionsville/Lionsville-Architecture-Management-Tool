// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * One glyph per kind of board, for the rows on a scope's home.
 *
 * A home lists a landscape, its container diagrams and the laid-out pages in
 * one table, and the words under each name say which is which — but only once
 * a person has read them. The glyph says it at a glance. It is decoration and
 * nothing more: every icon is `aria-hidden`, because the row already says its
 * kind in words and a screen reader hearing it twice is not helped.
 *
 * The laid-out kinds wear the glyph their card on the organisation's home
 * wears, so a business architecture looks the same on both screens.
 */
import type { ComponentType } from 'react'
import type { DesignDiagram } from '../../model'
import { DeploymentIcon, LandscapeIcon, MapIcon, SheetIcon } from '../../widgets/icons'

interface IconProps {
  size?: number
}

/**
 * A container diagram: an application's boundary with its containers inside
 * it, the C4 picture of what one application is made of. Not the deployment
 * glyph, whose dashed boxes mean hosting.
 */
export function ContainerIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M7 7.5h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <rect x="6.5" y="11.5" width="4.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.75" />
      <rect x="13" y="11.5" width="4.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  )
}

/**
 * Every kind the model declares, and its glyph. `satisfies` rather than an
 * annotation, so a kind added to `DesignDiagram['kind']` without a line here
 * is a type error in this file rather than a row with a hole in it — and a
 * line for a kind the model dropped is one too.
 */
export const BOARD_ICONS = {
  layer7: LandscapeIcon,
  container: ContainerIcon,
  sheet: SheetIcon,
  map: MapIcon,
  // The technology landscape's card draws hosting boxes; the view it opens
  // is the same three bands, so it wears the same glyph.
  technology: DeploymentIcon,
} satisfies Record<DesignDiagram['kind'], ComponentType<IconProps>>

/** The glyph for a board of this kind, in the colour of the text around it. */
export function BoardKindIcon({ kind, size }: { kind: DesignDiagram['kind']; size?: number }) {
  const Icon = BOARD_ICONS[kind]
  return <Icon size={size} />
}
