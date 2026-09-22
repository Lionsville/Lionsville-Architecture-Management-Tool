// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

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
 * renderer reports the mode the way it reports unsaved work. The third fact
 * the renderer reports is whether a scope is open, so the items that act on
 * one — Open…, Save, Save a Copy…, and the Edit menu's four — are disabled
 * while none is, rather than doing nothing in silence. Main asks nothing
 * else (ADR-0005, amended).
 *
 * Edit and Help are ours as well as File. Electron's Edit menu binds Undo to
 * the DOM, which the app's one undo stack is not in, so its four that are the
 * app's send commands and the clipboard roles stay; its Help menu links to
 * Electron's own pages, so ours has the manual, the shortcut overlay and
 * Check for Updates… — one place for it on every platform. A packaged build
 * loses the developer items from View.
 *
 * Labels come from the platform's English slice, verbatim. Main has no way to
 * know which language the renderer settled on; a native menu in English is
 * the price of not building a channel for it.
 */
import { Menu, MenuItem, webContents } from 'electron'
import type { MenuItemConstructorOptions } from 'electron'
import type { DesktopDirectory } from '../../src/adapters/desktop/channel'
import { fileMenuSlot, helpMenuTail, replacingSlot } from './menuLayout'
import type { HostCommand } from '../../src/platform/hostCommands'
import {
  EDIT_ITEMS, FILE_MENU, HELP_MENU, PREFERENCES_ITEM, SETTINGS_ITEM, THEME_ITEMS, preferencesPlacement,
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

/** The id an item that needs a scope is found by, to enable it when one opens. */
const scopeId = (spec: MenuItemSpec) => `scope:${spec.command.type}`

function itemFor(spec: MenuItemSpec): MenuItemConstructorOptions {
  return {
    label: label(spec.label as keyof typeof EN),
    accelerator: spec.accelerator,
    click: () => sendCommand(spec.command),
    ...(spec.needs?.includes('scope') ? { id: scopeId(spec), enabled: scopeOpen } : {}),
  }
}

/**
 * Edit: Undo, Redo, Delete and Select All as commands the renderer routes to
 * the app's undo stack and the canvas's selection; Cut, Copy and Paste as the
 * roles they always were, because the clipboard belongs to the page. ⌘Z and
 * ⌘⇧Z are on the command items now, not on roles — and on macOS a menu
 * accelerator fires whether or not the page handled the key, so the menu bar
 * is their one owner: the canvas leaves them alone on the desktop, and the
 * renderer gives a focused text field its own undo before touching the stack.
 */
function editMenuFor(): MenuItemConstructorOptions[] {
  return [
    itemFor(EDIT_ITEMS.undo),
    itemFor(EDIT_ITEMS.redo),
    { type: 'separator' },
    { role: 'cut' },
    { role: 'copy' },
    { role: 'paste' },
    ...(process.platform === 'darwin' ? [{ role: 'pasteAndMatchStyle' } as const] : []),
    { type: 'separator' },
    itemFor(EDIT_ITEMS.delete),
    itemFor(EDIT_ITEMS.selectAll),
  ]
}

/**
 * Help: the two commands, then Check for Updates…, main's own, in one place on
 * every platform — and only where this build checks for updates at all
 * (`helpMenuTail`). Without `onCheck` the item and the rule above it are both
 * absent, rather than an item that calls nothing.
 */
function helpMenuFor(onCheck?: () => void): MenuItemConstructorOptions[] {
  return [
    ...HELP_MENU.map((entry): MenuItemConstructorOptions => (entry.kind === 'item' ? itemFor(entry) : { type: 'separator' })),
    ...helpMenuTail(onCheck !== undefined).map((entry): MenuItemConstructorOptions => (
      entry.kind === 'separator' ? { type: 'separator' } : { label: label('menu.checkForUpdates'), click: onCheck }
    )),
  ]
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

/** What the renderer last said about having a scope open. */
let scopeOpen = false

/**
 * Build (or rebuild) the application menu.
 */
export function installAppMenu(options: {
  recents: readonly DesktopDirectory[]
  /**
   * Check for updates, by hand, now. Absent where this build does not check for
   * them at all — a development run, a smoke run, a machine told not to phone
   * home, or a build composed from this one that keeps its own updates — and
   * Help then ends where it ended before the item existed.
   */
  onCheckForUpdates?: () => void
  /** A packaged build: the developer items leave the View menu. */
  packaged: boolean
}): void {
  const first = defaults === undefined
  defaults ??= Menu.getApplicationMenu()?.items ? [...Menu.getApplicationMenu()!.items] : []

  const file = new MenuItem({ label: label('menu.file'), submenu: fileMenuFor(options.recents) })
  const edit = new MenuItem({ label: label('menu.edit'), submenu: editMenuFor() })
  const help = new MenuItem({ label: label('menu.help'), role: 'help', submenu: helpMenuFor(options.onCheckForUpdates) })

  // Over Electron's own File menu, whose one item ours ends with; then over
  // its Edit and Help, which bind the wrong things.
  const items = [...defaults]
  const slot = fileMenuSlot(items, process.platform)
  items.splice(slot.index, slot.replace ? 1 : 0, file)
  const editSlot = replacingSlot(items, 'editmenu')
  items.splice(editSlot.index, editSlot.replace ? 1 : 0, edit)
  const helpSlot = replacingSlot(items, 'help')
  items.splice(helpSlot.index, helpSlot.replace ? 1 : 0, help)

  const menu = new Menu()
  for (const held of items) menu.append(held)
  // Once: the default submenus are the same objects on every rebuild, so a
  // second pass would insert every item a second time.
  if (first) decorateDefaults(menu, options.packaged)
  tickTheme()
  Menu.setApplicationMenu(menu)
  tickScope()
}

/** The renderer said which theme is on. Nothing else about the menu changes. */
export function reportTheme(mode: ThemeMode): void {
  theme = mode
  tickTheme()
}

/** The renderer said whether a scope is open. The items about one follow. */
export function reportScopeOpen(open: boolean): void {
  scopeOpen = open
  tickScope()
}

function tickTheme(): void {
  for (const held of themeRadios) held.item.checked = held.mode === theme
}

/**
 * Every item that needs a scope, found by id in the menu that is up: the
 * File menu's three and the Edit menu's four are rebuilt with the recents,
 * so a kept reference would point at a menu no longer shown.
 */
function tickScope(): void {
  const menu = Menu.getApplicationMenu()
  if (!menu) return
  const specs = [
    ...FILE_MENU.filter((entry): entry is MenuItemSpec => entry.kind === 'item'),
    ...HELP_MENU.filter((entry): entry is MenuItemSpec => entry.kind === 'item'),
    ...Object.values(EDIT_ITEMS),
  ]
  for (const spec of specs) {
    if (!spec.needs?.includes('scope')) continue
    const held = menu.getMenuItemById(scopeId(spec))
    if (held) held.enabled = scopeOpen
  }
}

/**
 * What goes into the menus Electron built, and does so exactly once.
 *
 * **Settings… ⌘,** goes in the app menu on macOS, which is the only platform
 * with one; elsewhere it is in the File menu above Quit, and `fileMenuFor`
 * put it there. Check for Updates… used to sit beside it here and in Help
 * elsewhere; it is in Help on every platform now (`helpMenuFor`), one place.
 *
 * **View** loses Reload, Force Reload and Toggle Developer Tools in a
 * packaged build: they are for whoever builds the app, and a person who
 * reloads by accident loses the unsaved minute. They stay in development.
 *
 * **The theme** is three radio items at the foot of the View menu Electron
 * already builds, so it sits beside zoom and full screen where a person
 * expects to find how the window looks.
 */
function decorateDefaults(menu: Menu, packaged: boolean): void {
  if (process.platform === 'darwin' && preferencesPlacement(process.platform) === 'appMenu') {
    // The first submenu is the app menu, and its first item is About. Below
    // it, above the separator, is where every Mac app puts Settings.
    const appMenu = menu.items[0]?.submenu
    appMenu?.insert(1, new MenuItem({ type: 'separator' }))
    appMenu?.insert(2, new MenuItem(itemFor(SETTINGS_ITEM)))
  }

  const view = menu.items.find((held) => held.role?.toLowerCase() === 'viewmenu')?.submenu
  if (!view) return
  if (packaged) {
    const developer = new Set(['reload', 'forcereload', 'toggledevtools'])
    for (const held of view.items) {
      if (developer.has(held.role?.toLowerCase() ?? '')) held.visible = false
    }
    // The separator that followed them would otherwise open the menu.
    const first = view.items.find((held) => held.visible)
    if (first?.type === 'separator') first.visible = false
  }
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
