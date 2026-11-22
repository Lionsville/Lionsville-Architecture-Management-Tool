// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Who stops being what if a unit is deleted, as a page that may not read the
 * register draws it (ADR-0036, amended 12 October 2026): the person by the
 * register, the role and the unit as the host calls them. The sheet's
 * confirmation asks for it (`business/ui/FunctionInspector.SheetResponsible`);
 * a board's says the same sentences (`editor/EditorDialogs`).
 */
import type { Translate } from '../../i18n'
import { rolesEndedSentences } from '../../model/deletion'
import type { DeletionSummary } from '../../model/deletion'
import { usePersonNames } from '../../people/ui/names'
import { RolesEnded } from '../../widgets/RolesEnded'

export function RolesEndedHere({ summary, role, unit, s }: {
  summary: Pick<DeletionSummary, 'roles' | 'earlierAssignments'>
  role: (id: string) => string
  unit: (id: string) => string
  s: Translate
}) {
  const names = usePersonNames()
  const lines = rolesEndedSentences(summary, { person: (id) => names.text({ person: id }), role, unit }, s)
  return <RolesEnded lines={lines} instead={s('dialog.retireInstead')} />
}
