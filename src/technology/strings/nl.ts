/** Dutch, for the technology view (ADR-0013). Typed from the English slice. */
import type { EN } from './en'

export const NL: Record<keyof typeof EN, string> = {
  'technology.page': 'Technologieweergave',
  'technology.close': 'Technologieweergave sluiten',
  'technology.summary': '{hosted} gehost · {users} gebruiken het',
  'technology.standsOn': 'Staat op',
  'technology.children': 'Eronder',
  'technology.hosted': 'Draait hier',
  'technology.users': 'Gebruikt het',
  'technology.nothing': 'Nog niets',
  'technology.unknown': 'Niemand in de organisatie definieert dit',
  'technology.noPlatform': 'Deze weergave gaat over een platform dat deze scope niet bevat.',
  'technology.open': '{name} openen',
}
