// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The question a merge asks when somebody active goes into an entry that has
 * left (ADR-0036 §9): is the person still here, or did they leave? The merge
 * never guesses, and never ends anybody's roles in silence.
 *
 * - *Still here*: the leaving is cleared — the entry kept is active again, and
 *   the policy stops counting down to forgetting the name.
 * - *Left*: the roles of the entry absorbed end on the leaving day, as leaving
 *   ends them; one that only began after it is taken away, because a role is
 *   never ended on a day before it began. The page says how many of each.
 *
 * *Still here* is chosen to start with where any of those roles began after
 * the leaving day — the person was evidently back, rehired or as an external —
 * and *left* otherwise.
 */
import FormControlLabel from '@mui/material/FormControlLabel'
import Radio from '@mui/material/Radio'
import RadioGroup from '@mui/material/RadioGroup'
import Typography from '@mui/material/Typography'
import { leavingOn } from '../hold'
import type { HeldAssignment } from '../hold'
import type { MergeLeaving } from '../person'
import type { Translate } from '../shown'

/** The answer chosen to start with: *still here* where any role of the one absorbed began after the leaving day. */
export function mergeLeavingFirst(held: readonly HeldAssignment[], leftOn: string): MergeLeaving {
  return leavingOn(held, leftOn).later > 0 ? 'stillHere' : 'left'
}

export type MergeLeavingChoiceProps = {
  /** What the entry absorbed and the entry kept read as. */
  drop: string
  keep: string
  /** The day the entry kept left. */
  leftOn: string
  /** The absorbed entry's assignments, under its id and every id merged into it. */
  held: readonly HeldAssignment[]
  value: MergeLeaving
  onChange: (next: MergeLeaving) => void
  s: Translate
}

export function MergeLeavingChoice({ drop, keep, leftOn, held, value, onChange, s }: MergeLeavingChoiceProps) {
  const { ends, later } = leavingOn(held, leftOn)
  const day = leftOn
  const help = { fontSize: 12, color: 'text.secondary', ml: 4, mt: -0.5, mb: 0.5 }
  return (
    <div data-testid="people-merge-leaving">
      <Typography sx={{ fontSize: 14, mt: 1.5, fontWeight: 600 }}>{s('people.mergeLeftAsk', { keep, drop, day })}</Typography>
      {later > 0 && <Typography sx={{ fontSize: 12, mt: 0.5 }} data-testid="people-merge-later">{s('people.mergeLater', { drop, day })}</Typography>}
      <RadioGroup value={value} onChange={(event) => onChange(event.target.value as MergeLeaving)} aria-label={s('people.mergeLeftAsk', { keep, drop, day })}>
        <FormControlLabel value="stillHere" control={<Radio size="small" />} label={s('people.mergeStillHere')} data-testid="people-merge-still-here" />
        <Typography sx={help}>{s('people.mergeStillHereHelp', { keep })}</Typography>
        <FormControlLabel value="left" control={<Radio size="small" />} label={s('people.mergeLeft', { day })} data-testid="people-merge-left" />
        <Typography sx={help} data-testid="people-merge-left-help">
          {ends === 0 ? s('people.mergeLeftNone', { drop, day }) : s(ends === 1 ? 'people.mergeLeftEndsOne' : 'people.mergeLeftEndsOther', { count: ends, drop, day })}
          {later > 0 && ` ${s(later === 1 ? 'people.mergeLeftLaterOne' : 'people.mergeLeftLaterOther', { count: later, day })}`}
        </Typography>
      </RadioGroup>
    </div>
  )
}
