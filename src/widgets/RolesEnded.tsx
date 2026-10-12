// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Who stops being what, in a delete's confirmation (ADR-0036, amended 12
 * October 2026): a line per role a deleted unit takes with it, and under them
 * what to do instead where the history should stay — end the unit on a day.
 *
 * The lines are said by the screen (`model/deletion.rolesEndedSentences`):
 * this knows no person, role or unit, so a board's confirmation and a
 * sheet's draw them the same. Nothing at all where there are none.
 */
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'

export function RolesEnded({ lines, instead }: {
  lines: readonly string[]
  /** What to do instead where the history should stay. */
  instead: string
}) {
  if (lines.length === 0) return null
  return (
    <Box data-testid="roles-ended" sx={{ mt: 1.5 }}>
      <Box component="ul" sx={{ m: 0, pl: 2.5, fontSize: 14 }}>
        {lines.map((line) => <li key={line} data-testid="role-ended">{line}</li>)}
      </Box>
      <Typography sx={{ fontSize: 12.5, color: 'text.secondary', mt: 1 }} data-testid="roles-ended-instead">{instead}</Typography>
    </Box>
  )
}
