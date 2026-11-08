// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Where the help answers for each screen, page and panel: the one table every
 * way in reads — the ? press in row one, F1 (and ⌘? where the platform leaves
 * it to the page), and the ? in a panel's head. A screen added without a row
 * here, or a row pointing at a place the help does not have, fails
 * `build/helpPlaces.test.ts`.
 *
 * Plain strings and no imports, beside the help's address, so every screen
 * that names its place in the help can read it without carrying a word of it.
 */

/**
 * Each page of the app (`agent/screen.ts`'s `PAGES`), and a page's tab where
 * the help has a section of its own for it (`<page>:<tab>`). A view is its
 * page: a board is `board`, a sheet `sheet`.
 */
export const SCREEN_HELP = {
  home: 'home.read',
  board: 'board',
  sheet: 'sheet',
  'sheet:poster': 'poster',
  'sheet:design': 'poster.design',
  map: 'map.open',
  technology: 'technology',
  'technology:matrix': 'technology.matrix',
  drawing: 'drawing',
  chart: 'chart',
  conway: 'conway.verdict',
  'conway:lines': 'conway.lines',
  decisions: 'decisions',
  observations: 'observations',
  'observations:analysis': 'obs-ask-why',
  'observations:analysis-list': 'obs-ask-why',
  'observations:analysis-map': 'obs-map',
  'observations:solutions': 'sol-propose',
  'observations:solutions-list': 'sol-propose',
  'observations:solutions-map': 'sol-map',
  'observations:results': 'obs-results',
  roadmap: 'roadmap',
  'roadmap:findings': 'roadmap.findings',
  plan: 'plan.open',
  element: 'record.open',
  document: 'record.open',
  documentation: 'record.open',
  platform: 'technology.platformReport',
  service: 'technology.serviceReport',
  register: 'register.open',
  'register:services': 'register.tabs',
  'register:platforms': 'register.tabs',
  technologyRegister: 'register.tabs',
  people: 'people',
  'people:review': 'people.review',
  'people:privacy': 'people.privacy',
  operating: 'operating',
  'operating:structure': 'operating.structure',
  'operating:roles': 'operating.rolesList',
  'operating:responsibilities': 'operating.raciTree',
  'operating:exceptions': 'operating.exceptions',
  'operating:libraries': 'operating.libraries',
  checks: 'checks.open',
  'checks:accepted': 'checks.accepted',
  principles: 'principles.read',
  'principles:topics': 'topics.read',
  'principles:blocks': 'blocks.read',
  topics: 'topics.read',
  blocks: 'blocks.read',
  work: 'work',
  activity: 'frame.activity',
  /** The frame's panel for what waits to be settled, which has no page of its own. */
  settle: 'work',
  settings: 'scope.settings',
  preferences: 'prefs.page',
  agents: 'agent',
} as const satisfies Readonly<Record<string, string>>

/** The first page, before there is an organisation to have a screen. */
export const FIRST_RUN_HELP = 'start'

/** The panels that carry a ? in their head, by what they are about, and the few links that read more from inside one. */
export const PANEL_HELP = {
  work: 'work',
  activity: 'frame.activity',
  element: 'panel',
  connection: 'panel.line',
  several: 'panel.multi',
  group: 'panel.group',
  view: 'panel.thisView',
  function: 'sheet.select',
  technology: 'technology.select',
  roadmap: 'roadmap.reader',
  conway: 'conway.pair',
  check: 'checks.pick',
  exceptions: 'chart.exceptions',
  move: 'chart.move',
  arrange: 'operating.raciArrange',
  /** *How work is kept* in Your work's foot: the account of where work is kept. */
  whereKept: 'work~0',
  /** *How to read it* under a Conway map's grid. */
  conwayGrid: 'conway.grid',
  /** The keys, where there is no frame to show the sheet of them: the first page. */
  shortcuts: 'frame.shortcutsSheet',
} as const satisfies Readonly<Record<string, string>>

export type HelpPanel = keyof typeof PANEL_HELP

/** The place in the help for a page and the tab it is on: the tab's own where it has one, the page's otherwise. */
export function helpForScreen(page: string | undefined, tab?: string): string {
  const table: Readonly<Record<string, string>> = SCREEN_HELP
  if (page === undefined) return SCREEN_HELP.home
  return (tab !== undefined ? table[`${page}:${tab}`] : undefined) ?? table[page] ?? SCREEN_HELP.home
}
