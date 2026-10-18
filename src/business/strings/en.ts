// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

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
  'sheet.hidePanels': 'Hide the stakeholders and the details',
  'sheet.showPanels': 'Show the stakeholders and the details',
  'sheet.resizeRail': 'Resize the stakeholder rail',
  'sheet.resizeDetails': 'Resize the details',
  'sheet.noStakeholders': 'No stakeholders yet.',
  // The units the sheet uses, and the rest on request (ADR-0036, amended 12 October 2026).
  'sheet.unitsHere': 'Units on this sheet',
  'sheet.unitsOther': 'All other units',
  'sheet.allUnits': 'All units',
  'sheet.unitsNotDrawnOne': '1 more unit is filed here.',
  'sheet.unitsNotDrawnOther': '{count} more units are filed here.',
  'sheet.unitResponsible': 'Responsible for {name}',
  'sheet.unitResponsibleMore': 'Responsible for {name} and {count} more',
  'sheet.unitLane': 'Has a lane',
  'sheet.nowAUnit': 'Now a unit: it is on the organisation chart. Use ‘All units’ to keep it on this rail.',

  // --- finding something on the page ---------------------------------------
  'sheet.find': 'Find on the page',
  'sheet.findPlaceholder': 'Type a name…',
  'sheet.findNone': 'Nothing on this page matches.',
  'sheet.findMore': '{count} more — keep typing',
  'sheet.bandActor': 'stakeholder',
  'sheet.bandPhase': 'phase',
  'sheet.bandStep': 'step',
  'sheet.bandArea': 'area',
  'sheet.bandGrouping': 'grouping',
  'sheet.bandCapability': 'capability',
  'sheet.bandUnmapped': 'not yet mapped',

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
  'sheet.settingsPaper': 'Canvas',
  'sheet.paperFit': 'Fit the window',
  'sheet.settingsColumns': 'Columns',
  'sheet.columnsFit': 'As many as fit',
  'sheet.wider': 'Make {name} wider',
  'sheet.narrower': 'Make {name} narrower',

  // --- a picture of the page ----------------------------------------------
  'sheet.export': 'Save as a picture…',
  'sheet.exportTitle': 'Save the business architecture as a picture',
  'sheet.exportHint': 'The whole page, laid out for the width you choose — an A1 or A0 print fits more areas side by side than the window does.',
  'sheet.exportPaper': 'Laid out for',
  'sheet.exportScreen': 'The window as it is',
  'sheet.exportSave': 'Save',
  'sheet.exportBusy': 'Drawing…',
  'sheet.exportFailed': 'The picture could not be drawn: {message}',

  // --- taking something away -----------------------------------------------
  'sheet.deleteThis': 'Delete {name}',
  'sheet.deleteUnitTitle': 'Delete “{name}”?',
  'sheet.deleteUnitBody': 'You can undo this.',
  'sheet.deleteChildrenFirst': 'Delete what is inside it first',
  'sheet.insideOne': '1 thing is inside it',
  'sheet.insideOther': '{count} things are inside it',

  // --- coverage, as something a person ticks -------------------------------
  'sheet.supportedBy': 'Supported by…',
  'sheet.assignedTo': 'Assigned to',
  'sheet.assignUnit': '+ Unit',
  'sheet.findUnit': 'Find a unit or an actor',
  'sheet.noUnit': 'Nobody by that name',
  'sheet.assignedNobody': 'Nobody yet',
  'sheet.assignedOutside': 'outside this domain',
  'sheet.assignedFarEnd': 'Each is an assigned row kept here. A unit filed in another scope is its far end, and is drawn on no board here for it.',
  'sheet.showResponsible': 'Show who is responsible',
  'sheet.responsibleNobody': 'nobody',
  'sheet.unitLabel': 'Responsible: {units}. Open where they serve',
  'sheet.unitLabelMore': '+{count}',
  'sheet.unitWhereKept': 'where it is kept',

  // --- which domains it is handed to, and which took it up (ADR-0040) ------
  'sheet.domains': 'Domains',
  'sheet.domainsNone': 'Not handed to a domain',
  'sheet.domainsThere': 'Said where it is defined',
  'sheet.domainsAdd': '+ Domain',
  'sheet.domainsFind': 'Find a scope below this one',
  'sheet.domainsNothing': 'No scope by that name',
  'sheet.notStarted': 'not started',
  'sheet.domainUnknown': 'no such scope',
  'sheet.domainsThrough': 'With {name}: {scopes}',
  'sheet.takenUpBy': 'Taken up by',
  'sheet.takenUpNobody': 'No domain yet',
  'sheet.takenUpUnasked': 'without being handed it',
  'sheet.fromAbove': 'From above…',
  'sheet.fromAboveTitle': 'Take up an area or a capability of a sheet above',
  'sheet.fromAboveFind': 'Find an area or a capability above',
  'sheet.fromAboveNothing': 'Nothing above by that name',

  // --- where an element is actually drawn ----------------------------------
  'sheet.switchedBoard': 'Showing {name}, which draws it',

  // --- the band at the end (ADR-0012 §9) -----------------------------------
  'sheet.unmapped': 'Not yet mapped to a domain',
  'sheet.unmappedCount': '{count} waiting',

  // --- the inspector -------------------------------------------------------
  'sheet.details': 'Details',
  'sheet.openPage': 'Open the page of {name}',
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

  // --- the enterprise map (ADR-0012 §6, §9) --------------------------------
  'map.page': 'Enterprise map',
  'map.close': 'Close the enterprise map',
  'map.function': 'Capability',
  'map.people': 'People',
  'map.coverage': 'Coverage',
  'map.thisScope': 'This scope',
  'map.summary': '{covered} covered · {manual} by people · {uncovered} uncovered',
  'map.legend': '● supports it · ○ supports something under it',
  'map.uncovered': 'uncovered',
  'map.byPeople': 'people',
  'map.gapsOne': '1 gap',
  'map.gapsOther': '{count} gaps',
  'map.supportsTip': '{application} supports {function}',
  'map.rolledUpTip': '{application} supports something under {function}',
  'map.peopleTip': 'Done by {names}',
  'map.unknownApplication': 'Nobody in the organisation defines this',
  'map.noFunctions': 'No capabilities to map yet.',
  'map.noFunctionsHint': 'Capabilities are made on the business architecture sheet; the map draws what supports them.',
  'map.noApplications': 'Nothing supports these capabilities yet.',
} as const
