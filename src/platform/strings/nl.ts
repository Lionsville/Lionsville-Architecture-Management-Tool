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
  'menu.connect': 'Een map openen…',
  'menu.openRecent': 'Recente map openen',
  'menu.noRecent': 'Geen recente mappen',
  'menu.open': 'Een bestand openen…',
  'menu.save': 'Bewaren',
  'menu.exportWorkingFile': 'Kopie bewaren…',
  'menu.shareLink': 'Delen met een link…',
  'menu.snapshot': 'Een snapshot maken…',
  'menu.history': 'Geschiedenis…',
  'menu.connectAgent': 'Agent koppelen…',
  'menu.preferences': 'Voorkeuren…',
  'menu.settings': 'Instellingen…',
  'menu.view': 'Beeld',
  'menu.zoomActual': 'Ware grootte',
  'menu.zoomIn': 'Inzoomen',
  'menu.zoomOut': 'Uitzoomen',
  'menu.textLarger': 'Grotere tekst',
  'menu.textSmaller': 'Kleinere tekst',
  'menu.textDefault': 'Standaard tekstgrootte',
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
  'menu.userManual': 'Help bij Lionsville Architect',
  'menu.helpHere': 'Help bij deze pagina',
  'menu.shortcuts': 'Sneltoetsen…',
  'menu.visitExample': 'Rondkijken in het voorbeeld',
  'menu.go': 'Ga',
  'menu.back': 'Terug',
  'menu.forward': 'Vooruit',
  'menu.getDesktopApp': 'Desktop-app downloaden',
  // The question the desktop asks where closing would lose what could not be saved.
  'window.unsavedTitle': 'Niet-bewaarde wijzigingen',
  'window.unsavedMessage': 'Deze scope kon niet worden bewaard.',
  'window.unsavedDetail': 'Nu sluiten verliest de wijzigingen die alleen nog in dit venster staan.',
  'window.closeAnyway': 'Toch sluiten',
  'window.keepOpen': 'Venster open laten',
  'menu.website': 'Website',
  'menu.exportPicture': 'Afbeelding exporteren…',
  'menu.notNow': 'Nu niet beschikbaar',
  'menu.saveNothingOpen': 'Er staat niets open. Werk bewaart zichzelf; open een scope om nu te bewaren.',
}
