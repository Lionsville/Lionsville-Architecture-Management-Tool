// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * *Merge another into this one…* (ADR-0041): this principle absorbs others of its
 * scope that say the same thing, with their aspects, groups, citations and
 * comments; the absorbed are kept as history. Typed to find, because the twin is
 * hard to spot among fifty.
 */
import { useState } from 'react'
import { useStrings } from '../../i18n/LanguageContext'
import { matchesQuery } from '../../model/textSearch'
import { Button } from '../../widgets/kit/Button'
import { Dialog } from '../../widgets/kit/Dialog'
import { FindField } from '../../widgets/kit/FindField'
import { formatPrincipleNumber } from '../principle'
import type { Principle } from '../principle'
import { usePrinciples } from './PrinciplesContext'

export function MergeDialog({ open, scope, into, onClose }: { open: boolean; scope: string; into: Principle; onClose: () => void }) {
  const access = usePrinciples()
  const { t } = useStrings()
  const [from, setFrom] = useState<string[]>([])
  const [find, setFind] = useState('')
  if (!access) return null
  const others = access.own(scope).principles.filter((one) => one.id !== into.id && !one.mergedInto)
  const shown = others.filter((one) => from.includes(one.id) || matchesQuery(find, [formatPrincipleNumber(one.number), one.title, one.statement]))
  return (
    <Dialog
      open={open} size="m" title={t('principles.mergeTitle', { number: formatPrincipleNumber(into.number) })} onClose={onClose}
      actions={(
        <>
          <Button variant="quiet" onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="primary" disabled={from.length === 0} onClick={() => { access.merge(scope, into.id, from); onClose() }}>{t('principles.mergeSubmit')}</Button>
        </>
      )}
    >
      <p>{t('principles.mergeIntro')}</p>
      <FindField fill autoFocus label={t('principles.search')} value={find} onChange={setFind} />
      <div className="guidance-form__ticks">
        {shown.map((one) => (
          <label className="guidance-form__tick" key={one.id}>
            <input type="checkbox" checked={from.includes(one.id)} onChange={(event) => setFrom((held) => (event.target.checked ? [...held, one.id] : held.filter((id) => id !== one.id)))} />
            <span>{formatPrincipleNumber(one.number)} {one.title}</span>
          </label>
        ))}
      </div>
    </Dialog>
  )
}
