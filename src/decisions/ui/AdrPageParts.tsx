// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The decisions page's columns and dialogs, each drawn from what the page
 * hands it: the top bar, the tree of places, the list of records, the banner
 * over an ancestor's record, and the two questions a locking move asks.
 *
 * Apart from `AdrPage.tsx` because the page owns the lists, the selection and
 * every write, and these own none of it — each draws, and says what was pressed.
 */
import type { ReactNode } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemText from '@mui/material/ListItemText'
import ListSubheader from '@mui/material/ListSubheader'
import TextField from '@mui/material/TextField'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import type { Translate } from '../../i18n'
import { adrFieldItems, formatAdrNumber } from '../adr'
import type { Adr } from '../adr'
import type { WindowChrome } from '../../platform/windowChrome'
import { ConfirmDialog } from '../../widgets/ConfirmDialog'
import { ReasonDialog } from './AdrDialogs'
import { STATUS_COLOR, STATUS_LABEL, fromScope, subjectScope } from '../adrScope'
import type { AncestorRecords, ScopeKey } from '../adrScope'

// --- the top bar ------------------------------------------------------------------------

/**
 * The window's bar while the page is up: back, where this is, and *New
 * decision*. Where this is: the shell's crumbs where the caller has them, and
 * otherwise the names there are — an organisation whose root has no name yet
 * is not an empty crumb.
 */
export function AdrTopBar({ bar, crumbs, names, readOnly, s, onClose, onNew }: {
  bar: WindowChrome
  crumbs?: ReactNode
  names: readonly string[]
  readOnly: boolean
  s: Translate
  onClose: () => void
  onNew: () => void
}) {
  return (
    <Box
      data-testid="adr-topbar"
      sx={{
        display: 'flex', flexWrap: 'wrap', rowGap: 0.5, alignItems: 'center', gap: 1, px: 1.5,
        pl: `${12 + bar.controlsInset}px`,
        WebkitAppRegion: bar.draggable ? 'drag' : undefined,
        '& button, & a, & input': { WebkitAppRegion: 'no-drag' },
        minHeight: 48, borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper', flexShrink: 0,
      }}
    >
      <Tooltip title={s('adr.close')}>
        <IconButton size="small" aria-label={s('adr.close')} onClick={onClose}>
          <Box component="span" aria-hidden sx={{ display: 'inline-block', width: 18, textAlign: 'center', fontSize: 16, lineHeight: 1 }}>‹</Box>
        </IconButton>
      </Tooltip>
      {crumbs ? (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0 }}>
          {crumbs}
          <Typography variant="body2" aria-hidden sx={{ color: 'text.secondary' }}>/</Typography>
          <Typography variant="body2" sx={{ color: 'text.primary', fontWeight: 600, whiteSpace: 'nowrap' }}>{s('adr.title')}</Typography>
        </Box>
      ) : (
        <Typography variant="body2" color="text.secondary" sx={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {names.map((part) => part.trim()).filter(Boolean).map((part) => `${part} / `).join('')}
          <Box component="span" sx={{ color: 'text.primary', fontWeight: 600 }}>{s('adr.title')}</Box>
        </Typography>
      )}
      <Box sx={{ flex: 1 }} />
      {!readOnly && (
        <Button size="small" variant="contained" onClick={onNew} data-guide="decisions.new">
          + {s('adr.new')}
        </Button>
      )}
    </Box>
  )
}

// --- the tree ---------------------------------------------------------------------------

function Heading({ children }: { children: ReactNode }) {
  return <ListSubheader component="div" disableSticky sx={{ lineHeight: '32px', bgcolor: 'transparent' }}>{children}</ListSubheader>
}

/**
 * Where records live: this scope, one node per subject a record here is about
 * (ADR-0012 §7), subjects that have left the model, and the scopes above. A
 * heading over nothing is a heading about nothing, so an empty group is not
 * drawn.
 */
