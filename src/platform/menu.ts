/**
 * The menu, said once (ADR-0005).
 *
 * The File menu's vocabulary — Open Folder…, Open…, Save, the two exports,
 * Snapshot…, History…, Preferences… — and the View menu's, which is the
 * theme, declared here as data: a label key, a command, an accelerator, and
 * which hosts carry it. Two things render this list and neither decides
 * anything:
 *
 * - `electron/main/appMenu.ts`, into the menu bar. Preferences goes where the
 *   platform puts it ({@link preferencesPlacement}), and the theme is three
 *   radio items in the View menu Electron already builds.
 * - The toolbar's overflow, one `⋯`, present on the web and absent on the
 *   desktop, carrying the same list. On the web the overflow is load-bearing:
 *   anything moved out of the toolbar and into a menu bar disappears there
 *   unless something is put in its place, and this is that something.
 *
 * An item is offered on a host only while the shell says it can be done —
 * a folder to choose, a history to keep. That is {@link offered}, and it is
 * the one decision this file makes: an item that cannot work is worse than an
 * item that is missing. The desktop's menu bar shows everything regardless,
 * because main cannot see the screen; the renderer ignores what it cannot do.
 */
// From the table itself and not the module index: the index pulls in the React
// context, and the electron main bundle compiles this file without JSX.
import type { StringKey } from '../i18n/strings'
import type { HostCommand } from './hostCommands'
import type { ThemeMode } from './theme'

export type MenuHost = 'desktop' | 'web'

/** What an item needs the shell to have before it is worth offering. */
export type MenuNeed = 'history' | 'folders'

export type MenuItemSpec = {
  readonly kind: 'item'
  readonly label: StringKey
  readonly command: HostCommand
  /** Electron's accelerator syntax. The web shows none. */
  readonly accelerator?: string
  readonly on: readonly MenuHost[]
  readonly needs?: MenuNeed
}

export type MenuEntry =
  | MenuItemSpec
  | { readonly kind: 'separator' }
  /**
   * The Recent submenu. Main's exception to "the menu decides nothing", and
   * only because main is where the list of granted folders lives — a renderer
   * cannot be trusted to name one. The web has no such list and skips it.
   */
  | { readonly kind: 'recentFolders' }

const BOTH: readonly MenuHost[] = ['desktop', 'web']

function item(
  label: StringKey, command: HostCommand, accelerator?: string, needs?: MenuNeed,
): MenuItemSpec {
  return { kind: 'item', label, command, accelerator, on: BOTH, needs }
}

export const FILE_MENU: readonly MenuEntry[] = [
  item('menu.openFolder', { type: 'chooseFolder' }, 'CmdOrCtrl+Shift+O', 'folders'),
  { kind: 'recentFolders' },
  { kind: 'separator' },
  item('menu.open', { type: 'open' }, 'CmdOrCtrl+O'),
  item('menu.save', { type: 'save' }, 'CmdOrCtrl+S'),
  item('menu.exportWorkingFile', { type: 'export' }, 'CmdOrCtrl+Shift+E'),
  item('menu.exportInterchange', { type: 'exportInterchange' }),
  { kind: 'separator' },
  item('menu.snapshot', { type: 'snapshot' }, undefined, 'history'),
  item('menu.history', { type: 'history' }, undefined, 'history'),
  { kind: 'separator' },
  // On both hosts, and needing nothing: in a browser tab the dialog explains
  // and says the desktop app is where an agent can connect (ADR-0007).
  item('menu.connectAgent', { type: 'connectAgent' }),
]

/**
 * Preferences. On macOS it is **Settings… ⌘,** in the app menu; elsewhere
 * **Preferences…** above Quit in the File menu. Same command either way.
 */
export const PREFERENCES_ITEM: MenuItemSpec = item('menu.preferences', { type: 'preferences' }, 'CmdOrCtrl+,')
export const SETTINGS_ITEM: MenuItemSpec = { ...PREFERENCES_ITEM, label: 'menu.settings' }

export function preferencesPlacement(platform: string): 'appMenu' | 'fileMenu' {
  return platform === 'darwin' ? 'appMenu' : 'fileMenu'
}

/** The View menu's three radios, and the overflow's. */
export const THEME_MODE_LABEL: Record<ThemeMode, StringKey> = {
  light: 'menu.themeLight', dark: 'menu.themeDark', system: 'menu.themeSystem',
}

export const THEME_ITEMS: readonly { readonly mode: ThemeMode; readonly label: StringKey }[] =
  (['light', 'dark', 'system'] as const).map((mode) => ({ mode, label: THEME_MODE_LABEL[mode] }))

export type MenuCapabilities = {
  /** Can this machine keep a history of the folder? */
  readonly history: boolean
  /** Can a folder be chosen here at all? */
  readonly folders: boolean
}

/**
 * The entries a host offers, given what the shell can do right now.
 *
 * Separators are tidied after the filtering, so a section whose every item
 * is missing does not leave a rule behind, and the list never starts or ends
 * with one.
 */
export function offered(
  entries: readonly MenuEntry[], host: MenuHost, can: MenuCapabilities,
): MenuEntry[] {
  const kept: MenuEntry[] = []
  for (const entry of entries) {
    if (entry.kind === 'recentFolders') {
      if (host === 'desktop') kept.push(entry)
      continue
    }
    if (entry.kind === 'separator') {
      if (kept.length > 0 && kept[kept.length - 1].kind !== 'separator') kept.push(entry)
      continue
    }
    if (!entry.on.includes(host)) continue
    if (entry.needs && !can[entry.needs]) continue
    kept.push(entry)
  }
  while (kept.length > 0 && kept[kept.length - 1].kind === 'separator') kept.pop()
  return kept
}

/** Every command the menu bar or the overflow can send, for a test to walk. */
export function commandsIn(entries: readonly MenuEntry[]): HostCommand[] {
  return entries.flatMap((entry) => (entry.kind === 'item' ? [entry.command] : []))
}
