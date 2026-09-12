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
  'shell.interchangeNoDiagrams': 'Dit dokumint hat gjin oansichten.',
  'git.andMore': ' en noch {count}',

  'check.conflict': '{name} wurdt ek yn {scope} definiearre',
  'check.drift': 'De namme hjir is net mear hoe\'t {scope} it neamt',
  'check.dangling': 'Neat yn dizze organisaasje definiearret {name}',
  'check.danglingEnd': 'In rigel op {name} einiget op wat nimmen hat',
  'check.proposal': '{name} is gjin capability dy\'t de organisaasje neamd hat',
  'check.ownedElsewhere': '{scope} behearret dit',
  'check.unattributed': 'Nimmen hat sein fan wa\'t {name} is',
  'check.notDrawn': '{name} stiet op gjin inkelde plaat yn dizze scope',
  'check.unmapped': '{name} is oan nimmen tawiisd en troch nimmen oppakt',
  'check.uncovered': 'Neat en nimmen docht {name}',

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

  'standIn.definedIn': 'Definiearre yn {scope} — de details wurde dêr behearre.',
  'standIn.open': '{scope} iepenje',
  'standIn.from': 'út {scope}',
  'shell.unknownFile': 'Dit bestân is gjin interchange-dokumint en gjin wurkbestân.',
}
