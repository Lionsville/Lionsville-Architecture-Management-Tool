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
  'shell.storageNearlyFull':
    'Dieser Browser ist für diese App zu etwa {percent}% voll. Speichern Sie Ihre Arbeit in einem Ordner '
    + 'oder einer Datei, bevor der Platz ausgeht — ein Browser hört ohne Nachfrage auf zu speichern.',
  'folder.historyNote': 'Jede Momentaufnahme wird im Ordner selbst festgehalten, mit git \u2014 nichts verlässt diesen Rechner.',
  'folder.historyNoteBrowser': 'Jede Momentaufnahme wird in diesem Browser festgehalten, neben dem Ordner \u2014 dafür wird nichts in den Ordner geschrieben.',
  'browser.historyNote': 'Jede Momentaufnahme wird in diesem Browser festgehalten \u2014 nichts verlässt diesen Rechner.',
  'memory.historyNote': 'Momentaufnahmen bleiben erhalten, solange dieser Tab offen ist, und gehen mit ihm.',
  'browser.earlierAsking': 'Dieser Browser hat die Arbeit verloren, die er aufbewahrt hat, und eine ältere Kopie ist noch da. Die ältere Kopie zurückholen oder mit dem weitermachen, was jetzt hier ist?',
  'browser.earlierDiverged': '\u201e{path}\u201c hat sich hier und in der älteren Kopie dieses Browsers geändert. Welche gilt?',
  'browser.earlierBring': 'Die ältere Kopie übernehmen',
  'browser.earlierLeave': 'Behalten, was hier ist',
  'browser.earlierBrought': 'Die ältere Kopie wurde übernommen; was hier war, steht im Verlauf.',
  'browser.earlierLeft': 'Was hier ist, gilt. Die ältere Kopie wird erst übernommen, wenn sie sich wieder ändert.',
  'browser.earlierLeftBehind': 'Einiges von dem, was dieser Browser früher aufbewahrt hat, war nicht lesbar und bleibt, wo es war: {paths}.',
  'browser.earlierRefused': 'Über {paths} wurde nichts übernommen: Was hier ist, war nicht vollständig lesbar.',
  'browser.historyAuthor': 'dieser Browser',
  'memory.historyAuthor': 'dieser Tab',
  'browser.broughtOver': 'Aus dem früheren Speicher dieses Browsers übernommen',
  'browser.broughtOverAgain': 'Erneut aus dem früheren Speicher dieses Browsers übernommen',
  'browser.beforeBringingAgain': 'Vor der erneuten Übernahme aus dem früheren Speicher dieses Browsers',
  'browser.stillAnswering': 'Der Speicher dieses Browsers hat noch nicht geantwortet. Ihre Arbeit erscheint hier, sobald er es tut.',
  'browser.shownFromOlder': 'Ihre Arbeit wird aus dem älteren Speicher dieses Browsers angezeigt; Änderungen hier werden nicht aufbewahrt. Speichern Sie eine Arbeitsdatei, um sie zu behalten.',
  'browser.earlierBringAt': 'Die ältere Kopie von \u201e{path}\u201c übernehmen',
  'browser.earlierLeaveAt': '\u201e{path}\u201c so behalten, wie es hier ist',
  'folder.adoptCopying': 'Ihre Arbeit wird nach \u201e{name}\u201c kopiert\u2026',
  'folder.adoptDone': '{copied} nach \u201e{name}\u201c kopiert.',
  'folder.adoptPartly': '{copied} kopiert; {failed} konnte nicht kopiert werden: {paths}.',
  'folder.adoptFailed': 'Es wurde nichts kopiert: {message}',
  'folder.adoptAgain': 'Erneut versuchen',
  'folder.adoptClose': 'Schließen',
}
