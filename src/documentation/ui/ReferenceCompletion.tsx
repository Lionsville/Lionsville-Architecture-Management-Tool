// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Referring while typing (ADR-0043): `[[` or a lone `@` opens a list at the
 * caret of what the document may refer to — views, elements, principles,
 * evaluations, decisions, observations — narrowed by the words typed
 * after it. ↑ and ↓
 * move, Enter or Tab puts the reference in, Escape closes. An element goes
 * in as `[[Name]]`, a view as a picture, and the rest as a `ref` fence on
 * lines of its own. The Insert menu offers the same catalogue by kind. `/` at
 * the start of a line opens the same list with the blocks above it.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent, RefObject } from 'react'
import Box from '@mui/material/Box'
import ListItemButton from '@mui/material/ListItemButton'
import Divider from '@mui/material/Divider'
import { SurfacePopper as Popper } from '../../widgets/kit/Surface'
import Paper from '@mui/material/Paper'
import { AutocompleteBox, FieldBox } from '../../widgets/kit/FieldBox'
import { Dialog } from '../../widgets/kit/Dialog'
import { MenuButton } from '../../widgets/kit/Menu'
import type { MenuEntry } from '../../widgets/kit/Menu'
import Typography from '@mui/material/Typography'
import { useStrings } from '../../i18n/LanguageContext'
import type { StringKey } from '../../i18n'
import { completionAt, findReferables, insertReferable, REFERABLE_KINDS } from '../references'
import type { Referable, ReferableKind } from '../references'
import { slashAt } from '../markdownEditing'
import type { Edit, Selected } from '../markdownEditing'
import { matchesQuery } from '../../model/textSearch'
import { useReferences } from './References'

export const KIND_WORD: Record<ReferableKind, StringKey> = {
  view: 'doc.refKindView',
  element: 'doc.refKindElement',
  principle: 'doc.refKindPrinciple',
  evaluation: 'doc.refKindEvaluation',
  decision: 'doc.refKindDecision',
  observation: 'doc.refKindObservation',
}

const MENU_WORD: Record<ReferableKind, StringKey> = {
  view: 'doc.insertView',
  element: 'doc.insertElement',
  principle: 'doc.insertPrinciple',
  evaluation: 'doc.insertEvaluation',
  decision: 'doc.insertDecision',
  observation: 'doc.insertObservation',
}

/** Where the caret is in a textarea, in the page's pixels: a mirror of the text up to it, measured. */
export function caretRect(area: HTMLTextAreaElement, index: number): DOMRect {
  const style = window.getComputedStyle(area)
  const mirror = document.createElement('div')
  for (const name of ['font', 'letterSpacing', 'lineHeight', 'padding', 'border', 'boxSizing', 'whiteSpace', 'wordWrap', 'tabSize', 'width'] as const) {
    mirror.style[name] = style[name]
  }
  mirror.style.position = 'absolute'
  mirror.style.visibility = 'hidden'
  mirror.style.whiteSpace = 'pre-wrap'
  mirror.style.overflowWrap = 'break-word'
  mirror.textContent = area.value.slice(0, index)
  const mark = document.createElement('span')
  mark.textContent = '​'
  mirror.appendChild(mark)
  document.body.appendChild(mirror)
  const box = area.getBoundingClientRect()
  const top = box.top + mark.offsetTop - area.scrollTop
  const left = box.left + mark.offsetLeft - area.scrollLeft
  const height = parseFloat(style.lineHeight) || 20
  document.body.removeChild(mirror)
  return new DOMRect(left, top, 1, height)
}

export type Completion = {
  /** Read on every key the textarea handles first: true where the completion took it. */
  onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>): boolean
  /** A reference put in at the caret, from *Insert ▾*: a block on lines of its own. */
  insert(referable: Referable): void
  /** Read after every change of the text or the caret. */
  onInput(): void
  popper: React.ReactNode
}

/** What `/` offers beside the references: a block of markdown, a picture, a file, a section of the template. */
export type SlashBlock = {
  key: string
  label: string
  /** Do it, with what the `/` and the word after it occupy selected: they go with it. */
  run(typed: Selected): void
}

/** One row of the list, whichever way it opened. */
type Row = { id: string; word: string; label: string; detail?: string; put(start: number, end: number): void }

