/**
 * What has happened to this project since it was opened (ADR-0002, step 9).
 *
 * The first thing the command log buys that undo did not already: a change is
 * a thing with a name and a time, so a list of them is a list somebody can
 * read. Nothing here computes anything — `model/activity.ts` works out what a
 * step is called, at the moment it is made and against the model as it was,
 * because that is the only moment a deleted row can still be named.
 *
 * Read-only on purpose. Stepping back to an entry is a different feature with a
 * different question behind it ("what happens to everything after it?"), and
 * ⌘Z already covers the one this answers.
 */
import Box from '@mui/material/Box'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Typography from '@mui/material/Typography'
import type { Language, Translate } from '../i18n'
import type { StepSummary } from '../model'
import { clockTime } from './ShellToolbar'

/** One line of the list: what was done, and when. */
export type ActivityEntry = {
  summary: StepSummary
  /** Epoch milliseconds, as `Date.now()` gives them. */
  at: number
}

export type ActivityMenuProps = {
  anchorEl: HTMLElement | null
  onClose: () => void
  /** Oldest first, as the stack holds them. */
  entries: readonly ActivityEntry[]
  language: Language
  s: Translate
}

export function ActivityMenu({ anchorEl, onClose, entries, language, s }: ActivityMenuProps) {
  // Newest at the top, which is the order a person reads a log in and the
  // opposite of the order a stack keeps it.
  const lines = [...entries].reverse()
  return (
    <Menu
      anchorEl={anchorEl}
      open={Boolean(anchorEl)}
      onClose={onClose}
      slotProps={{ list: { 'aria-label': s('shell.activity'), dense: true } }}
    >
      {lines.length === 0 ? (
        <MenuItem disabled>
          <Typography sx={{ fontSize: 12 }}>{s('shell.activityEmpty')}</Typography>
        </MenuItem>
      ) : (
        lines.map((entry, i) => (
          <MenuItem key={`${entry.at}-${i}`} disableRipple sx={{ cursor: 'default' }}>
            <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'baseline', minWidth: 220 }}>
              <Typography sx={{ fontSize: 12, flex: 1 }}>
                {s(entry.summary.key, {
                  name: entry.summary.name ?? '—',
                  count: entry.summary.count ?? 1,
                })}
              </Typography>
              <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
                {clockTime(new Date(entry.at), language)}
              </Typography>
            </Box>
          </MenuItem>
        ))
      )}
    </Menu>
  )
}
