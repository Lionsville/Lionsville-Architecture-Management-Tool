/**
 * English, for the model speaks: element kinds, zones, the refusals a rule returns.
 *
 * `as const`, so this slice is the schema for its own keys: `nl.ts` beside it
 * cannot be missing one and cannot invent one. The registry composes every
 * module's slice into the table `t()` reads (`i18n/strings.ts`).
 */
export const EN = {

  'kind.actor': 'Actor',
  'kind.application': 'Application',
  'kind.component': 'Component',
  'kind.externalSystem': 'External system',
  'kind.inputChannel': 'Input channel',
  'kind.managementTool': 'Management tool',

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
  /**
   * The three refusals from `logoLibrary.readLogoFile`. They travel as KEYS,
   * not sentences: the reader is a pure browser helper with no language of its
   * own, and it used to hand back Dutch prose that the shell then showed
   * verbatim — the one place an English UI still spoke Dutch.
   */
  'shell.logoBadType': 'Only SVG and PNG files can be added as a logo.',
  'shell.logoTooBig': 'This logo is too big ({size} kB). The limit is {max} kB.',
  'shell.logoUnreadable': 'This file could not be read.',
} as const
