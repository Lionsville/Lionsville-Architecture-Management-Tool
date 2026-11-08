// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Which board? A thing drawn on more than one, and none of them up.
 *
 * A list rather than a guess (`useShowElement`): a landscape and the same
 * landscape in 2027 both draw the application, and which one a person meant
 * is theirs to say.
 */
import Dialog from '@mui/material/Dialog'
import { DialogFooter } from '../../widgets/kit/Dialog'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemText from '@mui/material/ListItemText'
import Typography from '@mui/material/Typography'
import type { Translate } from '../../i18n'
import type { BoardChoice } from '../useShowElement'

export function ChooseBoardDialog({ choice, onChoose, onCancel, s }: {
  choice: BoardChoice | undefined
  onChoose(boardId: string): void
  onCancel(): void
  s: Translate
}) {
  return (
    <Dialog open={choice !== undefined} onClose={onCancel} maxWidth="xs" fullWidth aria-label={s('shell.chooseBoard')}>
      <DialogTitle>{s('shell.chooseBoard')}</DialogTitle>
      <DialogContent sx={{ pt: 0 }}>
        <Typography sx={{ fontSize: 'var(--t-small)', color: 'text.secondary', mb: 1 }}>
          {s('shell.chooseBoardHint', { name: choice?.name ?? '' })}
        </Typography>
        <List component="div" dense disablePadding>
          {choice?.boards.map((board) => (
            <ListItemButton key={board.id} onClick={() => onChoose(board.id)} data-testid={`choose-board-${board.id}`}>
              <ListItemText
                primary={board.name}
                secondary={board.asOf ? s('shell.chooseBoardAsOf', { day: board.asOf }) : undefined}
                slotProps={{ primary: { sx: { fontSize: 'var(--t-body)' } }, secondary: { sx: { fontSize: 'var(--t-small)' } } }}
              />
            </ListItemButton>
          ))}
        </List>
      </DialogContent>
      <DialogFooter
        cancel={{ onClick: onCancel, label: s('common.cancel') }}
      />
    </Dialog>
  )
}
