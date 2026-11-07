// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Every place a person may go, said once: row two's pages, the foot of the
 * tree, More and ⌘K all read this, so a place cannot be in one and not in the
 * next. A new page gets a line here, a page in `agent/screen`'s `PAGES`, and
 * with that an address, a way in for a person and a way in for an agent.
 */
import type { Page } from '../../agent/screen'
import type { StringKey } from '../../i18n'

export type FramePlace = {
  readonly page: Page
  readonly label: StringKey
  readonly guide?: string
  /** Other pages this one entry stands for: its tabs, each with its own address. */
  readonly also?: readonly Page[]
  /** What the one entry holds, said under it and each a press away: a person looks for a word, not for the entry it was filed under. */
  readonly within?: readonly PlaceWithin[]
}

export type PlaceWithin = {
  readonly page: Page
  /** Its tab, where the page has several and this word is one of them. */
  readonly tab?: string
  readonly label: StringKey
}

/** Is this place the one on screen? */
export function placeShows(place: FramePlace, page: Page | undefined): boolean {
  return page !== undefined && (page === place.page || (place.also ?? []).includes(page))
}

/** A scope's own pages, on the right of row two, on every scope. */
export const SCOPE_PLACES: readonly FramePlace[] = [
  { page: 'documentation', label: 'shell.documentation' },
  { page: 'decisions', label: 'shell.decisions' },
  { page: 'observations', label: 'shell.observations' },
  { page: 'roadmap', label: 'shell.roadmap' },
]

/** The organisation's: the foot of the tree, and the top of More. */
export const ORGANISATION_PLACES: readonly FramePlace[] = [
  {
    page: 'register', label: 'frame.place.register', guide: 'org.card.register',
    within: [
      { page: 'register', tab: 'applications', label: 'register.tabApplications' },
      { page: 'technologyRegister', tab: 'services', label: 'register.tabServices' },
      { page: 'technologyRegister', tab: 'platforms', label: 'register.tabPlatforms' },
    ],
  },
  { page: 'people', label: 'frame.place.people', guide: 'org.card.people' },
  { page: 'operating', label: 'frame.place.operating', guide: 'org.card.operating' },
  {
    page: 'principles', label: 'frame.place.guidance', also: ['topics', 'blocks'],
    within: [
      { page: 'principles', label: 'frame.place.principles' },
      { page: 'topics', label: 'frame.place.topics' },
      { page: 'blocks', label: 'frame.place.blocks' },
    ],
  },
  { page: 'checks', label: 'frame.place.checks', guide: 'org.card.checks' },
]

/** The rest of More, until their pages have merged into the ones above. */
export const MORE_PLACES: readonly FramePlace[] = []

/** What ⌘K finds by its own name, though one entry stands for it everywhere else. */
export const FOUND_PLACES: readonly FramePlace[] = [
  { page: 'technologyRegister', label: 'frame.place.technology' },
  { page: 'topics', label: 'frame.place.topics' },
  { page: 'blocks', label: 'frame.place.blocks' },
]
