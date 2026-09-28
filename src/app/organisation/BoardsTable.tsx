// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The boards a scope draws, on its home: one row each, and the way to a new one.
 */
import { useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { formatDay } from '../../i18n/dates'
import { plural } from '../../i18n/strings'
import type { Language, Translate } from '../../i18n'
import { isBoardKind } from '../../model/placement'
import type { DesignDiagram } from '../../model'
import { BoardKindIcon } from './boardIcons'
import { outlineBoards } from './boardOutline'

/** What a laid-out view's row says instead of a day and a count: the kind, and that it is laid out. */
const LAID_OUT_LABEL = { sheet: 'org.viewSheet', map: 'org.viewMap', technology: 'org.viewTechnology' } as const

/** The name is a button that looks like a name: see {@link BoardRow}. */
const NAME_SX = {
  font: 'inherit', color: 'inherit', background: 'none', border: 0,
  p: 0, cursor: 'pointer', textAlign: 'left', '&:hover': { color: 'primary.main' },
} as const

const ACTION_SX = { fontSize: 11, minWidth: 0, px: 1 } as const

/**
 * A compact row's buttons: the same two doors, without the height a full
 * row's buttons bring with them — a row is only as short as its tallest part.
 */
const COMPACT_ACTION_SX = { ...ACTION_SX, py: 0, lineHeight: 1.6 } as const

interface RowActions {
  onOpen: (id: string) => void
  /** Absent for somebody who may only read the scope: there is nothing to take off. */
  onDelete?: (board: { id: string; name: string }) => void
  language: Language
  s: Translate
}

/**
 * Every board the scope draws, oldest first as the model holds them, and each
 * container diagram under the landscape its application is on
 * ({@link outlineBoards}). What a row says is what tells two boards of one
 * landscape apart: the kind, the day it shows (ADR-0009) and how much is on it.
 */
export function BoardsTable({ boards, onOpen, onAdd, onAddSheet, onAddMap, onAddTechnology, onDelete, readOnly = false, language, s }: {
  boards: readonly DesignDiagram[]
  onOpen: (id: string) => void
  /** A landscape for this scope — the only way to its first one. */
  onAdd: () => void
  /** The laid-out kinds, the same three the editor's + tab offers (ADR-0016). */
  onAddSheet: () => void
  onAddMap: () => void
  onAddTechnology: () => void
  /**
   * A container diagram only: a landscape is deleted from its tab, where the
   * last one is refused, and a container diagram has no tab and no last one.
   */
  onDelete: (board: { id: string; name: string }) => void
  /**
   * The person may read this scope and not change it: the table lists the
   * boards and opens them, and offers neither a new one nor a removal.
   */
  readOnly?: boolean
  language: Language
  s: Translate
}) {
  const [newMenu, setNewMenu] = useState<HTMLElement | null>(null)
  const pick = (make: () => void) => () => { setNewMenu(null); make() }
  const { entries, loose } = outlineBoards(boards)
  const actions: RowActions = { onOpen, ...(readOnly ? {} : { onDelete }), language, s }
  return (
    <Box sx={{ mb: 4 }} data-testid="boards" data-guide="org.boards">
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1 }}>
        <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.6, flex: 1, textTransform: 'uppercase' }}>
          {s('org.boards')}
        </Typography>
        {!readOnly && <Button
          size="small"
          variant="outlined"
          onClick={(event) => setNewMenu(event.currentTarget)}
          aria-haspopup="menu"
          aria-expanded={Boolean(newMenu)}
          data-testid="new-board" data-guide="org.newBoard"
        >
          {s('org.newBoard')}
        </Button>}
        <Menu open={Boolean(newMenu)} anchorEl={newMenu} onClose={() => setNewMenu(null)} slotProps={{ list: { dense: true } }}>
          <MenuItem onClick={pick(onAdd)} data-testid="new-board-landscape">{s('org.newBoardLandscape')}</MenuItem>
          <MenuItem onClick={pick(onAddSheet)}>{s('org.newBoardSheet')}</MenuItem>
          <MenuItem onClick={pick(onAddMap)}>{s('org.newBoardMap')}</MenuItem>
          <MenuItem onClick={pick(onAddTechnology)}>{s('org.newBoardTechnology')}</MenuItem>
        </Menu>
      </Stack>
      {boards.length === 0 && (
        <Typography sx={{ fontSize: 12, color: 'text.secondary', py: 0.75 }} data-testid="boards-empty">
          {s('org.noBoards')}
        </Typography>
      )}
      {/* The container diagrams come straight after their landscape in the
          document as well as on screen, so Tab walks the list in the order it
          is read. */}
      {entries.map(({ board, containers }) => (
        <Box key={board.id} sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <BoardRow board={board} {...actions} />
          {containers.length > 0 && (
            <Box
              role="group"
              aria-label={s('org.containersOn', { name: board.name })}
              data-testid={`board-containers-${board.id}`}
              // A rule down from the landscape's glyph, and the rows starting
              // where its name does: the tree without a tree control.
              sx={{ ml: '8px', pl: '19px', mb: 0.75, borderLeft: 1, borderColor: 'divider' }}
            >
              {containers.map((container) => (
                <BoardRow key={container.id} board={container} under={board.id} compact {...actions} />
              ))}
            </Box>
          )}
        </Box>
      ))}
      {loose.length > 0 && (
        <Box
          role="group"
          aria-label={s('org.containersLoose')}
          data-testid="board-containers-loose"
          sx={{ py: 0.5, borderBottom: 1, borderColor: 'divider' }}
        >
          {loose.map((container) => <BoardRow key={container.id} board={container} compact {...actions} />)}
        </Box>
      )}
    </Box>
  )
}

