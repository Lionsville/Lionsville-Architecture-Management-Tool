/**
 * Everything about a project that is not its content: its name, and its group.
 *
 * Both were decided once, in a dialog, and were then unreachable - which is fine
 * right up until somebody types a name wrong, or a landscape started under one
 * department turns out to belong to another. Neither is a reason to rebuild a
 * project by hand.
 *
 * The two changes are not the same underneath. A rename edits the model; a move
 * changes the ref, which means the store has to forget the old address and take
 * the new one. This dialog says what it wants; the caller performs it.
 */
import { useEffect, useState } from 'react'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import type { Translate } from '@lionsville/solution-design'
import type { ProjectGroup, ProjectSnapshot } from '../core/project'
import { groupNameOf } from '../core/project'
import { refFor, refPath } from '../core/projectRef'
import { GroupField, NEW_GROUP, groupChoiceName, isGroupChoiceReady } from './picker/GroupField'
import type { GroupChoice } from './picker/GroupField'

export type ProjectSettings = {
  name: string
  /**
   * The group's slug — resolved here, so the caller never has to know that "new
   * group" was a sentinel in a select rather than a group.
   */
  group: string
  groupName: string
}

export type ProjectSettingsDialogProps = {
  open: boolean
  project: ProjectSnapshot
  groups: readonly ProjectGroup[]
  onCancel: () => void
  onSave: (settings: ProjectSettings) => void
  s: Translate
}

export function ProjectSettingsDialog({
  open, project, groups, onCancel, onSave, s,
}: ProjectSettingsDialogProps) {
  const [name, setName] = useState(project.model.name)
  const [group, setGroup] = useState<GroupChoice>(
    { selected: project.ref.group, newName: '' })

  // Reopening on a different project - or after a move - must not show the
  // previous project's values still sitting in the fields.
  useEffect(() => {
    if (!open) return
    setName(project.model.name)
    setGroup({ selected: project.ref.group, newName: '' })
  }, [open, project.model.name, project.ref.group])

  const groupName = group.selected === NEW_GROUP
    ? group.newName.trim()
    : groupChoiceName(group, groups) || groupNameOf(project.model)
  const ready = name.trim().length > 0 && isGroupChoiceReady(group)
  const moving = group.selected !== NEW_GROUP
    ? group.selected !== project.ref.group
    : group.newName.trim().length > 0

  return (
    <Dialog open={open} onClose={onCancel} maxWidth="xs" fullWidth>
      <DialogTitle>{s('settings.title')}</DialogTitle>
      <DialogContent>
        <Stack spacing={1}>
          <TextField
            autoFocus
            fullWidth
            margin="dense"
            label={s('settings.projectName')}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <GroupField
            groups={groups}
            value={group}
            onChange={setGroup}
            label={s('settings.group')}
            helperText={moving ? s('settings.groupHelp') : undefined}
            s={s}
          />
          <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
            {refPath(project.ref)}
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>{s('common.cancel')}</Button>
        <Button
          variant="contained"
          disabled={!ready}
          onClick={() => onSave({
            name: name.trim(),
            group: group.selected === NEW_GROUP
              ? refFor(groupName, name.trim()).group
              : group.selected,
            groupName,
          })}
        >
          {s('settings.save')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
