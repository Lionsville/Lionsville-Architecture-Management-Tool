// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The question before an item of the operating model is removed, and what
 * removing it takes with it (`edit.ts`): a unit type out of the types that may
 * sit in it, a role out of the slots and the rules, a responsibility out of
 * every role's part in it.
 */
import { ConfirmDialog } from '../../widgets/ConfirmDialog'
import { useStrings } from '../../i18n'
import type { OperatingItem } from '../edit'

const QUESTION = {
  unitType: 'operating.removeUnitType', role: 'operating.removeRole', responsibility: 'operating.removeResponsibility',
} as const

export function RemoveConfirm({ item, onCancel, onConfirm }: {
  item: OperatingItem | undefined
  onCancel(): void
  onConfirm(): void
}) {
  const { t } = useStrings()
  return (
    <ConfirmDialog
      open={item !== undefined}
      title={t('operating.remove')}
      body={item ? t(QUESTION[item.kind], { name: item.item.name }) : ''}
      confirmLabel={t('operating.removeConfirm')}
      cancelLabel={t('operating.cancel')}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  )
}
