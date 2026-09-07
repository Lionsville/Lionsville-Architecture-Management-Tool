/**
 * The menu bar, rendered from the list in `src/platform/menu.ts`.
 *
 * It adds to the default menu rather than replacing it. Electron builds a
 * reasonable one — the app menu, Edit with the clipboard roles, View, Window —
 * and a hand-written template would mean owning all of that, including the
 * platform differences, to gain a dozen items.
 *
 * One of those defaults is a File menu of its own, holding nothing but Close
 * Window, and ours takes its place rather than sitting beside it. See
 * {@link fileMenuSlot}.
 *
 * **The menu decides nothing.** Every item sends a command to the window
 * (`HostCommand`) and that is the end of main's involvement. Whether
 * anything is open, whether there is unsaved work, what a working file is: all
 * of that lives in the renderer, and a menu that had to know would be a second
 * copy of the shell's state kept in the one process that cannot see the screen.
 *
 * Two exceptions, both because the fact lives on this side. The Recent
 * submenu, because main is where the list of granted folders lives; and the
 * theme radio in the View menu, which has to show which one is on — so the
 * renderer reports the mode the way it reports unsaved work, and main asks
 * nothing else.
 *
 * Labels come from the platform's English slice, verbatim. Main has no way to
 * know which language the renderer settled on; a native menu in English is
 * the price of not building a channel for it.
 */
import { Menu, MenuItem, webContents } from 'electron'
import type { MenuItemConstructorOptions } from 'electron'
import type { DesktopDirectory } from '../../src/adapters/desktop/channel'
import { fileMenuSlot } from './menuLayout'
import type { HostCommand } from '../../src/platform/hostCommands'
import {
  FILE_MENU, PREFERENCES_ITEM, SETTINGS_ITEM, THEME_ITEMS, preferencesPlacement,
} from '../../src/platform/menu'
import type { MenuEntry, MenuItemSpec } from '../../src/platform/menu'
import type { ThemeMode } from '../../src/platform/theme'
import { EN } from '../../src/platform/strings/en'

/**
 * To the focused window, and to the only window when none is focused.
 *
 * A menu item can fire with no focused window (the Dock menu, a keyboard
 * shortcut while a dialog is up), and dropping the command then would be a
 * menu item that silently does nothing every so often.
 */
export function sendCommand(command: HostCommand): void {
  const all = webContents.getAllWebContents().filter((held) => !held.isDestroyed())
  const target = all.find((held) => held.isFocused()) ?? all[0]
  target?.send('app:command', command)
}

const label = (key: keyof typeof EN): string => EN[key]

function itemFor(spec: MenuItemSpec): MenuItemConstructorOptions {
  return {
    label: label(spec.label as keyof typeof EN),
    accelerator: spec.accelerator,
    click: () => sendCommand(spec.command),
  }
}

function fileMenuFor(recents: readonly DesktopDirectory[]): MenuItemConstructorOptions[] {
  const recent: MenuItemConstructorOptions[] = recents.length === 0
    ? [{ label: label('menu.noRecent'), enabled: false }]
    : recents.map((held) => ({
        label: held.name,
        click: () => sendCommand({ type: 'openFolder', root: held.root }),
      }))

  const items = FILE_MENU.map((entry: MenuEntry): MenuItemConstructorOptions => {
    switch (entry.kind) {
      case 'item': return itemFor(entry)
      case 'separator': return { type: 'separator' }
      case 'recentFolders': return { label: label('menu.openRecent'), submenu: recent }
    }
  })

  // Preferences… above Quit, where macOS has it in the app menu instead.
  if (preferencesPlacement(process.platform) === 'fileMenu') {
    items.push({ type: 'separator' }, itemFor(PREFERENCES_ITEM))
  }
  // Closing the window is the platform's own item and keeps its role, so the
  // unsaved-work prompt in the renderer still gets its say.
  items.push({ type: 'separator' }, process.platform === 'darwin' ? { role: 'close' } : { role: 'quit' })
  return items
}

