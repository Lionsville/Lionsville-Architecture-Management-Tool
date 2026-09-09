/**
 * Frisian, for the menu.
 *
 * Typed from the English slice beside it, so a missing translation is a compile
 * error here rather than an English sentence on a Frisian screen. Only the web's
 * overflow reads this table; the desktop's menu bar is English (see `en.ts`).
 */
import type { EN } from './en'

export const FY: Record<keyof typeof EN, string> = {
  'menu.file': 'Bestân',
  'menu.openFolder': 'Map iepenje…',
  'menu.openRecent': 'Resinte map iepenje',
  'menu.noRecent': 'Gjin resinte mappen',
  'menu.open': 'Iepenje…',
  'menu.save': 'Bewarje',
  'menu.exportWorkingFile': 'Wurkbestân eksportearje…',
  'menu.exportInterchange': 'Interchange-dokumint eksportearje…',
  'menu.snapshot': 'Momintopname…',
  'menu.history': 'Skiednis…',
  'menu.connectAgent': 'Agent keppelje…',
  'menu.preferences': 'Foarkarren…',
  'menu.settings': 'Ynstellings…',
  'menu.theme': 'Tema',
  'menu.themeLight': 'Ljocht',
  'menu.themeDark': 'Tsjuster',
  'menu.themeSystem': 'Systeem',
  'menu.checkForUpdates': 'Sykje nei updates…',
  'menu.more': 'Mear',
}
