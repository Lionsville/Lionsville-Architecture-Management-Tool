/**
 * German, for the search over everything.
 *
 * Typed from the English slice beside it, so a missing translation is a compile
 * error here rather than an English sentence on a German screen. `strings.test.ts`
 * covers what the type cannot: empty values, and placeholders that were dropped
 * or invented in translation.
 */
import type { EN } from './en'

export const DE: Record<keyof typeof EN, string> = {

  'search.title': 'Element suchen',
  'search.placeholder': 'Name, Kategorie oder Anbieter',
  'search.field': 'Elemente suchen',
  'search.results': 'Suchergebnisse',
  'search.empty': 'Tippen, um in diesem Entwurf zu suchen.',
  'search.noMatches': 'Kein Element entspricht „{query}“.',
  'search.otherDiagram': 'auf {name}',
  'search.unplaced': 'auf keinem Diagramm',
  'search.hint': 'Enter öffnet den ersten Treffer; Esc schließt.',

  'gsearch.title': 'In diesem Projekt suchen',
  'gsearch.placeholder': 'Elemente, Dokumentation, Entscheidungen',
  'gsearch.field': 'Überall suchen',
  'gsearch.results': 'Ergebnisse',
  'gsearch.empty': 'Tippen, um in den Elementen, der Dokumentation und den Entscheidungen dieses Projekts und seiner Gruppe zu suchen.',
  'gsearch.noMatches': 'Nichts entspricht „{query}“.',
  'gsearch.elements': 'Elemente',
  'gsearch.documentation': 'Dokumentation',
  'gsearch.decisions': 'Entscheidungen',
  'gsearch.hint': 'Enter öffnet das markierte Ergebnis; Esc schließt.',
}
