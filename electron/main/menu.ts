/**
 * One item in the menu: **Check for Updates…**
 *
 * It exists because the update notice carries an off switch, and an off switch
 * with no on switch is a trap. Unticking "Check for updates automatically"
 * would otherwise be the last thing this app ever said about updates, with the
 * only way back a JSON file in the user's Application Support folder.
 *
 * It adds to the default menu rather than replacing it. Electron builds a
 * reasonable one — the app menu, Edit with the clipboard roles, View, Window —
 * and a hand-written template would mean owning all of that, including the
 * platform differences, to gain one item. `Menu.insert` lets an existing menu
 * be added to; `setApplicationMenu` re-applies it.
 *
 * Where the item goes is a platform convention, not a preference: macOS puts it
 * in the app menu directly under About, Windows and Linux put it in Help.
 */
import { Menu, MenuItem } from 'electron'

export function addCheckForUpdatesItem(onCheck: () => void): void {
  const menu = Menu.getApplicationMenu()
  if (!menu) return

  const item = new MenuItem({ label: 'Check for Updates…', click: onCheck })

  if (process.platform === 'darwin') {
    // The first submenu is the app menu, and its first item is About. Below it,
    // above the separator, is where every Mac app puts this.
    const appMenu = menu.items[0]?.submenu
    if (!appMenu) return
    appMenu.insert(1, item)
  } else {
    const help = menu.items.find((entry) => entry.role === 'help')?.submenu
    if (!help) return
    help.insert(0, item)
  }

  // A menu is only live once it has been set; mutating the one that is showing
  // does not redraw it.
  Menu.setApplicationMenu(menu)
}
