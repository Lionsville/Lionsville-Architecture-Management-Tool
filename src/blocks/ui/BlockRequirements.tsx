// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A building block's *Requirements* (ADR-0043 §2): one grid, and it is the only
 * list of its capabilities, with *must* and *Remove* on the row, so each thing has
 * one place. A usage context added writes its chapter in the block's document in
 * the same step. Every change is one step in the scope that keeps the block.
 */
import { useState } from 'react'
import { useStrings } from '../../i18n/LanguageContext'
import { withChapters, withoutCapability } from '../../model/buildingBlock'
import type { BlockCapability, UsageContext } from '../../model/types'
import { Button } from '../../widgets/kit/Button'
import { Dialog } from '../../widgets/kit/Dialog'
import { SelectField, TextField } from '../../widgets/kit/Field'
import { MenuButton, MoreMenu } from '../../widgets/kit/Menu'
import { useBlocks } from './BlocksContext'
import type { BlockRow } from './BlocksContext'
import { RequirementsGrid } from './EvaluationGrid'

export function BlockRequirements({ row, onChapter }: { row: BlockRow; onChapter: (context: string) => void }) {
  const access = useBlocks()
  const { t } = useStrings()
  const [adding, setAdding] = useState<'capability' | 'context' | undefined>(undefined)
  if (!access) return null
  const { block } = row
  const may = access.mayWrite(row.scope)
  const capabilities = block.capabilities ?? []
  const contexts = block.contexts ?? []
  const setMust = (one: BlockCapability, must: boolean) => access.update(block.id, {
    capabilities: capabilities.map((held) => {
      if (held.id !== one.id) return held
      const { must: _was, ...rest } = held
      void _was
      return must ? { ...rest, must: true as const } : rest
    }),
  })
  const dropCapability = (id: string) => access.update(block.id, { capabilities: capabilities.filter((one) => one.id !== id), contexts: withoutCapability(contexts, id) })
  const dropContext = (id: string) => access.update(block.id, { contexts: contexts.filter((one) => one.id !== id) })
  const rowEnd = (one: BlockCapability) => (may ? (
    <span className="guidance-record__line">
      <label className="guidance-form__tick">
        <input type="checkbox" checked={one.must === true} onChange={(event) => setMust(one, event.target.checked)} aria-label={t('blocks.mustOf', { name: one.text })} />
        {t('blocks.must')}
      </label>
      <MoreMenu label={t('blocks.moreOf', { name: one.text })} items={[{ label: t('blocks.remove'), final: true, onSelect: () => dropCapability(one.id) }]} />
    </span>
  ) : (one.must ? t('blocks.must') : null))
  return (
    <>
      <p className="guidance-record__intro">{t('blocks.requirementsIntro')}</p>
      {capabilities.length === 0 && contexts.length === 0
        ? <p className="guidance-record__intro">{t('blocks.requirementsEmpty')}</p>
        : <RequirementsGrid block={block} rowEnd={rowEnd} {...(may ? { onChange: (next) => access.update(block.id, next) } : {})} />}
      {contexts.length > 0 && (
        <div className="guidance-record__line">
          <span className="guidance-read__quiet">{t('blocks.usageContexts')}</span>
          {contexts.map((one) => (
            <MenuButton
              key={one.id} label={one.name} variant="quiet" size="small" data-guide={undefined}
              items={[
                { label: t('blocks.chapterOf', { name: one.name }), onSelect: () => onChapter(one.id) },
                ...(may ? [{ label: t('blocks.remove'), final: true, onSelect: () => dropContext(one.id) }] : []),
              ]}
            />
          ))}
        </div>
      )}
      {may && (
        <div className="guidance-record__line">
          <Button variant="plain" onClick={() => setAdding('capability')} data-testid="block-add-capability">{t('blocks.addCapability')}</Button>
          <Button variant="plain" onClick={() => setAdding('context')} data-testid="block-add-context">{t('blocks.addContext')}</Button>
        </div>
      )}
      {adding === 'capability' && <CapabilityDialog row={row} onClose={() => setAdding(undefined)} />}
      {adding === 'context' && <ContextDialog row={row} onClose={() => setAdding(undefined)} />}
    </>
  )
}

function CapabilityDialog({ row, onClose }: { row: BlockRow; onClose: () => void }) {
  const access = useBlocks()
  const { t } = useStrings()
  const [text, setText] = useState('')
  const [must, setMust] = useState(false)
  const [aspect, setAspect] = useState('')
  if (!access) return null
  const aspects = access.aspectChoices(row.scope)
  const add = () => {
    const picked = aspects[Number(aspect)]?.aspect
    const capability: BlockCapability = {
      id: access.makeId('cap'), text: text.trim(), ...(must ? { must: true as const } : {}), ...(aspect !== '' && picked ? { aspect: picked } : {}),
    }
    access.update(row.block.id, { capabilities: [...(row.block.capabilities ?? []), capability] })
    onClose()
  }
  return (
    <Dialog
      open size="m" title={t('blocks.addCapabilityTitle')} onClose={onClose}
      actions={(
        <>
          <Button variant="plain" onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="primary" disabled={!text.trim()} onClick={add} data-testid="capability-add">{t('blocks.add')}</Button>
        </>
      )}
    >
      <TextField autoFocus label={t('blocks.capabilityText')} hint={t('blocks.capabilityHelp')} value={text} onChange={setText} data-testid="capability-text" />
      <label className="guidance-form__tick"><input type="checkbox" checked={must} onChange={(event) => setMust(event.target.checked)} />{t('blocks.mustLabel')}</label>
      <SelectField
        label={t('blocks.aspectField')} value={aspect} onChange={setAspect}
        options={[{ value: '', label: t('blocks.noAspect') }, ...aspects.map((one, index) => ({ value: String(index), label: one.label }))]}
      />
    </Dialog>
  )
}

/** A usage context: a situation in words, with a chapter of its own in the block's document, written in the same step. */
function ContextDialog({ row, onClose }: { row: BlockRow; onClose: () => void }) {
  const access = useBlocks()
  const { t } = useStrings()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  if (!access) return null
  const add = () => {
    const context: UsageContext = { id: access.makeId('cx'), name: name.trim(), ...(description.trim() ? { description: description.trim() } : {}), needs: {} }
    const contexts = [...(row.block.contexts ?? []), context]
    // The chapter goes onto the document the scope keeps: the row is the index's, which carries none.
    access.update(row.block.id, (held) => ({ contexts, description: withChapters(held.description ?? '', [context]) }))
    onClose()
  }
  return (
    <Dialog
      open size="m" title={t('blocks.addContextTitle')} onClose={onClose}
      actions={(
        <>
          <Button variant="plain" onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="primary" disabled={!name.trim()} onClick={add} data-testid="context-add">{t('blocks.add')}</Button>
        </>
      )}
    >
      <p>{t('blocks.contextIntro')}</p>
      <TextField autoFocus label={t('blocks.contextName')} hint={t('blocks.contextNameHelp')} value={name} onChange={setName} data-testid="context-name" />
      <TextField rows={2} label={t('blocks.description')} hint={t('blocks.contextDescriptionHelp')} value={description} onChange={setDescription} />
    </Dialog>
  )
}
