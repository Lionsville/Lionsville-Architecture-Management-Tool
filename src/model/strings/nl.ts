/**
 * Dutch, for the model speaks: element kinds, zones, the refusals a rule returns.
 *
 * Typed from the English slice beside it, so a missing translation is a compile
 * error here rather than an English sentence on a Dutch screen. `strings.test.ts`
 * covers what the type cannot: empty values, and placeholders that were dropped
 * or invented in translation.
 */
import type { EN } from './en'

export const NL: Record<keyof typeof EN, string> = {

  'kind.actor': 'Actor',
  'kind.application': 'Applicatie',
  'kind.component': 'Component',
  'kind.externalSystem': 'Extern systeem',
  'kind.inputChannel': 'Invoerkanaal',
  'kind.managementTool': 'Beheertool',

  'zone.actors': 'ACTOREN',
  'zone.inputChannels': 'INVOERKANALEN',
  'zone.externalSystems': 'EXTERNE SYSTEMEN',
  'zone.landscape': 'APPLICATIELANDSCHAP',
  'zone.management': 'BEHEERLAAG',
  'zoneMenu.actors': 'Actoren',
  'zoneMenu.inputChannels': 'Invoerkanalen',
  'zoneMenu.externalSystems': 'Externe systemen',
  'zoneMenu.landscape': 'Applicatielandschap',
  'zoneMenu.management': 'Beheerlaag',
  'kindChange.sameKind': 'Dit is al de soort',
  'kindChange.notOnThisDiagram': 'Dit element staat niet op dit aanzicht',
  'kindChange.hasContainerDiagram':
    'Deze applicatie heeft een containeraanzicht — verwijder dat aanzicht eerst',
  'kindChange.hasParent': 'Dit component hoort bij een applicatie — maak het eerst los',
  'kindChange.hasComponents':
    'Deze applicatie heeft componenten — verplaats of verwijder die eerst',
  'kindChange.notAllowedHere': 'Dit aanzicht draagt die soort niet',
  'logo.category.data': 'Gegevens',
  'logo.category.integration': 'Integratie',
  'logo.category.applications': 'Applicaties',
  'logo.category.platform': 'Platform',
  'logo.category.security': 'Beveiliging & beheer',
  'logo.category.vendors': 'Leveranciers',

  'deletion.nothing': 'niets',
  'deletion.elementOne': '{count} element',
  'deletion.elementOther': '{count} elementen',
  'deletion.connectionOne': '{count} koppeling',
  'deletion.connectionOther': '{count} koppelingen',
  'deletion.groupOne': '{count} groep',
  'deletion.groupOther': '{count} groepen',
  'deletion.joined': '{head} en {last}',
  'shell.logoBadType': 'Alleen SVG- en PNG-bestanden kunnen als logo worden toegevoegd.',
  'shell.logoTooBig': 'Dit logo is te groot ({size} kB). Maximaal {max} kB.',
  'shell.logoUnreadable': 'Dit bestand kon niet worden gelezen.',
}
