/** German, for the technology view (ADR-0013). Typed from the English slice. */
import type { EN } from './en'

export const DE: Record<keyof typeof EN, string> = {
  'technology.page': 'Technologieansicht',
  'technology.close': 'Technologieansicht schließen',
  'technology.summary': '{hosted} gehostet · {users} nutzen es',
  'technology.standsOn': 'Steht auf',
  'technology.children': 'Darunter',
  'technology.hosted': 'Läuft hier',
  'technology.users': 'Nutzt es',
  'technology.nothing': 'Noch nichts',
  'technology.unknown': 'Niemand in der Organisation definiert dies',
  'technology.noPlatform': 'Diese Ansicht betrifft eine Plattform, die dieser Bereich nicht enthält.',
  'technology.open': '{name} öffnen',
}
