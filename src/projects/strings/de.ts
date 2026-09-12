/**
 * German, for what a project refuses to be.
 *
 * Typed from the English slice beside it, so a missing translation is a compile
 * error here rather than an English sentence on a German screen. `strings.test.ts`
 * covers what the type cannot: empty values, and placeholders that were dropped
 * or invented in translation.
 */
import type { EN } from './en'

export const DE: Record<keyof typeof EN, string> = {
  'shell.workingFileNoDiagrams': 'Diese Arbeitsdatei enthält keine Ansichten.',
  'shell.interchangeNoDiagrams': 'Dieses Dokument enthält keine Ansichten.',
  'git.andMore': ' und {count} weitere',

  'check.conflict': '{name} ist auch in {scope} definiert',
  'check.drift': 'Der Name hier ist nicht mehr der, den {scope} verwendet',
  'check.dangling': 'Nichts in dieser Organisation definiert {name}',
  'check.danglingEnd': 'Eine Zeile an {name} endet an etwas, das niemand hält',
  'check.proposal': '{name} ist keine Fähigkeit, die die Organisation benannt hat',
  'check.ownedElsewhere': '{scope} verantwortet dies',
  'check.unattributed': 'Niemand hat gesagt, wem {name} gehört',
  'check.notDrawn': '{name} steht auf keinem Bild in diesem Bereich',
  'check.unmapped': '{name} ist niemandem zugewiesen und von niemandem übernommen',
  'check.uncovered': 'Nichts und niemand erledigt {name}',

  'check.short.conflict.one': '{count} Konflikt',
  'check.short.conflict.other': '{count} Konflikte',
  'check.short.drift.one': '{count} veraltet',
  'check.short.drift.other': '{count} veraltet',
  'check.short.dangling.one': '{count} undefiniert',
  'check.short.dangling.other': '{count} undefiniert',
  'check.short.danglingEnd.one': '{count} lose Zeile',
  'check.short.danglingEnd.other': '{count} lose Zeilen',
  'check.short.proposal.one': '{count} Vorschlag',
  'check.short.proposal.other': '{count} Vorschläge',
  'check.short.ownedElsewhere.one': '{count} anderswo verantwortet',
  'check.short.ownedElsewhere.other': '{count} anderswo verantwortet',
  'check.short.unattributed.one': '{count} ohne Eigentümer',
  'check.short.unattributed.other': '{count} ohne Eigentümer',
  'check.short.notDrawn.one': '{count} nirgends gezeichnet',
  'check.short.notDrawn.other': '{count} nirgends gezeichnet',
  'check.short.unmapped.one': '{count} nicht zugewiesen',
  'check.short.unmapped.other': '{count} nicht zugewiesen',
  'check.short.uncovered.one': '{count} nicht abgedeckt',
  'check.short.uncovered.other': '{count} nicht abgedeckt',

  'standIn.definedIn': 'Definiert in {scope} — die Details werden dort verantwortet.',
  'standIn.open': '{scope} öffnen',
  'standIn.from': 'aus {scope}',
  'shell.unknownFile': 'Diese Datei ist weder ein Interchange-Dokument noch eine Arbeitsdatei.',
}
