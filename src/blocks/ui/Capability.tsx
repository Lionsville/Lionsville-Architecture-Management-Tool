// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * One capability of a building block, read beside its grid and written in a full
 * window (ADR-0043 §2, amended 24 November 2026). A row of a grid is a line; what
 * the line asks for — why, how it is judged, its pictures — is a chapter of the
 * block's document under the capability's own words (`model/blockChapters`), so
 * pressing the line's name opens the panel with that chapter, the principle's
 * aspect it delivers, how much each use needs it and, from a comparison, how far
 * each option covers it. ✎ Edit writes the line and its chapter as one step in
 * the scope that keeps the block.
 */
import { useEffect, useState } from 'react'
import { useStrings } from '../../i18n/LanguageContext'
import { chapterBody, requirementHeading, withCapability } from '../../model/blockChapters'
import type { CapabilityEdit } from '../../model/blockChapters'
import type { Evaluation } from '../../model/evaluation'
import type { BlockCapability } from '../../model/types'
import { MarkdownEditor } from '../../documentation/ui/MarkdownEditor'
import { MarkdownView } from '../../documentation/ui/MarkdownView'
import { SelectField, TextField } from '../../widgets/kit/Field'
import { FocusedWindow, useWritingView } from '../../widgets/kit/FocusedWindow'
import { Panel, PanelLink, PanelSection } from '../../widgets/kit/Panel'
import { RecordActions } from '../../widgets/kit/RecordActions'
import type { BlockDocument } from './BlockAbout'
import { useBlocks } from './BlocksContext'
import type { BlockRow } from './BlocksContext'
import { COVER_WORD, NEED_WORD } from './EvaluationGrid'
import { BallFigure } from './HarveyBall'
import { readComparison } from './comparisonReading'
import './Blocks.css'

/** The heading the capabilities' chapters stand under in the block's document: the tab's own word, in the language it is written in. */
function useUnder(): string {
  const { t } = useStrings()
  return `## ${t('blocks.requirements')}`
}

/** A capability's edit landed: one step where the block is kept, and shown at once on the document the page holds. */
function useCapabilityWrite(row: BlockRow, document: BlockDocument) {
  const access = useBlocks()
  const under = useUnder()
  return (id: string, edit: CapabilityEdit) => {
    if (!access) return
    access.update(row.block.id, (held) => withCapability(held, id, edit, under))
    if (document.text === undefined) return
    const shown = withCapability({ capabilities: row.block.capabilities ?? [], description: document.text }, id, edit, under).description
    if (shown !== undefined) document.wrote(shown)
  }
}

export function CapabilityPanel({ row, capability, document, comparison, onEdit, onRemove, onClose }: {
  row: BlockRow
  capability: BlockCapability
  document: BlockDocument
  /** The comparison it was opened from: how far each of its options covers this. */
  comparison?: { readonly scope: string; readonly evaluation: Evaluation } | undefined
  onEdit: () => void
  onRemove: () => void
  onClose: () => void
}) {
  const access = useBlocks()
  const { t } = useStrings()
  const write = useCapabilityWrite(row, document)
  if (!access) return null
  const { block } = row
  const may = access.mayWrite(row.scope)
  const body = document.text === undefined ? undefined : chapterBody(document.text, requirementHeading(capability)) ?? ''
  const aspect = capability.aspect ? access.aspectLabel(capability.aspect) : undefined
  const contexts = block.contexts ?? []
  const cells = comparison ? readComparison(block, comparison.evaluation) : undefined
  const reading = cells?.capabilities.find((one) => one.capability.id === capability.id)
  const rename = (text: string) => {
    if (!text.trim()) return t('blocks.capabilityNeedsWords')
    write(capability.id, { text, must: capability.must === true, aspect: capability.aspect })
    return undefined
  }
  return (
    <Panel
      wide kind={t('blocks.capability')} name={capability.text} nameOf={capability.id} onClose={onClose}
      {...(may ? { onRename: rename } : {})}
      {...(capability.must ? { facts: t('blocks.mustLabel') } : {})}
      actions={may ? (
        <RecordActions
          edit={{ onPress: onEdit, testId: 'capability-edit' }}
          more={[{ label: t('blocks.remove'), final: true, onSelect: onRemove }]} moreLabel={t('blocks.moreOf', { name: capability.text })}
        />
      ) : undefined}
    >
      <PanelSection title={t('blocks.description')}>
        <div className="blocks-chapter" data-testid="capability-chapter">
          {body === undefined ? null : body
            ? <MarkdownView markdown={body} />
            : <p className="guidance-read__empty">{t('blocks.capabilityEmpty')}</p>}
        </div>
        {may && body === '' && <PanelLink onPress={onEdit} data-testid="capability-write">{t('blocks.capabilityWrite')}</PanelLink>}
      </PanelSection>
      {aspect && (
        <PanelSection title={t('blocks.aspectField')}>
          <p className="blocks-panelLine" title={aspect.title}>{aspect.label}</p>
        </PanelSection>
      )}
      {contexts.length > 0 && (
        <PanelSection title={t('blocks.capabilityNeeds')}>
          {contexts.map((one) => {
            const level = one.needs[capability.id] ?? 0
            return (
              <div className="guidance-read__line" key={one.id}>
                <span className="guidance-read__grow">{one.name}</span>
                <BallFigure level={level} quiet />
                <span className="guidance-read__quiet">{t(NEED_WORD[level])}</span>
              </div>
            )
          })}
        </PanelSection>
      )}
      {cells && reading && cells.options.length > 0 && (
        <PanelSection title={t('blocks.capabilityCovers', { scope: comparison ? access.scopeLabel(comparison.scope) : '' })}>
          {cells.options.map((option) => {
            const cell = reading.cells[option.sbb.id]
            if (!cell) return null
            return (
              <div className="guidance-read__line" key={option.sbb.id}>
                <span className="guidance-read__grow">{option.sbb.name}</span>
                <BallFigure level={cell.level} />
                <span className="guidance-read__quiet">
                  {[t(COVER_WORD[cell.level]), cell.short > 0 ? t('blocks.shortBy', { count: cell.short }) : ''].filter(Boolean).join(', ')}
                </span>
                {cell.how && <span className="blocks-panelNote">{cell.how}</span>}
              </div>
            )
          })}
        </PanelSection>
      )}
    </Panel>
  )
}

