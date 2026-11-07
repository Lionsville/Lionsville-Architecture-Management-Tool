// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What a gesture needs to make something, or nothing at all under `readOnly`.
 *
 * One object rather than a `readOnly` prop threaded through every band: a band
 * that cannot reach the actions cannot offer a *+*, which is a stronger guarantee
 * than remembering to write the flag into each one.
 *
 * *+ area*, and *From above…* beside it (ADR-0040 §5): an area made here, or a
 * function of a sheet above taken up, as a searchable list by the scope that
 * defines each. Not offered where there is nothing to take up.
 */
import { useState } from 'react'
import type { ElementId } from '../../model'
import type { Translate } from '../../i18n'
import { Button } from '../../widgets/kit/Button'
import { GroupedPicker } from '../../widgets/PickToAdd'
import type { PickOption } from '../../widgets/PickToAdd'
import type { SheetActions } from './FunctionInspector'

export type Author = { t: Translate; made(id: ElementId | undefined): void; actions: SheetActions }

/** What *From above…* offers, and what a pick does: one step in this scope's session. */
export type SheetClaims = {
  /** Grouped by the scope that defines each, each saying what it sits in. */
  choices: readonly PickOption[]
  claim(id: ElementId): void
}

export function FromAbove({ claims, t }: { claims: SheetClaims | undefined; t: Translate }) {
  const [picking, setPicking] = useState(false)
  const offered = claims?.choices ?? []
  if (!claims || offered.length === 0) return null
  if (picking) {
    return (
      <span data-testid="sheet-from-above-field" className="sheet-find__field">
        <GroupedPicker
          options={offered} field={t('sheet.fromAboveFind')} nothing={t('sheet.fromAboveNothing')} testId="sheet-from-above-input"
          onPick={(id) => { setPicking(false); claims.claim(id) }} onClose={() => setPicking(false)}
        />
      </span>
    )
  }
  return (
    <span data-guide="sheet.fromAbove" data-testid="sheet-from-above">
      <Button variant="quiet" size="small" title={t('sheet.fromAboveTitle')} data-sheet-add onClick={() => setPicking(true)}>{t('sheet.fromAbove')}</Button>
    </span>
  )
}

export function AreaAdds({ author, claims, label }: { author: Author; claims: SheetClaims | undefined; label: string }) {
  const { t } = author
  return (
    <div className="sheet-adds" data-sheet-add>
      <Button variant="quiet" size="small" title={t('sheet.newArea')} aria-label={t('sheet.newArea')} onClick={() => author.made(author.actions.addArea(t('sheet.nameArea')))}>{label}</Button>
      <FromAbove claims={claims} t={t} />
    </div>
  )
}

/** The empty sheet: the ways to start, each saying what it means. */
export function EmptySheet({ author, claims, t }: { author: Author | undefined; claims: SheetClaims | undefined; t: Translate }) {
  return (
    <div className="sheet-empty">
      <div>
        <div>{t('sheet.noAreas')}</div>
        <div className="sheet-empty__means">{t('sheet.emptyHint')}</div>
      </div>
      {author && (
        <>
          <div className="sheet-empty__way">
            <Button variant="primary" onClick={() => author.made(author.actions.addArea(t('sheet.nameArea')))}>{t('sheet.newArea')}</Button>
            <span className="sheet-empty__means">{t('sheet.newAreaMeans')}</span>
          </div>
          <div className="sheet-empty__way">
            <Button onClick={() => author.made(author.actions.addJourney({ journey: t('sheet.nameJourney'), phase: t('sheet.nameFirstPhase') }))}>{t('sheet.newJourney')}</Button>
            <span className="sheet-empty__means">{t('sheet.newJourneyMeans')}</span>
          </div>
          {claims && claims.choices.length > 0 && (
            <div className="sheet-empty__way">
              <FromAbove claims={claims} t={t} />
              <span className="sheet-empty__means">{t('sheet.fromAboveMeans')}</span>
            </div>
          )}
        </>
      )}
    </div>
  )
}
