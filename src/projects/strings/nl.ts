/**
 * Dutch, for what a project refuses to be.
 *
 * Typed from the English slice beside it, so a missing translation is a compile
 * error here rather than an English sentence on a Dutch screen. `strings.test.ts`
 * covers what the type cannot: empty values, and placeholders that were dropped
 * or invented in translation.
 */
import type { EN } from './en'

export const NL: Record<keyof typeof EN, string> = {
  'shell.workingFileNoDiagrams': 'Dit werkbestand heeft geen aanzichten.',
  'shell.interchangeNoDiagrams': 'Dit document heeft geen aanzichten.',
  'git.andMore': ' en nog {count}',

  'check.conflict': '{name} wordt ook in {scope} gedefinieerd',
  'check.drift': 'De naam hier is niet meer hoe {scope} het noemt',
  'check.dangling': 'Niets in deze organisatie definieert {name}',
  'check.danglingEnd': 'Een regel op {name} eindigt op iets wat niemand heeft',
  'check.proposal': '{name} is geen capability die de organisatie heeft benoemd',
  'check.ownedElsewhere': '{scope} beheert dit',
  'check.unattributed': 'Niemand heeft gezegd van wie {name} is',
  'check.notDrawn': '{name} staat op geen enkele plaat in deze scope',
  'check.unmapped': '{name} is aan niemand toegewezen en door niemand opgepakt',
  'check.uncovered': 'Niets en niemand doet {name}',

  'standIn.definedIn': 'Gedefinieerd in {scope} — de details worden daar beheerd.',
  'standIn.open': '{scope} openen',
  'standIn.from': 'uit {scope}',
  'shell.unknownFile': 'Dit bestand is geen interchange-document en geen werkbestand.',
}
