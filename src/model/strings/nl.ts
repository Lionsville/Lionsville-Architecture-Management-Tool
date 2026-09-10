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

  'relation.flow': 'Koppeling',
  'relation.supports': 'Ondersteunt',
  'relation.serves': 'Bedient',
  'relation.realises': 'Realiseert',
  'relation.assigned': 'Toegewezen aan',
  'relation.notInThisFormat': 'Een relatie van het type {type} kan nog niet in dit bestandsformaat worden opgeslagen. Alleen koppelingen wel.',

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

  // --- wat de enige schrijver weigert (ADR-0002) ---------------------------
  'command.gone': 'Dat is er niet meer',
  'command.lastLandscape': 'Dit is het laatste landschap; het kan niet worden verwijderd.',
  'command.datesOutOfOrder': 'Deze datums lopen terug: een applicatie kan niet uitgefaseerd zijn voordat zij live gaat.',
  'restore.absentThen': 'Dit stond bij die momentopname niet in het project.',
  'restore.absentNow': 'Het element staat niet meer in het project; zet het hele project terug om het terug te halen.',
  'restore.locked': 'Dit besluit is aanvaard, afgewezen of vervangen, en een afgesloten record wordt niet gewijzigd. Schrijf een nieuw besluit dat het vervangt.',
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
  'shell.imageBadType': 'Alleen PNG-, JPEG-, SVG- en WebP-bestanden kunnen in een document worden opgenomen.',
  'shell.imageTooBig': 'Deze afbeelding is te groot ({size} kB). Maximaal {max} kB.',
  'shell.imageUnreadable': 'Dit bestand kon niet worden gelezen.',

  'activity.nothing': 'Niets',
  'activity.elementAdded': '{name} toegevoegd',
  'activity.elementChanged': '{name} gewijzigd',
  'activity.elementDeleted': '{name} verwijderd',
  'activity.relationAdded': 'Koppeling getekend',
  'activity.relationChanged': 'Koppeling gewijzigd',
  'activity.relationDeleted': 'Koppeling verwijderd',
  'activity.movedOne': 'Eén element verplaatst',
  'activity.movedMany': '{count} elementen verplaatst',
  'activity.removedOne': 'Eén element van het diagram gehaald',
  'activity.removedMany': '{count} elementen van het diagram gehaald',
  'activity.routeChanged': 'Lijnverloop gewijzigd',
  'activity.layoutChanged': 'Indeling gewijzigd',
  'activity.groupChanged': 'Groep {name} gewijzigd',
  'activity.groupRemoved': 'Groep {name} verwijderd',
  'activity.diagramAdded': 'Diagram {name} toegevoegd',
  'activity.diagramRenamed': 'Diagram hernoemd naar {name}',
  'activity.diagramSettings': 'Instellingen van {name} gewijzigd',
  'activity.diagramChanged': 'Diagram {name} gewijzigd',
  'activity.diagramDeleted': 'Diagram {name} verwijderd',
  'activity.decisionAdded': 'Besluit {name} toegevoegd',
  'activity.decisionChanged': 'Besluit {name} gewijzigd',
  'activity.decisionRemoved': 'Besluit {name} verwijderd',
  'activity.planAdded': 'Plan {name} toegevoegd',
  'activity.planChanged': 'Plan {name} gewijzigd',
  'activity.planRemoved': 'Plan {name} verwijderd',
  'activity.projectSettings': 'Projectinstellingen gewijzigd',
  'activity.diagramRestored': 'Aanzicht {name} teruggezet naar {asOf}',
  'activity.descriptionRestored': 'Beschrijving van {name} teruggezet naar {asOf}',
  'activity.decisionRestored': 'Besluit {name} teruggezet naar {asOf}',
  'activity.projectRestored': 'Het hele project teruggezet naar {asOf}',
}
