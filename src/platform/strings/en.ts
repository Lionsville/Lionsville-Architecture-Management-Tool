/**
 * English, for the menu — the one vocabulary two hosts render.
 *
 * `as const`, so this slice is the schema for its own keys: `nl.ts` beside it
 * cannot be missing one and cannot invent one. The registry composes every
 * module's slice into the table `t()` reads (`i18n/strings.ts`).
 *
 * The desktop's menu bar reads this table directly and in English: main has
 * no way to know which language the renderer settled on, and a native menu in
 * English is the price of not building a channel for it yet. The web's
 * overflow reads it through `t()` like everything else.
 */
export const EN = {
  'menu.file': 'File',
  'menu.openFolder': 'Open Folder…',
  'menu.openRecent': 'Open Recent Folder',
  'menu.noRecent': 'No Recent Folders',
  'menu.open': 'Open…',
  'menu.save': 'Save',
  'menu.exportWorkingFile': 'Export Working File…',
  'menu.exportInterchange': 'Export Interchange Document…',
  'menu.snapshot': 'Snapshot…',
  'menu.history': 'History…',
  /** Where the platform puts it decides which of the two words it gets. */
  'menu.preferences': 'Preferences…',
  'menu.settings': 'Settings…',
  'menu.theme': 'Theme',
  'menu.themeLight': 'Light',
  'menu.themeDark': 'Dark',
  'menu.themeSystem': 'System',
  'menu.checkForUpdates': 'Check for Updates…',
  /** The web's overflow button, which carries the same list as the menu bar. */
  'menu.more': 'More',
} as const
