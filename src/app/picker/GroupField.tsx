/**
 * Choose a group, or name a new one.
 *
 * The one control shared by "new project" and "project settings", because both
 * ask the same question and the wrong answer to it is the same in both: a typo
 * that silently creates a near-duplicate group. A select of what exists makes
 * the common case a click; "New group..." is the deliberate escape from it.
 *
 * The value is the group SLUG for an existing group and the typed text for a new
 * one, which is why the caller gets both halves back - it needs the slug to
 * address and the label to display.
 */
import MenuItem from '@mui/material/MenuItem'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import type { Translate } from '../../i18n'
import type { ProjectGroup } from '../../projects/project'

/** The sentinel the select uses for "not one of these". */
export const NEW_GROUP = '\u0000new'

export type GroupChoice = {
  /** An existing group's slug, or {@link NEW_GROUP}. */
  selected: string
  /** What was typed when `selected` is {@link NEW_GROUP}. */
  newName: string
}

export function groupChoiceName(choice: GroupChoice, groups: readonly ProjectGroup[]): string {
  if (choice.selected === NEW_GROUP) return choice.newName.trim()
  return groups.find((g) => g.group === choice.selected)?.name ?? ''
}

export function isGroupChoiceReady(choice: GroupChoice): boolean {
  return choice.selected !== NEW_GROUP || choice.newName.trim().length > 0
}

export type GroupFieldProps = {
  groups: readonly ProjectGroup[]
  value: GroupChoice
  onChange: (next: GroupChoice) => void
  label: string
  helperText?: string
  s: Translate
}

export function GroupField({ groups, value, onChange, label, helperText, s }: GroupFieldProps) {
  return (
    <Stack spacing={1}>
      <TextField
        select
        fullWidth
        margin="dense"
        label={label}
        value={value.selected}
        helperText={value.selected === NEW_GROUP ? undefined : helperText}
        onChange={(e) => onChange({ ...value, selected: e.target.value })}
      >
        {groups.map((group) => (
          <MenuItem key={group.group} value={group.group}>{group.name}</MenuItem>
        ))}
        <MenuItem value={NEW_GROUP}>{s('picker.groupNewOption')}</MenuItem>
      </TextField>
      {value.selected === NEW_GROUP && (
        <TextField
          autoFocus
          fullWidth
          margin="dense"
          label={s('picker.group')}
          helperText={s('picker.groupHelp')}
          value={value.newName}
          onChange={(e) => onChange({ ...value, newName: e.target.value })}
        />
      )}
    </Stack>
  )
}
