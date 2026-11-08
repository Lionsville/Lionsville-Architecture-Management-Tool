// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * German, for architecture decision records: the page, the statuses, the template.
 *
 * Typed from the English slice beside it, so a missing translation is a compile
 * error here rather than an English sentence on a German screen. `strings.test.ts`
 * covers what the type cannot: empty values, and placeholders that were dropped
 * or invented in translation.
 */
import type { EN } from './en'

export const DE: Record<keyof typeof EN, string> = {

  'adr.removeColumn': 'Entfernen',
  'adr.groupOpen': 'Noch offen',
  'adr.groupInForce': 'In Kraft',
  'adr.groupEnded': 'Beendet',
  'adr.scopeThis': 'dieser Bereich',
  'adr.aboutField': 'Betrifft',
  'adr.aboutHelp': 'Oder eine Anwendung, Fähigkeit oder einen Schritt einer Journey in diesem Bereich.',
  'adr.aboutScope': 'Dieser Bereich als Ganzes',
  'adr.aboutWord': 'Betrifft: {about}',
  'adr.aboutWithRecords': 'Mit Entscheidungen',
  'adr.aboutNone': 'Noch ohne',
  'adr.emptyTitle': 'Noch keine Entscheidungen in {scope}',
  'adr.emptyBody': 'Ein Entscheidungsprotokoll sagt, was gewählt wurde, was sonst erwogen wurde und warum. Einmal angenommen, bleibt es, wie es ist, damit man sich später darauf verlassen kann.',
  'adr.stepVerdict': 'Angenommen oder abgelehnt',
  'adr.verbReview': 'Zur Prüfung senden',
  'adr.verbAccept': 'Annehmen…',
  'adr.verbAcceptHeld': 'Annehmen: noch {count} offen',
  'adr.verbReject': 'Ablehnen…',
  'adr.verbSendBack': 'Zurück zu Vorgeschlagen',
  'adr.verbWithdraw': 'Zurückziehen…',
  'adr.verbSupersede': 'Als abgelöst markieren…',
  'adr.verbDelete': 'Löschen…',
  'adr.writing': 'Eine Entscheidung schreiben',
  'adr.titleNeeded': 'Eine Entscheidung braucht einen Titel.',
  'adr.writeHow': 'Wie Sie schreiben',
  'adr.writeSections': 'Nach Abschnitt',
  'adr.writeSource': 'Quelltext',
  'adr.notWritten': 'Noch nicht geschrieben',
  'adr.sectionBefore': 'Vor der ersten Überschrift',
  'adr.saidProposed': 'Vorgeschlagen am {day}.',
  'adr.saidReviewing': 'In Prüfung seit {day}.',
  'adr.saidAccepted': 'Angenommen am {day}. Gesperrt: Um sie zu ändern, schreiben Sie eine Entscheidung, die sie ablöst.',
  'adr.saidRejected': 'Abgelehnt am {day}. Sie bleibt, wie sie ist.',
  'adr.saidSuperseded': 'Abgelöst am {day}. Das Protokoll bleibt, wie es ist.',
  'adr.saidReason': 'Grund: {reason}',
  'adr.saidProposedBy': 'Vorgeschlagen von',
  'adr.saidAbout': 'Betrifft {about}.',
  'adr.numberOf': '{number} von {scope}',
  'adr.supersededByLine': 'Abgelöst durch',
  'adr.supersedesLine': 'Löst ab',
  'adr.willSupersedeLine': 'Wird ablösen',
  'adr.gateOpen': 'Bis zur Annahme noch {count} offen',
  'adr.gateClear': 'Bereit zur Annahme',
  'adr.gateDone': 'erledigt',
  'adr.supersedeConfirm': 'Als abgelöst markieren',
  'adr.title': 'Entscheidungen',
  'adr.scopeGroup': 'Gruppe',
  'adr.scopeAbove': 'Aus einem Bereich darüber',
  'adr.scopeLandscape': 'Landschaften',
  'adr.scopeApplications': 'Anwendungen',
  'adr.scopeRemoved': 'Entfernte Anwendungen',
  'adr.scopeFrom': 'Von {scope}',
  'adr.openScope': '{scope} öffnen',
  'adr.fromAncestor': 'Sie gehört zu {scope} und wird hier gelesen.',
  'adr.new': 'Neue Entscheidung',
  'adr.newTitleField': 'Titel',
  'adr.newTitleHelp': 'Formulieren Sie die Entscheidung als kurzen Satz: \u201ePostgreSQL für den Auftragsspeicher verwenden\u201c.',
  'adr.create': 'Anlegen und schreiben',
  'adr.searchPlaceholder': 'Eine Entscheidung suchen',
  'adr.searchField': 'Entscheidungen suchen',
  'adr.listEmpty': 'Hier sind noch keine Entscheidungen festgehalten.',
  'adr.searchEmpty': 'Keine Entscheidung passt zu \u201e{query}\u201c.',
  'adr.statusProposed': 'Vorgeschlagen',
  'adr.statusReviewing': 'In Prüfung',
  'adr.statusAccepted': 'Angenommen',
  'adr.statusRejected': 'Abgelehnt',
  'adr.statusSuperseded': 'Abgelöst',
  'adr.moveTo': 'Auf {status} setzen',
  'adr.plans': 'Verknüpft mit',
  'adr.supersedeTitle': 'Als abgelöst markieren',
  'adr.supersedeBody': 'Welche Entscheidung ersetzt diese? Der Eintrag bleibt, wie er ist, mit einem Verweis auf den Nachfolger.',
  'adr.successor': 'Nachfolger',
  'adr.noSuccessor': 'In dieser Liste gibt es noch keine angenommene Entscheidung, auf die verwiesen werden kann. Schreiben Sie den Nachfolger, nennen Sie diese Entscheidung unter \u201eLöst ab\u201c, und das Annehmen löst diese ab.',
  'adr.source': 'Entscheidungsquelle (Markdown)',
  'adr.titleField': 'Titel',
  'adr.delete': 'Löschen',
  'adr.deleteTitle': '{name} löschen?',
  'adr.deleteBody': 'Nur eine Entscheidung, die noch geschrieben wird, kann gelöscht werden. Ihre Nummer wird nicht wiederverwendet.',
  'adr.signers': 'Prüfer und Unterschriften',
  'adr.signersHelp': 'Wem diese Entscheidung vorgelegt wurde. Ein Urteil trägt das Datum des Tages, an dem es gefällt wird.',
  'adr.signerName': 'Name',
  'adr.signerRole': 'Rolle',
  'adr.signerVerdict': 'Urteil',
  'adr.signedAt': 'Unterzeichnet',
  'adr.verdictPending': 'Ausstehend',
  'adr.verdictApproved': 'Zugestimmt',
  'adr.verdictRejected': 'Abgelehnt',
  'adr.addSigner': 'Prüfer hinzufügen',
  'adr.removeSigner': '{name} entfernen',
  'adr.noSigners': 'Es wurde noch niemand gefragt.',
  'adr.contents': 'Auf dieser Seite',
  'adr.gate.context': 'Der Kontext ist beschrieben',
  'adr.gate.options': 'Mindestens zwei Optionen wurden betrachtet',
  'adr.gate.outcome': 'Das Ergebnis nennt eine der Optionen',
  'adr.gate.consequence': 'Mindestens eine Konsequenz ist beschrieben',
  'adr.gate.approved': 'Jemand hat zugestimmt, und niemand hat abgelehnt',
  'adr.gate.predecessors': 'Jede Entscheidung, die sie ablöst, ist angenommen',
  'adr.gate.reason': 'Ein Grund ist angegeben',
  'adr.gate.rejection': 'Jemand hat abgelehnt, oder ein Grund ist angegeben',
  'adr.gate.successor': 'Der Nachfolger ist angenommen',
  'adr.gateHint.context': 'Mindestens eine eigene Zeile unter \u201eKontext und Problemstellung\u201c. Der Text der Vorlage z\u00e4hlt nicht.',
  'adr.gateHint.options': 'Mindestens zwei Aufz\u00e4hlungspunkte unter \u201eBetrachtete Optionen\u201c, die nicht \u201eOption 1\u201c, \u201eOption 2\u201c der Vorlage sind.',
  'adr.gateHint.outcome': 'Unter \u201eErgebnis der Entscheidung\u201c den Namen einer Option so schreiben, wie er unter \u201eBetrachtete Optionen\u201c steht: den Text bis zum ersten Doppelpunkt, frei stehenden Strich oder zur ersten Klammer. Gro\u00df- und Kleinschreibung und Anf\u00fchrungszeichen sind egal, die W\u00f6rter nicht.',
  'adr.gateHint.outcomeNames': 'Die Namen, nach denen gesucht wird: {names}.',
  'adr.gateHint.outcomeNone': 'Es gibt noch keine Optionen, die genannt werden k\u00f6nnten.',
  'adr.gateHint.quoted': '\u201e{name}\u201c',
  'adr.gateHint.consequence': 'Mindestens ein Aufz\u00e4hlungspunkt unter \u201eKonsequenzen\u201c, der nicht \u201eGut, weil \u2026\u201c oder \u201eSchlecht, weil \u2026\u201c der Vorlage ist.',
  'adr.gateHint.approved': 'Ein Pr\u00fcfer mit dem Urteil Zugestimmt. Ein einziges Urteil Abgelehnt h\u00e4lt die Entscheidung zur\u00fcck, bis es ge\u00e4ndert ist.',
  'adr.gateHint.predecessors': 'Jede Entscheidung unter L\u00f6st ab muss selbst angenommen sein, bevor diese sie abl\u00f6sen kann.',
  'adr.gateHint.reason': 'Warum, geschrieben im Dialog, der nach einem Grund fragt.',
  'adr.gateHint.rejection': 'Ein Pr\u00fcfer mit dem Urteil Abgelehnt, oder ein Grund im Dialog.',
  'adr.gateHint.successor': 'Die Entscheidung, die diese abl\u00f6st, muss angenommen sein.',
  'adr.acceptTitle': '{name} annehmen?',
  'adr.acceptBody': 'Sie ist danach gesperrt; wer sie später ändern will, schreibt eine Entscheidung, die sie ablöst.',
  'adr.acceptSupersedes': 'Das Annehmen markiert auch {names} als abgelöst.',
  'adr.accept': 'Annehmen',
  'adr.withdraw': 'Zurückziehen',
  'adr.withdrawTitle': '{name} zurückziehen?',
  'adr.withdrawBody': 'Die Entscheidung behält ihre Nummer und endet als abgelehnt, mit Ihrem Grund. Sie kann danach nicht mehr geändert werden.',
  'adr.rejectTitle': '{name} ablehnen?',
  'adr.rejectBody': 'Die Entscheidung behält ihre Nummer und wird gesperrt. Nennen Sie einen Grund, sofern nicht schon die Ablehnung eines Prüfers ihn nennt.',
  'adr.reject': 'Ablehnen',
  'adr.reasonField': 'Grund',
  'adr.proposedBy': 'Vorgeschlagen von',
  'adr.selfAccepted': 'Die einzige Zustimmung stammt von {name}, die oder der sie auch vorgeschlagen hat.',
  'adr.supersedesField': 'Löst ab',
  'adr.supersedesHelp': 'Angenommene Entscheidungen, die diese ersetzt. Das Annehmen markiert sie im selben Schritt als abgelöst.',
  'adr.brokenSuccessor': 'Abgelöst durch eine Entscheidung, die nicht angenommen ist. Keine angenommene Entscheidung ersetzt diese.',
  'adr.decidedFor': 'Entschieden für',
  'adr.tplContext': 'Kontext und Problemstellung',
  'adr.tplDrivers': 'Entscheidungsfaktoren',
  'adr.tplDriver': 'Eine Kraft, ein Anliegen, eine Randbedingung \u2026',
  'adr.tplOptions': 'Betrachtete Optionen',
  'adr.tplOption': 'Option {n}',
  'adr.tplOutcome': 'Ergebnis der Entscheidung',
  'adr.tplChosen': 'Gewählte Option: \u201eOption 1\u201c, weil \u2026',
  'adr.tplConsequences': 'Konsequenzen',
  'adr.tplGood': 'Gut, weil \u2026',
  'adr.tplBad': 'Schlecht, weil \u2026',
  'adr.tplConfirmation': 'Bestätigung',
  'adr.tplProsCons': 'Vor- und Nachteile der Optionen',
  'adr.tplMore': 'Weitere Informationen',
  'adr.markdownHelp': `### Formatierung

| Schreiben Sie | Sie erhalten |
|---|---|
| \`## Abschnitt\`, \`### Unterabschnitt\` | Überschriften \u2014 das Inhaltsverzeichnis folgt ihnen |
| \`**fett**\`, \`_kursiv_\`, \`~~durchgestrichen~~\` | **fett**, _kursiv_, ~~durchgestrichen~~ |
| \`* Punkt\` oder \`1. Punkt\` | eine Aufzählung, mit oder ohne Nummern |
| \`- [x] erledigt\`, \`- [ ] offen\` | eine Aufgabenliste |
| \`> Zitat\` | ein Zitat |
| \`[Text](https://\u2026)\` | ein Link, außerhalb der App geöffnet |
| \`[[Elementname]]\` | ein Link zur Dokumentation dieses Elements |
| \`\` \`code\` \`\` | \`Code in der Zeile\` |
| \`\\| a \\| b \\|\` mit einer Zeile \`\\|---\\|---\\|\` darunter | eine Tabelle |
| \`---\` | eine Trennlinie |

### Diagramme

Ein Codeblock, der mit \`mermaid\` markiert ist, wird als Diagramm gezeichnet:

\`\`\`
\`\`\`mermaid
flowchart LR
  Auftrag --> Abrechnung
  Auftrag --> Lager
\`\`\`
\`\`\`

Flussdiagramme, Sequenzdiagramme, Zustandsdiagramme und Klassendiagramme funktionieren alle; die Syntax steht auf mermaid.js.org.
`,
}
