// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The question before an item of the operating model is removed, and what
 * removing it takes with it (`edit.ts`): a unit type out of the types that may
 * sit in it, a role out of the slots and the rules, a responsibility out of
 * every role's part in it.
 *
 * **A role somebody holds** says how many people hold it today or later and
 * in which units, as the host counts them (`RoleHolders`) — this page knows
 * nobody's name — and that ending the role on a day instead lists them with
 * *Move the people* (ADR-0036 §6). Removing it is still one step that undo
 * takes back; their assignments are left naming a role the model no longer
 * holds, which is why the question says so first.
 */
import { ConfirmDialog } from '../../widgets/ConfirmDialog'
import { useStrings } from '../../i18n'
import type { OperatingItem } from '../edit'

/** Who holds a role today or later, as the host counts them: how many people, and the units' names. */
export type RoleHolders = { readonly people: number; readonly units: readonly string[] }

const QUESTION = {
  unitType: 'operating.removeUnitType', role: 'operating.removeRole', responsibility: 'operating.removeResponsibility',
} as const

export function RemoveConfirm({ item, holders, onCancel, onConfirm }: {
  item: OperatingItem | undefined
  /** For a role, who holds it; nothing where the host cannot say or nobody does. */
  holders: RoleHolders | undefined
  onCancel(): void
  onConfirm(): void
}) {
  const { t } = useStrings()
  const held = item?.kind === 'role' && holders && holders.people > 0
    ? ` ${t(holders.people === 1 ? 'operating.removeRoleHeldOne' : 'operating.removeRoleHeldOther', { count: holders.people, units: holders.units.join(', ') })} ${t('operating.removeRoleMoveFirst')}`
    : ''
  return (
    <ConfirmDialog
      open={item !== undefined}
      title={t('operating.remove')}
      body={item ? `${t(QUESTION[item.kind], { name: item.item.name })}${held}` : ''}
      confirmLabel={t('operating.removeConfirm')}
      cancelLabel={t('operating.cancel')}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  )
}
