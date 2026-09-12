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

  'standIn.definedIn': 'Definiert in {scope} — die Details werden dort verantwortet.',
  'standIn.open': '{scope} öffnen',
  'standIn.from': 'aus {scope}',
  'shell.unknownFile': 'Diese Datei ist weder ein Interchange-Dokument noch eine Arbeitsdatei.',
}
