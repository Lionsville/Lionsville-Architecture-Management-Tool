/**
 * Name a group, and the first project in it.
 *
 * Both, because a group is derived from the projects filed under it - there is
 * nowhere to keep an empty one and nothing to show for it. Saying so in the
 * dialog is more honest than letting somebody create a group and then wonder why
 * it vanished on refresh.
 */
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import type { Translate } from '@lionsville/solution-design'
import { refFor } from '../../core/projectRef'
import type { ProjectGroup } from '../../core/project'

export type NewGroupDialogProps = {
  open: boolean
  groups: readonly ProjectGroup[]
  groupName: string
  projectName: string
  onGroupNameChange: (name: string) => void
  onProjectNameChange: (name: string) => void
  onCancel: () => void
  onCreate: () => void
  s: Translate
}

export function NewGroupDialog({
  open, groups, groupName, projectName,
  onGroupNameChange, onProjectNameChange, onCancel, onCreate, s,
}: NewGroupDialogProps) {
  const ready = groupName.trim().length > 0 && projectName.trim().length > 0
  // Slugged, because that is what decides whether it is the same group - "Acme"
  // and "acme" are one namespace, and saying so beats creating a second.
  const collides = ready
    && groups.some((group) => group.group === refFor(groupName, projectName).group)

  return (
    <Dialog open={open} onClose={onCancel} maxWidth="xs" fullWidth>
      <DialogTitle>{s('picker.newGroup')}</DialogTitle>
      <DialogContent>
        <Stack spacing={1}>
          <TextField
            autoFocus
            fullWidth
            margin="dense"
            label={s('picker.group')}
            helperText={s('picker.groupHelp')}
            value={groupName}
            onChange={(e) => onGroupNameChange(e.target.value)}
          />
          <TextField
            fullWidth
            margin="dense"
            label={s('picker.firstProject')}
            value={projectName}
            onChange={(e) => onProjectNameChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && ready) onCreate() }}
          />
          {collides && (
            <Typography sx={{ fontSize: 11, color: 'warning.main' }}>
              {s('picker.groupExists')}
            </Typography>
          )}
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