const sameAspect = (a: BlockCapability['aspect'], b: BlockCapability['aspect']) => a?.scope === b?.scope && a?.id === b?.id && a?.number === b?.number

/**
 * A capability written in the full window: its words, whether it is a must, the
 * aspect it delivers, and its chapter. Save is one step; nothing is started
 * before the document is read, since a chapter drafted from nothing would be
 * saved over the one it has.
 */
export function CapabilityEditor({ row, capability, document, onDone }: {
  row: BlockRow
  capability: BlockCapability | undefined
  document: BlockDocument
  onDone: () => void
}) {
  const access = useBlocks()
  const { t } = useStrings()
  const write = useCapabilityWrite(row, document)
  const { view, views } = useWritingView()
  const [draft, setDraft] = useState<{ id: string; text: string; must: boolean; aspect: string; body: string; kept: string } | undefined>(undefined)
  const aspects = access?.aspectChoices(row.scope) ?? []
  const id = capability?.id
  const ready = document.text !== undefined
  useEffect(() => {
    if (!capability || document.text === undefined) { if (!capability) setDraft(undefined); return }
    setDraft((held) => {
      if (held?.id === capability.id) return held
      const body = chapterBody(document.text ?? '', requirementHeading(capability)) ?? ''
      const at = aspects.findIndex((one) => sameAspect(one.aspect, capability.aspect))
      return { id: capability.id, text: capability.text, must: capability.must === true, aspect: at < 0 ? '' : String(at), body, kept: body }
    })
    // Started once per capability, when its document is there: the choices are read as they stand then.
  }, [id, ready])
  if (!access || !capability || !draft) return null
  // An aspect the choices no longer offer stays as it is unless another is picked.
  const picked = draft.aspect === '' ? undefined : aspects[Number(draft.aspect)]?.aspect
  const wasAt = aspects.findIndex((one) => sameAspect(one.aspect, capability.aspect))
  const aspect = draft.aspect === '' && wasAt < 0 && capability.aspect ? capability.aspect : picked
  const changed = draft.text.trim() !== capability.text || draft.must !== (capability.must === true) || !sameAspect(aspect, capability.aspect) || draft.body !== draft.kept
  const keep = () => {
    if (changed) write(capability.id, { text: draft.text, must: draft.must, aspect, ...(draft.body !== draft.kept ? { body: draft.body } : {}) })
    onDone()
  }
  const set = (patch: Partial<typeof draft>) => setDraft({ ...draft, ...patch })
  return (
    <FocusedWindow
      open title={t('blocks.editingCapability')} views={views} changed={changed} onSave={keep} onCancel={onDone}
      {...(draft.text.trim() ? {} : { saveRefused: t('blocks.capabilityNeedsWords') })}
    >
      <div className="blocks-capabilityEdit">
        <div className="blocks-capabilityEdit__line">
          <TextField autoFocus label={t('blocks.capabilityText')} value={draft.text} onChange={(text) => set({ text })} data-testid="capability-edit-text" />
          <SelectField
            label={t('blocks.aspectField')} value={draft.aspect} onChange={(next) => set({ aspect: next })}
            options={[{ value: '', label: wasAt < 0 && capability.aspect ? access.aspectLabel(capability.aspect)?.label ?? t('blocks.noAspect') : t('blocks.noAspect') }, ...aspects.map((one, index) => ({ value: String(index), label: one.label }))]}
          />
        </div>
        <label className="guidance-form__tick"><input type="checkbox" checked={draft.must} onChange={(event) => set({ must: event.target.checked })} data-testid="capability-edit-must" />{t('blocks.mustLabel')}</label>
        <div className="guidance-form__edit">
          <MarkdownEditor variant="pane" value={draft.body} onChange={(body) => set({ body })} label={t('blocks.capabilityDocument')} shownAs={view} renderPreview={(text) => <MarkdownView markdown={text} />} />
        </div>
      </div>
    </FocusedWindow>
  )
}
