/**
 * Frisian, for the search over everything.
 *
 * Typed from the English slice beside it, so a missing translation is a compile
 * error here rather than an English sentence on a Frisian screen. `strings.test.ts`
 * covers what the type cannot: empty values, and placeholders that were dropped
 * or invented in translation.
 */
import type { EN } from './en'

export const FY: Record<keyof typeof EN, string> = {

  'search.title': 'Elemint sykje',
  'search.placeholder': 'Namme, kategory of leveransier',
  'search.field': 'Eleminten sykje',
  'search.results': 'Sykresultaten',
  'search.empty': 'Typ om yn dit ûntwerp te sykjen.',
  'search.noMatches': 'Gjin elemint komt oerien mei “{query}”.',
  'search.otherDiagram': 'op {name}',
  'search.unplaced': 'op gjin inkeld diagram',
  'search.hint': 'Enter iepenet it earste resultaat; Esc slút.',

  'gsearch.title': 'Sykje yn dit projekt',
  'gsearch.placeholder': 'Eleminten, dokumintaasje, besluten',
  'gsearch.field': 'Oeral sykje',
  'gsearch.results': 'Resultaten',
  'gsearch.empty': 'Typ om te sykjen yn de eleminten, dokumintaasje en besluten fan dit projekt en syn groep.',
  'gsearch.noMatches': 'Neat komt oerien mei “{query}”.',
  'gsearch.elements': 'Eleminten',
  'gsearch.documentation': 'Dokumintaasje',
  'gsearch.decisions': 'Besluten',
  'gsearch.hint': 'Enter iepenet it markearre resultaat; Esc slút.',
}
