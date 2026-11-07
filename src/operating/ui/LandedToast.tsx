// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/** The toast after a library is brought in: what the one step did, and *Undo* for that step alone (`useLibraryStep`). */
import { useStrings } from '../../i18n'
import type { Translate } from '../../i18n'
import { Toast } from '../../widgets/kit/Toast'
import type { Landed } from './useLibraryStep'

export function LandedToast({ landed, onUndo, onClose }: { landed: Landed | undefined; onUndo(): void; onClose(): void }) {
  const { t } = useStrings()
  const offer = landed?.kind === 'brought' && landed.undo !== undefined
  return (
    <Toast
      toast={landed ? { key: landed.key, message: landedWords(landed, t), ...(offer ? { undo: { onPress: onUndo } } : {}) } : null}
      onClose={onClose}
    />
  )
}

/** What the step did, in a sentence: what it made from which library, and how many of the organisation's own it used. */
export function landedWords(landed: Landed, t: Translate): string {
  if (landed.kind === 'notUndone') return t('operating.notUndone')
  const { made, reused, library } = landed.brought
  const what = made > 0
    ? t(made === 1 ? 'operating.landedOne' : 'operating.landedOther', { count: made, library: library.name })
    : t('operating.landedNothing', { library: library.name })
  const used = reused > 0 ? ` ${t(reused === 1 ? 'operating.landedReusedOne' : 'operating.landedReusedOther', { count: reused })}` : ''
  return made > 0 ? `${what}${used} ${t('operating.landedNew')}` : `${what}${used}`
}
