// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * One table of commands. `platform/menu.ts` says the items, which the
 * desktop's menu bar renders, and this reads the same items out for what a
 * browser draws: the ⋯, the ? menu, ⌘K and the sheet of keys. A command is
 * added once, there or here, and is in all of them.
 */
import { EDIT_ITEMS, FILE_MENU, HELP_MENU, PREFERENCES_ITEM, TEXT_SIZE_ITEMS, THEME_ITEMS, ZOOM_ITEMS, goMenu, offered } from '../../platform/menu'
import type { MenuCapabilities, MenuItemSpec } from '../../platform/menu'
import type { HostCommand } from '../../platform/hostCommands'
import type { StringKey } from '../../i18n'

export type CommandRow = {
  readonly id: string
  readonly label: StringKey
  readonly group: 'file' | 'edit' | 'go' | 'view' | 'help'
  /** Electron's spelling; `keyCap` says it for this platform. */
  readonly keys?: string
  readonly command: HostCommand
}

const row = (group: CommandRow['group'], item: MenuItemSpec): CommandRow => ({
  id: `${group}:${item.label}`, label: item.label, group, command: item.command,
  ...(item.accelerator ? { keys: item.accelerator } : {}),
})

/** Every command a host could run now, in the menu's order; the platform says which spelling of Back. */
export function commandsTable(can: MenuCapabilities, platform: string): readonly CommandRow[] {
  const items = (entries: Parameters<typeof offered>[0], host: 'desktop' | 'web') => offered(entries, host, can)
    .flatMap((entry) => (entry.kind === 'item' ? [entry] : []))
  return [
    ...items(FILE_MENU, 'web').map((item) => row('file', item)),
    ...items([EDIT_ITEMS.undo, EDIT_ITEMS.redo, EDIT_ITEMS.delete, EDIT_ITEMS.selectAll], 'web').map((item) => row('edit', item)),
    ...goMenu(platform).map((item) => row('go', item)),
    ...THEME_ITEMS.map(({ mode, label }): CommandRow => ({ id: `view:${mode}`, label, group: 'view', command: { type: 'theme', mode } })),
    ...items(ZOOM_ITEMS, 'web').map((item) => row('view', item)),
    ...items(TEXT_SIZE_ITEMS, 'web').map((item) => row('view', item)),
    row('view', PREFERENCES_ITEM),
    ...items(HELP_MENU, 'web').map((item) => row('help', item)),
  ]
}

/** An accelerator as a person reads it on this platform. */
export function keyCap(keys: string, mac: boolean): string {
  const said: Record<string, string> = {
    CmdOrCtrl: mac ? '⌘' : 'Ctrl', Cmd: '⌘', Shift: mac ? '⇧' : 'Shift', Alt: mac ? '⌥' : 'Alt', Left: '←', Right: '→', Plus: '+',
  }
  return keys.split('+').map((part) => said[part] ?? part).join(mac ? '' : '+')
}

/**
 * The keys the frame and the shell answer on every screen, that are on no menu:
 * the find, the tree, the help at this screen and the sheet of keys itself
 * (`AppFrame`'s `useFrameKeys`, `helpKeys.ts`). The sheet lists them, and the
 * help may name no key that is not here, on a menu or in the canvas's keymap
 * (`help/helpKeys.test.ts`).
 */
export const FRAME_KEYS = (mac: boolean): readonly (readonly [StringKey, string])[] => [
  ['frame.find', mac ? '⌘K' : 'Ctrl K'],
  ['frame.treeToggle', mac ? '⌘\\' : 'Ctrl \\'],
  ['frame.helpHere', 'F1'],
  ['menu.shortcuts', '?'],
]
