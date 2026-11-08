// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Building blocks (ADR-0043 §8), under Guidance: one line each, grouped by where it
 * is kept, over the whole organisation or the blocks a home keeps or evaluates. A
 * row says what stands out, once. Selecting one opens it large, with its document
 * and its numbers; *Open the building block* is its workbench. *New building block*
 * keeps one in a topic or a scope. A page over the home it was opened from.
 */
import { useEffect, useMemo, useState } from 'react'
import { useStrings } from '../../i18n/LanguageContext'
import { plural } from '../../i18n/strings'
import { MarkdownView } from '../../documentation/ui/MarkdownView'
import { matchesQuery } from '../../model/textSearch'
import type { WindowChrome } from '../../platform/windowChrome'
import { GuidanceEmpty, GuidanceFrame } from '../../principles/ui/GuidanceFrame'
import { Button } from '../../widgets/kit/Button'
import { Dialog } from '../../widgets/kit/Dialog'
import { FilterWords } from '../../widgets/kit/FilterWords'
import { SelectField, TextField } from '../../widgets/kit/Field'
import { List } from '../../widgets/kit/List'
import type { ListGroup } from '../../widgets/kit/List'
import { Preview, PreviewFact } from '../../widgets/kit/Preview'
import { RecordActions } from '../../widgets/kit/RecordActions'
import { PageDialog } from '../../widgets/PageDialog'
import { useBlockDocument } from './BlockAbout'
import { useBlocks } from './BlocksContext'
import type { BlockRow, BlocksAccess } from './BlocksContext'
import { scopeOptions } from './scopeOptions'

/** Where each block is evaluated, the scopes that chose marked ✓. */
function evaluatedIn(access: BlocksAccess, block: string): string {
  return access.evaluationsOf(block).map((one) => `${access.scopeLabel(one.scope)}${one.evaluation.chosen ? ' ✓' : ''}`).join(', ')
}

/** The word on a row: what stands out about this block, where anything does. */
function noteOf(access: BlocksAccess, row: BlockRow, t: ReturnType<typeof useStrings>['t']): string | undefined {
  const evaluations = access.evaluationsOf(row.block.id)
  const chosen = evaluations.filter((one) => one.evaluation.chosen).length
  if (chosen > 0) return plural(t, { one: 'blocks.noteChosenOne', other: 'blocks.noteChosen' }, chosen)
  if (evaluations.length > 0) return plural(t, { one: 'blocks.noteEvaluateOne', other: 'blocks.noteEvaluate' }, evaluations.length)
  const { capabilities, contexts, sbbs } = row.block
  return (capabilities ?? []).length + (contexts ?? []).length + (sbbs ?? []).length === 0 ? t('blocks.noteNothing') : undefined
}

function BlockPreview({ access, row, ids, onSelect }: { access: BlocksAccess; row: BlockRow; ids: readonly string[]; onSelect: (id: string | null) => void }) {
  const { t } = useStrings()
  const { block, scope } = row
  const document = useBlockDocument(block.id)
  return (
    <Preview
      ids={ids} currentId={block.id} onSelect={onSelect} title={block.name} listWord={t('blocks.listWord')}
      openFull={{ onPress: () => { onSelect(null); access.openBlock(block.id) } }}
      actions={<RecordActions more={[{ label: t('blocks.openIn', { scope: access.scopeLabel(scope) }), onSelect: () => { onSelect(null); access.openScope(scope) } }]} />}
      facts={(
        <>
          <PreviewFact label={t('blocks.colKeptIn')}>{access.scopeLabel(scope)}</PreviewFact>
          <PreviewFact label={t('blocks.capabilities')}>{(block.capabilities ?? []).length}</PreviewFact>
          <PreviewFact label={t('blocks.usageContexts')}>{(block.contexts ?? []).map((one) => one.name).join(', ') || '—'}</PreviewFact>
          <PreviewFact label={t('blocks.solutions')}>{(block.sbbs ?? []).map((one) => one.name).join(', ') || '—'}</PreviewFact>
          <PreviewFact label={t('blocks.colEvaluatedIn')}>{evaluatedIn(access, block.id) || t('blocks.notEvaluated')}</PreviewFact>
        </>
      )}
    >
      {document.text === undefined ? null
        : document.text.trim() ? <MarkdownView markdown={document.text} /> : <p className="guidance-read__empty">{t('blocks.documentEmpty')}</p>}
    </Preview>
  )
}

