/** German, for the platform report (ADR-0013). Typed from the English slice. */
import type { EN } from './en'

export const DE: Record<keyof typeof EN, string> = {
  'technology.page': 'Plattformbericht',
  'technology.close': 'Plattformbericht schließen',
  'technology.summary': '{hosted} gehostet · {users} nutzen es · {landings} Schnittstellen darüber',
  'technology.standsOn': 'Steht auf',
  'technology.children': 'Darunter',
  'technology.hosted': 'Läuft hier',
  'technology.users': 'Nutzt es',
  'technology.nothing': 'Noch nichts',
  'technology.unknown': 'Niemand in der Organisation definiert dies',
  'technology.noPlatform': 'Dieser Scope kennt diese Plattform nicht.',
  'technology.open': '{name} öffnen',
  'technology.landings': 'Schnittstellen darüber',
  'technology.noLandings': 'Noch keine Container-Schnittstelle führt darüber.',
  'technology.from': 'Von',
  'technology.to': 'Nach',
  'technology.protocol': 'Wie',
  'technology.partOf': 'Teil von',
  'technology.itsOwn': 'Eine eigenständige Schnittstelle',
  'technology.on': 'auf {name}',
}
