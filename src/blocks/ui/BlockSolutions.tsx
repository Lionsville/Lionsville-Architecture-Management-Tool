// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A building block's *Options* (ADR-0043 §3; `sbbs` and *solution* in the model and
 * to an agent): the catalogue of what could deliver it — a product, a service,
 * something built in house — never how well, which each scope says for itself.
 * *Solution* on screen means a remedy for a cause, under Observations, so these are
 * options. A line says where each is weighed and chosen, and which landscape
 * elements are it; its status and elements are changed in the row.
 */
import { useState } from 'react'
import Autocomplete from '@mui/material/Autocomplete'
import { FieldBox } from '../../widgets/kit/FieldBox'
import type { StringKey } from '../../i18n'
import { useStrings } from '../../i18n/LanguageContext'
import { SOLUTION_SORTS, SOLUTION_STATUSES } from '../../model/buildingBlock'
import type { SolutionBlock, SolutionBlockStatus, SolutionSort } from '../../model/types'
import { Button } from '../../widgets/kit/Button'
import { Dialog } from '../../widgets/kit/Dialog'
import { Select, SelectField, TextField } from '../../widgets/kit/Field'
import { List } from '../../widgets/kit/List'
import { useBlocks } from './BlocksContext'
import { SORT_WORD } from './EvaluationGrid'
import type { BlockRow } from './BlocksContext'

export const STATUS_WORD: Record<SolutionBlockStatus, StringKey> = {
  candidate: 'blocks.statusCandidate', evaluated: 'blocks.statusEvaluated', inUse: 'blocks.statusInUse', retired: 'blocks.statusRetired',
}

export function BlockSolutions({ row }: { row: BlockRow }) {
  const access = useBlocks()
  const { t } = useStrings()
  const [adding, setAdding] = useState(false)
  const [linking, setLinking] = useState<SolutionBlock | undefined>(undefined)
  if (!access) return null
  const sbbs = row.block.sbbs ?? []
  const may = access.mayWrite(row.scope)
  const evaluations = access.evaluationsOf(row.block.id)
  const setStatus = (id: string, status: SolutionBlockStatus) => access.update(row.block.id, { sbbs: sbbs.map((one) => (one.id === id ? { ...one, status } : one)) })
  const rows = sbbs.map((sbb) => {
    const weighed = evaluations.filter((one) => one.evaluation.options.includes(sbb.id)).map((one) => access.scopeLabel(one.scope))
    const chosen = evaluations.filter((one) => one.evaluation.chosen === sbb.id).map((one) => access.scopeLabel(one.scope))
    const elements = (sbb.elements ?? []).map((id) => access.elementName(id)).join(', ')
    return {
      id: sbb.id, text: sbb.name,
      cells: {
        supplier: sbb.supplier ?? '—',
        sort: t(SORT_WORD[sbb.sort]),
        status: may
          ? <Select value={sbb.status} aria-label={t('blocks.statusOf', { name: sbb.name })} onChange={(value) => setStatus(sbb.id, value as SolutionBlockStatus)} options={SOLUTION_STATUSES.map((one) => ({ value: one, label: t(STATUS_WORD[one]) }))} />
          : t(STATUS_WORD[sbb.status]),
        weighed: weighed.join(', ') || '—',
        chosen: chosen.join(', ') || '—',
        elements: may
          ? <Button variant="quiet" size="small" onClick={() => setLinking(sbb)} aria-label={t('blocks.elementsOf', { name: sbb.name })}>{elements || t('blocks.linkElement')}</Button>
          : elements || '—',
      },
    }
  })
  return (
    <>
      <p className="guidance-record__intro">{t('blocks.solutionsIntro')}</p>
      {sbbs.length === 0 ? <p className="guidance-record__intro">{t('blocks.solutionsEmpty')}</p> : (
        <div data-testid="block-solutions">
          <List
            label={t('blocks.solutions')} itemLabel={t('blocks.name')} groups={[{ id: '', label: '', rows }]}
            columns={[
              { id: 'supplier', label: t('blocks.supplier') }, { id: 'sort', label: t('blocks.sort') }, { id: 'status', label: t('blocks.status') },
              { id: 'weighed', label: t('blocks.weighedIn') }, { id: 'chosen', label: t('blocks.chosenIn') }, { id: 'elements', label: t('blocks.isElement') },
            ]}
          />
        </div>
      )}
      {may && <div><Button variant="plain" onClick={() => setAdding(true)} data-testid="block-add-sbb">{t('blocks.addSbb')}</Button></div>}
      {adding && <SolutionDialog row={row} onClose={() => setAdding(false)} />}
      {linking && <ElementsDialog row={row} sbb={linking} onClose={() => setLinking(undefined)} />}
    </>
  )
}

