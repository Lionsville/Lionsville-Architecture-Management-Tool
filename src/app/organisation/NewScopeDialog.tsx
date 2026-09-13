/**
 * One dialog where there were two.
 *
 * "New group" asked for a group and its first project; "New project" asked for
 * a project and which group to file it under. They were two dialogs because a
 * group and a project were two records — a group could not exist on its own,
 * and a project could not hold another one. Every scope is the same document
 * now (ADR-0012 §1), so there is one question: what is it called, and where
 * does it go.
 *
 * A name that is one of the six folders a scope writes into is refused here,
 * where a person can see it and type another, rather than quietly suffixed by
 * the addressing (`scopePath.ts`).
 */
import Button from '@mui/material/Button'
import Checkbox from '@mui/material/Checkbox'
import FormControlLabel from '@mui/material/FormControlLabel'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import type { Translate } from '../../i18n'
import type { ScopeSummary } from '../../projects/scope'
import { isReservedScopeName } from '../../projects/scopePath'
import type { ScopePath } from '../../projects/scopePath'
import { slug } from '../../model/keys'
import { ScopeField } from './ScopeField'

export type NewScopeDialogProps = {
  open: boolean
  tree: ScopeSummary
  parent: ScopePath
  name: string
  /**
   * Start it with a landscape. On by default, because a scope made by hand is
   * usually somewhere to draw; off makes a domain on purpose — a folder for
   * other scopes, which until now only came about as a missing ancestor.
   */
  withBoard: boolean
  onParentChange: (next: ScopePath) => void
  onNameChange: (name: string) => void
  onWithBoardChange: (withBoard: boolean) => void
  onCancel: () => void
  onCreate: () => void
  s: Translate
}

export function NewScopeDialog({
  open, tree, parent, name, withBoard, onParentChange, onNameChange, onWithBoardChange, onCancel, onCreate, s,
}: NewScopeDialogProps) {
  const typed = name.trim()
  // Slugged, because that is what becomes the folder: "Docs" and "docs" are the
  // same name as far as the tree is concerned.
  const reserved = typed.length > 0 && isReservedScopeName(slug(typed))
  const ready = typed.length > 0 && !reserved

  return (
    <Dialog open={open} onClose={onCancel} maxWidth="xs" fullWidth>
      <DialogTitle>{s('picker.newScope')}</DialogTitle>
      <DialogContent>
        <Stack spacing={1}>
          <ScopeField
            tree={tree}
            value={parent}
            onChange={onParentChange}
            label={s('picker.under')}
            s={s}
          />
          <TextField
            autoFocus
            fullWidth
            margin="dense"
            label={s('picker.scopeName')}
            value={name}
            error={reserved}
            helperText={reserved ? s('picker.reservedName') : undefined}
            onChange={(e) => onNameChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && ready) onCreate() }}
          />
          <FormControlLabel
            control={(
              <Checkbox
                size="small"
                checked={withBoard}
                onChange={(e) => onWithBoardChange(e.target.checked)}
                inputProps={{ 'aria-label': s('picker.withBoard') }}
              />
            )}
            label={s('picker.withBoard')}
            slotProps={{ typography: { sx: { fontSize: 13 } } }}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>{s('common.cancel')}</Button>
        <Button variant="contained" disabled={!ready} onClick={onCreate}>
          {s('picker.create')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
