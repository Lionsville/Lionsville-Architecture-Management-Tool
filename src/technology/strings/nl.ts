/** Dutch, for the platform report (ADR-0013). Typed from the English slice. */
import type { EN } from './en'

export const NL: Record<keyof typeof EN, string> = {
  'technology.page': 'Platformrapport',
  'technology.close': 'Platformrapport sluiten',
  'technology.summary': '{hosted} gehost · {users} gebruiken het · {landings} koppelvlakken eroverheen',
  'technology.standsOn': 'Staat op',
  'technology.children': 'Eronder',
  'technology.hosted': 'Draait hier',
  'technology.users': 'Gebruikt het',
  'technology.nothing': 'Nog niets',
  'technology.unknown': 'Niemand in de organisatie definieert dit',
  'technology.noPlatform': 'Deze scope kent dat platform niet.',
  'technology.open': '{name} openen',
  'technology.landings': 'Koppelvlakken eroverheen',
  'technology.noLandings': 'Er loopt nog geen containerkoppelvlak overheen.',
  'technology.from': 'Van',
  'technology.to': 'Naar',
  'technology.protocol': 'Hoe',
  'technology.partOf': 'Onderdeel van',
  'technology.itsOwn': 'Een koppelvlak op zichzelf',
  'technology.on': 'op {name}',
}
