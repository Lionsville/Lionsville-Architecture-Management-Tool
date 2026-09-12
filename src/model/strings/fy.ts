/**
 * Frisian, for the model speaks: element kinds, zones, the refusals a rule returns.
 *
 * Typed from the English slice beside it, so a missing translation is a compile
 * error here rather than an English sentence on a Frisian screen. `strings.test.ts`
 * covers what the type cannot: empty values, and placeholders that were dropped
 * or invented in translation.
 */
import type { EN } from './en'

export const FY: Record<keyof typeof EN, string> = {

  'kind.actor': 'Akteur',
  'kind.step': 'Stap',
  'kind.function': 'Funksje',
  'kind.process': 'Proses',
  'kind.application': 'Applikaasje',
  'kind.component': 'Komponint',
  'placement.notOnACanvas': 'In {kind} wurdt net op dit soarte werjefte tekene.',

  'relation.flow': 'Keppeling',
  'relation.supports': 'Stipet',
  'relation.serves': 'Betsjinnet',
  'relation.realises': 'Realisearret',
  'relation.assigned': 'Tawiisd oan',

  'zone.actors': 'AKTEUREN',
  'zone.inputChannels': 'YNFIERKANALEN',
  'zone.externalSystems': 'EKSTERNE SYSTEMEN',
  'zone.landscape': 'APPLIKAASJELÂNSKIP',
  'zone.management': 'BEHEARLAACH',
  'zoneMenu.actors': 'Akteuren',
  'zoneMenu.inputChannels': 'Ynfierkanalen',
  'zoneMenu.externalSystems': 'Eksterne systemen',
  'zoneMenu.landscape': 'Applikaasjelânskip',
  'zoneMenu.management': 'Behearlaach',
  'kindChange.sameKind': 'Dit is al dat soarte',
  'kindChange.notOnThisDiagram': 'Dit elemint stiet net op dit diagram',
  'kindChange.hasContainerDiagram':
    'Dizze applikaasje hat in containerdiagram — smyt dat diagram earst fuort',
  'kindChange.hasParent': 'Dizze komponint heart by in applikaasje — meitsje him earst los',
  'kindChange.hasComponents':
    'Dizze applikaasje hat komponinten — ferpleats of smyt dy earst fuort',
  'kindChange.notAllowedHere': 'Dit diagram draacht dat soarte net',

  // --- what the one writer refuses (ADR-0002) ------------------------------
  'command.gone': 'Dat is der net mear',
  'command.lastLandscape': 'Dit is it lêste lânskip; it kin net fuortsmiten wurde.',
  'command.datesOutOfOrder': 'Dizze datums rinne werom: in applikaasje kin net ôfboud wêze foardat se live giet.',
  'restore.absentThen': 'Dit stie by dy momintopname net yn it projekt.',
  'restore.absentNow': 'It elemint stiet net mear yn it projekt; set it hiele projekt werom om it werom te heljen.',
  'restore.locked': 'Dit beslút is oannommen, ôfwiisd of ferfongen, en in ôfsletten record wurdt net wizige. Skriuw in nij beslút dat it ferfangt.',
  'logo.category.data': 'Gegevens',
  'logo.category.integration': 'Yntegraasje',
  'logo.category.applications': 'Applikaasjes',
  'logo.category.platform': 'Platfoarm',
  'logo.category.security': 'Feiligens & behear',
  'logo.category.vendors': 'Leveransiers',

  'deletion.nothing': 'neat',
  'deletion.elementOne': '{count} elemint',
  'deletion.elementOther': '{count} eleminten',
  'deletion.connectionOne': '{count} ferbining',
  'deletion.connectionOther': '{count} ferbiningen',
  'deletion.groupOne': '{count} groep',
  'deletion.groupOther': '{count} groepen',
  'deletion.joined': '{head} en {last}',
  'shell.logoBadType': 'Allinnich SVG- en PNG-bestannen kinne as logo tafoege wurde.',
  'shell.logoTooBig': 'Dit logo is te grut ({size} kB). Op syn heechst {max} kB.',
  'shell.logoUnreadable': 'Dit bestân koe net lêzen wurde.',
  'shell.imageBadType': 'Allinnich PNG-, JPEG-, SVG- en WebP-bestannen kinne yn in dokumint opnommen wurde.',
  'shell.imageTooBig': 'Dizze ôfbylding is te grut ({size} kB). Op syn heechst {max} kB.',
  'shell.imageUnreadable': 'Dit bestân koe net lêzen wurde.',

  'activity.nothing': 'Neat',
  'activity.elementAdded': '{name} tafoege',
  'activity.elementChanged': '{name} wizige',
  'activity.elementDeleted': '{name} fuortsmiten',
  'activity.relationAdded': 'Ferbining tekene',
  'activity.relationChanged': 'Ferbining wizige',
  'activity.relationDeleted': 'Ferbining fuortsmiten',
  'activity.rowAdded': 'Rige tekene ({type})',
  'activity.rowChanged': 'Rige feroare ({type})',
  'activity.rowDeleted': 'Rige wiske ({type})',
  'activity.movedOne': 'Ien elemint ferpleatst',
  'activity.movedMany': '{count} eleminten ferpleatst',
  'activity.removedOne': 'Ien elemint fan it diagram helle',
  'activity.removedMany': '{count} eleminten fan it diagram helle',
  'activity.routeChanged': 'Lineferrin wizige',
  'activity.layoutChanged': 'Yndieling wizige',
  'activity.groupChanged': 'Groep {name} wizige',
  'activity.groupRemoved': 'Groep {name} fuortsmiten',
  'activity.diagramAdded': 'Diagram {name} tafoege',
  'activity.diagramRenamed': 'Diagram omneamd nei {name}',
  'activity.diagramSettings': 'Ynstellingen fan {name} wizige',
  'activity.diagramChanged': 'Diagram {name} wizige',
  'activity.diagramDeleted': 'Diagram {name} fuortsmiten',
  'activity.decisionAdded': 'Beslút {name} tafoege',
  'activity.decisionChanged': 'Beslút {name} wizige',
  'activity.decisionRemoved': 'Beslút {name} fuortsmiten',
  'activity.planAdded': 'Plan {name} tafoege',
  'activity.planChanged': 'Plan {name} wizige',
  'activity.planRemoved': 'Plan {name} fuortsmiten',
  'activity.projectSettings': 'Projektynstellingen wizige',
  'activity.diagramRestored': 'Diagram {name} weromset nei {asOf}',
  'activity.descriptionRestored': 'Beskriuwing fan {name} weromset nei {asOf}',
  'activity.decisionRestored': 'Beslút {name} weromset nei {asOf}',
  'activity.projectRestored': 'It hiele projekt weromset nei {asOf}',
}
