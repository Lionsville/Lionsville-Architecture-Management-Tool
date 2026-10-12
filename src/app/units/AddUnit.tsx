// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The ways *+ Unit* is drawn on the organisation chart (ADR-0036, as built
 * 3.6.2), kept quiet so the chart stays the units: *+ Unit at the top* in the
 * bar, the outline's header and on an empty chart, and a small *+* on a
 * unit's name row that shows while the row is pointed at, holds the focus or
 * the unit is picked — always there for the keyboard, and on a screen with no
 * pointer to hover.
 *
 * **Where nothing may sit**, it says so: a *+ Unit at the top* that may make
 * nothing is disabled, with the reason and the way to change it beside it; a
 * unit's *+* is marked unavailable, its tooltip says why, and pressed it
 * opens the dialog that says it and links to the operating model.
 */
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import type { Translate } from '../../i18n'
import { AddIcon } from '../../widgets/icons'
import type { UnitOffer } from './useNewUnit'

/** The attribute a unit's *+* carries, which the name row shows on hover and focus. */
export const ADD_INSIDE = 'data-add-inside'

/** What a name row lays over itself so its *+* shows when it is wanted. */
export const showsAddInside = {
  [`& [${ADD_INSIDE}]`]: { opacity: 0, transition: 'opacity 120ms' },
  [`&:hover [${ADD_INSIDE}], &:focus-within [${ADD_INSIDE}], & [${ADD_INSIDE}][data-shown="true"]`]: { opacity: 1 },
  [`@media (hover: none)`]: { [`& [${ADD_INSIDE}]`]: { opacity: 1 } },
} as const

/** *+ Unit at the top*, or — where nothing may be made there — the same disabled, with why and the way on. */
export function AddAtTop({ offer, onAdd, onLink, guide, testId, t, variant = 'text' }: {
  offer: UnitOffer; onAdd: () => void; onLink: () => void; guide: string; testId: string; t: Translate
  variant?: 'text' | 'outlined' | 'contained'
}) {
  const button = (
    <Button
      size="small" variant={variant} disabled={!offer.ok} onClick={onAdd} data-guide={guide} data-testid={testId}
      sx={{ textTransform: 'none', whiteSpace: 'nowrap' }}
    >
      {t('chart.addAtTop')}
    </Button>
  )
  if (offer.ok) return button
  return (
    <Box sx={{ display: 'inline-flex', flexWrap: 'wrap', alignItems: 'center', gap: 0.5 }}>
      {button}
      <Typography component="span" sx={{ fontSize: 11.5, color: 'text.secondary' }} data-testid={`${testId}-reason`}>{offer.reason}</Typography>
      <Button size="small" onClick={onLink} data-testid={`${testId}-link`} sx={{ textTransform: 'none', minWidth: 0 }}>{offer.link}</Button>
    </Box>
  )
}

/** A unit's own *+*: a unit inside it, or why none may be. */
export function AddInside({ name, offer, picked, onAdd, t }: { name: string; offer: UnitOffer; picked: boolean; onAdd: () => void; t: Translate }) {
  return (
    <Tooltip title={offer.ok ? t('chart.addInside', { name }) : offer.reason}>
      <IconButton
        size="small" aria-label={t('chart.addInside', { name })} aria-disabled={offer.ok ? undefined : 'true'} onClick={onAdd}
        data-guide="chart.addInside" data-testid="chart-add-inside" {...{ [ADD_INSIDE]: '', 'data-shown': picked ? 'true' : undefined }}
        sx={{ width: 22, height: 22, mt: 0.25, color: offer.ok ? 'text.secondary' : 'text.disabled' }}
      >
        <AddIcon size={14} />
      </IconButton>
    </Tooltip>
  )
}