/**
 * One board: its glyph, its name, what it is, and the ways in and out.
 *
 * `compact` is a container diagram's row — one line, smaller type and less
 * air — because a landscape can have many of them and they are details of
 * it, not boards to choose between. `under` names the landscape it is listed
 * under, when there is one.
 */
function BoardRow({ board, under, compact = false, onOpen, onDelete, language, s }: RowActions & {
  board: DesignDiagram
  under?: string
  compact?: boolean
}) {
  const said = !isBoardKind(board.kind) ? s(LAID_OUT_LABEL[board.kind as keyof typeof LAID_OUT_LABEL]) : [
    s(board.kind === 'container' ? 'org.viewContainer' : 'org.viewLayer7'),
    // The day the board shows. A board with no date moves with the
    // calendar, and says so rather than printing today's.
    // A day, read as the local one it is: parsed as UTC it was the day before
    // anywhere west of Greenwich.
    board.asOf ? s('org.viewAsOf', { date: formatDay(board.asOf, language) }) : s('org.viewToday'),
    plural(s, { one: 'org.onItOne', other: 'org.onItOther' }, board.members.length),
  ].join(' · ')
  const actionSx = compact ? COMPACT_ACTION_SX : ACTION_SX
  return (
    <Stack
      direction="row"
      spacing={compact ? 1 : 1.25}
      data-testid={`board-${board.id}`}
      data-kind={board.kind}
      data-compact={compact || undefined}
      data-under={under}
      sx={{ alignItems: 'center', py: compact ? 0.25 : 0.75 }}
    >
      <Box sx={{ display: 'flex', flexShrink: 0, color: 'text.secondary' }}>
        <BoardKindIcon kind={board.kind} size={compact ? 14 : 18} />
      </Box>
      <Box
        sx={compact
          ? { flex: 1, minWidth: 0, display: 'flex', alignItems: 'baseline', columnGap: 1, overflow: 'hidden' }
          : { flex: 1, minWidth: 0 }}
      >
        {/* The name opens it too: a row whose only door is the button at
            the far end is a row people click on and nothing happens. */}
        <Typography
          component="button"
          type="button"
          onClick={() => onOpen(board.id)}
          data-testid={`board-name-${board.id}`}
          sx={compact
            ? { ...NAME_SX, fontSize: 12, fontWeight: 500, flexShrink: 0, maxWidth: '60%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }
            // In this order the shorthand wins and the name takes the
            // page's own size, as it always has; the compact row's comes
            // after it, so there the smaller size is the one that holds.
            : { fontSize: 13, fontWeight: 500, ...NAME_SX }}
        >
          {board.name}
        </Typography>
        <Typography
          component={compact ? 'span' : 'p'}
          sx={compact
            ? { fontSize: 11, color: 'text.secondary', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }
            : { fontSize: 11, color: 'text.secondary' }}
        >
          {said}
        </Typography>
      </Box>
      <Button size="small" onClick={() => onOpen(board.id)} sx={actionSx}>
        {s('picker.open')}
      </Button>
      {board.kind === 'container' && onDelete && (
        <Button
          size="small"
          color="error"
          onClick={() => onDelete({ id: board.id, name: board.name })}
          sx={actionSx}
        >
          {s('common.delete')}
        </Button>
      )}
    </Stack>
  )
}
