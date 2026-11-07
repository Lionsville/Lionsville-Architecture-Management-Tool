// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A heading over part of a page, in sentence case, and the one quiet line of
 * links a page ends on: what a place does not hold folded into a line of its
 * names, each still a press away, so that nothing is drawn as a row of zeroes.
 */
import type { ReactNode } from 'react'
import './Section.css'

export function Section({ title, children, 'data-guide': guide, 'data-testid': testId }: {
  readonly title: string
  readonly children: ReactNode
  readonly 'data-guide'?: string
  readonly 'data-testid'?: string
}) {
  return (
    <section className="kit-section" data-guide={guide} data-testid={testId}>
      <h2 className="kit-section__title">{title}</h2>
      {children}
    </section>
  )
}

/** A page's own head: its name, one or two quiet lines under it, and its acts at the right. */
export function PageHead({ title, meta, children, actions, titleTestId, metaTestId, metaTitle }: {
  readonly title: ReactNode
  readonly meta?: ReactNode
  /** Under the meta line: a description, what else the page says of itself. */
  readonly children?: ReactNode
  readonly actions?: ReactNode
  readonly titleTestId?: string
  readonly metaTestId?: string
  /** What a hover adds to the meta line. */
  readonly metaTitle?: string
}) {
  return (
    <header className="kit-pagehead">
      <div className="kit-pagehead__main">
        <h1 className="kit-pagehead__title" data-testid={titleTestId}>{title}</h1>
        {meta && <p className="kit-pagehead__meta" data-testid={metaTestId} title={metaTitle}>{meta}</p>}
        {children}
      </div>
      {actions && <div className="kit-pagehead__actions">{actions}</div>}
    </header>
  )
}

export type LineLink = {
  readonly label: string
  readonly onPress: () => void
  readonly 'data-guide'?: string
  readonly 'data-testid'?: string
  /** The words a hover adds: what the link's sentence was before it folded into a word. */
  readonly title?: string
}

/** *Nothing here yet: Documentation · Building blocks*. Nothing to say draws nothing. */
export function LinkLine({ label, links, 'data-testid': testId }: {
  readonly label: string
  readonly links: readonly LineLink[]
  readonly 'data-testid'?: string
}) {
  if (links.length === 0) return null
  return (
    <p className="kit-linkline" data-testid={testId}>
      <span>{label}</span>{' '}
      {links.map((link, at) => (
        <span key={link.label}>
          {at > 0 && <span aria-hidden="true"> · </span>}
          <button
            type="button" className="kit-linkline__link" title={link.title} data-guide={link['data-guide']} data-testid={link['data-testid']}
            onClick={link.onPress}
          >
            {link.label}
          </button>
        </span>
      ))}
    </p>
  )
}
