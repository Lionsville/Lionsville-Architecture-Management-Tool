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
import { DialogChoices } from '../../widgets/kit/Dialog'
import { leavingOn } from '../hold'
import type { HeldAssignment } from '../hold'
import type { MergeLeaving } from '../person'
import type { Translate } from '../shown'
import { useDayWords } from './parts'

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
  const dayWords = useDayWords()
  const { ends, later } = leavingOn(held, leftOn)
  const day = dayWords(leftOn)
  const leftEffect = [
    ends === 0 ? s('people.mergeLeftNone', { drop, day }) : s(ends === 1 ? 'people.mergeLeftEndsOne' : 'people.mergeLeftEndsOther', { count: ends, drop, day }),
    ...(later > 0 ? [s(later === 1 ? 'people.mergeLeftLaterOne' : 'people.mergeLeftLaterOther', { count: later, day })] : []),
  ].join(' ')
  return (
    <div data-testid="people-merge-leaving">
      <p className="people-heading">{s('people.mergeLeftAsk', { keep, drop, day })}</p>
      {later > 0 && <p className="people-note" data-testid="people-merge-later">{s('people.mergeLater', { drop, day })}</p>}
      <DialogChoices<MergeLeaving>
        label={s('people.mergeLeftAsk', { keep, drop, day })} value={value} onChange={onChange}
        options={[
          { value: 'stillHere', label: s('people.mergeStillHere'), effect: s('people.mergeStillHereHelp', { keep }) },
          { value: 'left', label: s('people.mergeLeft', { day }), effect: leftEffect },
        ]}
      />
    </div>
  )
}
