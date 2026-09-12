/**
 * English, for the model speaks: element kinds, zones, the refusals a rule returns.
 *
 * `as const`, so this slice is the schema for its own keys: `nl.ts` beside it
 * cannot be missing one and cannot invent one. The registry composes every
 * module's slice into the table `t()` reads (`i18n/strings.ts`).
 */
export const EN = {

  'kind.actor': 'Actor',
  'kind.step': 'Step',
  'kind.function': 'Function',
  'kind.process': 'Process',
  'kind.application': 'Application',
  'kind.component': 'Component',
  'placement.notOnACanvas': 'A {kind} is not drawn on this sort of view.',

  // --- what a relation MEANS (ADR-0012 §5) ---------------------------------
  'relation.flow': 'Flow',
  'relation.supports': 'Supports',
  'relation.serves': 'Serves',
  'relation.realises': 'Realises',
  'relation.assigned': 'Assigned to',

  // --- Layer 7 zones -------------------------------------------------------
  'zone.actors': 'ACTORS',
  'zone.inputChannels': 'INPUT CHANNELS',
  'zone.externalSystems': 'EXTERNAL SYSTEMS',
  'zone.landscape': 'APPLICATION LANDSCAPE',
  'zone.management': 'MANAGEMENT LAYER',
  'zoneMenu.actors': 'Actors',
  'zoneMenu.inputChannels': 'Input channels',
  'zoneMenu.externalSystems': 'External systems',
  'zoneMenu.landscape': 'Application landscape',
  'zoneMenu.management': 'Management layer',
  'kindChange.sameKind': 'It is already this kind',
  'kindChange.notOnThisDiagram': 'This element is not placed on this diagram',
  'kindChange.hasContainerDiagram':
    'This application has a container diagram — delete that view first',
  'kindChange.hasParent': 'This component belongs to an application — detach it first',
  'kindChange.hasComponents':
    'This application has components — move or delete them first',
  'kindChange.notAllowedHere': 'This diagram does not hold that kind',

  // --- what the one writer refuses (ADR-0002) ------------------------------
  'command.gone': 'That is no longer there',
  'command.lastLandscape': 'This is the last landscape; it cannot be deleted.',
  'command.datesOutOfOrder': 'These dates run backwards: an application cannot retire before it goes live.',
  // A restore that cannot be (ADR-0008). A refusal, never an exception.
  'restore.absentThen': 'This was not in the project at that snapshot.',
  'restore.absentNow': 'The element is no longer in the project; restore the whole project to bring it back.',
  'restore.locked': 'This decision has been accepted, rejected or superseded, and a locked record is not changed. Write a new one that supersedes it.',
  'logo.category.data': 'Data',
  'logo.category.integration': 'Integration',
  'logo.category.applications': 'Applications',
  'logo.category.platform': 'Platform',
  'logo.category.security': 'Security & operations',
  'logo.category.vendors': 'Vendors',

  // --- dialogs -------------------------------------------------------------
  'deletion.nothing': 'nothing',
  'deletion.elementOne': '{count} element',
  'deletion.elementOther': '{count} elements',
  'deletion.connectionOne': '{count} connection',
  'deletion.connectionOther': '{count} connections',
  'deletion.groupOne': '{count} group',
  'deletion.groupOther': '{count} groups',
  'deletion.joined': '{head} and {last}',
  'deletion.withStandIns': '{what} — {count} of them stand-ins, which stay where they are defined',
  /**
   * The three refusals from `logoLibrary.readLogoFile`. They travel as KEYS,
   * not sentences: the reader is a pure browser helper with no language of its
   * own, and it used to hand back Dutch prose that the shell then showed
   * verbatim — the one place an English UI still spoke Dutch.
   */
  'shell.logoBadType': 'Only SVG and PNG files can be added as a logo.',
  'shell.logoTooBig': 'This logo is too big ({size} kB). The limit is {max} kB.',
  'shell.logoUnreadable': 'This file could not be read.',
  /** The same three, for a picture in a document (ADR-0009). */
  'shell.imageBadType': 'Only PNG, JPEG, SVG and WebP files can be added to a document.',
  'shell.imageTooBig': 'This image is too big ({size} kB). The limit is {max} kB.',
  'shell.imageUnreadable': 'This file could not be read.',

  // --- what a step is called, in the activity list (ADR-0002) ---------------
  'activity.nothing': 'Nothing',
  'activity.elementAdded': 'Added {name}',
  'activity.elementChanged': 'Changed {name}',
  'activity.elementDeleted': 'Deleted {name}',
  'activity.standInsRefreshed': 'Refreshed {count} stand-ins',
  'activity.relationAdded': 'Drew a connection',
  'activity.relationChanged': 'Changed a connection',
  'activity.relationDeleted': 'Deleted a connection',
  'activity.rowAdded': 'Drew a row ({type})',
  'activity.rowChanged': 'Changed a row ({type})',
  'activity.rowDeleted': 'Deleted a row ({type})',
  'activity.movedOne': 'Moved one element',
  'activity.movedMany': 'Moved {count} elements',
  'activity.removedOne': 'Took one element off the diagram',
  'activity.removedMany': 'Took {count} elements off the diagram',
  'activity.routeChanged': 'Changed a route',
  'activity.layoutChanged': 'Changed the layout',
  'activity.groupChanged': 'Changed the group {name}',
  'activity.groupRemoved': 'Removed the group {name}',
  'activity.diagramAdded': 'Added the diagram {name}',
  'activity.diagramRenamed': 'Renamed a diagram to {name}',
  'activity.diagramSettings': 'Changed the settings of {name}',
  'activity.diagramChanged': 'Changed the diagram {name}',
  'activity.diagramDeleted': 'Deleted the diagram {name}',
  'activity.decisionAdded': 'Added the decision {name}',
  'activity.decisionChanged': 'Changed the decision {name}',
  'activity.decisionRemoved': 'Removed the decision {name}',
  'activity.planAdded': 'Added plan {name}',
  'activity.planChanged': 'Changed plan {name}',
  'activity.planRemoved': 'Removed plan {name}',
  'activity.projectSettings': 'Changed the project settings',
  'activity.diagramRestored': 'Restored the diagram {name} as of {asOf}',
  'activity.descriptionRestored': 'Restored the description of {name} as of {asOf}',
  'activity.decisionRestored': 'Restored the decision {name} as of {asOf}',
  'activity.projectRestored': 'Restored the whole project as of {asOf}',
} as const
