// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

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
 *
 * A source provider's own lines are the one thing in here that is not this
 * tree's (`platform/sourceProvider.ts`'s `SourceMenuEntry`): they come last, in
 * a section of their own, and they are asked for when the menu opens rather than
 * held — what a provider offers moves with whether anybody is signed in to it.
 */
import { useEffect, useState } from 'react'
import Divider from '@mui/material/Divider'
import IconButton from '@mui/material/IconButton'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import ListSubheader from '@mui/material/ListSubheader'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Tooltip from '@mui/material/Tooltip'
import type { StringKey, Translate } from '../i18n'
import type { HostCommand } from '../platform/hostCommands'
import type { SourceMenuEntry, SourceWorkChanged } from '../platform/sourceProvider'
import { FILE_MENU, HELP_MENU, PREFERENCES_ITEM, THEME_ITEMS, offered } from '../platform/menu'
import type { MenuCapabilities } from '../platform/menu'
import type { ThemeMode } from '../platform/theme'

export type OverflowMenuProps = {
  themeMode: ThemeMode
  can: MenuCapabilities
  onCommand: (command: HostCommand) => void
  /**
   * What the source providers want in here, asked for on every open. Absent
   * where no provider registered a line, and then this menu is what it was.
   */
  sourceEntries?: () => readonly SourceMenuEntry[]
  /**
   * A provider says its own answer has moved. An open menu asks again, which is
   * how *Sign in…* becomes a name while the person is looking at it.
   */
  onSourceWork?: SourceWorkChanged
  s: Translate
}

export function OverflowMenu({
  themeMode, can, onCommand, sourceEntries, onSourceWork, s,
}: OverflowMenuProps) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const choose = (command: HostCommand) => () => { setAnchor(null); onCommand(command) }
  const entries = offered(FILE_MENU, 'web', can)
  const help = offered(HELP_MENU, 'web', can)

  /**
   * The providers' lines, read while the menu is open and not before.
   *
   * Asked on the open because a provider's answer is about this moment, and
   * asked again on *ask me again* because the moment can move while the list is
   * on screen — a handshake finishing behind an open menu is exactly the case
   * that would otherwise need the menu closed and opened again. Nothing is asked
   * and nothing is subscribed to while the menu is shut, which is almost always.
   */
  const [lines, setLines] = useState<readonly SourceMenuEntry[]>([])
  useEffect(() => {
    if (anchor === null || !sourceEntries) return
    setLines(sourceEntries())
    return onSourceWork?.(() => setLines(sourceEntries()))
  }, [anchor, sourceEntries, onSourceWork])

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
        slotProps={{ list: { dense: true, 'aria-label': s('menu.more') } }}
        data-testid="overflow-menu"
      >
        {entries.map((entry, at) => (
          entry.kind === 'item'
            ? (
              <MenuItem key={entry.label} onClick={choose(entry.command)}>
                <ListItemText primary={s(entry.label)} slotProps={{ primary: { sx: { fontSize: 13 } } }} />
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
            <ListItemText primary={s(label)} slotProps={{ primary: { sx: { fontSize: 13 } } }} />
          </MenuItem>
        ))}
        <Divider />
        <MenuItem onClick={choose(PREFERENCES_ITEM.command)}>
          <ListItemText primary={s(PREFERENCES_ITEM.label)} slotProps={{ primary: { sx: { fontSize: 13 } } }} />
        </MenuItem>
        {/* Help, under its own heading: the same two the desktop's Help menu carries. */}
        {help.length > 0 && <Divider />}
        {help.length > 0 && <ListSubheader sx={{ lineHeight: '28px', fontSize: 11 }}>{s('menu.help')}</ListSubheader>}
        {help.map((entry) => (entry.kind === 'item' ? (
          <MenuItem key={entry.label} onClick={choose(entry.command)}>
            <ListItemText primary={s(entry.label)} slotProps={{ primary: { sx: { fontSize: 13 } } }} />
          </MenuItem>
        ) : null))}
        {/* The providers' own lines, last and under a rule. A rule and not a
            heading: a heading would be a word of ours about somewhere this shell
            has never heard of, and the lines say what they are. The label is the
            provider's key, from the table it registered, and a key nobody
            registered renders as itself — which is a blemish and never a blank.
            `href` makes the line a link as well, because a provider's own page
            is somewhere a person may want to open beside this window rather
            than instead of it; the press still reaches `onSelect`. */}
        {lines.length > 0 && <Divider />}
        {lines.map((line) => [
          line.divider ? <Divider key={`${line.key}-divider`} /> : null,
          <MenuItem
            key={line.key}
            data-testid={`source-entry-${line.key}`}
            disabled={line.disabled}
            {...(line.href ? { component: 'a' as const, href: line.href, target: '_blank', rel: 'noreferrer' } : {})}
            onClick={() => { setAnchor(null); line.onSelect() }}
          >
            <ListItemText primary={s(line.labelKey as StringKey)} slotProps={{ primary: { sx: { fontSize: 13 } } }} />
          </MenuItem>,
        ])}
      </Menu>
    </>
  )
}
