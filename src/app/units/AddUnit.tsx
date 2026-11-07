// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * *+ Unit at the top* on the organisation chart (ADR-0036, as built 3.6.2), in
 * the bar and on an empty chart.
 *
 * **Where nothing may sit**, it says so: a *+ Unit at the top* that may make
 * nothing is disabled, with the reason and the way to change it beside it.
 */
import type { Translate } from '../../i18n'
import { Button } from '../../widgets/kit/Button'
import type { UnitOffer } from './useNewUnit'

/** *+ Unit at the top*, or — where nothing may be made there — the same disabled, with why and the way on. */
export function AddAtTop({ offer, onAdd, onLink, guide, testId, label, tip, t, primary = false }: {
  offer: UnitOffer; onAdd: () => void; onLink: () => void; guide: string; testId: string; t: Translate
  /** The word on the button, where the bar says less than *+ Unit at the top*. */
  label?: string
  tip?: string
  primary?: boolean
}) {
  const button = (
    <Button variant={primary ? 'primary' : 'plain'} disabled={!offer.ok} onClick={onAdd} title={tip} data-guide={guide} data-testid={testId}>
      {label ?? t('chart.addAtTop')}
    </Button>
  )
  if (offer.ok) return button
  return (
    <span className="chart-add-none">
      {button}
      <span data-testid={`${testId}-reason`}>{offer.reason}</span>
      <Button variant="quiet" onClick={onLink} data-testid={`${testId}-link`}>{offer.link}</Button>
    </span>
  )
}
