/**
 * Frisian, for what a project refuses to be.
 *
 * Typed from the English slice beside it, so a missing translation is a compile
 * error here rather than an English sentence on a Frisian screen. `strings.test.ts`
 * covers what the type cannot: empty values, and placeholders that were dropped
 * or invented in translation.
 */
import type { EN } from './en'

export const FY: Record<keyof typeof EN, string> = {
  'shell.workingFileNoDiagrams': 'Dit wurkbestân hat gjin oansichten.',
  'git.andMore': ' en noch {count}',

  'check.conflict': '{name} is sawol hjir as yn {scope} definiearre — hâld ien definysje en meitsje fan de oare in plakferfanger mei Keppelje…',
  'check.drift': 'De kopy fan {name} hjir komt net mear oerien mei {scope} — ferfarskje har, of feroarje it dêr',
  'check.dangling': '{name} stiet yn foar wat neat yn de organisaasje definiearret — definiearje it hjir, of smyt de plakferfanger fuort',
  'check.danglingEnd': 'In rigel op {name} einiget op wat dizze scope net hat — smyt de rigel fuort, of tekenje wêr\'t er nei wiist',
  'check.proposal': '{name} is in capability dy\'t dit domein foarstelt en dy\'t de organisaasje net neamd hat — foegje har ta oan de bedriuwsarsjitektuer fan de organisaasje, of neam har om nei ien dy\'t der is',
  'check.ownedElsewhere': 'Dit wurdt byholden yn {scope} — feroarje it dêr',
  'check.unattributed': '{name} stiet bûten de organisaasje en nimmen hat sein fan wa\'t it is — neam de partij op har side',
  'check.notDrawn': '{name} is hjir definiearre en op gjin inkeld boerd tekene — set it op in boerd, of lit it in rekord',
  'check.unmapped': '{name} is oan nimmen tawiisd en troch gjin domein oppakt — wiis it ta, of jou it oan in domein',
  'check.uncovered': 'Neat en nimmen docht {name} — keppelje in applikaasje dy\'t it stipet, of wiis in persoan ta',
  'check.offeredNotShared': '{name} wurdt brûkt troch {detail}, bûten it team dat it ûnderhâldt, en is net as dield markearre — markearje it as dield, of ferpleats it',

  'check.short.conflict.one': '{count} konflikt',
  'check.short.conflict.other': '{count} konflikten',
  'check.short.drift.one': '{count} ferâldere',
  'check.short.drift.other': '{count} ferâldere',
  'check.short.dangling.one': '{count} ûndefiniearre',
  'check.short.dangling.other': '{count} ûndefiniearre',
  'check.short.danglingEnd.one': '{count} losse rigel',
  'check.short.danglingEnd.other': '{count} losse rigels',
  'check.short.proposal.one': '{count} foarstel',
  'check.short.proposal.other': '{count} foarstellen',
  'check.short.ownedElsewhere.one': '{count} earne oars behearre',
  'check.short.ownedElsewhere.other': '{count} earne oars behearre',
  'check.short.unattributed.one': '{count} sûnder eigner',
  'check.short.unattributed.other': '{count} sûnder eigner',
  'check.short.notDrawn.one': '{count} nearne tekene',
  'check.short.notDrawn.other': '{count} nearne tekene',
  'check.short.unmapped.one': '{count} net tawiisd',
  'check.short.unmapped.other': '{count} net tawiisd',
  'check.short.uncovered.one': '{count} net dekt',
  'check.short.uncovered.other': '{count} net dekt',
  'check.short.offeredNotShared.one': '{count} oanbean, net as dield markearre',
  'check.short.offeredNotShared.other': '{count} oanbean, net as dield markearre',

  'gesture.unknownId': 'Dit nivo hat dat record net mear.',
  'gesture.notADefinition': 'Dit record ferwiist al nei in definysje earne oars.',
  'gesture.notAMaster': '{scope} behearret dit. Ferpleats it dêrwei.',
  'gesture.noMaster': 'Neat oars yn de organisaasje definiearret dit.',
  'gesture.notAnAncestor': 'In record kin allinnich omheech nei in nivo dêr\'t dit ûnder falt.',
  'gesture.notADescendant': 'In record kin allinnich omleech nei in nivo dat hjirûnder falt.',
  'gesture.noSuchScope': 'Dat nivo bestiet net.',
  'gesture.wouldConflict': '{scope} behearret dit al.',
  'gesture.hasChildren': 'Wat ûnder dit record falt bliuwt dan sûnder. Ferpleats dat earst.',
  'gesture.barrier': 'Dy stap hat twa nivo\'s skreaun en kin hjir net ûngedien makke wurde. Ferpleats it record werom mei in eigen hanneling.',

  'library.unknownId': 'It register ken dy applikaasje net mear.',
  'library.alreadyDrawn': '{name} stiet al op dit boerd.',
  'library.notABoard': 'In kaart wurdt op in lânskip of in kontenerwerjefte tekene.',

  'standIn.definedIn': 'Definiearre yn {scope} — de details wurde dêr byholden.',
  'standIn.open': '{scope} iepenje',
  'standIn.from': 'út {scope}',
  'shell.unknownFile': 'Dit bestân is gjin wurkbestân.',
}
