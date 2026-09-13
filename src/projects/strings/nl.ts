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

  'check.short.conflict.one': '{count} conflict',
  'check.short.conflict.other': '{count} conflicten',
  'check.short.drift.one': '{count} verouderd',
  'check.short.drift.other': '{count} verouderd',
  'check.short.dangling.one': '{count} ongedefinieerd',
  'check.short.dangling.other': '{count} ongedefinieerd',
  'check.short.danglingEnd.one': '{count} losse regel',
  'check.short.danglingEnd.other': '{count} losse regels',
  'check.short.proposal.one': '{count} voorstel',
  'check.short.proposal.other': '{count} voorstellen',
  'check.short.ownedElsewhere.one': '{count} elders beheerd',
  'check.short.ownedElsewhere.other': '{count} elders beheerd',
  'check.short.unattributed.one': '{count} zonder eigenaar',
  'check.short.unattributed.other': '{count} zonder eigenaar',
  'check.short.notDrawn.one': '{count} nergens getekend',
  'check.short.notDrawn.other': '{count} nergens getekend',
  'check.short.unmapped.one': '{count} niet toegewezen',
  'check.short.unmapped.other': '{count} niet toegewezen',
  'check.short.uncovered.one': '{count} niet gedekt',
  'check.short.uncovered.other': '{count} niet gedekt',

  'gesture.unknownId': 'Dit niveau heeft dat record niet meer.',
  'gesture.notADefinition': 'Dit record verwijst al naar een definitie elders.',
  'gesture.notAMaster': '{scope} beheert dit. Verplaats het daarvandaan.',
  'gesture.noMaster': 'Niets anders in de organisatie definieert dit.',
  'gesture.notAnAncestor': 'Een record kan alleen omhoog naar een niveau waar dit onder valt.',
  'gesture.notADescendant': 'Een record kan alleen omlaag naar een niveau dat hieronder valt.',
  'gesture.noSuchScope': 'Dat niveau bestaat niet.',
  'gesture.wouldConflict': '{scope} beheert dit al.',
  'gesture.hasChildren': 'Wat onder dit record valt blijft dan zonder. Verplaats dat eerst.',
  'gesture.barrier': 'Die stap heeft twee niveaus geschreven en kan hier niet ongedaan worden gemaakt. Verplaats het record terug met een eigen handeling.',

  'library.unknownId': 'Het register kent die applicatie niet meer.',
  'library.alreadyDrawn': '{name} staat al op dit bord.',
  'library.notABoard': 'Een kaart wordt op een landschap of een containerweergave getekend.',

  'standIn.definedIn': 'Gedefinieerd in {scope} — de details worden daar beheerd.',
  'standIn.open': '{scope} openen',
  'standIn.from': 'uit {scope}',
  'shell.unknownFile': 'Dit bestand is geen interchange-document en geen werkbestand.',
}
