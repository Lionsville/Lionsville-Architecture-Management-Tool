// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import type { Translate } from '../../i18n'
import { plural } from '../../i18n/strings'

/** "3 unit types · 8 roles · 6 responsibilities", each said in the singular where it is one. */
export function countsLine(t: Translate, types: number, roles: number, responsibilities: number): string {
  return [
    plural(t, { one: 'operating.unitTypesOne', other: 'operating.unitTypesOther' }, types),
    plural(t, { one: 'operating.rolesOne', other: 'operating.rolesOther' }, roles),
    plural(t, { one: 'operating.responsibilitiesOne', other: 'operating.responsibilitiesOther' }, responsibilities),
  ].join(' · ')
}
