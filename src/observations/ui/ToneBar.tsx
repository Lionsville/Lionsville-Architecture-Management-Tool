// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The 3 px bar a tone is drawn with (ADR-0038, amended): down the register's
 * row as its stripe, and to the left of the word on the form's button, so the
 * form and the list read alike. Success, grey and error.
 */
import Box from '@mui/material/Box'
import type { Theme } from '@mui/material/styles'
import type { ObservationTone } from '../observation'

/** The colour a tone is drawn in. */
export function toneColor(theme: Theme, tone: ObservationTone): string {
  if (tone === 'bright') return theme.palette.success.main
  if (tone === 'problem') return theme.palette.error.main
  return theme.palette.grey[400]
}

/** The row's stripe, as a style: an inset shadow, so it takes no width from the first cell. */
export function toneStripe(tone: ObservationTone) {
  return { boxShadow: (theme: Theme) => `inset 3px 0 0 ${toneColor(theme, tone)}` }
}

export function ToneBar({ tone, height = 14 }: { tone: ObservationTone; height?: number }) {
  return <Box aria-hidden sx={{ width: 3, height, borderRadius: 0.5, bgcolor: (theme) => toneColor(theme, tone), flex: '0 0 auto' }} />
}