/** The landscape elements an option is, linked: what a chosen one with none yet is given (§8). */
function ElementsDialog({ row, sbb, onClose }: { row: BlockRow; sbb: SolutionBlock; onClose: () => void }) {
  const access = useBlocks()
  const { t } = useStrings()
  const choices = (access?.elementChoices() ?? []) as { id: string; name: string }[]
  const [value, setValue] = useState(() => (sbb.elements ?? []).map((id) => choices.find((one) => one.id === id) ?? { id, name: access?.elementName(id) ?? id }))
  if (!access) return null
  const save = () => {
    access.update(row.block.id, {
      sbbs: (row.block.sbbs ?? []).map((one) => {
        if (one.id !== sbb.id) return one
        const { elements: _was, ...rest } = one
        void _was
        return value.length ? { ...rest, elements: value.map((held) => held.id) } : rest
      }),
    })
    onClose()
  }
  return (
    <Dialog
      open size="m" title={t('blocks.elementsOf', { name: sbb.name })} onClose={onClose}
      actions={(
        <>
          <Button variant="plain" onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="primary" onClick={save} data-testid="sbb-elements-save">{t('blocks.save')}</Button>
        </>
      )}
    >
      <Autocomplete
        multiple options={choices} value={value} onChange={(_event, next) => setValue(next)}
        getOptionLabel={(one) => one.name} isOptionEqualToValue={(a, b) => a.id === b.id}
        renderInput={(params) => <FieldBox {...params} autoFocus label={t('blocks.isElement')} helperText={t('blocks.isElementHelp')} />}
      />
    </Dialog>
  )
}

/** A new option in the catalogue; the elements that are it, where there are any yet. */
export function SolutionDialog({ row, onClose }: { row: BlockRow; onClose: (made?: string) => void }) {
  const access = useBlocks()
  const { t } = useStrings()
  const [name, setName] = useState('')
  const [supplier, setSupplier] = useState('')
  const [sort, setSort] = useState<SolutionSort>('product')
  const [elements, setElements] = useState<{ id: string; name: string }[]>([])
  if (!access) return null
  const add = () => {
    const sbb: SolutionBlock = {
      id: access.makeId('sb'), name: name.trim(), ...(supplier.trim() ? { supplier: supplier.trim() } : {}), sort, status: 'candidate',
      ...(elements.length ? { elements: elements.map((one) => one.id) } : {}),
    }
    access.update(row.block.id, { sbbs: [...(row.block.sbbs ?? []), sbb] })
    onClose(sbb.id)
  }
  return (
    <Dialog
      open size="m" title={t('blocks.addSbbTitle')} onClose={() => onClose()}
      actions={(
        <>
          <Button variant="plain" onClick={() => onClose()}>{t('common.cancel')}</Button>
          <Button variant="primary" disabled={!name.trim()} onClick={add} data-testid="sbb-add">{t('blocks.add')}</Button>
        </>
      )}
    >
      <TextField autoFocus label={t('blocks.name')} value={name} onChange={setName} data-testid="sbb-name" />
      <TextField label={t('blocks.supplier')} value={supplier} onChange={setSupplier} />
      <SelectField label={t('blocks.sort')} value={sort} onChange={(next) => setSort(next as SolutionSort)} options={SOLUTION_SORTS.map((one) => ({ value: one, label: t(SORT_WORD[one]) }))} />
      <Autocomplete
        multiple options={access.elementChoices() as { id: string; name: string }[]} value={elements} onChange={(_event, next) => setElements(next)}
        getOptionLabel={(one) => one.name} isOptionEqualToValue={(a, b) => a.id === b.id}
        renderInput={(params) => <FieldBox {...params} label={t('blocks.isElement')} helperText={t('blocks.isElementHelp')} />}
      />
    </Dialog>
  )
}
