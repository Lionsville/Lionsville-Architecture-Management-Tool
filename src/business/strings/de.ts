/** Deutsch, für die Geschäftsarchitektur (ADR-0012 §4, §6). Typisiert aus `en.ts`. */
import type { EN } from './en'

export const DE: Record<keyof typeof EN, string> = {
  'sheet.page': 'Geschäftsarchitektur',
  'sheet.close': 'Geschäftsarchitektur schließen',

  'sheet.stakeholders': 'Beteiligte',
  'sheet.outside': 'Extern',
  'sheet.showRail': 'Beteiligte anzeigen',
  'sheet.hideRail': 'Beteiligte ausblenden',
  'sheet.noStakeholders': 'Noch keine Beteiligten.',

  'sheet.commonLane': 'Alle Kunden',
  'sheet.passThrough': 'Wie die Zeile darüber',
  'sheet.outsideStep': '{name} — außerhalb der Organisation erledigt',
  'sheet.noJourney': 'Noch keine Kundenreise auf diesem Blatt.',

  'sheet.appsOne': '1 Anwendung',
  'sheet.appsOther': '{count} Anwendungen',
  'sheet.people': 'Menschen',
  'sheet.nothingYet': 'noch nichts',
  'sheet.noAreas': 'Noch keine Bereiche auf diesem Blatt.',
  'sheet.emptyHint': 'Fügen Sie eine Kundenreise, einen Bereich oder eine Fähigkeit hinzu, dann erscheint sie hier.',

  'sheet.unmapped': 'Noch keiner Domäne zugeordnet',
  'sheet.unmappedCount': '{count} warten',

  'sheet.details': 'Details',
  'sheet.nothingSelected': 'Wählen Sie etwas auf dem Blatt, um es hier zu sehen.',
  'sheet.parent': 'Gehört zu',
  'sheet.parentRoot': 'Nichts — dies steht ganz oben',
  'sheet.parentCycle': 'Steckt hier schon darin',
  'sheet.order': 'Unter seinesgleichen',
  'sheet.moveUp': 'Nach oben',
  'sheet.moveDown': 'Nach unten',
  'sheet.lane': 'Wessen Weg',
  'sheet.laneCommon': 'Der Weg, den alle gehen',
  'sheet.lifecycle': 'Lebenszyklus',
  'sheet.date.live': 'Live ab',
  'sheet.date.retiring': 'Abschaltung ab',
  'sheet.date.retired': 'Weg am',
  'sheet.description': 'Beschreibung',
  'sheet.coverage': 'Abgedeckt durch',
  'sheet.coverageNobody': 'Noch nichts und niemand',
  'sheet.coveragePeople': 'Menschen, ohne System',
  'sheet.open': '{name} öffnen',
}