export function AdrTree({ modelName, subjects, orphanIds, ancestors, selected, count, onChoose, s }: {
  modelName: string
  subjects: readonly { id: string; name: string; category?: string }[]
  orphanIds: readonly string[]
  ancestors: readonly AncestorRecords[]
  /** The place stood in; nothing while a search spans them all. */
  selected?: ScopeKey
  count: (key: ScopeKey) => number
  onChoose: (key: ScopeKey) => void
  s: Translate
}) {
  const node = (key: ScopeKey, label: string, note?: string, indent = 0) => (
    <ListItemButton
      key={key}
      selected={key === selected}
      onClick={() => onChoose(key)}
      sx={{ py: 0.5, pl: 2 + indent * 2 }}
      data-testid={`adr-scope-${key}`}
    >
      <ListItemText
        primary={label}
        secondary={note}
        slotProps={{ primary: { noWrap: true, sx: { fontSize: 13 } }, secondary: { noWrap: true, sx: { fontSize: 11 } } }}
      />
      {count(key) > 0 && (
        <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>{count(key)}</Typography>
      )}
    </ListItemButton>
  )
  const above = (one: AncestorRecords) => one.name || one.path || s('adr.scopeGroup')
  return (
    <Box component="nav" data-testid="adr-tree" sx={{ borderRight: 1, borderColor: 'divider', bgcolor: 'background.paper', overflow: 'auto' }}>
      <List component="div" dense disablePadding>
        <Heading>{s('adr.scopeLandscape')}</Heading>
        {node('landscape', modelName, s('adr.scopeLandscapeNote'))}
        {subjects.length > 0 && <Heading>{s('adr.scopeApplications')}</Heading>}
        {subjects.map((one) => node(subjectScope(one.id), one.name, one.category, 1))}
        {orphanIds.length > 0 && (
          <>
            <Heading>{s('adr.scopeRemoved')}</Heading>
            {orphanIds.map((id) => node(subjectScope(id), id, undefined, 1))}
          </>
        )}
        {/* Then the scopes above, read up the tree and read-only here: a
            record is edited where it lives. */}
        {ancestors.filter((one) => one.decisions.length > 0).map((one) => (
          <Box key={one.path}>
            <Heading>{s('adr.scopeFrom', { scope: above(one) })}</Heading>
            {node(fromScope(one.path), above(one), s('adr.scopeFromNote'))}
          </Box>
        ))}
      </List>
    </Box>
  )
}

// --- the list ---------------------------------------------------------------------------

