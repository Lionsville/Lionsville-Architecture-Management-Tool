/**
 * Dutch, for the search over everything.
 *
 * Typed from the English slice beside it, so a missing translation is a compile
 * error here rather than an English sentence on a Dutch screen. `strings.test.ts`
 * covers what the type cannot: empty values, and placeholders that were dropped
 * or invented in translation.
 */
import type { EN } from './en'

export const NL: Record<keyof typeof EN, string> = {

  'search.title': 'Element zoeken',
  'search.placeholder': 'Naam, categorie of leverancier',
  'search.field': 'Elementen zoeken',
  'search.results': 'Zoekresultaten',
  'search.empty': 'Typ om in dit ontwerp te zoeken.',
  'search.noMatches': 'Geen element komt overeen met “{query}”.',
  'search.otherDiagram': 'op {name}',
  'search.unplaced': 'op geen enkel aanzicht',
  'search.hint': 'Enter opent het eerste resultaat; Esc sluit.',

  'gsearch.title': 'Zoeken in dit project',
  'gsearch.placeholder': 'Elementen, documentatie, besluiten',
  'gsearch.field': 'Overal zoeken',
  'gsearch.results': 'Resultaten',
  'gsearch.empty': 'Typ om te zoeken in de elementen, documentatie en besluiten van dit project en zijn groep.',
  'gsearch.noMatches': 'Niets komt overeen met \u201c{query}\u201d.',
  'gsearch.elements': 'Elementen',
  'gsearch.documentation': 'Documentatie',
  'gsearch.decisions': 'Besluiten',
  'gsearch.hint': 'Enter opent het gemarkeerde resultaat; Esc sluit.',
}
