// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

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
  'gsearch.title': 'Search everything',
  'gsearch.placeholder': 'Elements, views, decisions, plans, observations…',
  'gsearch.field': 'Search everything',
  'gsearch.results': 'Results',
  'gsearch.empty': 'Type to search every record of this scope — elements and their pages, views, relations, decisions, plans and milestones, observations, causes, solutions and experiments — and what the rest of the organisation holds.',
  'gsearch.noMatches': 'Nothing matches \u201c{query}\u201d.',
  'gsearch.hint': 'Enter opens the highlighted result where it lives; Esc closes.',
  // One heading per kind of hit, in the order `SEARCH_KINDS` lists them.
  'gsearch.kind.element': 'Elements',
  'gsearch.kind.documentation': 'Documentation',
  'gsearch.kind.view': 'Views',
  'gsearch.kind.relation': 'Relations',
  'gsearch.kind.decision': 'Decisions',
  'gsearch.kind.plan': 'Plans',
  'gsearch.kind.milestone': 'Milestones',
  'gsearch.kind.observation': 'Observations',
  'gsearch.kind.cause': 'Causes',
  'gsearch.kind.solution': 'Solutions',
  'gsearch.kind.experiment': 'Experiments',
  // A view is one kind of hit; which view it is, beside it.
  'gsearch.view.layer7': 'Landscape',
  'gsearch.view.container': 'Container diagram',
  'gsearch.view.sheet': 'Business architecture',
  'gsearch.view.map': 'Enterprise map',
  'gsearch.view.technology': 'Technology landscape',
  'gsearch.view.drawing': 'Drawing',
} as const
