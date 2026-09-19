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
  'git.andMore': ' en nog {count}',

  'check.conflict': '{name} is zowel hier als in {scope} gedefinieerd — houd één definitie en maak van de andere een plaatsvervanger met Koppelen…',
  'check.drift': 'De kopie van {name} hier komt niet meer overeen met {scope} — ververs haar, of wijzig het daar',
  'check.dangling': '{name} staat in voor iets wat niets in de organisatie definieert — definieer het hier, of verwijder de plaatsvervanger',
  'check.danglingEnd': 'Een regel op {name} eindigt op iets wat deze scope niet heeft — verwijder de regel, of teken waar hij naar wijst',
  'check.proposal': '{name} is een capability die dit domein voorstelt en die de organisatie niet heeft benoemd — voeg haar toe aan de bedrijfsarchitectuur van de organisatie, of hernoem haar naar een die er is',
  'check.ownedElsewhere': 'Dit wordt bijgehouden in {scope} — wijzig het daar',
  'check.unattributed': '{name} staat buiten de organisatie en niemand heeft gezegd van wie het is — noem de partij op haar pagina',
  'check.notDrawn': '{name} is hier gedefinieerd en op geen enkel bord getekend — zet het op een bord, of laat het een record',
  'check.unmapped': '{name} is aan niemand toegewezen en door geen domein opgepakt — wijs het toe, of geef het aan een domein',
  'check.uncovered': 'Niets en niemand doet {name} — koppel een applicatie die het ondersteunt, of wijs een persoon toe',
  'check.offeredNotShared': '{name} wordt gebruikt door {detail}, buiten het team dat het onderhoudt, en is niet als gedeeld gemarkeerd — markeer het als gedeeld, of verplaats het',

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
  'check.short.offeredNotShared.one': '{count} aangeboden, niet als gedeeld gemarkeerd',
  'check.short.offeredNotShared.other': '{count} aangeboden, niet als gedeeld gemarkeerd',

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

  'standIn.definedIn': 'Gedefinieerd in {scope} — de details worden daar bijgehouden.',
  'standIn.open': '{scope} openen',
  'standIn.from': 'uit {scope}',
  'shell.unknownFile': 'Dit bestand is geen werkbestand.',
}
