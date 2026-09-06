/**
 * The File menu, and the one item that was here before it.
 *
 * It adds to the default menu rather than replacing it. Electron builds a
 * reasonable one — the app menu, Edit with the clipboard roles, View, Window —
 * and a hand-written template would mean owning all of that, including the
 * platform differences, to gain five items.
 *
 * **The menu decides nothing.** Every item sends a command to the window
 * (`HostCommand`) and that is the end of main's involvement. Whether
 * anything is open, whether there is unsaved work, what a working file is: all
 * of that lives in the renderer, and a menu that had to know would be a second
 * copy of the shell's state kept in the one process that cannot see the screen.
 *
 * The Recent submenu is the exception, and only because main is where the list
 * of granted folders lives — a renderer cannot be trusted to name one.
 */
import { Menu, MenuItem, webContents } from 'electron'
import type { MenuItemConstructorOptions } from 'electron'
import type { DesktopDirectory } from '../../src/adapters/desktop/channel'
import type { HostCommand } from '../../src/platform/hostCommands'

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

function item(
  label: string, command: HostCommand, accelerator?: string,
): MenuItemConstructorOptions {
  return { label, accelerator, click: () => sendCommand(command) }
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
let updatesItemAdded = false

/**
 * Build (or rebuild) the application menu.
 */
export function installAppMenu(options: {
  recents: readonly DesktopDirectory[]
  onCheckForUpdates: () => void
}): void {
  defaults ??= Menu.getApplicationMenu()?.items ? [...Menu.getApplicationMenu()!.items] : []

  const recent: MenuItemConstructorOptions[] = options.recents.length === 0
    ? [{ label: 'No Recent Folders', enabled: false }]
    : options.recents.map((held) => item(held.name, { type: 'openFolder', root: held.root }))

  const file = new MenuItem({
    label: 'File',
    submenu: [
      item('Open Folder…', { type: 'chooseFolder' }, 'CmdOrCtrl+Shift+O'),
      { label: 'Open Recent Folder', submenu: recent },
      { type: 'separator' },
      item('Open…', { type: 'open' }, 'CmdOrCtrl+O'),
      item('Save', { type: 'save' }, 'CmdOrCtrl+S'),
      item('Export…', { type: 'export' }, 'CmdOrCtrl+Shift+E'),
      { type: 'separator' },
      // Closing the window is the platform's own item and keeps its role, so
      // the unsaved-work prompt in the renderer still gets its say.
      process.platform === 'darwin' ? { role: 'close' } : { role: 'quit' },
    ],
  })

  // After the app menu on macOS, first on the platforms that have none.
  const items = [...defaults]
  items.splice(process.platform === 'darwin' ? 1 : 0, 0, file)

  const menu = new Menu()
  for (const held of items) menu.append(held)
  if (!updatesItemAdded) {
    // Once: the submenus are the same objects on every rebuild, so a second
    // pass would add a second Check for Updates.
    addCheckForUpdatesItem(menu, options.onCheckForUpdates)
    updatesItemAdded = true
  }
  Menu.setApplicationMenu(menu)
}

/**
 * **Check for Updates…**
 *
 * It exists because the update notice carries an off switch, and an off switch
 * with no on switch is a trap. Unticking "Check for updates automatically"
 * would otherwise be the last thing this app ever said about updates, with the
 * only way back a JSON file in the user's Application Support folder.
 *
 * Where the item goes is a platform convention, not a preference: macOS puts it
 * in the app menu directly under About, Windows and Linux put it in Help.
 */
function addCheckForUpdatesItem(menu: Menu, onCheck: () => void): void {
  const entry = new MenuItem({ label: 'Check for Updates…', click: onCheck })

  if (process.platform === 'darwin') {
    // The first submenu is the app menu, and its first item is About. Below it,
    // above the separator, is where every Mac app puts this.
    menu.items[0]?.submenu?.insert(1, entry)
    return
  }
  menu.items.find((held) => held.role === 'help')?.submenu?.insert(0, entry)
}
