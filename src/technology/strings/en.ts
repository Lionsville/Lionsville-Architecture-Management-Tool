/**
 * English, for the platform report (ADR-0013): one platform, what stands on
 * it, and what crosses it.
 *
 * `as const`, so this slice is the schema for its own keys.
 */
export const EN = {
  'technology.page': 'Platform report',
  'technology.close': 'Close the platform report',
  'technology.summary': '{hosted} hosted · {users} using it · {landings} interfaces across it',
  'technology.standsOn': 'Stands on',
  'technology.children': 'Under it',
  'technology.hosted': 'Hosted here',
  'technology.users': 'Uses it',
  'technology.nothing': 'Nothing yet',
  'technology.unknown': 'Nobody in the organisation defines this',
  'technology.noPlatform': 'This scope does not hold that platform.',
  'technology.open': 'Open {name}',
  'technology.landings': 'Interfaces across it',
  'technology.noLandings': 'No container interface crosses it yet.',
  'technology.from': 'From',
  'technology.to': 'To',
  'technology.protocol': 'How',
  'technology.partOf': 'Part of',
  'technology.itsOwn': 'An interface of its own',
} as const
