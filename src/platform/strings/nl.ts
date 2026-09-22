// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Dutch, for the menu.
 *
 * Typed from the English slice beside it, so a missing translation is a compile
 * error here rather than an English sentence on a Dutch screen. Only the web's
 * overflow reads this table; the desktop's menu bar is English (see `en.ts`).
 */
import type { EN } from './en'

export const NL: Record<keyof typeof EN, string> = {
  'menu.file': 'Bestand',
  'menu.openFolder': 'Map openen…',
  'menu.openRecent': 'Recente map openen',
  'menu.noRecent': 'Geen recente mappen',
  'menu.open': 'Openen…',
  'menu.save': 'Bewaren',
  'menu.exportWorkingFile': 'Kopie van het werkbestand bewaren…',
  'menu.snapshot': 'Momentopname…',
  'menu.history': 'Geschiedenis…',
  'menu.connectAgent': 'Agent koppelen…',
  'menu.preferences': 'Voorkeuren…',
  'menu.settings': 'Instellingen…',
  'menu.theme': 'Thema',
  'menu.themeLight': 'Licht',
  'menu.themeDark': 'Donker',
  'menu.themeSystem': 'Systeem',
  'menu.checkForUpdates': 'Zoeken naar updates…',
  'menu.more': 'Meer',
  'menu.edit': 'Bewerken',
  'menu.undo': 'Ongedaan maken',
  'menu.redo': 'Opnieuw',
  'menu.editDelete': 'Verwijderen',
  'menu.editSelectAll': 'Alles selecteren',
  'menu.help': 'Help',
  'menu.userManual': 'Handleiding',
  'menu.shortcuts': 'Sneltoetsen…',
}
