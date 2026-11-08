// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A building block's *Where used* (ADR-0043 §4, §7): each scope's evaluation of
 * it, a row each, and *Evaluate for a scope…* — offering to copy the ratings of a
 * scope that evaluated it before, which are the new scope's own from then on. A row
 * opens that evaluation; accepting the decision it proposes writes the choice.
 */
import { useState } from 'react'
import { useStrings } from '../../i18n/LanguageContext'
import { Button } from '../../widgets/kit/Button'
import { Dialog } from '../../widgets/kit/Dialog'
import { SelectField } from '../../widgets/kit/Field'
import { List } from '../../widgets/kit/List'
import { useBlocks } from './BlocksContext'
import type { BlockRow } from './BlocksContext'
import { EvaluationView } from './EvaluationView'
import { scopeOptions } from './scopeOptions'

const rowOf = (scope: string) => `at:${scope}`

export function BlockWhereUsed({ row, evaluating, onEvaluate, onChapter }: {
  row: BlockRow
  /** The scope whose evaluation is open; none, the list. */
  evaluating: string | undefined
  onEvaluate: (scope: string | undefined) => void
  onChapter: (context: string) => void
}) {
  const access = useBlocks()
  const { t } = useStrings()
  const [adding, setAdding] = useState(false)
  if (!access) return null
  if (evaluating !== undefined) return <EvaluationView row={row} scope={evaluating} onBack={() => onEvaluate(undefined)} onChapter={onChapter} />
  const { block } = row
  const evaluations = access.evaluationsOf(block.id)
  const sbbName = (id: string | undefined) => (block.sbbs ?? []).find((one) => one.id === id)?.name
  const rows = evaluations.map(({ scope, evaluation }) => ({
    id: rowOf(scope), text: access.scopeLabel(scope),
    cells: {
      contexts: (block.contexts ?? []).filter((one) => evaluation.contexts.includes(one.id)).map((one) => one.name).join(', ') || '—',
      options: evaluation.options.map(sbbName).filter(Boolean).join(', ') || '—',
      chosen: sbbName(evaluation.chosen) ?? t('blocks.notChosen'),
    },
  }))
  return (
    <>
      <p className="guidance-record__intro">{t('blocks.whereUsedIntro')}</p>
      {evaluations.length === 0 ? <p className="guidance-record__intro">{t('blocks.noEvaluations')}</p> : (
        <div className="guidance-where" data-testid="block-evaluations">
          <List
            label={t('blocks.whereUsed')} itemLabel={t('blocks.colScope')} groups={[{ id: '', label: '', rows }]}
            onOpen={(id) => onEvaluate(evaluations.find((one) => rowOf(one.scope) === id)?.scope)}
            columns={[{ id: 'contexts', label: t('blocks.colContexts') }, { id: 'options', label: t('blocks.colOptions') }, { id: 'chosen', label: t('blocks.colChosen') }]}
          />
        </div>
      )}
      {/* An evaluation is written where it is made: offered only where this person may write. */}
      {access.evaluateChoices(block.id).some((one) => access.mayWrite(one.path)) && (
        <div><Button variant="primary" onClick={() => setAdding(true)} data-testid="block-evaluate">{t('blocks.evaluateFor')}</Button></div>
      )}
      {adding && <EvaluateDialog row={row} onClose={(made) => { setAdding(false); if (made !== undefined) onEvaluate(made) }} />}
    </>
  )
}

/** *Evaluate for a scope…*: the scope that is choosing, the contexts that apply there, and whose ratings to start from. */
function EvaluateDialog({ row, onClose }: { row: BlockRow; onClose: (made?: string) => void }) {
  const access = useBlocks()
  const { t } = useStrings()
  const choices = access?.evaluateChoices(row.block.id).filter((one) => access.mayWrite(one.path)) ?? []
  const before = access?.evaluationsOf(row.block.id) ?? []
  const [scope, setScope] = useState(choices[0]?.path ?? '')
  const [contexts, setContexts] = useState<string[]>([])
  const [copyFrom, setCopyFrom] = useState('')
  const [busy, setBusy] = useState(false)
  if (!access) return null
  const start = () => {
    setBusy(true)
    void access.evaluate(row.block.id, scope, contexts, copyFrom === '' ? undefined : copyFrom).then((made) => onClose(made ? scope : undefined))
  }
  const toggle = (id: string, on: boolean) => setContexts((held) => (on ? [...held, id] : held.filter((one) => one !== id)))
  return (
    <Dialog
      open size="m" title={t('blocks.evaluateFor')} onClose={() => onClose()}
      actions={{
        cancel: { onClick: () => onClose(), label: t('common.cancel') },
        outcome: { disabled: busy || choices.length === 0, onClick: start, 'data-testid': 'evaluate-start', label: t('blocks.evaluateStart') },
      }}
    >
      <p>{t('blocks.evaluateIntro')}</p>
      <SelectField label={t('blocks.colScope')} value={scope} onChange={setScope} options={scopeOptions(choices, t)} data-testid="evaluate-scope" />
      <fieldset className="guidance-record__choices">
        <legend>{t('blocks.contextsHere')}</legend>
        {(row.block.contexts ?? []).map((context) => (
          <label key={context.id}><input type="checkbox" checked={contexts.includes(context.id)} onChange={(event) => toggle(context.id, event.target.checked)} />{context.name}</label>
        ))}
      </fieldset>
      {before.length > 0 && (
        <SelectField
          label={t('blocks.copyFrom')} hint={t('blocks.copyFromHelp')} value={copyFrom} onChange={setCopyFrom}
          options={[{ value: '', label: t('blocks.copyNothing') }, ...before.map((one) => ({ value: one.scope, label: t('blocks.copyRatingsFrom', { scope: access.scopeLabel(one.scope) }) }))]}
        />
      )}
    </Dialog>
  )
}
