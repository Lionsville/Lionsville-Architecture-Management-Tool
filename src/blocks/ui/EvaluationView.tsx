// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * One scope's evaluation of a building block (ADR-0043 §4–§7): the usage contexts
 * that apply there, the options it weighs, the grid with the fit, the option chosen
 * once a decision is accepted, and *Propose a decision…* — a decision kept in that
 * scope that chooses one option, with each option's fit in its body. Every change
 * is a step in that scope, under its rights; the block's own fields are not changed
 * from here. Removing it is rare and waits in More, away from the main act.
 */
import { useState } from 'react'
import { useStrings } from '../../i18n/LanguageContext'
import { percent, ranking } from '../../model/evaluation'
import type { Evaluation } from '../../model/evaluation'
import { Band } from '../../widgets/kit/Band'
import { Button } from '../../widgets/kit/Button'
import { Dialog } from '../../widgets/kit/Dialog'
import { SelectField } from '../../widgets/kit/Field'
import { MoreMenu } from '../../widgets/kit/Menu'
import { useBlocks } from './BlocksContext'
import type { BlockRow } from './BlocksContext'
import { EvaluationGrid } from './EvaluationGrid'

const toggled = (list: readonly string[], item: string) => (list.includes(item) ? list.filter((one) => one !== item) : [...list, item])

/** The ticks a person turns on and off: the contexts that apply here, or the options weighed. */
function Choices({ legend, items, on, onToggle, readOnly, testId }: {
  legend: string; items: readonly { id: string; name: string }[]; on: readonly string[]; onToggle: (id: string) => void; readOnly: boolean; testId: string
}) {
  return (
    <fieldset className="guidance-record__choices">
      <legend>{legend}</legend>
      {items.map((item) => (
        <label key={item.id}>
          <input type="checkbox" checked={on.includes(item.id)} disabled={readOnly} onChange={() => onToggle(item.id)} data-testid={`${testId}-${item.id}`} />
          {item.name}
        </label>
      ))}
    </fieldset>
  )
}

export function EvaluationView({ row, scope, onBack, onChapter }: { row: BlockRow; scope: string; onBack: () => void; onChapter: (context: string) => void }) {
  const access = useBlocks()
  const { t } = useStrings()
  const [proposing, setProposing] = useState(false)
  const [removing, setRemoving] = useState(false)
  const { block } = row
  const evaluation = access?.evaluationsOf(block.id).find((one) => one.scope === scope)?.evaluation
  if (!access || !evaluation) return null
  const may = access.mayWrite(scope)
  const save = (next: Evaluation) => access.updateEvaluation(scope, next)
  const chosen = (block.sbbs ?? []).find((one) => one.id === evaluation.chosen)
  const used = (block.contexts ?? []).filter((one) => evaluation.contexts.includes(one.id))
  return (
    <div className="guidance-record__body" data-testid="evaluation-view">
      <div className="guidance-record__line">
        <button type="button" className="guidance__link" onClick={onBack}>{t('blocks.backToWhereUsed')}</button>
      </div>
      <div className="guidance-record__line">
        <h2 className="guidance-record__title">{t('blocks.evaluationTitle', { block: block.name, scope: access.scopeLabel(scope) })}</h2>
        <span className="guidance-read__spring" />
        {may && <Button variant="primary" disabled={evaluation.options.length === 0 || evaluation.contexts.length === 0} onClick={() => setProposing(true)} data-testid="block-propose">{t('blocks.propose')}</Button>}
        {may && <MoreMenu items={[{ label: t('blocks.removeEvaluation'), final: true, onSelect: () => setRemoving(true) }]} />}
      </div>
      <p className="guidance-record__intro">{t('blocks.evaluationIntro')}</p>
      {chosen && (
        <Band
          tone="info" title={t('blocks.chosenHere', { name: chosen.name })}
          {...(evaluation.decidedBy ? { action: <Button variant="quiet" onClick={() => access.openDecision(scope, evaluation.decidedBy!)}>{t('blocks.openDecision')}</Button> } : {})}
        />
      )}
      <Choices legend={t('blocks.contextsHere')} items={block.contexts ?? []} on={evaluation.contexts} readOnly={!may} testId="evaluation-context" onToggle={(id) => save({ ...evaluation, contexts: toggled(evaluation.contexts, id) })} />
      {used.length > 0 && (
        <div className="guidance-record__line">
          {used.map((one) => <button key={one.id} type="button" className="guidance__link" onClick={() => onChapter(one.id)}>{t('blocks.chapterOf', { name: one.name })}</button>)}
        </div>
      )}
      <Choices
        legend={t('blocks.optionsHere')} items={(block.sbbs ?? []).filter((one) => one.status !== 'retired' || evaluation.options.includes(one.id))} on={evaluation.options}
        readOnly={!may} testId="evaluation-option"
        onToggle={(id) => save({ ...evaluation, options: toggled(evaluation.options, id), ...(evaluation.chosen === id ? { chosen: undefined, decidedBy: undefined } : {}) })}
      />
      {evaluation.contexts.length === 0 && <Band tone="info" title={t('blocks.pickContextFirst')} />}
      <EvaluationGrid block={block} evaluation={evaluation} {...(may ? { onChange: save } : {})} />
      {proposing && <ProposeDialog row={row} scope={scope} evaluation={evaluation} onClose={() => setProposing(false)} />}
      <Dialog
        open={removing} title={t('blocks.removeEvaluationTitle', { scope: access.scopeLabel(scope) })} onClose={() => setRemoving(false)}
        actions={(
          <>
            <Button variant="quiet" onClick={() => setRemoving(false)}>{t('common.cancel')}</Button>
            <Button variant="danger" onClick={() => { setRemoving(false); access.removeEvaluation(scope, evaluation.id); onBack() }}>{t('blocks.remove')}</Button>
          </>
        )}
      >
        <p>{t('blocks.removeEvaluationBody')}</p>
      </Dialog>
    </div>
  )
}

