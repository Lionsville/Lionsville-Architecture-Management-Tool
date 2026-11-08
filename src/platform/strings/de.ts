// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * German, for the menu.
 *
 * Typed from the English slice beside it, so a missing translation is a compile
 * error here rather than an English sentence on a German screen. The web's
 * overflow and the desktop's menu bar both read it.
 */
import type { EN } from './en'

export const DE: Record<keyof typeof EN, string> = {
  'menu.file': 'Datei',
  'menu.connect': 'Einen Ordner öffnen…',
  'menu.openRecent': 'Zuletzt verwendeten Ordner öffnen',
  'menu.noRecent': 'Keine zuletzt verwendeten Ordner',
  'menu.open': 'Eine Datei öffnen…',
  'menu.save': 'Speichern',
  'menu.exportWorkingFile': 'Kopie speichern…',
  'menu.shareLink': 'Per Link teilen…',
  'menu.snapshot': 'Eine Momentaufnahme festhalten…',
  'menu.history': 'Verlauf…',
  'menu.connectAgent': 'Agent verbinden…',
  'menu.preferences': 'Voreinstellungen…',
  'menu.settings': 'Einstellungen…',
  'menu.view': 'Ansicht',
  'menu.zoomActual': 'Originalgröße',
  'menu.zoomIn': 'Vergrößern',
  'menu.zoomOut': 'Verkleinern',
  'menu.textLarger': 'Größerer Text',
  'menu.textSmaller': 'Kleinerer Text',
  'menu.textDefault': 'Standard-Textgröße',
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
  'menu.userManual': 'Lionsville Architect-Hilfe',
  'menu.helpHere': 'Hilfe zu dieser Seite',
  'menu.shortcuts': 'Tastenkürzel…',
  'menu.visitExample': 'Im Beispiel umsehen',
  'menu.go': 'Gehe zu',
  'menu.back': 'Zurück',
  'menu.forward': 'Vorwärts',
  'menu.getDesktopApp': 'Desktop-App herunterladen',
  // The question the desktop asks where closing would lose what could not be saved.
  'window.unsavedTitle': 'Nicht gespeicherte Änderungen',
  'window.unsavedMessage': 'Dieser Bereich konnte nicht gespeichert werden.',
  'window.unsavedDetail': 'Wenn Sie jetzt schließen, gehen die Änderungen verloren, die nur in diesem Fenster sind.',
  'window.closeAnyway': 'Trotzdem schließen',
  'window.keepOpen': 'Fenster geöffnet lassen',
  'menu.website': 'Website',
  'menu.exportPicture': 'Bild exportieren…',
  'menu.notNow': 'Derzeit nicht verfügbar',
  'menu.saveExample': 'Das Beispiel wird nicht gespeichert. Übernehmen Sie es, um es zu speichern.',
  'menu.saveNothingOpen': 'Nichts ist geöffnet. Ihre Arbeit wird automatisch gespeichert; öffnen Sie einen Bereich, um jetzt zu speichern.',
  // The desktop's menu bar: the items Electron's roles would otherwise say in English.
  'menubar.window': 'Fenster',
  'menubar.cut': 'Ausschneiden',
  'menubar.copy': 'Kopieren',
  'menubar.paste': 'Einfügen',
  'menubar.pasteAndMatchStyle': 'Einfügen und Stil anpassen',
  'menubar.closeWindow': 'Fenster schließen',
  'menubar.quit': '{app} beenden',
  'menubar.fullScreen': 'Vollbild ein/aus',
  'menubar.minimize': 'Minimieren',
  'menubar.zoomWindow': 'Zoomen',
  'menubar.front': 'Alle nach vorne bringen',
  'menubar.about': 'Über {app}',
  'menubar.hide': '{app} ausblenden',
  'menubar.hideOthers': 'Andere ausblenden',
  'menubar.showAll': 'Alle einblenden',
  'menubar.services': 'Dienste',
}
