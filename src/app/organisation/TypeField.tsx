// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import type { Translate } from '../../i18n'
import { SelectField } from '../../widgets/kit/Field'
import { SCOPE_KINDS } from '../../projects/scope'
import type { TypeChoice } from '../../projects/scopeType'
import { SCOPE_KIND_LABEL } from './scopeKinds'

/**
 * *What this is*: one list, the operating model's unit types first where there are
 * any, the built-in kinds below them, still allowed; the kinds alone where the
 * organisation has no operating model (ADR-0036, amended 17 October 2026). A unit
 * type the scope says and the model no longer holds is listed once so the field
 * can show it.
 */
export function TypeField({ type, unitTypes, onChange, help, readOnly = false, s }: {
  type: TypeChoice; unitTypes: readonly { id: string; name: string }[]; onChange: (type: TypeChoice) => void; help?: string; readOnly?: boolean; s: Translate
}) {
  const gone = type.startsWith('unit:') && !unitTypes.some((one) => `unit:${one.id}` === type)
  const options = [
    { value: '', label: s('org.kindNone') },
    // Under a heading each where there are unit types: a unit type and a kind may share a word (*Team*).
    ...unitTypes.map((one) => ({ value: `unit:${one.id}`, label: one.name, group: s('org.typeGroupUnits') })),
    ...(gone ? [{ value: type, label: s('org.typeGoneBadge'), group: s('org.typeGroupUnits') }] : []),
    ...SCOPE_KINDS.map((one) => ({ value: `kind:${one}`, label: s(SCOPE_KIND_LABEL[one]), ...(unitTypes.length > 0 || gone ? { group: s('org.typeGroupKinds') } : {}) })),
  ]
  return (
    <SelectField
      label={s('org.kind')} hint={help ?? s(unitTypes.length > 0 ? 'org.typeHelp' : 'org.kindHelp')} value={type} options={options}
      onChange={(next) => onChange(next as TypeChoice)} disabled={readOnly} data-testid="scope-type-field"
    />
  )
}