export function useReferenceCompletion(
  areaRef: RefObject<HTMLTextAreaElement | null>,
  apply: (edit: Edit) => void,
  blocks: readonly SlashBlock[] = [],
): Completion {
  const access = useReferences()
  const { t } = useStrings()
  const [open, setOpen] = useState<{ start: number; query: string; slash: boolean; anchor: DOMRect } | undefined>(undefined)
  const [active, setActive] = useState(0)
  const isOpen = open !== undefined
  const all = useMemo(() => (isOpen && access ? access.referables() : []), [isOpen, access])

  const putReferable = useCallback((referable: Referable, start: number, end: number) => {
    const area = areaRef.current
    if (!area) return
    const next = insertReferable(area.value, start, end, referable)
    apply({ text: next.text, start: next.caret, end: next.caret })
  }, [areaRef, apply])

  const rows = useMemo<Row[]>(() => {
    if (!open) return []
    const references = findReferables(all, open.query, 8).map((one): Row => ({
      id: `${one.kind}/${one.key}`, word: t(KIND_WORD[one.kind]), label: one.label, detail: one.detail,
      put: (start, end) => putReferable(one, start, end),
    }))
    if (!open.slash) return references
    const found = blocks.filter((one) => matchesQuery(open.query, [one.label, one.key])).map((one): Row => ({
      id: `block/${one.key}`, word: t('md.slashBlock'), label: one.label,
      put: (start, end) => {
        const text = areaRef.current?.value
        if (text !== undefined) one.run({ text, start, end })
      },
    }))
    return [...found, ...references]
  }, [open, all, blocks, t, putReferable, areaRef])
  useEffect(() => { setActive(0) }, [open?.query])

  // Until a person has put the caret somewhere, Insert adds at the end, not before the first word.
  const caretPlaced = useRef(false)
  const onInput = useCallback(() => {
    const area = areaRef.current
    if (!area) return
    caretPlaced.current = true
    const caret = area.selectionStart
    if (area.selectionStart !== area.selectionEnd) { setOpen(undefined); return }
    const slash = blocks.length > 0 ? slashAt(area.value, caret) : undefined
    if (slash) { setOpen({ start: slash.start, query: slash.query, slash: true, anchor: caretRect(area, slash.start) }); return }
    const at = access ? completionAt(area.value, caret) : undefined
    setOpen(at ? { start: at.start, query: at.query, slash: false, anchor: caretRect(area, at.start) } : undefined)
  }, [areaRef, access, blocks])

  const choose = useCallback((row: Row) => {
    const area = areaRef.current
    if (!area || !open) return
    row.put(open.start, area.selectionStart)
    setOpen(undefined)
  }, [areaRef, open])

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): boolean => {
    if (!open || rows.length === 0) return false
    if (event.key === 'ArrowDown') { event.preventDefault(); setActive((at) => (at + 1) % rows.length); return true }
    if (event.key === 'ArrowUp') { event.preventDefault(); setActive((at) => (at - 1 + rows.length) % rows.length); return true }
    if (event.key === 'Enter' || event.key === 'Tab') { event.preventDefault(); choose(rows[active]!); return true }
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setOpen(undefined); return true }
    return false
  }

  const anchorEl = useMemo(() => (open ? { getBoundingClientRect: () => open.anchor } : null), [open])
  const popper = (
    <Popper open={Boolean(open) && rows.length > 0} anchorEl={anchorEl} placement="bottom-start" sx={{ zIndex: 1500 }}>
      <Paper elevation={6} sx={{ width: 440, maxWidth: 'calc(100vw - 32px)', maxHeight: 320, overflow: 'auto', py: 0.5 }} data-testid="reference-completion" role="listbox" aria-label={t(open?.slash ? 'md.slashList' : 'doc.refCompletion')}>
        {rows.map((one, index) => (
          <ListItemButton
            key={one.id} selected={index === active} role="option" aria-selected={index === active}
            // Chosen on the click, not on the press: the list goes when it is chosen, and the rest of the press would land on what is under it.
            onMouseDown={(event) => event.preventDefault()} onClick={() => choose(one)}
            sx={{ py: 0.25, px: 1.5, gap: 1, alignItems: 'baseline' }}
          >
            <Typography sx={{ fontSize: 'var(--t-small)', color: 'text.secondary', flex: '0 0 8.5em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textTransform: 'uppercase', letterSpacing: '.04em' }}>{one.word}</Typography>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography noWrap sx={{ fontSize: 'var(--t-body)' }}>{one.label}</Typography>
              {one.detail && <Typography noWrap sx={{ fontSize: 'var(--t-small)', color: 'text.secondary' }}>{one.detail}</Typography>}
            </Box>
          </ListItemButton>
        ))}
        <Divider />
        <Typography sx={{ fontSize: 'var(--t-small)', color: 'text.secondary', px: 1.5, py: 0.5 }}>{t('doc.refCompletionHint')}</Typography>
      </Paper>
    </Popper>
  )
  const insert = useCallback((referable: Referable) => {
    const area = areaRef.current
    if (!area) return
    if (caretPlaced.current) putReferable(referable, area.selectionStart, area.selectionEnd)
    else putReferable(referable, area.value.length, area.value.length)
  }, [areaRef, putReferable])
  return { onKeyDown, onInput, insert, popper }
}

/**
 * *Insert* (ADR-0043 §9): what is added to the text itself — a picture, a file, a
 * business case, the record's template and its sections — under one heading, and
 * each kind of thing a document may refer to, picked by name, under another.
 */
export function InsertMenu({ onPicture, onAttach, onBusinessCase, onInsert, more = [], writing }: {
  onPicture?: () => void
  /** Offered only where the source keeps attachments. */
  onAttach?: () => void
  onBusinessCase: () => void
  onInsert: (referable: Referable) => void
  /** What this record has of its own to put in: its template, and the sections of it the text lacks. */
  more?: readonly { key: string; label: string; onPick(): void }[]
  /** The box being written in: where the focus goes back once a link is picked, or the picking let go of, so the next letter lands in the text. */
  writing?: () => HTMLElement | null | undefined
}) {
  const access = useReferences()
  const { t } = useStrings()
  const [picking, setPicking] = useState<ReferableKind | undefined>(undefined)
  // Read when the menu is drawn: a list of kinds nobody can refer to is no list.
  const all = access?.referables() ?? []
  const kinds = REFERABLE_KINDS.filter((kind) => all.some((one) => one.kind === kind))
  // After the dialog has gone and handed the focus back to Insert: the caret is where the link was put.
  const backToWriting = () => { setTimeout(() => { const box = writing?.(); if (box?.isConnected) box.focus() }, 0) }
  const items: MenuEntry[] = [
    { heading: t('doc.insertGroupText') },
    ...(onPicture ? [{ label: t('doc.insertPictureMenu'), onSelect: onPicture }] : []),
    ...(onAttach ? [{ label: t('md.attachMenu'), onSelect: onAttach, 'data-testid': 'doc-insert-attachment' }] : []),
    { label: t('doc.insertBusinessCase'), onSelect: onBusinessCase },
    ...more.map((one) => ({ label: one.label, onSelect: () => one.onPick() })),
    ...(kinds.length > 0 ? [{ line: true } as const, { heading: t('doc.insertGroupRefer') }] : []),
    ...kinds.map((kind) => ({ label: t(MENU_WORD[kind]), onSelect: () => setPicking(kind), 'data-testid': `doc-insert-${kind}` })),
    { line: true },
    { heading: t('doc.insertTypeHint') },
  ]
  return (
    <>
      <MenuButton size="small" label={t('doc.insertPicture')} items={items} data-testid="doc-insert" />
      {picking && (
        <PickDialog kind={picking} options={all.filter((one) => one.kind === picking)} onClose={() => { setPicking(undefined); backToWriting() }} onPick={(one) => { setPicking(undefined); onInsert(one); backToWriting() }} />
      )}
    </>
  )
}

/** One thing of a kind, picked by name; Return inserts what is picked, as the dialog's default button. */
function PickDialog({ kind, options, onClose, onPick }: { kind: ReferableKind; options: readonly Referable[]; onClose: () => void; onPick: (one: Referable) => void }) {
  const { t } = useStrings()
  const [value, setValue] = useState<Referable | null>(null)
  return (
    <Dialog
      open size="m" title={t(MENU_WORD[kind]).replace(/…$/, '')} onClose={onClose}
      onSubmit={() => { if (value) onPick(value) }}
      actions={{
        cancel: { onClick: onClose, label: t('common.cancel') },
        outcome: { type: 'submit', reason: value ? undefined : t(KIND_WORD[kind]), label: t('doc.insertPicture') },
      }}
    >
      <AutocompleteBox
        options={options as Referable[]} value={value} onChange={(_event, next) => setValue(next)} openOnFocus
        getOptionLabel={(one) => one.label}
        renderOption={(props, one) => (
          <li {...props} key={one.key}>
            <Box><Typography sx={{ fontSize: 'var(--t-small)' }}>{one.label}</Typography>{one.detail && <Typography sx={{ fontSize: 'var(--t-small)', color: 'text.secondary' }}>{one.detail}</Typography>}</Box>
          </li>
        )}
        renderInput={(params) => <FieldBox {...params} autoFocus label={t(KIND_WORD[kind])} />}
      />
    </Dialog>
  )
}
