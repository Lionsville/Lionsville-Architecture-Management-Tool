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
  'sheet.emptyHint': 'Start with a journey across the top, or an area to keep capabilities in.',

  // --- making something ----------------------------------------------------
  'sheet.newJourney': 'New journey',
  'sheet.newArea': 'New area',
  'sheet.addPhase': '+ phase',
  'sheet.addPhaseTo': 'Add a phase to {name}',
  'sheet.addStep': '+ step',
  'sheet.addStepTo': 'Add a step in {phase}, {lane}',
  'sheet.addLane': '+ lane…',
  'sheet.addArea': '+ area',
  'sheet.addGrouping': '+ grouping',
  'sheet.addGroupingTo': 'Add a grouping to {name}',
  'sheet.addCapability': '+ capability',
  'sheet.addCapabilityTo': 'Add a capability to {name}',
  'sheet.addStakeholder': '+ stakeholder',
  'sheet.addStakeholderTo': 'Add a stakeholder under {name}',
  'sheet.addGroup': '+ group',
  'sheet.addGroupHint': 'Add a stakeholder group',

  // What a new thing is called until the person types over it. These are
  // written into the file, so they are words rather than placeholders.
  'sheet.nameJourney': 'New journey',
  'sheet.nameFirstPhase': 'Start',
  'sheet.namePhase': 'New phase',
  'sheet.nameStep': 'New step',
  'sheet.nameArea': 'New area',
  'sheet.nameGrouping': 'New grouping',
  'sheet.nameCapability': 'New capability',
  'sheet.nameStakeholder': 'New stakeholder',
  'sheet.nameGroup': 'New group',
  'sheet.untitled': 'Untitled',

  // --- a path of its own ---------------------------------------------------
  'sheet.laneTitle': 'A path of its own',
  'sheet.laneWho': 'Whose path it is',
  'sheet.laneSomebodyNew': 'Somebody not on the rail yet',
  'sheet.laneName': 'Their name',
  'sheet.laneWhere': 'Forks at',
  'sheet.laneAdd': 'Add the lane',
  'sheet.outsideOrganisation': 'Outside the organisation',

  // --- what this sheet is of -----------------------------------------------
  'sheet.settings': 'What this sheet draws',
  'sheet.settingsJourney': 'The journey across the top',
  'sheet.settingsAreas': 'The areas, in order',
  'sheet.settingsLanes': 'The lanes, in order',
  'sheet.settingsNoLanes': 'No row of its own yet — a lane appears when a step is on it.',
  'sheet.settingsRail': 'Draw the stakeholder rail',
  'sheet.settingsDraw': 'Draw {name}',

  // --- taking something away -----------------------------------------------
  'sheet.deleteThis': 'Delete {name}',
  'sheet.deleteChildrenFirst': 'Delete what is inside it first',
  'sheet.insideOne': '1 thing is inside it',
  'sheet.insideOther': '{count} things are inside it',

  // --- coverage, as something a person ticks -------------------------------
  'sheet.supportedBy': 'Supported by…',
  'sheet.doneBy': 'Done by…',

  // --- where an element is actually drawn ----------------------------------
  'sheet.switchedBoard': 'Showing {name}, which draws it',

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
