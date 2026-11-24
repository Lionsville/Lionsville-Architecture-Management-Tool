// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A part in a responsibility, said: its letter as a cell shows it, and in words
 * what it means, whether it was checked and where it was read. Only an assumed
 * letter speaks up, by its dash; the rest is quiet text.
 */
import type { ReactNode } from 'react'
import { raciSaid } from '../../model/operatingModel'
import type { Duty, Raci } from '../../model/operatingModel'
import type { Translate } from '../../i18n'

export type CellLetter = Raci | 'A/R'

/** The letters in the order they are offered. */
export const CELL_LETTERS: readonly CellLetter[] = ['R', 'A', 'A/R', 'C', 'I']

export const LETTER_WORD = {
  R: 'operating.raci.R', A: 'operating.raci.A', 'A/R': 'operating.raci.AR', C: 'operating.raci.C', I: 'operating.raci.I',
} as const

/** What is said beside the letter: the mark and the source, or nothing. */
export function besideWords(duty: Pick<Duty, 'certainty' | 'source'>, t: Translate): string {
  return [
    duty.certainty && t(`certainty.${duty.certainty}`),
    duty.source && t('operating.sourceSaid', { source: duty.source }),
  ].filter(Boolean).join(' · ')
}

/** A cell in words: the letter's meaning, the mark and the source. */
export function dutyWords(duty: Duty, t: Translate): string {
  const beside = besideWords(duty, t)
  return `${t(LETTER_WORD[raciSaid(duty)])}${beside ? ` · ${beside}` : ''}`
}

/** One line of a reader: the letter, the way to what it is about, and what is said beside it. */
export function DutyLine({ duty, children, t }: { duty: Duty; children: ReactNode; t: Translate }) {
  const beside = besideWords(duty, t)
  return (
    <div className="op-duty" data-testid="operating-duty">
      <b data-assumed={duty.certainty === 'assumed' || undefined}>{raciSaid(duty)}</b>
      <span>{children}{beside && <> <span className="op-small">{beside}</span></>}</span>
    </div>
  )
}
