// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The poster key's swatch, kept out of the poster's own chunk: the key is drawn
 * by the sheet page, and its looks are the poster's (`SheetPoster.css`).
 */
import type { CSSProperties } from 'react'
import { tokenVar } from '../../widgets/kit/tokens'
import type { LensValue, SheetLens } from '../lens'
import { lookOf } from './sheetLook'

/** A key's swatch on a poster: a small tile in the fill a tile of that value has, with its corner mark where tiles draw one. */
export function PosterKeyTile({ lens, value }: { lens: SheetLens; value: LensValue }) {
  const look = lookOf(lens, value)
  return (
    <span className="poster-key-tile" data-value={value.value} style={look.tile ? { '--poster-tile-fill': tokenVar(look.tile) } as CSSProperties : undefined} aria-hidden="true">
      {lens === 'coveredBy' && look.mark && <i className="poster-tile__mark" />}
    </span>
  )
}
