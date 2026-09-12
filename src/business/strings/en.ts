/**
 * English, for the business architecture: the sheet, and the inspector docked
 * to it (ADR-0012 §4, §6).
 *
 * `as const`, so this slice is the schema for its own keys and its three
 * siblings cannot be missing one. The lifecycle phases are read through the
 * shared `lifecycle.*` vocabulary, as the roadmap reads them: a capability
 * being built and an application being built are in the same phase, and two
 * spellings of *Retiring* is a translation nobody would keep in step.
 */
export const EN = {
  'sheet.page': 'Business architecture',
  'sheet.close': 'Close the business architecture',

  // --- the stakeholder rail ------------------------------------------------
  'sheet.stakeholders': 'Stakeholders',
  'sheet.outside': 'Outside',
  'sheet.showRail': 'Show the stakeholders',
  'sheet.hideRail': 'Hide the stakeholders',
  'sheet.noStakeholders': 'No stakeholders yet.',

  // --- the journey band ----------------------------------------------------
  'sheet.commonLane': 'All customers',
  'sheet.passThrough': 'As the row above',
  'sheet.outsideStep': '{name} — done outside the organisation',
  'sheet.noJourney': 'No journey on this sheet yet.',

  // --- the areas -----------------------------------------------------------
  'sheet.appsOne': '1 app',
  'sheet.appsOther': '{count} apps',
  'sheet.people': 'people',
  'sheet.nothingYet': 'nothing yet',
  'sheet.noAreas': 'No areas on this sheet yet.',
  'sheet.emptyHint': 'Add a journey, an area or a capability, and it is drawn here.',

  // --- the band at the end (ADR-0012 §9) -----------------------------------
  'sheet.unmapped': 'Not yet mapped to a domain',
  'sheet.unmappedCount': '{count} waiting',

  // --- the inspector -------------------------------------------------------
  'sheet.details': 'Details',
  'sheet.nothingSelected': 'Choose something on the sheet to see it here.',
  'sheet.parent': 'Sits under',
  'sheet.parentRoot': 'Nothing — this is a top-level entry',
  'sheet.parentCycle': 'Already inside this one',
  'sheet.order': 'Among its neighbours',
  'sheet.moveUp': 'Move up',
  'sheet.moveDown': 'Move down',
  'sheet.lane': 'Whose path',
  'sheet.laneCommon': 'The path everybody takes',
  'sheet.lifecycle': 'Lifecycle',
  'sheet.date.live': 'Live from',
  'sheet.date.retiring': 'Retiring from',
  'sheet.date.retired': 'Gone on',
  'sheet.description': 'Description',
  'sheet.coverage': 'Covered by',
  'sheet.coverageNobody': 'Nothing and nobody yet',
  'sheet.coveragePeople': 'People, without a system',
  'sheet.open': 'Open {name}',
} as const
