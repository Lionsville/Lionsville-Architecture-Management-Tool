// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * One building block as a workbench (ADR-0043 §8), under Guidance with the list
 * folded away, because its grids need the width:
 *
 * - *About*: its document, a chapter per usage context, and the principles it cites;
 * - *Requirements*: its capabilities and usage contexts, how much each context needs
 *   of each capability;
 * - *Options*: the catalogue of what could deliver it, where each is weighed and chosen;
 * - *Where used*: each scope's evaluation, and *Evaluate for a scope…*.
 *
 * A page over the home it was opened from, reached from the list, a topic or the
 * block on a board; never the first view, so its script arrives when it is first
 * opened. Each tab has an address.
 */
import { useEffect, useRef, useState } from 'react'
import { useStrings } from '../../i18n/LanguageContext'
import type { WindowChrome } from '../../platform/windowChrome'
import { GuidanceFrame } from '../../principles/ui/GuidanceFrame'
import { Button } from '../../widgets/kit/Button'
import { RecordActions } from '../../widgets/kit/RecordActions'
import { Tabs } from '../../widgets/kit/Tabs'
import { PageDialog } from '../../widgets/PageDialog'
import { usePlaceTab } from '../../widgets/placeTab'
import { BlockAbout, BlockTextWindow, useBlockDocument } from './BlockAbout'
import { BlockRequirements } from './BlockRequirements'
import { BlockSolutions } from './BlockSolutions'
import { BlockWhereUsed } from './BlockWhereUsed'
import { useBlocks } from './BlocksContext'

type TabKey = 'about' | 'requirements' | 'options' | 'used'

export function BlockPage({ open, id, evaluation: openOn, nonce, onClose, windowChrome }: {
  open: boolean
  id: string | undefined
  /** A scope whose evaluation to open on: *Where used* on it. */
  evaluation?: string
  /** Moves with every request, so the same block asked for twice is opened twice. */
  nonce?: number
  onClose: () => void
  windowChrome: WindowChrome
}) {
  const access = useBlocks()
  const { t } = useStrings()
  const [tab, setTab] = usePlaceTab('about')
  const [chapter, setChapter] = useState<string | undefined>(undefined)
  const [evaluating, setEvaluating] = useState<string | undefined>(openOn)
  const [editAsked, setEditAsked] = useState(false)
  const shown = useRef(id)
  useEffect(() => {
    if (!open) return
    setEvaluating(openOn)
    // Another block opens on About; a reload stays on the tab its address says.
    if (openOn !== undefined) setTab('used')
    else if (shown.current !== id) setTab('about')
    shown.current = id
  }, [open, openOn, id, nonce, setTab])
  const document = useBlockDocument(id ?? '')
  const row = id ? access?.block(id) : undefined
  if (!access || !row) return null
  const { block, scope } = row
  const toChapter = (context: string) => { setChapter((block.contexts ?? []).find((one) => one.id === context)?.name); setTab('about') }
  const now = (['about', 'requirements', 'options', 'used'] as const).find((one) => one === tab) ?? 'about'
  return (
    <PageDialog open={open} topInset={windowChrome.topInset} onClose={onClose} aria-label={block.name}>
      <GuidanceFrame tab="blocks">
        <div className="guidance-record" data-testid="block-page">
          <div className="guidance-record__head">
            <Button variant="quiet" onClick={onClose}>{t('blocks.backToList')}</Button>
            <h1 className="guidance-record__title">{block.name}</h1>
            <span className="guidance-read__quiet">{t('blocks.keptInScope', { scope: access.scopeLabel(scope) })}</span>
            <span className="guidance-read__spring" />
            {/* The block's text is its record's text: ✎ Edit in the head, as on every record (`RecordActions`). */}
            <RecordActions
              {...(access.mayWrite(scope) ? { edit: { onPress: () => setEditAsked(true), testId: 'block-document-edit' } } : {})}
              more={[{ label: t('blocks.openIn', { scope: access.scopeLabel(scope) }), onSelect: () => access.openScope(scope), 'data-testid': 'block-open-scope' }]}
            />
          </div>
          <div className="guidance-record__tabs">
            <Tabs<TabKey>
              label={block.name} value={now}
              onChange={(next) => { setTab(next); if (next === 'used') setEvaluating(undefined) }}
              items={[
                { value: 'about', label: t('blocks.about') },
                { value: 'requirements', label: t('blocks.requirements') },
                { value: 'options', label: t('blocks.solutions') },
                { value: 'used', label: t('blocks.whereUsed') },
              ]}
            />
          </div>
          {now === 'used' && evaluating !== undefined
            ? <BlockWhereUsed row={row} evaluating={evaluating} onEvaluate={setEvaluating} onChapter={toChapter} />
            : (
              <div className="guidance-record__body">
                {now === 'about' && <BlockAbout row={row} chapter={chapter} onChapterShown={() => setChapter(undefined)} document={document} writing={editAsked} />}
                {now === 'requirements' && <BlockRequirements row={row} onChapter={toChapter} />}
                {now === 'options' && <BlockSolutions row={row} />}
                {now === 'used' && <BlockWhereUsed row={row} evaluating={evaluating} onEvaluate={setEvaluating} onChapter={toChapter} />}
              </div>
            )}
        </div>
        <BlockTextWindow row={row} document={document} asked={editAsked} onDone={() => setEditAsked(false)} />
      </GuidanceFrame>
    </PageDialog>
  )
}
