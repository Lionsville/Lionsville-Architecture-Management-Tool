// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The pages a home has over its rows, and what the shell asks of the screen
 * that draws them: said here so the screen and the shell's navigation name
 * them without importing each other.
 */

/** A page over a home: the organisation's registers and checks, a scope's topics, blocks and settings. */
export type OrgPage = 'register' | 'technologyRegister' | 'people' | 'checks' | 'topics' | 'blocks' | 'settings' | 'agents'

/**
 * What the shell asks of the organisation screen: one of its pages, or the
 * home itself with none over it. With a nonce, because the same thing
 * asked for twice is two requests and a prop that did not change is none.
 * `select` is the person the People page picks, where one was asked for:
 * not part of the place, as an element selected on a view is not.
 */
export type OrgPageRequest = {
  page: OrgPage | 'home'; nonce: number; select?: string
  /** On the Checks page, the finding to come back to under the check picked. */
  finding?: string
  /** The tab a request lands on, where a page with tabs is asked for by a way in to one of them. */
  tab?: string
  /** On a block's page, the scope whose evaluation to open on (ADR-0043). */
  evaluation?: string
  /** Opened from another screen — a reader, a reference — so closing it goes back there (ADR-0033), not to the register. */
  returns?: true
  /** On the settings page, the field to give the focus to (`PAGE_FIELDS`): *Move to…* lands on *Filed under*. */
  field?: string
}