export function BlocksRegisterPage({ open, at, select, onClose, windowChrome }: {
  open: boolean
  /** The home it was opened over: the organisation lists every block, a scope those it keeps or evaluates. */
  at: string
  /** A block to read large as the page opens. */
  select?: string
  onClose: () => void
  windowChrome: WindowChrome
}) {
  const access = useBlocks()
  const { t } = useStrings()
  const [find, setFind] = useState('')
  const [making, setMaking] = useState(false)
  const [picked, setPicked] = useState<string | null>(select ?? null)
  useEffect(() => { if (open && select) setPicked(select) }, [open, select])
  const version = access?.version ?? 0
  const every = useMemo(() => {
    if (!access) return []
    if (at === '') return access.blocks()
    const held = access.blocksAt(at)
    return [...held.kept, ...held.evaluated]
    // The version says the tree was read again.
  }, [access, version, at])
  if (!access) return null
  const rows = every.filter((one) => matchesQuery(find, [one.block.name, one.block.description ?? '', ...(one.block.sbbs ?? []).map((sbb) => sbb.name)]))
  const groups = new Map<string, ListGroup & { rows: ListGroup['rows'][number][] }>()
  for (const row of rows) {
    const group = groups.get(row.scope) ?? { id: row.scope || '-', label: t('blocks.keptInScope', { scope: access.scopeLabel(row.scope) }), rows: [] }
    const note = noteOf(access, row, t)
    group.rows.push({ id: row.block.id, text: row.block.name, ...(note ? { note } : {}) })
    groups.set(row.scope, group)
  }
  const drawn = [...groups.values()]
  const current = picked !== null ? access.block(picked) : undefined
  const mayMake = access.placeChoices().some((one) => access.mayWrite(one.path))
  const newOne = mayMake ? { label: t('blocks.new'), onPress: () => setMaking(true), dataGuide: 'blocks.new' } : undefined
  return (
    <PageDialog open={open} topInset={windowChrome.topInset} onClose={onClose} aria-label={t('blocks.registerTitle')}>
      <GuidanceFrame tab="blocks">
        {every.length === 0 ? <div className="guidance__body"><GuidanceEmpty tab="blocks" {...(newOne ? { action: newOne } : {})} /></div> : (
          <>
            <div className="guidance__bar">
              <FilterWords
                find={find} onFind={setFind} findLabel={t('blocks.search')} shown={{ count: rows.length, total: every.length }}
                actions={mayMake && <Button variant="primary" onClick={() => setMaking(true)} data-testid="blocks-new" data-guide="blocks.new">{t('blocks.new')}</Button>}
              />
            </div>
            <div className="guidance__list" data-testid="blocks-register">
              <List
                label={t('blocks.registerTitle')} groups={drawn} selectedId={current?.block.id ?? null} onOpen={setPicked}
                empty={<p className="guidance__note" role="status">{t('blocks.searchEmpty', { query: find })}</p>}
              />
            </div>
          </>
        )}
      </GuidanceFrame>
      {current && <BlockPreview access={access} row={current} ids={drawn.flatMap((group) => group.rows.map((one) => one.id))} onSelect={setPicked} />}
      {making && <NewBlockDialog access={access} at={at} onClose={() => setMaking(false)} />}
    </PageDialog>
  )
}

/** A new building block: its name and where it is kept, a topic first. */
function NewBlockDialog({ access, at, onClose }: { access: BlocksAccess; at: string; onClose: () => void }) {
  const { t } = useStrings()
  const places = access.placeChoices().filter((one) => access.mayWrite(one.path))
  const [name, setName] = useState('')
  // Over a scope's home, that scope; over the organisation's, the first topic — what a block is usually kept in.
  const [place, setPlace] = useState((at !== '' ? places.find((one) => one.path === at)?.path : undefined) ?? places[0]?.path ?? '')
  const [busy, setBusy] = useState(false)
  const make = () => {
    setBusy(true)
    void access.create(place, name).then((id) => { onClose(); if (id) access.openBlock(id) })
  }
  return (
    <Dialog
      open size="m" title={t('blocks.new')} onClose={onClose}
      actions={{
        cancel: { onClick: onClose, label: t('common.cancel') },
        outcome: { disabled: busy || !name.trim() || places.length === 0, onClick: make, 'data-testid': 'block-create', label: t('blocks.create') },
      }}
    >
      <TextField autoFocus label={t('blocks.name')} value={name} onChange={setName} data-testid="block-name" />
      <SelectField label={t('blocks.colKeptIn')} hint={t('blocks.keptInHelp')} value={place} onChange={setPlace} options={scopeOptions(places, t)} />
    </Dialog>
  )
}
