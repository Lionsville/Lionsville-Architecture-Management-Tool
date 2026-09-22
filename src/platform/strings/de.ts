// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * German, for the menu.
 *
 * Typed from the English slice beside it, so a missing translation is a compile
 * error here rather than an English sentence on a German screen. Only the web's
 * overflow reads this table; the desktop's menu bar is English (see `en.ts`).
 */
import type { EN } from './en'

export const DE: Record<keyof typeof EN, string> = {
  'menu.file': 'Datei',
  'menu.openFolder': 'Ordner öffnen…',
  'menu.openRecent': 'Zuletzt verwendeten Ordner öffnen',
  'menu.noRecent': 'Keine zuletzt verwendeten Ordner',
  'menu.open': 'Öffnen…',
  'menu.save': 'Speichern',
  'menu.exportWorkingFile': 'Kopie der Arbeitsdatei speichern…',
  'menu.snapshot': 'Snapshot erstellen…',
  'menu.history': 'Verlauf…',
  'menu.connectAgent': 'Agent verbinden…',
  'menu.preferences': 'Einstellungen…',
  'menu.settings': 'Einstellungen…',
  'menu.theme': 'Design',
  'menu.themeLight': 'Hell',
  'menu.themeDark': 'Dunkel',
  'menu.themeSystem': 'System',
  'menu.checkForUpdates': 'Nach Updates suchen…',
  'menu.more': 'Mehr',
  'menu.edit': 'Bearbeiten',
  'menu.undo': 'Rückgängig',
  'menu.redo': 'Wiederholen',
  'menu.editDelete': 'Löschen',
  'menu.editSelectAll': 'Alles auswählen',
  'menu.help': 'Hilfe',
  'menu.userManual': 'Handbuch',
  'menu.shortcuts': 'Tastenkürzel…',
}
