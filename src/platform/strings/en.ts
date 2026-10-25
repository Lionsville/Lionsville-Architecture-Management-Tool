// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

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
 *
 * Sentence case, like every button beside the overflow that carries it on the
 * web; the menu bar says the same items in Title Case through `titleCase`
 * (`menu.ts`), as a macOS menu does.
 */
export const EN = {
  'menu.file': 'File',
  'menu.connect': 'Open folder…',
  'menu.openRecent': 'Open recent folder',
  'menu.noRecent': 'No recent folders',
  'menu.open': 'Open…',
  'menu.save': 'Save',
  'menu.exportWorkingFile': 'Save a copy of the working file…',
  'menu.shareLink': 'Share with a link…',
  'menu.snapshot': 'Snapshot…',
  'menu.history': 'History…',
  'menu.connectAgent': 'Connect an agent…',
  /** Where the platform puts it decides which of the two words it gets. */
  'menu.preferences': 'Preferences…',
  'menu.settings': 'Settings…',
  'menu.theme': 'Theme',
  'menu.themeLight': 'Light',
  'menu.themeDark': 'Dark',
  'menu.themeSystem': 'System',
  'menu.checkForUpdates': 'Check for updates…',
  /** The web's overflow button, which carries the same list as the menu bar. */
  'menu.more': 'More',
  // Edit: the four that are the app's, beside the clipboard roles.
  'menu.edit': 'Edit',
  'menu.undo': 'Undo',
  'menu.redo': 'Redo',
  'menu.editDelete': 'Delete',
  'menu.editSelectAll': 'Select all',
  // Help, on both hosts.
  'menu.help': 'Help',
  'menu.userManual': 'User manual',
  'menu.shortcuts': 'Keyboard shortcuts…',
  /** The desktop's Go menu (ADR-0033), between View and Window as on every Mac. */
  'menu.go': 'Go',
  'menu.back': 'Back',
  'menu.forward': 'Forward',
  /** The web's link to the desktop app's download page; the desktop never shows it. */
  'menu.getDesktopApp': 'Get the desktop app',
  // The question the desktop asks where closing would lose what could not be saved.
  'window.unsavedTitle': 'Unsaved changes',
  'window.unsavedMessage': 'This scope could not be saved.',
  'window.unsavedDetail': 'Closing now loses the changes that are still only in this window.',
  'window.closeAnyway': 'Close anyway',
  'window.keepOpen': 'Keep the window open',
  'menu.website': 'Website',
} as const