/**
 * Electron's own menu, as it was before we touched it.
 *
 * Kept because the menu is rebuilt every time the recent folders change — a
 * submenu that is already on screen does not redraw, and only
 * `Menu.setApplicationMenu` makes a change visible — and rebuilding from the
 * menu we last installed would insert File into it again on every pass.
 */
let defaults: MenuItem[] | undefined

/** The View menu's radios, kept so a reported theme can tick the right one. */
let themeRadios: { mode: ThemeMode; item: MenuItem }[] = []

/** What the renderer last said the theme was. */
let theme: ThemeMode = 'system'

/**
 * Build (or rebuild) the application menu.
 */
export function installAppMenu(options: {
  recents: readonly DesktopDirectory[]
  onCheckForUpdates: () => void
}): void {
  const first = defaults === undefined
  defaults ??= Menu.getApplicationMenu()?.items ? [...Menu.getApplicationMenu()!.items] : []

  const file = new MenuItem({ label: label('menu.file'), submenu: fileMenuFor(options.recents) })

  // Over Electron's own File menu, whose one item ours ends with.
  const items = [...defaults]
  const slot = fileMenuSlot(items, process.platform)
  items.splice(slot.index, slot.replace ? 1 : 0, file)

  const menu = new Menu()
  for (const held of items) menu.append(held)
  // Once: the default submenus are the same objects on every rebuild, so a
  // second pass would insert every item a second time.
  if (first) decorateDefaults(menu, options.onCheckForUpdates)
  tickTheme()
  Menu.setApplicationMenu(menu)
}

/** The renderer said which theme is on. Nothing else about the menu changes. */
export function reportTheme(mode: ThemeMode): void {
  theme = mode
  tickTheme()
}

function tickTheme(): void {
  for (const held of themeRadios) held.item.checked = held.mode === theme
}

/**
 * What goes into the menus Electron built, and does so exactly once.
 *
 * **Check for Updates…** exists because the update notice carries an off
 * switch, and an off switch with no on switch is a trap. Where it goes is a
 * platform convention: macOS puts it in the app menu directly under About,
 * Windows and Linux put it in Help.
 *
 * **Settings… ⌘,** goes in the app menu on macOS, which is the only platform
 * with one; elsewhere it is in the File menu above Quit, and `fileMenuFor`
 * put it there.
 *
 * **The theme** is three radio items at the foot of the View menu Electron
 * already builds, so it sits beside zoom and full screen where a person
 * expects to find how the window looks.
 */
function decorateDefaults(menu: Menu, onCheck: () => void): void {
  const updates = new MenuItem({ label: label('menu.checkForUpdates'), click: onCheck })

  if (process.platform === 'darwin') {
    // The first submenu is the app menu, and its first item is About. Below it,
    // above the separator, is where every Mac app puts these two.
    const appMenu = menu.items[0]?.submenu
    appMenu?.insert(1, updates)
    if (preferencesPlacement(process.platform) === 'appMenu') {
      appMenu?.insert(2, new MenuItem({ type: 'separator' }))
      appMenu?.insert(3, new MenuItem(itemFor(SETTINGS_ITEM)))
    }
  } else {
    menu.items.find((held) => held.role?.toLowerCase() === 'help')?.submenu?.insert(0, updates)
  }

  const view = menu.items.find((held) => held.role?.toLowerCase() === 'viewmenu')?.submenu
  if (!view) return
  themeRadios = THEME_ITEMS.map(({ mode, label: key }) => ({
    mode,
    item: new MenuItem({
      label: label(key as keyof typeof EN),
      type: 'radio',
      click: () => sendCommand({ type: 'theme', mode }),
    }),
  }))
  view.append(new MenuItem({ type: 'separator' }))
  view.append(new MenuItem({ label: label('menu.theme'), enabled: false }))
  for (const held of themeRadios) view.append(held.item)
}
