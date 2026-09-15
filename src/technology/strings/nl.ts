/** Dutch, for the technology view (ADR-0013). Typed from the English slice. */
import type { EN } from './en'

export const NL: Record<keyof typeof EN, string> = {
  'technology.page': 'Technologieweergave',
  'technology.close': 'Technologieweergave sluiten',
  'technology.summary': '{hosted} gehost · {users} gebruiken het · {flows} koppelvlakken erdoorheen',
  'technology.standsOn': 'Staat op',
  'technology.children': 'Eronder',
  'technology.hosted': 'Draait hier',
  'technology.users': 'Gebruikt het',
  'technology.flows': 'Koppelvlakken erdoorheen',
  'technology.from': 'Van',
  'technology.to': 'Naar',
  'technology.protocol': 'Protocol',
  'technology.transport': 'Transport',
  'technology.path': 'Pad',
  'technology.nothing': 'Nog niets',
  'technology.noFlows': 'Er loopt nog geen koppelvlak doorheen.',
  'technology.noFlowsHint': 'Zeg op de verbinding zelf wat een koppelvlak draagt: Via, op het landschap.',
  'technology.unknown': 'Niemand in de organisatie definieert dit',
  'technology.noPlatform': 'Deze weergave gaat over een platform dat deze scope niet bevat.',
  'technology.open': '{name} openen',
}
