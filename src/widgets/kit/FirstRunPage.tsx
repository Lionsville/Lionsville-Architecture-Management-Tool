// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * **First-run page**: what to do first, one way forward per intent, and where the
 * work will be kept, said before any work exists. It stands alone rather than in
 * the frame's rows, because there is no scope yet for them to speak of.
 */
import type { ReactNode } from 'react'
import { WINDOW_BAR } from './windowArea'
import './FirstRunPage.css'

export function FirstRunPage({ brand, tools, title, intro, children, foot, 'data-testid': testId }: {
  brand: string
  /** Language and the manual, at the end of the top line. */
  tools?: ReactNode
  title: string
  intro?: string
  /** `FirstRunWay` rows. */
  children: ReactNode
  /** What is said under the ways: where it is kept, and what can lose it. */
  foot?: ReactNode
  'data-testid'?: string
}) {
  return (
    <div className="kit-firstrun" data-testid={testId}>
      {/* The top line stands at the top of the window: it keeps clear of the window's controls and moves it (`windowArea`). */}
      <header className={`kit-firstrun__bar ${WINDOW_BAR}`}>
        <span className="kit-firstrun__brand">{brand}</span>
        {tools && <span className="kit-firstrun__tools">{tools}</span>}
      </header>
      <main className="kit-firstrun__main">
        <h1 className="kit-firstrun__title">{title}</h1>
        {intro && <p className="kit-firstrun__intro">{intro}</p>}
        <div className="kit-firstrun__ways">{children}</div>
        {foot && <div className="kit-firstrun__foot">{foot}</div>}
      </main>
    </div>
  )
}

/** One way forward: what it is, in a line, and its control. `stacked` puts a field under the words. */
export function FirstRunWay({ title, body, stacked, children }: { title: string; body?: ReactNode; stacked?: boolean; children: ReactNode }) {
  return (
    <section className="kit-firstrun__way" data-stacked={stacked ? true : undefined}>
      <div className="kit-firstrun__way-words">
        <h2 className="kit-firstrun__way-title">{title}</h2>
        {body && <p className="kit-firstrun__way-body">{body}</p>}
      </div>
      <div className="kit-firstrun__way-control">{children}</div>
    </section>
  )
}
