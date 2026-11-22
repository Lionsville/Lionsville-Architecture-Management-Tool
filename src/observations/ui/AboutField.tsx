// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The elements an observation is about, picked (ADR-0032, amended 22 November
 * 2026): the kit's picker of several, which the element's own record uses for
 * what it realises, opened by a press so it neither takes the focus from the
 * title nor stands open in a form. *Where seen* stays beside it as words; this
 * is the part a record can be found by from the element.
 *
 * An id the scope no longer holds stays chosen and says so, rather than
 * vanishing from the record on its next save.
 *
 * Where the open source cannot keep the field yet (`widgets/unkept.ts`), it
 * says so in the source's own sentence and offers nothing to pick: a choice
 * made here would be a change the source refuses, or one it drops.
 */
import { useState } from 'react'
import type { Translate } from '../../i18n'
import type { StringKey } from '../../i18n/strings'
import type { UnkeptPart } from '../../platform/sourceProvider'
import { Button } from '../../widgets/kit/Button'
import { PickerMany } from '../../widgets/kit/Picker'
import { useUnkept } from '../../widgets/unkept'

/** The field this is, as a source says it cannot keep it. */
const PART: UnkeptPart = 'observation.about'

/** An element that may be picked: what this scope holds, its own or a stand-in. */
export type AboutChoice = { readonly id: string; readonly name: string }

export function AboutField({ value, elements, onChange, s, testId = 'form-about' }: {
  value: readonly string[]
  elements: readonly AboutChoice[]
  onChange: (next: string[]) => void
  s: Translate
  testId?: string
}) {
  const [picking, setPicking] = useState(false)
  const unkept = useUnkept(PART)
  const label = s('observation.aboutField')
  if (unkept !== undefined) {
    return (
      <div className="kit-field" data-testid={testId} data-guide="observationForm.about">
        <span className="kit-field__label">{label}</span>
        <p className="kit-field__words" data-testid={`${testId}-unkept`}>{s(unkept as StringKey)}</p>
      </div>
    )
  }
  const named = new Map(elements.map((one) => [one.id, one.name]))
  const chosen = value.map((id) => ({ id, label: named.get(id) ?? id, ...(named.has(id) ? {} : { detail: s('observation.aboutNotHere') }) }))
  return (
    <div className="kit-field" data-testid={testId} data-guide="observationForm.about">
      <span className="kit-field__label">{label}</span>
      {picking
        ? (
          <PickerMany
            label={label} placeholder={s('observation.aboutPlaceholder')} chosen={chosen}
            options={elements.map((one) => ({ id: one.id, label: one.name }))}
            onAdd={(id) => onChange([...value, id])}
            onRemove={(id) => onChange(value.filter((held) => held !== id))}
            onDone={() => setPicking(false)}
          />
        )
        : (
          <span className="chain-about">
            {chosen.length
              ? chosen.map((one) => <span key={one.id} className="chain-about__one" title={one.detail}>{one.label}{one.detail ? ` (${one.detail})` : ''}</span>)
              : <span className="chain-about__none">{s('observation.aboutNone')}</span>}
            <Button variant="quiet" size="small" onClick={() => setPicking(true)} data-testid={`${testId}-pick`}>
              {chosen.length ? s('observation.aboutChange') : s('observation.aboutPick')}
            </Button>
          </span>
        )}
      <p className="kit-field__words">{s('observation.aboutHint')}</p>
    </div>
  )
}
