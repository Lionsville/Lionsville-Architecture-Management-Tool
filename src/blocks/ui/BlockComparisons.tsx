// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A building block's comparisons where the block is read (ADR-0043 §8, amended
 * 24 November 2026): the grids are what a block comes to, so they are not three
 * presses from its text. `ComparisonWays` is the way to one from a head — a
 * button where one scope compares, a menu where several do — and
 * `BlockComparisons` draws each under the block's document, read-only, with its
 * *Open the comparison*; where no scope compares yet, the requirements instead.
 */
import { useStrings } from '../../i18n/LanguageContext'
import { Button } from '../../widgets/kit/Button'
import { MenuButton } from '../../widgets/kit/Menu'
import { useBlocks } from './BlocksContext'
import type { BlockRow } from './BlocksContext'
import { EvaluationGrid, RequirementsGrid } from './EvaluationGrid'
import { BallLegend } from './HarveyBall'
import './Blocks.css'

export function ComparisonWays({ row, onOpen }: { row: BlockRow; onOpen: (scope: string) => void }) {
  const access = useBlocks()
  const { t } = useStrings()
  const evaluations = access?.evaluationsOf(row.block.id) ?? []
  const [only] = evaluations
  if (!access || !only) return null
  if (evaluations.length === 1) return <Button onClick={() => onOpen(only.scope)} data-testid="block-to-comparison">{t('blocks.comparisonIn', { scope: access.scopeLabel(only.scope) })}</Button>
  return (
    <MenuButton
      label={t('blocks.whereUsed')} data-testid="block-to-comparison"
      items={evaluations.map((one) => ({ label: access.scopeLabel(one.scope), onSelect: () => onOpen(one.scope) }))}
    />
  )
}

export function BlockComparisons({ row, onOpen, onRequirements }: {
  row: BlockRow
  onOpen: (scope: string) => void
  /** The block's requirements, opened: offered where they are what is drawn. */
  onRequirements?: () => void
}) {
  const access = useBlocks()
  const { t } = useStrings()
  if (!access) return null
  const { block } = row
  const evaluations = access.evaluationsOf(block.id)
  if (evaluations.length === 0) {
    if ((block.capabilities ?? []).length === 0 || (block.contexts ?? []).length === 0) return null
    return (
      <section className="blocks-read" data-testid="block-read-requirements">
        <div className="blocks-read__head">
          <h3>{t('blocks.requirements')}</h3>
          {onRequirements && <Button onClick={onRequirements}>{t('blocks.openRequirements')}</Button>}
        </div>
        <RequirementsGrid block={block} />
      </section>
    )
  }
  return (
    <>
      {evaluations.map(({ scope, evaluation }) => (
        <section className="blocks-read" key={scope} data-testid="block-read-comparison">
          <div className="blocks-read__head">
            <h3>{t('blocks.comparisonIn', { scope: access.scopeLabel(scope) })}</h3>
            <Button onClick={() => onOpen(scope)}>{t('blocks.openComparison')}</Button>
          </div>
          <EvaluationGrid plain block={block} evaluation={evaluation} />
        </section>
      ))}
      <BallLegend />
    </>
  )
}
