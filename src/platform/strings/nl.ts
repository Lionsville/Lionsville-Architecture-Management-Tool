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
  'menu.exportWorkingFile': 'Werkbestand exporteren…',
  'menu.exportInterchange': 'Interchange-document exporteren…',
  'menu.snapshot': 'Momentopname…',
  'menu.history': 'Geschiedenis…',
  'menu.preferences': 'Voorkeuren…',
  'menu.settings': 'Instellingen…',
  'menu.theme': 'Thema',
  'menu.themeLight': 'Licht',
  'menu.themeDark': 'Donker',
  'menu.themeSystem': 'Systeem',
  'menu.checkForUpdates': 'Zoeken naar updates…',
  'menu.more': 'Meer',
}
