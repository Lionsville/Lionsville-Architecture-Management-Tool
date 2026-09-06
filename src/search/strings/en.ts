/**
 * English, for the search over everything.
 *
 * `as const`, so this slice is the schema for its own keys: `nl.ts` beside it
 * cannot be missing one and cannot invent one. The registry composes every
 * module's slice into the table `t()` reads (`i18n/strings.ts`).
 */
export const EN = {

  // --- element search (⌘F) --------------------------------------------------
  'search.title': 'Find element',
  'search.placeholder': 'Name, category or vendor',
  'search.field': 'Search elements',
  'search.results': 'Search results',
  'search.empty': 'Type to search this design.',
  'search.noMatches': 'No element matches “{query}”.',
  'search.otherDiagram': 'on {name}',
  'search.unplaced': 'not on any diagram',
  'search.hint': 'Enter opens the first match; Esc closes.',

  // --- the search over everything ------------------------------------------
  'gsearch.title': 'Search this project',
  'gsearch.placeholder': 'Elements, documentation, decisions',
  'gsearch.field': 'Search everything',
  'gsearch.results': 'Results',
  'gsearch.empty': 'Type to search the elements, documentation and decisions of this project and its group.',
  'gsearch.noMatches': 'Nothing matches \u201c{query}\u201d.',
  'gsearch.elements': 'Elements',
  'gsearch.documentation': 'Documentation',
  'gsearch.decisions': 'Decisions',
  'gsearch.hint': 'Enter opens the highlighted result; Esc closes.',
} as const
