// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/** Who manages a unit moved, in words, for the dialog and the panel alike. */
import type { Translate } from '../../i18n'
import type { PersonId } from '../../model/person'
import type { ElementId } from '../../model/types'
import type { Manager, Organisation } from '../../model/units'

export function managedByWords(organisation: Organisation, name: (id: ElementId) => string, personName: (person: PersonId) => string, s: Translate) {
  const roleName = (id: string) => organisation.roles.find((one) => one.id === id)?.name ?? id
  const how = (via: string) => (via === 'line' ? ` · ${s('unit.byLine')}` : via === 'override' ? ` · ${s('unit.byOverride')}` : '')
  return (list: readonly Manager[]) => (list.length === 0
    ? s('unitMove.managedNobody')
    : list.map((one) => `${s('unit.managedByLine', { person: personName(one.person), role: roleName(one.roleId), unit: name(one.unitId) })}${how(one.via)}`).join('; '))
}
