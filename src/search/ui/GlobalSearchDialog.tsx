/**
 * ⌘K: one field over everything the project knows.
 *
 * The editor's own ⌘F finds a box on the canvas and nothing else, on purpose —
 * a paragraph would out-match every name. This dialog is the wider one: it
 * asks `searchAll` for elements, documentation and decisions together and lets
 * each kind of hit open the thing it is about. It is the same combobox-over-
 * listbox pattern as the element finder — focus stays in the field, ↑/↓ move
 * the active row, Enter takes it — so the two feel like one tool.
 *
 * Pure rendering: the hits come from `core/search`, and what a chosen hit does
 * is the caller's (`onChoose`), because opening a page is the workspace's job.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Dialog from '@mui/material/Dialog'
import ListItemButton from '@mui/material/ListItemButton'
import ListSubheader from '@mui/material/ListSubheader'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import type { StringKey, Translate } from '../../i18n'
import type { Adr } from '../../decisions/adr'
import { SCOPE_LABEL } from '../../decisions/adrScope'
import { formatAdrNumber } from '../../decisions/adr'
import type { HostModel } from '../../model/fromInterchange'
import { searchAll } from '../search'
import type { SearchHit } from '../search'
import { STATUS_LABEL } from '../../decisions/adrScope'

export type GlobalSearchDialogProps = {
  open: boolean
  model: HostModel
  groupDecisions: readonly Adr[]
  onClose: () => void
  onChoose: (hit: SearchHit) => void
  s: Translate
}

const KIND_LABEL: Record<SearchHit['kind'], StringKey> = {
  element: 'gsearch.elements',
  documentation: 'gsearch.documentation',
  adr: 'gsearch.decisions',
}

export function GlobalSearchDialog({ open, model, groupDecisions, onClose, onChoose, s }: GlobalSearchDialogProps) {
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  // Each opening starts empty: yesterday's answer to today's question helps nobody.
  useEffect(() => {
    if (open) { setQuery(''); setActiveIndex(0) }
  }, [open])

  const hits = useMemo(
    () => (open ? searchAll({ model, groupDecisions, query }) : []),
    [open, model, groupDecisions, query],
  )
  useEffect(() => setActiveIndex(0), [query])

  const active = hits.length > 0 ? Math.min(activeIndex, hits.length - 1) : -1
  const optionId = (index: number) => `lv-gsearch-option-${index}`

  useEffect(() => {
    if (active < 0) return
    const row = listRef.current?.querySelector(`#${optionId(active)}`)
    ;(row as HTMLElement | null)?.scrollIntoView?.({ block: 'nearest' })
  }, [active, hits])

  const move = (delta: number) => {
    if (hits.length === 0) return
    setActiveIndex((current) => (Math.min(current, hits.length - 1) + delta + hits.length) % hits.length)
  }

  const choose = (hit: SearchHit) => {
    onChoose(hit)
    onClose()
  }

  const trimmed = query.trim()

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      sx={{ '& .MuiDialog-container': { alignItems: 'flex-start', pt: '10vh' } }}
    >
      <Box sx={{ p: 1.5, pb: 1 }}>
        <TextField
          autoFocus
          fullWidth
          size="small"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') { event.preventDefault(); move(1) }
            else if (event.key === 'ArrowUp') { event.preventDefault(); move(-1) }
            else if (event.key === 'Enter' && active >= 0) { event.preventDefault(); choose(hits[active]) }
          }}
          label={s('gsearch.title')}
          placeholder={s('gsearch.placeholder')}
          slotProps={{
            htmlInput: {
              'aria-label': s('gsearch.field'),
              role: 'combobox',
              'aria-expanded': hits.length > 0,
              'aria-controls': 'lv-gsearch-results',
              'aria-activedescendant': active >= 0 ? optionId(active) : undefined,
              autoComplete: 'off',
            },
          }}
        />
      </Box>
      <Box
        ref={listRef}
        id="lv-gsearch-results"
        role="listbox"
        aria-label={s('gsearch.results')}
        sx={{ maxHeight: 420, overflowY: 'auto', pb: 0.5 }}
      >
        {hits.map((hit, index) => {
          const firstOfKind = index === 0 || hits[index - 1].kind !== hit.kind
          return (
            <Box key={`${hit.kind}-${index}`}>
              {firstOfKind && (
                <ListSubheader disableSticky sx={{ lineHeight: '28px', bgcolor: 'transparent', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                  {s(KIND_LABEL[hit.kind])}
                </ListSubheader>
              )}
              <ListItemButton
                id={optionId(index)}
                role="option"
                aria-selected={index === active}
                selected={index === active}
                dense
                onMouseMove={() => setActiveIndex(index)}
                onClick={() => choose(hit)}
                sx={{ display: 'block', px: 2, py: 0.75 }}
              >
                <HitRow hit={hit} s={s} />
              </ListItemButton>
            </Box>
          )
        })}
        {hits.length === 0 && (
          <Typography sx={{ fontSize: 12, color: 'text.secondary', px: 2, py: 1 }}>
            {trimmed === '' ? s('gsearch.empty') : s('gsearch.noMatches', { query: trimmed })}
          </Typography>
        )}
      </Box>
      <Typography sx={{ fontSize: 11, color: 'text.secondary', px: 2, pb: 1.5 }}>
        {s('gsearch.hint')}
      </Typography>
    </Dialog>
  )
}

function HitRow({ hit, s }: { hit: SearchHit; s: Translate }) {
  switch (hit.kind) {
    case 'element':
      return (
        <>
          <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{hit.name}</Typography>
          {hit.detail && <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{hit.detail}</Typography>}
        </>
      )
    case 'documentation':
      return (
        <>
          <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{hit.name}</Typography>
          <Typography sx={{ fontSize: 11, color: 'text.secondary' }} noWrap>{hit.snippet}</Typography>
        </>
      )
    case 'adr':
      return (
        <>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography sx={{ fontSize: 11, color: 'text.secondary', fontFamily: 'ui-monospace, Menlo, monospace' }}>
              {formatAdrNumber(hit.number)}
            </Typography>
            <Typography sx={{ fontSize: 13, fontWeight: 600, flex: 1, minWidth: 0 }} noWrap>{hit.title}</Typography>
            <Chip size="small" label={s(STATUS_LABEL[hit.status])} sx={{ height: 18, fontSize: 10 }} />
          </Box>
          <Typography sx={{ fontSize: 11, color: 'text.secondary' }} noWrap>
            {[
              hit.scope === 'application' ? (hit.applicationName ?? s(SCOPE_LABEL.application)) : s(SCOPE_LABEL[hit.scope]),
              hit.snippet || undefined,
            ].filter(Boolean).join(' · ')}
          </Typography>
        </>
      )
  }
}
