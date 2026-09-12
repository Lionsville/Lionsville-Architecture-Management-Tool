/** Frysk, foar de bedriuwsarsjitektuer (ADR-0012 §4, §6). Typearre fanút `en.ts`. */
import type { EN } from './en'

export const FY: Record<keyof typeof EN, string> = {
  'sheet.page': 'Bedriuwsarsjitektuer',
  'sheet.close': 'Bedriuwsarsjitektuer slute',
  'sheet.new': 'Bedriuwsarsjitektuer',

  'sheet.stakeholders': 'Belanghawwenden',
  'sheet.outside': 'Ekstern',
  'sheet.showRail': 'Belanghawwenden sjen litte',
  'sheet.hideRail': 'Belanghawwenden ferstopje',
  'sheet.noStakeholders': 'Noch gjin belanghawwenden.',

  'sheet.commonLane': 'Alle klanten',
  'sheet.passThrough': 'Lykas de rige hjirboppe',
  'sheet.outsideStep': '{name} — bûten de organisaasje dien',
  'sheet.noJourney': 'Noch gjin klantreis op dit blêd.',

  'sheet.appsOne': '1 applikaasje',
  'sheet.appsOther': '{count} applikaasjes',
  'sheet.people': 'minsken',
  'sheet.nothingYet': 'noch neat',
  'sheet.noAreas': 'Noch gjin gebieten op dit blêd.',
  'sheet.emptyHint': 'Foegje in klantreis, in gebiet of in capability ta, dan wurdt it hjir tekene.',

  'sheet.unmapped': 'Noch net oan in domein tawiisd',
  'sheet.unmappedCount': '{count} wachtsje',

  'sheet.details': 'Details',
  'sheet.nothingSelected': 'Kies wat op it blêd om it hjir te sjen.',
  'sheet.parent': 'Falt ûnder',
  'sheet.parentRoot': 'Neat — dit stiet boppe-oan',
  'sheet.parentCycle': 'Sit hjir al yn',
  'sheet.order': 'Tusken de buorlju',
  'sheet.moveUp': 'Nei boppen',
  'sheet.moveDown': 'Nei ûnderen',
  'sheet.lane': 'Waans paad',
  'sheet.laneCommon': 'It paad dat elkenien rint',
  'sheet.lifecycle': 'Libbenssyklus',
  'sheet.date.live': 'Live fan',
  'sheet.date.retiring': 'Ofbouwe fan',
  'sheet.date.retired': 'Fuort op',
  'sheet.description': 'Beskriuwing',
  'sheet.coverage': 'Ynfolle troch',
  'sheet.coverageNobody': 'Noch neat en nimmen',
  'sheet.coveragePeople': 'Minsken, sûnder systeem',
  'sheet.open': '{name} iepenje',
}