/** The records of the place stood in, or every hit of a search, newest first; each row a record. */
export function AdrRecordList({ query, onQuery, shown, selectedId, describe, empty, onChoose, s }: {
  query: string
  onQuery: (next: string) => void
  shown: readonly { adr: Adr; scope: ScopeKey }[]
  selectedId?: string
  /** The line under a row's title: where it lives while searching, and its day. */
  describe: (adr: Adr, where: ScopeKey) => string
  /** What an empty list says. */
  empty: string
  onChoose: (adr: Adr, where: ScopeKey) => void
  s: Translate
}) {
  return (
    <Box data-testid="adr-list" data-guide="decisions.list" sx={{ display: 'flex', flexDirection: 'column', minHeight: 0, borderRight: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
      <Box sx={{ p: 1.5, borderBottom: 1, borderColor: 'divider' }}>
        <TextField
          fullWidth
          size="small"
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          placeholder={s('adr.searchPlaceholder')}
          slotProps={{ htmlInput: { 'aria-label': s('adr.searchField'), autoComplete: 'off' } }}
        />
      </Box>
      <List component="div" dense disablePadding sx={{ overflow: 'auto', flex: 1 }}>
        {shown.map(({ adr, scope: where }) => (
          <ListItemButton
            key={adr.id}
            selected={adr.id === selectedId}
            onClick={() => onChoose(adr, where)}
            alignItems="flex-start"
            data-guide="decisions.row"
            data-element-id={adr.id}
            sx={{ display: 'block', py: 1, borderBottom: 1, borderColor: 'divider' }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography sx={{ fontSize: 11, color: 'text.secondary', fontFamily: 'ui-monospace, Menlo, monospace' }}>
                {formatAdrNumber(adr.number)}
              </Typography>
              <Box sx={{ flex: 1 }} />
              <Chip size="small" color={STATUS_COLOR[adr.status]} label={s(STATUS_LABEL[adr.status])} sx={{ height: 18, fontSize: 10 }} />
            </Box>
            <Typography sx={{ fontSize: 13, fontWeight: 600, mt: 0.25 }}>{adr.title}</Typography>
            <Typography sx={{ fontSize: 11, color: 'text.secondary' }} noWrap>{describe(adr, where)}</Typography>
          </ListItemButton>
        ))}
        {shown.length === 0 && (
          <Typography sx={{ fontSize: 13, color: 'text.secondary', px: 2, py: 2 }}>{empty}</Typography>
        )}
      </List>
    </Box>
  )
}

// --- a record from above ------------------------------------------------------------------

/**
 * Read here, edited where it lives (ADR-0012 §7) — the same sentence a
 * stand-in's inspector says about a field another scope answers for, and the
 * same way out.
 */
export function FromAboveBanner({ scopeName, onOpen, s }: { scopeName: string; onOpen?: () => void; s: Translate }) {
  return (
    <Box
      data-testid="adr-from-ancestor" data-guide="decisions.fromAbove"
      sx={{
        display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1,
        bgcolor: 'action.hover', borderBottom: 1, borderColor: 'divider',
      }}
    >
      <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>
        {s('adr.fromAncestor', { scope: scopeName })}
      </Typography>
      {onOpen && (
        <Button size="small" onClick={onOpen}>{s('adr.openScope', { scope: scopeName })}</Button>
      )}
    </Box>
  )
}

// --- the two moves that lock --------------------------------------------------------------

/**
 * Acceptance confirms, naming what it supersedes on the way; rejection and
 * withdrawal ask why (ADR-0008, amended 28 September 2026). A reason is
 * required unless a reviewer's rejection already gives one.
 */
export function MoveDialogs({ accepting, rejecting, listOf, onAccept, onReject, onCancel, s }: {
  accepting?: Adr
  rejecting?: Adr
  /** The list a record sits in, where what it supersedes is found. */
  listOf: (adr: Adr) => readonly Adr[]
  onAccept: (adr: Adr) => void
  onReject: (adr: Adr, reason: string) => void
  onCancel: () => void
  s: Translate
}) {
  const acceptBody = (adr: Adr): string => {
    const list = listOf(adr)
    const replaced = (adr.supersedes ?? [])
      .map((id) => list.find((one) => one.id === id))
      .filter((one): one is Adr => one !== undefined && one.status === 'accepted')
      .map((one) => formatAdrNumber(one.number))
    const locks = s('adr.acceptBody')
    return replaced.length ? `${locks} ${s('adr.acceptSupersedes', { names: replaced.join(', ') })}` : locks
  }
  return (
    <>
      <ConfirmDialog
        open={Boolean(accepting)}
        title={accepting ? s('adr.acceptTitle', { name: formatAdrNumber(accepting.number) }) : ''}
        body={accepting ? acceptBody(accepting) : ''}
        confirmLabel={s('adr.accept')}
        cancelLabel={s('common.cancel')}
        onCancel={onCancel}
        onConfirm={() => accepting && onAccept(accepting)}
      />
      <ReasonDialog
        target={rejecting}
        withdraw={rejecting?.status === 'proposed'}
        required={rejecting ? !adrFieldItems(rejecting, 'rejected', listOf(rejecting)).every((one) => one.ok) : true}
        onCancel={onCancel}
        onConfirm={(reason) => rejecting && onReject(rejecting, reason)}
        s={s}
      />
    </>
  )
}
