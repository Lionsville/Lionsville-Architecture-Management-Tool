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
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { KeyboardEvent, RefObject } from 'react'
import Autocomplete from '@mui/material/Autocomplete'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import Dialog from '@mui/material/Dialog'
import Divider from '@mui/material/Divider'
import ListItemButton from '@mui/material/ListItemButton'
import { SurfaceMenu as Menu, SurfacePopper as Popper } from '../../widgets/kit/Surface'
import MenuItem from '@mui/material/MenuItem'
import Paper from '@mui/material/Paper'
import { FieldBox } from '../../widgets/kit/FieldBox'
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

  const onInput = useCallback(() => {
    const area = areaRef.current
    if (!area) return
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
      <Paper elevation={6} sx={{ width: 380, maxWidth: 'calc(100vw - 32px)', maxHeight: 320, overflow: 'auto', py: 0.5 }} data-testid="reference-completion" role="listbox" aria-label={t(open?.slash ? 'md.slashList' : 'doc.refCompletion')}>
        {rows.map((one, index) => (
          <ListItemButton
            key={one.id} selected={index === active} role="option" aria-selected={index === active}
            // Chosen on the click, not on the press: the list goes when it is chosen, and the rest of the press would land on what is under it.
            onMouseDown={(event) => event.preventDefault()} onClick={() => choose(one)}
            sx={{ py: 0.25, px: 1.5, gap: 1, alignItems: 'baseline' }}
          >
            <Typography sx={{ fontSize: 'var(--t-small)', color: 'text.secondary', width: 74, flex: '0 0 auto', textTransform: 'uppercase', letterSpacing: '.04em' }}>{one.word}</Typography>
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
    if (area) putReferable(referable, area.selectionStart, area.selectionEnd)
  }, [areaRef, putReferable])
  return { onKeyDown, onInput, insert, popper }
}

/**
 * *Insert ▾* (ADR-0043 §9): a picture and a business case, as before, and
 * each kind of thing a document may refer to, picked by name.
 */
export function InsertMenu({ onPicture, onAttach, onBusinessCase, onInsert, more = [] }: {
  onPicture?: () => void
  /** Offered only where the source keeps attachments. */
  onAttach?: () => void
  onBusinessCase: () => void
  onInsert: (referable: Referable) => void
  /** What this record has of its own to put in: its template, and the sections of it the text lacks. */
  more?: readonly { key: string; label: string; onPick(): void }[]
}) {
  const access = useReferences()
  const { t } = useStrings()
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const [picking, setPicking] = useState<ReferableKind | undefined>(undefined)
  const all = useMemo(() => (anchor || picking ? access?.referables() ?? [] : []), [anchor, picking, access])
  const kinds = REFERABLE_KINDS.filter((kind) => all.some((one) => one.kind === kind))
  return (
    <>
      <Button size="small" onClick={(event) => setAnchor(event.currentTarget)} aria-haspopup="menu" data-testid="doc-insert">{t('doc.insert')}</Button>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
        {onPicture && <MenuItem onClick={() => { setAnchor(null); onPicture() }}>{t('doc.insertPictureMenu')}</MenuItem>}
        {onAttach && <MenuItem data-testid="doc-insert-attachment" onClick={() => { setAnchor(null); onAttach() }}>{t('md.attachMenu')}</MenuItem>}
        <MenuItem onClick={() => { setAnchor(null); onBusinessCase() }}>{t('doc.insertBusinessCase')}</MenuItem>
        {more.map((one) => <MenuItem key={one.key} onClick={() => { setAnchor(null); one.onPick() }}>{one.label}</MenuItem>)}
        {kinds.length > 0 && <Divider />}
        {kinds.map((kind) => (
          <MenuItem key={kind} onClick={() => { setAnchor(null); setPicking(kind) }} data-testid={`doc-insert-${kind}`}>{t(MENU_WORD[kind])}</MenuItem>
        ))}
        <Divider />
        <Typography sx={{ fontSize: 'var(--t-small)', color: 'text.secondary', px: 2, py: 0.5, maxWidth: 260 }}>{t('doc.insertTypeHint')}</Typography>
      </Menu>
      {picking && (
        <PickDialog kind={picking} options={all.filter((one) => one.kind === picking)} onClose={() => setPicking(undefined)} onPick={(one) => { setPicking(undefined); onInsert(one) }} />
      )}
    </>
  )
}

function PickDialog({ kind, options, onClose, onPick }: { kind: ReferableKind; options: readonly Referable[]; onClose: () => void; onPick: (one: Referable) => void }) {
  const { t } = useStrings()
  const [value, setValue] = useState<Referable | null>(null)
  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{t(MENU_WORD[kind])}</DialogTitle>
      <DialogContent sx={{ pt: '8px !important' }}>
        <Autocomplete
          options={options as Referable[]} value={value} onChange={(_event, next) => setValue(next)} openOnFocus
          getOptionLabel={(one) => one.label}
          renderOption={(props, one) => (
            <li {...props} key={one.key}>
              <Box><Typography sx={{ fontSize: 'var(--t-small)' }}>{one.label}</Typography>{one.detail && <Typography sx={{ fontSize: 'var(--t-small)', color: 'text.secondary' }}>{one.detail}</Typography>}</Box>
            </li>
          )}
          renderInput={(params) => <FieldBox {...params} autoFocus label={t(KIND_WORD[kind])} />}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button variant="contained" disabled={!value} onClick={() => value && onPick(value)}>{t('doc.insertPicture')}</Button>
      </DialogActions>
    </Dialog>
  )
}
