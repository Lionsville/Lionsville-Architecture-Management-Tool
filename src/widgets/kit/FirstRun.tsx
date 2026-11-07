// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The page a new place opens on: one sentence of what this is, a small picture
 * where one helps, and the real choices side by side. A place with nothing in
 * it is not an empty dashboard, and the ways in do not sit under rows of zeroes.
 */
import type { ReactNode } from 'react'
import './FirstRun.css'

export type FirstRunChoice = {
  readonly id: string
  readonly title: string
  readonly body: ReactNode
  /** The fields and buttons of this choice, at its foot. */
  readonly children: ReactNode
}

export function FirstRunPage({ title, body, picture, choices, foot, 'data-testid': testId }: {
  readonly title: string
  readonly body?: ReactNode
  readonly picture?: ReactNode
  readonly choices: readonly FirstRunChoice[]
  readonly foot?: ReactNode
  readonly 'data-testid'?: string
}) {
  return (
    <div className="kit-first" data-testid={testId}>
      <div className="kit-first__head">
        <div>
          <h1 className="kit-first__title">{title}</h1>
          {body && <p className="kit-first__body">{body}</p>}
        </div>
        {picture}
      </div>
      <div className="kit-first__choices">
        {choices.map((choice) => (
          <section key={choice.id} className="kit-first__choice" aria-label={choice.title} data-choice={choice.id}>
            <h2 className="kit-first__choiceTitle">{choice.title}</h2>
            <div className="kit-first__choiceBody">{choice.body}</div>
            <div className="kit-first__choiceFoot">{choice.children}</div>
          </section>
        ))}
      </div>
      {foot && <div className="kit-first__foot">{foot}</div>}
    </div>
  )
}

/** A small tree in words: one box, what is under it, and what each of those keeps. Boxes and lines only, so it holds in both modes. */
export function StructurePicture({ top, middle, kept, label }: {
  readonly top: string
  readonly middle: readonly string[]
  readonly kept: readonly string[]
  /** Said once to a screen reader, for the whole picture. */
  readonly label: string
}) {
  return (
    <div className="kit-structure" role="img" aria-label={label}>
      <div className="kit-structure__box" data-top="">{top}</div>
      <div className="kit-structure__row" data-lined="">
        {middle.map((word) => <div key={word} className="kit-structure__box">{word}</div>)}
      </div>
      <div className="kit-structure__row" data-lined="">
        {kept.map((word) => <div key={word} className="kit-structure__box" data-kept="">{word}</div>)}
      </div>
    </div>
  )
}
