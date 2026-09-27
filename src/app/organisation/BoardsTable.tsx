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
import { LOCALE } from '../../i18n'
import { plural } from '../../i18n/strings'
import type { Language, Translate } from '../../i18n'
import { isBoardKind } from '../../model/placement'
import type { DesignDiagram } from '../../model'

/**
 * Every board the scope draws, one row each, oldest first as the model holds
 * them. What a row says is what tells two boards of one landscape apart: the
 * kind, the day it shows (ADR-0009) and how much is on it.
 */
/** What a laid-out view's row says instead of a day and a count: the kind, and that it is laid out. */
const LAID_OUT_LABEL = { sheet: 'org.viewSheet', map: 'org.viewMap', technology: 'org.viewTechnology' } as const

export function BoardsTable({ boards, onOpen, onAdd, onAddSheet, onAddMap, onAddTechnology, onDelete, language, s }: {
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
  language: Language
  s: Translate
}) {
  const [newMenu, setNewMenu] = useState<HTMLElement | null>(null)
  const pick = (make: () => void) => () => { setNewMenu(null); make() }
  return (
    <Box sx={{ mb: 4 }} data-testid="boards" data-guide="org.boards">
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1 }}>
        <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.6, flex: 1, textTransform: 'uppercase' }}>
          {s('org.boards')}
        </Typography>
        <Button
          size="small"
          variant="outlined"
          onClick={(event) => setNewMenu(event.currentTarget)}
          aria-haspopup="menu"
          aria-expanded={Boolean(newMenu)}
          data-testid="new-board" data-guide="org.newBoard"
        >
          {s('org.newBoard')}
        </Button>
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
      {boards.map((board) => (
        <Stack
          key={board.id}
          direction="row"
          spacing={1}
          data-testid={`board-${board.id}`}
          sx={{ alignItems: 'center', py: 0.75, borderBottom: 1, borderColor: 'divider' }}
        >
          <Box sx={{ flex: 1, minWidth: 0 }}>
            {/* The name opens it too: a row whose only door is the button at
                the far end is a row people click on and nothing happens. */}
            <Typography
              component="button"
              type="button"
              onClick={() => onOpen(board.id)}
              data-testid={`board-name-${board.id}`}
              sx={{
                fontSize: 13, fontWeight: 500, font: 'inherit', color: 'inherit', background: 'none', border: 0,
                p: 0, cursor: 'pointer', textAlign: 'left', '&:hover': { color: 'primary.main' },
              }}
            >
              {board.name}
            </Typography>
            <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
              {!isBoardKind(board.kind) ? s(LAID_OUT_LABEL[board.kind as keyof typeof LAID_OUT_LABEL]) : [
                s(board.kind === 'container' ? 'org.viewContainer' : 'org.viewLayer7'),
                // The day the board shows. A board with no date moves with
                // the calendar, and says so rather than printing today's.
                board.asOf
                  ? s('org.viewAsOf', {
                    date: new Date(board.asOf).toLocaleDateString(LOCALE[language], {
                      day: 'numeric', month: 'short', year: 'numeric',
                    }),
                  })
                  : s('org.viewToday'),
                plural(s, { one: 'org.onItOne', other: 'org.onItOther' }, board.members.length),
              ].join(' · ')}
            </Typography>
          </Box>
          <Button size="small" onClick={() => onOpen(board.id)} sx={{ fontSize: 11, minWidth: 0, px: 1 }}>
            {s('picker.open')}
          </Button>
          {board.kind === 'container' && (
            <Button
              size="small"
              color="error"
              onClick={() => onDelete({ id: board.id, name: board.name })}
              sx={{ fontSize: 11, minWidth: 0, px: 1 }}
            >
              {s('common.delete')}
            </Button>
          )}
        </Stack>
      ))}
    </Box>
  )
}
