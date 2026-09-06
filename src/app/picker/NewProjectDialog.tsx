/**
 * Add a project - to a group that exists, or to one you name here.
 *
 * Separate from "new group" because they are different intentions. Adding the
 * fourth project to a group you already work in should not ask you to retype its
 * name and hope you spell it the way you did last time; that is how you end up
 * with `Acme` and `Acme Logistics` holding two halves of the same landscape.
 */
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import type { Translate } from '../../i18n'
import type { ProjectGroup } from '../../projects/project'
import { GroupField, isGroupChoiceReady } from './GroupField'
import type { GroupChoice } from './GroupField'

export type NewProjectDialogProps = {
  open: boolean
  groups: readonly ProjectGroup[]
  group: GroupChoice
  projectName: string
  onGroupChange: (next: GroupChoice) => void
  onProjectNameChange: (name: string) => void
  onCancel: () => void
  onCreate: () => void
  s: Translate
}

export function NewProjectDialog({
  open, groups, group, projectName, onGroupChange, onProjectNameChange, onCancel, onCreate, s,
}: NewProjectDialogProps) {
  const ready = projectName.trim().length > 0 && isGroupChoiceReady(group)

  return (
    <Dialog open={open} onClose={onCancel} maxWidth="xs" fullWidth>
      <DialogTitle>{s('picker.newProject')}</DialogTitle>
      <DialogContent>
        <Stack spacing={1}>
          <GroupField
            groups={groups}
            value={group}
            onChange={onGroupChange}
            label={s('picker.inGroup')}
            s={s}
          />
          <TextField
            autoFocus
            fullWidth
            margin="dense"
            label={s('picker.projectName')}
            value={projectName}
            onChange={(e) => onProjectNameChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && ready) onCreate() }}
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