/** The decision one scope's evaluation becomes: the option it chooses, each option's fit, kept in that scope. */
function ProposeDialog({ row, scope, evaluation, onClose }: { row: BlockRow; scope: string; evaluation: Evaluation; onClose: () => void }) {
  const access = useBlocks()
  const { t } = useStrings()
  const ranked = ranking(row.block, evaluation)
  const [option, setOption] = useState(ranked.find((one) => one.fit.failsMust.length === 0)?.sbb.id ?? ranked[0]?.sbb.id ?? '')
  const [made, setMade] = useState<string | undefined>(undefined)
  const [busy, setBusy] = useState(false)
  if (!access) return null
  const fitWords = (fit: (typeof ranked)[number]['fit']) => (fit.failsMust.length ? t('blocks.failsMust') : fit.fit !== undefined ? t('blocks.percent', { value: percent(fit.fit) }) : '—')
  const propose = () => {
    setBusy(true)
    void access.propose(scope, row.block.id, option).then((id) => { setBusy(false); setMade(id) })
  }
  return (
    <Dialog
      open size="m" title={t('blocks.proposeTitle')} onClose={onClose}
      actions={(
        <>
          <Button variant="plain" onClick={onClose}>{made ? t('common.close') : t('common.cancel')}</Button>
          {made
            ? <Button variant="primary" onClick={() => access.openDecision(scope, made)} data-testid="propose-open">{t('blocks.openDecision')}</Button>
            : <Button variant="primary" disabled={busy || !option} onClick={propose} data-testid="propose-submit">{t('blocks.proposeSubmit')}</Button>}
        </>
      )}
    >
      {made ? <p role="status">{t('blocks.proposed')}</p> : (
        <>
          <p>{t('blocks.proposeIntro', { scope: access.scopeLabel(scope) })}</p>
          <SelectField
            label={t('blocks.chooseSbb')} value={option} onChange={setOption} data-testid="propose-option"
            options={ranked.map(({ sbb, fit }) => ({ value: sbb.id, label: `${sbb.name}: ${fitWords(fit)}` }))}
          />
        </>
      )}
    </Dialog>
  )
}
