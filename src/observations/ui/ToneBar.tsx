// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The 3 px bar a tone is drawn with (ADR-0038, amended): down the register's
 * row as the kit list's rail, and to the left of the word on the form's button
 * and in the reader, so the form and the list read alike. The bar takes the
 * rail's tokens; the maps keep the status colours of `toneColor`.
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

const RAIL: Record<ObservationTone, string> = { bright: 'var(--rail-good)', problem: 'var(--rail-bad)', neutral: 'var(--rail-neutral)' }

export function ToneBar({ tone, height = 14 }: { tone: ObservationTone; height?: number }) {
  return <Box aria-hidden sx={{ width: 3, height, borderRadius: 0.5, bgcolor: RAIL[tone], flex: '0 0 auto' }} />
}
