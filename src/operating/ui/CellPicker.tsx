// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The cell picked, under the grid: its letters, and once it has one whether it was
 * checked and where it was read. A letter is one press, as it was; the rest waits
 * beside it and is nothing anybody has to pass. A part the open source cannot keep
 * says so in its control's place (ADR-0052 §7).
 */
import { useRef, useState } from 'react'
import type { KeyboardEvent, RefObject } from 'react'
import { dutyOf, raciSaid } from '../../model/operatingModel'
import type { Duty, DutySaid, Raci, Role } from '../../model/operatingModel'
import { isCertainty } from '../../model/types'
import { useStrings } from '../../i18n'
import type { StringKey } from '../../i18n'
import type { UnkeptPart } from '../../platform/sourceProvider'
import { Button } from '../../widgets/kit/Button'
import { Select, TextInput } from '../../widgets/kit/Field'
import { claimKey } from '../../widgets/kit/keys'
import { useUnkept } from '../../widgets/unkept'
import { DUTY_MARKS, markOf } from '../matrixView'
import { CELL_LETTERS, LETTER_WORD } from './dutyWords'
import type { CellLetter } from './dutyWords'

const ALSO: UnkeptPart = 'duty.alsoResponsible'
const MARK: UnkeptPart = 'duty.certainty'
const SOURCE: UnkeptPart = 'duty.source'

/** What of a duty the open source cannot keep, as the keys of its sentences. */
export function useUnkeptOfDuty(): { also: string | undefined; mark: string | undefined; source: string | undefined } {
  return { also: useUnkept(ALSO), mark: useUnkept(MARK), source: useUnkept(SOURCE) }
}

/** A letter as it is shown, as the letter that is kept and what is said beside it: A alone is A alone. */
export function letterKept(letter: CellLetter): { raci: Raci; said: DutySaid } {
  if (letter === 'A/R') return { raci: 'A', said: { alsoResponsible: true } }
  return { raci: letter, said: letter === 'A' ? { alsoResponsible: false } : {} }
}

/** The next mark a press of M gives: nobody said, assumed, confirmed, and nobody said again. */
export function nextMark(duty: Duty): DutySaid {
  const next = { unsaid: 'assumed', assumed: 'confirmed', confirmed: null } as const
  return { certainty: next[markOf(duty)] }
}

export function CellPicker({ role, row, sourceInput, onLetter, onSaid, onDone }: {
  role: Role | undefined; row: string
  sourceInput: RefObject<HTMLInputElement | null>
  onLetter(letter: CellLetter | undefined): void
  onSaid(said: DutySaid): void
  /** The source is written: the focus goes back to the cell. */
  onDone(): void
}) {
  const { t } = useStrings()
  const unkept = useUnkeptOfDuty()
  const duty = role && dutyOf(role, row)
  const now = duty && raciSaid(duty)
  const sentences = [...new Set([unkept.also, unkept.mark, unkept.source].filter((one) => one !== undefined))]
  return (
    <div className="op-picker" data-guide="operating.cell" data-testid="operating-cell-picker">
      <span className="op-picker__letters" role="group" aria-label={t('operating.setLetter')}>
        {CELL_LETTERS.filter((letter) => letter !== 'A/R' || unkept.also === undefined).map((letter) => (
          <Button key={letter} variant={now === letter ? 'primary' : 'plain'} size="small" aria-label={t(LETTER_WORD[letter])} aria-pressed={now === letter} onClick={() => onLetter(letter)}>{letter}</Button>
        ))}
        <Button variant="plain" size="small" aria-label={t('operating.raciNone')} onClick={() => onLetter(undefined)}>–</Button>
      </span>
      {duty && unkept.mark === undefined && (
        <span className="op-picker__mark"><Select
          aria-label={t('field.certainty')} data-testid="operating-cell-mark" data-fit value={markOf(duty)}
          options={DUTY_MARKS.map((mark) => ({ value: mark, label: t(`certainty.${mark}`) }))}
          onChange={(next) => onSaid({ certainty: isCertainty(next) ? next : null })}
        /></span>
      )}
      {duty && unkept.source === undefined && (
        <SourceInput key={`${role?.id} ${row} ${duty.source ?? ''}`} input={sourceInput} value={duty.source ?? ''} onChange={(source) => onSaid({ source })} onDone={onDone} />
      )}
      {sentences.map((key) => <span className="op-small" key={key} data-testid="operating-cell-unkept">{t(key as StringKey)}</span>)}
      <span className="op-small op-picker__legend">{t('operating.raciLegend')}</span>
    </div>
  )
}

/** Where the letter was read, kept when it is left or Enter is pressed; Escape puts back what was there. */
function SourceInput({ input, value, onChange, onDone }: { input: RefObject<HTMLInputElement | null>; value: string; onChange(next: string): void; onDone(): void }) {
  const { t } = useStrings()
  const [text, setText] = useState(value)
  const dropped = useRef(false)
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter' && event.key !== 'Escape') return
    claimKey(event)
    dropped.current = event.key === 'Escape'
    if (dropped.current) setText(value)
    onDone()
  }
  const left = () => {
    if (!dropped.current && text.trim() !== value.trim()) onChange(text.trim())
    dropped.current = false
  }
  return (
    <span className="op-picker__source">
      <TextInput
        ref={input} aria-label={t('operating.source')} placeholder={t('operating.sourcePlaceholder')} data-testid="operating-cell-source"
        value={text} onChange={(event) => setText(event.target.value)} onKeyDown={onKeyDown} onBlur={left}
      />
    </span>
  )
}
