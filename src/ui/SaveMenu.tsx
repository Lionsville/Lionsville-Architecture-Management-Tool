/**
 * The menu behind "Save…".
 *
 * The working file comes first: that is the file you carry on working in. The
 * interchange document is second because it carries less — and that says so on
 * the line itself, not in a tooltip you have to find.
 */
import ListItemText from '@mui/material/ListItemText'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import type { Translate } from '@lionsville/solution-design'

export type SaveMenuProps = {
  anchorEl: HTMLElement | null
  onClose: () => void
  onSaveWorkingFile: () => void
  onSaveInterchange: () => void
  s: Translate
}

export function SaveMenu({
  anchorEl, onClose, onSaveWorkingFile, onSaveInterchange, s,
}: SaveMenuProps) {
  const choose = (action: () => void) => () => { onClose(); action() }
  return (
    <Menu
      open={anchorEl !== null}
      anchorEl={anchorEl}
      onClose={onClose}
      MenuListProps={{ dense: true, 'aria-label': s('shell.saveMenu') }}
    >
      <MenuItem onClick={choose(onSaveWorkingFile)}>
        <ListItemText
          primary={s('shell.workingFile')}
          secondary={s('shell.workingFileNote')}
          primaryTypographyProps={{ fontSize: 13, fontWeight: 600 }}
          secondaryTypographyProps={{ fontSize: 11 }}
        />
      </MenuItem>
      <MenuItem onClick={choose(onSaveInterchange)}>
        <ListItemText
          primary={s('shell.interchange')}
          secondary={s('shell.interchangeNote')}
          primaryTypographyProps={{ fontSize: 13, fontWeight: 600 }}
          secondaryTypographyProps={{ fontSize: 11 }}
        />
      </MenuItem>
    </Menu>
  )
}
