// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * German, for what the providers that ship say for themselves.
 *
 * Typed from the English slice beside it, so a missing translation is a compile
 * error here rather than an English sentence on a German screen.
 */
import type { EN } from './en'

export const DE: Record<keyof typeof EN, string> = {
  'sync.diverged':
    'Dieser Ordner und sein Remote sind beide weitergegangen. Es wird nichts zusammengeführt: wählen Sie, welche Version gilt. '
    + 'Unsere bleibt in jedem Fall auf einem Branch erhalten.',
  'sync.takeTheirs': 'Die vom Remote',
  'sync.keepOurs': 'Unsere behalten',
  'sync.pulled': 'Auf dem Stand des Remotes.',
  'sync.pushed': 'Zum Remote gepusht.',
  'sync.tookTheirs': 'Die Version des Remotes gilt; unsere liegt auf einem Branch.',
  'sync.keptOurs': 'Unsere Version gilt, festgehalten als Merge.',
  'sync.noRemote': 'Dieser Ordner hat kein Remote zum Synchronisieren.',
  'sync.unreachable': 'Das Remote ist nicht erreichbar.',
  'sync.credentials':
    'Das Remote hat die Zugangsdaten dieses Rechners abgelehnt. Die App fragt nach keinen; melden Sie sich mit Ihrem git-Client an.',
  'sync.timeout': 'Das Remote hat nicht rechtzeitig geantwortet.',
  'sync.pullRefused': 'Der Ordner wurde nicht geholt: {reason}',
  'sync.pushRefused': 'Die Momentaufnahme wurde nicht gepusht: {reason}',
  'sync.resolveRefused': 'Es wurde nichts geändert: {reason}',
  'prefs.thisMachine': 'DIESER ORDNER, AUF DIESEM RECHNER',
  'prefs.thisMachineNote':
    'Von dieser Installation verwahrt und nicht geteilt — in den Ordner wird nichts geschrieben, und ein anderer Rechner, der ihn öffnet, entscheidet selbst.',
  'prefs.pullOnOpen': 'Beim Öffnen dieses Ordners vom Remote holen',
  'prefs.pushAfterSnapshot': 'Nach jeder Momentaufnahme pushen',
  'history.beforeSync': 'Vor dem Synchronisieren',
  'history.beforeUpgrade': 'Vor der Aktualisierung des Dateiformats',
  'folder.body':
    'Wählen Sie einen Ordner; diese App bewahrt Ihre Projekte darin als Dateien auf, die Sie lesen, '
    + 'sichern, synchronisieren und committen können. In der App selbst bleibt nichts.',
  'folder.choose': 'Ordner wählen…',
  'folder.adoptTitle': 'Ihre Arbeit in diesen Ordner mitnehmen?',
  'folder.adoptBody':
    'Ihre Projekte liegen zurzeit in der App selbst. „{name}“ kann eine Kopie davon '
    + 'bekommen oder so geöffnet werden, wie er ist. Gelöscht wird in beiden Fällen '
    + 'nichts — die App behält ihre eigene Kopie, bis Sie sie absichtlich verschieben.',
  'folder.adoptCopy': 'Meine Arbeit hineinkopieren',
  'folder.adoptSkip': 'Ordner so öffnen, wie er ist',
  'picker.chooseFolder': 'Ordner wählen…',
  'picker.changeFolder': 'Aus einem anderen Ordner arbeiten…',
  'shell.folderNotOpened': 'Der Ordner konnte nicht geöffnet werden: {message}',
  'shell.sourceFolder': 'Ordner · {name}',
  'shell.sourceBrowser': 'In diesem Browser',
  'shell.sourceMemory': 'Nirgends gespeichert',
  'shell.sourceTipFolder': 'Ihre Projekte sind Dateien in diesem Ordner. Schnappschüsse gehen in seinen Verlauf.',
  'shell.sourceTipBrowser': 'Ihre Projekte liegen im Speicher dieses Browsers. Speichern Sie eine Arbeitsdatei, um sie anderswo aufzubewahren.',
  'shell.sourceTipMemory': 'Nichts wird aufbewahrt: der Speicher hat abgelehnt. Speichern Sie eine Arbeitsdatei, bevor Sie diesen Tab schließen.',
  'picker.deleteBodyFolder': 'Dies löscht {name}, alles darunter Abgelegte und seinen Ordner auf der Festplatte. Eine anderswo gespeicherte Arbeitsdatei bleibt unberührt.',
  'picker.deleteBodyBrowser': 'Dies löscht {name} und alles darunter Abgelegte aus diesem Browser. Eine anderswo gespeicherte Arbeitsdatei bleibt unberührt.',
  'folder.where': 'Alles hier wird als Dateien im Ordner oben aufbewahrt.',
  'browser.where': 'Alles hier wird in diesem Browser aufbewahrt.',
  'memory.where': 'Alles hier wird noch nirgends \u2014 speichern Sie eine Arbeitsdatei, um es zu behalten aufbewahrt.',
}
