/**
 * Everything about a project that is not its content: its name, its group, and
 * the two answers it gives on behalf of the diagrams inside it.
 *
 * Both were decided once, in a dialog, and were then unreachable - which is fine
 * right up until somebody types a name wrong, or a landscape started under one
 * department turns out to belong to another. Neither is a reason to rebuild a
 * project by hand.
 *
 * The name and the group are not the same change underneath. A rename edits the
 * model; a move changes the ref, which means the store has to forget the old
 * address and take the new one. This dialog says what it wants; the caller
 * performs it.
 *
 * The defaults below it are seeds, not settings that reach back: the author is
 * what an exported diagram says when it has not been given one of its own, and
 * the maturity columns are what a NEW landscape starts with. Changing them never
 * rewrites a landscape somebody has already configured — which is why they are
 * here, at arm's length, and not a second copy of the diagram's own dialog.
 */
import { useEffect, useState } from 'react'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import Divider from '@mui/material/Divider'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { AspectColumnsEditor, settleFreshAspectKeys } from '../editor'
import { DEFAULT_ASPECT_CONFIG } from '../model'
import type { Translate } from '../i18n'
import type { AspectConfigEntry } from '../model'
import type { ProjectGroup, ProjectSnapshot } from '../projects/project'
import { groupNameOf } from '../projects/project'
import { refFor, refPath } from '../projects/projectRef'
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
  /** Who an exported diagram names when it has no author of its own. */
  defaultAuthor?: string
  /** The maturity columns a newly created landscape starts with. */
  defaultAspectConfig?: AspectConfigEntry[]
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
  const [author, setAuthor] = useState(project.model.defaultAuthor ?? '')
  const [columns, setColumns] = useState<AspectConfigEntry[]>(
    [...(project.model.defaultAspectConfig ?? DEFAULT_ASPECT_CONFIG)])
  const [freshColumns, setFreshColumns] = useState<string[]>([])

  // Reopening on a different project - or after a move - must not show the
  // previous project's values still sitting in the fields.
  useEffect(() => {
    if (!open) return
    setName(project.model.name)
    setGroup({ selected: project.ref.group, newName: '' })
    setAuthor(project.model.defaultAuthor ?? '')
    setColumns([...(project.model.defaultAspectConfig ?? DEFAULT_ASPECT_CONFIG)])
    setFreshColumns([])
  }, [open, project.model.name, project.ref.group, project.model.defaultAuthor,
    project.model.defaultAspectConfig])

  const groupName = group.selected === NEW_GROUP
    ? group.newName.trim()
    : groupChoiceName(group, groups) || groupNameOf(project.model)
  const ready = name.trim().length > 0 && isGroupChoiceReady(group)
  const moving = group.selected !== NEW_GROUP
    ? group.selected !== project.ref.group
    : group.newName.trim().length > 0

  return (
    <Dialog open={open} onClose={onCancel} maxWidth="sm" fullWidth>
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

          <Divider sx={{ mt: 1.5 }} />
          <Typography sx={{
            fontSize: 10, fontWeight: 700, letterSpacing: 0.6, color: 'text.secondary', mt: 1,
          }}>
            {s('settings.defaults')}
          </Typography>
          <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
            {s('settings.defaultsHelp')}
          </Typography>
          <TextField
            fullWidth
            size="small"
            margin="dense"
            label={s('settings.defaultAuthor')}
            helperText={s('settings.defaultAuthorHelp')}
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
          />
          <Typography sx={{ fontSize: 11, color: 'text.secondary', mt: 1 }}>
            {s('settings.defaultColumns')}
          </Typography>
          <AspectColumnsEditor
            columns={columns}
            fresh={freshColumns}
            onChange={(next, fresh) => { setColumns(next); setFreshColumns(fresh) }}
          />
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
            defaultAuthor: author.trim() || undefined,
            defaultAspectConfig: settleFreshAspectKeys(columns, freshColumns)
              .filter((column) => column.label.trim().length > 0),
          })}
        >
          {s('settings.save')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
