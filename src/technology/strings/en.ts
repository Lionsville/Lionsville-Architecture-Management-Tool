/**
 * English, for the technology view (ADR-0013): one platform, with what
 * stands on it and what passes through it.
 *
 * `as const`, so this slice is the schema for its own keys.
 */
export const EN = {
  'technology.page': 'Technology view',
  'technology.close': 'Close the technology view',
  'technology.summary': '{hosted} hosted · {users} using it · {flows} interfaces through it',
  'technology.standsOn': 'Stands on',
  'technology.children': 'Under it',
  'technology.hosted': 'Hosted here',
  'technology.users': 'Uses it',
  'technology.flows': 'Interfaces through it',
  'technology.from': 'From',
  'technology.to': 'To',
  'technology.protocol': 'Protocol',
  'technology.transport': 'Transport',
  'technology.path': 'Path',
  'technology.nothing': 'Nothing yet',
  'technology.noFlows': 'No interface passes through it yet.',
  'technology.noFlowsHint': 'Say what carries an interface on the connection itself: Via, on the landscape.',
  'technology.unknown': 'Nobody in the organisation defines this',
  'technology.noPlatform': 'This view is about a platform this scope does not hold.',
  'technology.open': 'Open {name}',
} as const
