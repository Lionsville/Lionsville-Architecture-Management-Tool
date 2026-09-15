/**
 * English, for the technology view (ADR-0013): one platform, with what
 * stands on it.
 *
 * `as const`, so this slice is the schema for its own keys.
 */
export const EN = {
  'technology.page': 'Technology view',
  'technology.close': 'Close the technology view',
  'technology.summary': '{hosted} hosted · {users} using it',
  'technology.standsOn': 'Stands on',
  'technology.children': 'Under it',
  'technology.hosted': 'Hosted here',
  'technology.users': 'Uses it',
  'technology.nothing': 'Nothing yet',
  'technology.unknown': 'Nobody in the organisation defines this',
  'technology.noPlatform': 'This view is about a platform this scope does not hold.',
  'technology.open': 'Open {name}',
} as const
