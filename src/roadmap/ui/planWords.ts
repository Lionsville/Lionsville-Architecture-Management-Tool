// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/** A plan's window, in the one way this module says it. */
import { isDay } from '../../model'
import type { Transition } from '../../model'
import { formatDay } from '../../i18n/dates'
import { useStrings } from '../../i18n'

export function useWindowWords(): (plan: Pick<Transition, 'from' | 'to'>) => string {
  const { t, language } = useStrings()
  return ({ from, to }) => {
    const first = isDay(from) ? formatDay(from, language) : undefined
    const last = isDay(to) ? formatDay(to, language) : undefined
    if (first && last) return t('plan.windowWords', { from: first, to: last })
    if (first) return t('plan.fromOnly', { day: first })
    if (last) return t('plan.toOnly', { day: last })
    return t('plan.noWindow')
  }
}
