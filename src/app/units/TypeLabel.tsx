// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A unit type's name on the organisation chart's boxes and in its outline
 * (3.7.3): each long word cut (`chartWords.shortTypeName`), the whole name on
 * hover, and the whole name — not the cut one — to assistive technology, so
 * a box or an outline row is named *Organisational unit Shipping*, never
 * *Organi. unit Shipping*. A name with nothing to cut is drawn as it is.
 *
 * The cut text is hidden from assistive technology and the whole name is
 * drawn for it alone, rather than an `aria-label` on the span: a label on a
 * plain span is not one ARIA allows, and the box's and the row's names are
 * worked out from what is inside them.
 */
import Box from '@mui/material/Box'
import { VISUALLY_HIDDEN } from '../../widgets/NothingDash'
import { shortTypeName } from './chartWords'

export function TypeLabel({ name }: { name: string }) {
  const short = shortTypeName(name)
  if (short === name) return <>{name}</>
  return (
    <Box component="span" title={name} data-testid="chart-type-label">
      <span aria-hidden="true">{short}</span>
      <Box component="span" sx={VISUALLY_HIDDEN}>{name}</Box>
    </Box>
  )
}
