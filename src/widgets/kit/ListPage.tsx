// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * **One list page.** Every page whose work is a list of records — the
 * observations' stages, decisions, principles, topics, building blocks, the
 * register — is laid out the same way, so a person finds the same thing in the
 * same place on each:
 *
 * - **The head**: the page's name and how many it holds, where no tab row above
 *   already names it, a quiet line about what it covers, and its tabs.
 * - **The bar**: Find, Filter, Group and View (`FilterWords`), what is shown when
 *   it is narrowed, the page's other quiet controls, and **New** at the far end,
 *   the one accent on the page.
 * - **The list**: the quiet `List`, full width in the page's gutter, a row the
 *   item and nothing else; selecting one opens it large (`Preview`), which the
 *   page draws beside this.
 *
 * What differs between pages is what they hand in, never where it stands.
 */
import type { ReactNode } from 'react'
import { Button } from './Button'
import { useDensity } from './density'
import { FilterWords } from './FilterWords'
import type { FilterWordsProps } from './FilterWords'
import './ListPage.css'

/** The page's New: one accent button at the far end of the bar. */
export type ListPageCreate = {
  readonly label: string
  readonly onPress: () => void
  readonly guide?: string
  readonly testId?: string
}

export type ListPageProps = {
  /** The page's name, where no tab row above it says it. */
  readonly title?: string
  /** How many records the page holds, said beside its name. */
  readonly count?: number
  /** What the page covers, in a quiet line beside its name. */
  readonly about?: ReactNode
  /** The page's own tabs, under its name. */
  readonly tabs?: ReactNode
  /** Find, Filter, Group and View, as the page offers them; the bar's end is this component's. None on a page with nothing to list yet. */
  readonly filter?: Omit<FilterWordsProps, 'actions'>
  /** The page's other controls, quiet, before New: how it is read, a second verb. */
  readonly tools?: ReactNode
  readonly create?: ListPageCreate
  /** A line between the bar and the list: what the list leaves out, said once. */
  readonly note?: ReactNode
  /**
   * `scroll`, the default: the list scrolls in the page's gutter. `fill`: the
   * page lays out its own work under the bar — a list beside a panel, a map in
   * place of the list — and scrolls it itself.
   */
  readonly body?: 'scroll' | 'fill'
  readonly children: ReactNode
  readonly testId?: string
  readonly headTestId?: string
  readonly listTestId?: string
}

export function ListPage({ title, count, about, tabs, filter, tools, create, note, body = 'scroll', children, testId, headTestId, listTestId }: ListPageProps) {
  // View is on every list page: the person's density at least, and the page's columns where it has some.
  const [density, setDensity] = useDensity()
  const head = title !== undefined || about !== undefined || tabs !== undefined
  const actions = (tools || create) && (
    <>
      {tools}
      {create && (
        <Button variant="primary" onClick={create.onPress} data-guide={create.guide} data-testid={create.testId}>{create.label}</Button>
      )}
    </>
  )
  return (
    <div className="kit-list-page" data-testid={testId}>
      {head && (
        <div className="kit-list-page__head" data-testid={headTestId}>
          {(title !== undefined || about !== undefined) && (
            <div className="kit-list-page__title">
              {title !== undefined && <h1 className="kit-list-page__name">{title}</h1>}
              {title !== undefined && count !== undefined && <span className="kit-list-page__count">{count}</span>}
              {about !== undefined && <span className="kit-list-page__about">{about}</span>}
            </div>
          )}
          {tabs}
        </div>
      )}
      {filter && (
        <div className="kit-list-page__bar">
          <FilterWords density={density} onDensity={setDensity} {...filter} {...(actions ? { actions } : {})} />
        </div>
      )}
      {note}
      <div className="kit-list-page__body" data-body={body} data-testid={listTestId}>{children}</div>
    </div>
  )
}
