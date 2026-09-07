/**
 * The `⋯` at the end of the toolbar: the menu bar, for a host that has none.
 *
 * Present on the web and absent on the desktop (ADR-0005). It renders the
 * same list the desktop's File and View menus render — `platform/menu.ts` —
 * and sends the same commands through the same stream, so nothing that moved
 * out of the toolbar and into a menu is lost on the web. On the web this is
 * load-bearing, and `App.commands.test.tsx` walks every item to say so.
 *
 * It decides nothing beyond what `offered` decides: an item that cannot work
 * here is not shown, rather than shown disabled.
 */
import { useState } from 'react'
import Divider from '@mui/material/Divider'
import IconButton from '@mui/material/IconButton'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import ListSubheader from '@mui/material/ListSubheader'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Tooltip from '@mui/material/Tooltip'
import type { Translate } from '../i18n'
import type { HostCommand } from '../platform/hostCommands'
import { FILE_MENU, PREFERENCES_ITEM, THEME_ITEMS, offered } from '../platform/menu'
import type { MenuCapabilities } from '../platform/menu'
import type { ThemeMode } from '../platform/theme'

export type OverflowMenuProps = {
  themeMode: ThemeMode
  can: MenuCapabilities
  onCommand: (command: HostCommand) => void
  s: Translate
}

export function OverflowMenu({ themeMode, can, onCommand, s }: OverflowMenuProps) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const choose = (command: HostCommand) => () => { setAnchor(null); onCommand(command) }
  const entries = offered(FILE_MENU, 'web', can)

  return (
    <>
      <Tooltip title={s('menu.more')}>
        <IconButton
          size="small"
          aria-label={s('menu.more')}
          data-testid="overflow-button"
          onClick={(e) => setAnchor(e.currentTarget)}
          sx={{ color: 'text.secondary', fontSize: 16, width: 30, height: 30 }}
        >
          ⋯
        </IconButton>
      </Tooltip>
      <Menu
        open={anchor !== null}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        MenuListProps={{ dense: true, 'aria-label': s('menu.more') }}
        data-testid="overflow-menu"
      >
        {entries.map((entry, at) => (
          entry.kind === 'item'
            ? (
              <MenuItem key={entry.label} onClick={choose(entry.command)}>
                <ListItemText primary={s(entry.label)} primaryTypographyProps={{ fontSize: 13 }} />
              </MenuItem>
            )
            : <Divider key={`separator-${at}`} />
        ))}
        <Divider />
        <ListSubheader sx={{ lineHeight: '28px', fontSize: 11 }}>{s('menu.theme')}</ListSubheader>
        {THEME_ITEMS.map(({ mode, label }) => (
          <MenuItem
            key={mode}
            role="menuitemradio"
            aria-checked={mode === themeMode}
            onClick={choose({ type: 'theme', mode })}
          >
            <ListItemIcon sx={{ minWidth: 24, fontSize: 12 }}>{mode === themeMode ? '✓' : ''}</ListItemIcon>
            <ListItemText primary={s(label)} primaryTypographyProps={{ fontSize: 13 }} />
          </MenuItem>
        ))}
        <Divider />
        <MenuItem onClick={choose(PREFERENCES_ITEM.command)}>
          <ListItemText primary={s(PREFERENCES_ITEM.label)} primaryTypographyProps={{ fontSize: 13 }} />
        </MenuItem>
      </Menu>
    </>
  )
}
