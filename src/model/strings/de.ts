/**
 * German, for the model speaks: element kinds, zones, the refusals a rule returns.
 *
 * Typed from the English slice beside it, so a missing translation is a compile
 * error here rather than an English sentence on a German screen. `strings.test.ts`
 * covers what the type cannot: empty values, and placeholders that were dropped
 * or invented in translation.
 */
import type { EN } from './en'

export const DE: Record<keyof typeof EN, string> = {

  'kind.actor': 'Akteur',
  'kind.application': 'Anwendung',
  'kind.component': 'Komponente',
  'kind.externalSystem': 'Externes System',
  'kind.inputChannel': 'Eingabekanal',
  'kind.managementTool': 'Verwaltungswerkzeug',

  'relation.flow': 'Verbindung',
  'relation.supports': 'Unterstützt',
  'relation.serves': 'Bedient',
  'relation.realises': 'Realisiert',
  'relation.assigned': 'Zugewiesen an',
  'relation.notInThisFormat': 'Eine Relation vom Typ {type} kann in diesem Dateiformat noch nicht gespeichert werden. Nur Verbindungen.',

  'zone.actors': 'AKTEURE',
  'zone.inputChannels': 'EINGABEKANÄLE',
  'zone.externalSystems': 'EXTERNE SYSTEME',
  'zone.landscape': 'ANWENDUNGSLANDSCHAFT',
  'zone.management': 'VERWALTUNGSEBENE',
  'zoneMenu.actors': 'Akteure',
  'zoneMenu.inputChannels': 'Eingabekanäle',
  'zoneMenu.externalSystems': 'Externe Systeme',
  'zoneMenu.landscape': 'Anwendungslandschaft',
  'zoneMenu.management': 'Verwaltungsebene',
  'kindChange.sameKind': 'Es ist bereits von dieser Art',
  'kindChange.notOnThisDiagram': 'Dieses Element liegt nicht auf diesem Diagramm',
  'kindChange.hasContainerDiagram':
    'Diese Anwendung hat ein Container-Diagramm — löschen Sie zuerst diese Ansicht',
  'kindChange.hasParent': 'Diese Komponente gehört zu einer Anwendung — lösen Sie sie zuerst',
  'kindChange.hasComponents':
    'Diese Anwendung hat Komponenten — verschieben oder löschen Sie diese zuerst',
  'kindChange.notAllowedHere': 'Dieses Diagramm nimmt diese Art nicht auf',

  // --- what the one writer refuses (ADR-0002) ------------------------------
  'command.gone': 'Das ist nicht mehr da',
  'command.lastLandscape': 'Dies ist die letzte Landschaft; sie kann nicht gelöscht werden.',
  'command.datesOutOfOrder': 'Diese Daten laufen rückwärts: eine Anwendung kann nicht abgeschaltet werden, bevor sie in Betrieb geht.',
  'restore.absentThen': 'Dies war bei diesem Schnappschuss nicht im Projekt.',
  'restore.absentNow': 'Das Element ist nicht mehr im Projekt; stellen Sie das ganze Projekt wieder her, um es zurückzuholen.',
  'restore.locked': 'Diese Entscheidung wurde angenommen, abgelehnt oder ersetzt, und ein abgeschlossener Eintrag wird nicht geändert. Schreiben Sie eine neue, die sie ersetzt.',
  'logo.category.data': 'Daten',
  'logo.category.integration': 'Integration',
  'logo.category.applications': 'Anwendungen',
  'logo.category.platform': 'Plattform',
  'logo.category.security': 'Sicherheit & Betrieb',
  'logo.category.vendors': 'Anbieter',

  'deletion.nothing': 'nichts',
  'deletion.elementOne': '{count} Element',
  'deletion.elementOther': '{count} Elemente',
  'deletion.connectionOne': '{count} Verbindung',
  'deletion.connectionOther': '{count} Verbindungen',
  'deletion.groupOne': '{count} Gruppe',
  'deletion.groupOther': '{count} Gruppen',
  'deletion.joined': '{head} und {last}',
  'shell.logoBadType': 'Nur SVG- und PNG-Dateien können als Logo hinzugefügt werden.',
  'shell.logoTooBig': 'Dieses Logo ist zu groß ({size} kB). Die Grenze liegt bei {max} kB.',
  'shell.logoUnreadable': 'Diese Datei konnte nicht gelesen werden.',
  'shell.imageBadType': 'Nur PNG-, JPEG-, SVG- und WebP-Dateien können in ein Dokument aufgenommen werden.',
  'shell.imageTooBig': 'Dieses Bild ist zu groß ({size} kB). Die Grenze liegt bei {max} kB.',
  'shell.imageUnreadable': 'Diese Datei konnte nicht gelesen werden.',

  'activity.nothing': 'Nichts',
  'activity.elementAdded': '{name} hinzugefügt',
  'activity.elementChanged': '{name} geändert',
  'activity.elementDeleted': '{name} gelöscht',
  'activity.relationAdded': 'Verbindung gezeichnet',
  'activity.relationChanged': 'Verbindung geändert',
  'activity.relationDeleted': 'Verbindung gelöscht',
  'activity.movedOne': 'Ein Element verschoben',
  'activity.movedMany': '{count} Elemente verschoben',
  'activity.removedOne': 'Ein Element vom Diagramm genommen',
  'activity.removedMany': '{count} Elemente vom Diagramm genommen',
  'activity.routeChanged': 'Linienführung geändert',
  'activity.layoutChanged': 'Anordnung geändert',
  'activity.diagramAdded': 'Diagramm {name} hinzugefügt',
  'activity.diagramRenamed': 'Diagramm umbenannt in {name}',
  'activity.diagramSettings': 'Einstellungen von {name} geändert',
  'activity.diagramChanged': 'Diagramm {name} geändert',
  'activity.diagramDeleted': 'Diagramm {name} gelöscht',
  'activity.decisionAdded': 'Entscheidung {name} hinzugefügt',
  'activity.decisionChanged': 'Entscheidung {name} geändert',
  'activity.decisionRemoved': 'Entscheidung {name} entfernt',
  'activity.planAdded': 'Plan {name} hinzugefügt',
  'activity.planChanged': 'Plan {name} geändert',
  'activity.planRemoved': 'Plan {name} entfernt',
  'activity.projectSettings': 'Projekteinstellungen geändert',
  'activity.diagramRestored': 'Diagramm {name} wiederhergestellt auf den Stand vom {asOf}',
  'activity.descriptionRestored': 'Beschreibung von {name} wiederhergestellt auf den Stand vom {asOf}',
  'activity.decisionRestored': 'Entscheidung {name} wiederhergestellt auf den Stand vom {asOf}',
  'activity.projectRestored': 'Das ganze Projekt wiederhergestellt auf den Stand vom {asOf}',
}
