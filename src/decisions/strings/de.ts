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

  'adr.title': 'Architekturentscheidungen',
  'adr.close': 'Entscheidungen schließen',
  'adr.scopeGroup': 'Gruppe',
  'adr.scopeAbove': 'Aus einem Bereich darüber',
  'adr.scopeLandscape': 'Landschaften',
  'adr.scopeApplications': 'Anwendungen',
  'adr.scopeRemoved': 'Entfernte Anwendungen',
  'adr.scopeGroupNote': 'Entscheidungen, die für jedes Projekt in dieser Gruppe gelten',
  'adr.scopeLandscapeNote': 'Entscheidungen über die Landschaft als Ganzes',
  'adr.scopeFrom': 'Von {scope}',
  'adr.scopeFromNote': 'Hier zu lesen, dort zu ändern, wo es liegt',
  'adr.openScope': '{scope} öffnen',
  'adr.fromAncestor': 'Dieser Datensatz gehört zu {scope}. Öffnen Sie diesen Bereich, um ihn zu ändern.',
  'adr.new': 'Neue Entscheidung',
  'adr.newTitleField': 'Titel',
  'adr.newTitleHelp': 'Formulieren Sie die Entscheidung als kurzen Satz: \u201ePostgreSQL für den Auftragsspeicher verwenden\u201c.',
  'adr.create': 'Anlegen',
  'adr.searchPlaceholder': 'Alle Entscheidungen durchsuchen',
  'adr.searchField': 'Entscheidungen suchen',
  'adr.listEmpty': 'Hier sind noch keine Entscheidungen festgehalten.',
  'adr.searchEmpty': 'Keine Entscheidung passt zu \u201e{query}\u201c.',
  'adr.noneSelected': 'Wählen Sie eine Entscheidung aus der Liste, oder legen Sie eine an.',
  'adr.status': 'Status',
  'adr.date': 'Datum',
  'adr.deciders': 'Entscheidungsträger',
  'adr.statusProposed': 'Vorgeschlagen',
  'adr.statusReviewing': 'In Prüfung',
  'adr.statusAccepted': 'Angenommen',
  'adr.statusRejected': 'Abgelehnt',
  'adr.statusSuperseded': 'Abgelöst',
  'adr.moveTo': 'Auf {status} setzen',
  'adr.supersededBy': 'Abgelöst durch {name}',
  'adr.supersedes': 'Löst {name} ab',
  'adr.plans': 'Pläne, die hierauf beruhen',
  'adr.supersedeTitle': 'Als abgelöst markieren',
  'adr.supersedeBody': 'Welche Entscheidung ersetzt diese? Der Eintrag bleibt, wie er ist, mit einem Verweis auf den Nachfolger.',
  'adr.successor': 'Nachfolger',
  'adr.noSuccessor': 'In dieser Liste gibt es noch keine andere Entscheidung, auf die verwiesen werden kann \u2014 legen Sie zuerst den Nachfolger an.',
  'adr.locked': 'Diese Entscheidung ist {status} und kann nicht mehr geändert werden.',
  'adr.read': 'Lesen',
  'adr.edit': 'Bearbeiten',
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
  'adr.formattingHelp': 'Hilfe zur Formatierung',
  'adr.contents': 'Auf dieser Seite',
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
