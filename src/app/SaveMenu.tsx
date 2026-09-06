/**
 * The menu behind "Save…".
 *
 * The working file comes first: that is the file you carry on working in. The
 * interchange document is second because it carries less — and that says so on
 * the line itself, not in a tooltip you have to find.
 *
 * The history items are here rather than in a menu of their own because they
 * belong to the same question — where does this end up — and because they are
 * not always there: a machine with no git cannot keep a history, and an item
 * that cannot work is worse than an item that is missing.
 */
import Divider from '@mui/material/Divider'
import ListItemText from '@mui/material/ListItemText'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import type { Translate } from '../i18n'

export type SaveMenuProps = {
  anchorEl: HTMLElement | null
  onClose: () => void
  onSaveWorkingFile: () => void
  onSaveInterchange: () => void
  /** Both absent unless this machine can keep a history of the folder. */
  onSnapshot?: () => void
  onOpenHistory?: () => void
  s: Translate
}

export function SaveMenu({
  anchorEl, onClose, onSaveWorkingFile, onSaveInterchange, onSnapshot, onOpenHistory, s,
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
      {onSnapshot && onOpenHistory && [
        <Divider key="divider" />,
        <MenuItem key="snapshot" onClick={choose(onSnapshot)}>
          <ListItemText
            primary={s('history.snapshot')}
            secondary={s('history.snapshotNote')}
            primaryTypographyProps={{ fontSize: 13, fontWeight: 600 }}
            secondaryTypographyProps={{ fontSize: 11 }}
          />
        </MenuItem>,
        <MenuItem key="history" onClick={choose(onOpenHistory)}>
          <ListItemText
            primary={s('history.open')}
            secondary={s('history.openNote')}
            primaryTypographyProps={{ fontSize: 13, fontWeight: 600 }}
            secondaryTypographyProps={{ fontSize: 11 }}
          />
        </MenuItem>,
      ]}
    </Menu>
  )
}
