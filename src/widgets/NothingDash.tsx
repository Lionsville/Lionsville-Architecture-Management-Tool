// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A dimmed dash where a cell has nothing to say.
 *
 * A column that says *Nowhere else* twenty times down a register, or
 * *nothing* twelve times down a library, is noise to the eye; a dash is not.
 * The words stay for whoever reads the page rather than looks at it, and
 * under the pointer.
 */
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'

/** Off screen for the eye, there for a screen reader: what the dash means. */
export const VISUALLY_HIDDEN = {
  position: 'absolute', width: 1, height: 1, margin: -1, padding: 0, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap', border: 0,
} as const

export function NothingDash({ says }: { says: string }) {
  return (
    <Typography component="span" title={says} data-testid="nothing-dash" sx={{ fontSize: 12, color: 'text.secondary', cursor: 'default' }}>
      <Box component="span" aria-hidden="true">–</Box>
      <Box component="span" sx={VISUALLY_HIDDEN}>{says}</Box>
    </Typography>
  )
}
