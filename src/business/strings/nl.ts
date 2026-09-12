/** Nederlands, voor de bedrijfsarchitectuur (ADR-0012 §4, §6). Getypeerd vanuit `en.ts`. */
import type { EN } from './en'

export const NL: Record<keyof typeof EN, string> = {
  'sheet.page': 'Bedrijfsarchitectuur',
  'sheet.close': 'Bedrijfsarchitectuur sluiten',

  'sheet.stakeholders': 'Belanghebbenden',
  'sheet.outside': 'Extern',
  'sheet.showRail': 'Belanghebbenden tonen',
  'sheet.hideRail': 'Belanghebbenden verbergen',
  'sheet.noStakeholders': 'Nog geen belanghebbenden.',

  'sheet.commonLane': 'Alle klanten',
  'sheet.passThrough': 'Zoals de rij hierboven',
  'sheet.outsideStep': '{name} — buiten de organisatie gedaan',
  'sheet.noJourney': 'Nog geen klantreis op dit blad.',

  'sheet.appsOne': '1 applicatie',
  'sheet.appsOther': '{count} applicaties',
  'sheet.people': 'mensen',
  'sheet.nothingYet': 'nog niets',
  'sheet.noAreas': 'Nog geen gebieden op dit blad.',
  'sheet.emptyHint': 'Voeg een klantreis, een gebied of een capability toe, dan wordt het hier getekend.',

  'sheet.unmapped': 'Nog niet aan een domein toegewezen',
  'sheet.unmappedCount': '{count} wachten',

  'sheet.details': 'Details',
  'sheet.nothingSelected': 'Kies iets op het blad om het hier te zien.',
  'sheet.parent': 'Valt onder',
  'sheet.parentRoot': 'Niets — dit staat bovenaan',
  'sheet.parentCycle': 'Zit hier al in',
  'sheet.order': 'Tussen de buren',
  'sheet.moveUp': 'Naar boven',
  'sheet.moveDown': 'Naar beneden',
  'sheet.lane': 'Wiens pad',
  'sheet.laneCommon': 'Het pad dat iedereen loopt',
  'sheet.lifecycle': 'Levenscyclus',
  'sheet.date.live': 'Live vanaf',
  'sheet.date.retiring': 'Uitfaseren vanaf',
  'sheet.date.retired': 'Weg op',
  'sheet.description': 'Beschrijving',
  'sheet.coverage': 'Ingevuld door',
  'sheet.coverageNobody': 'Nog niets en niemand',
  'sheet.coveragePeople': 'Mensen, zonder systeem',
  'sheet.open': '{name} openen',
}
