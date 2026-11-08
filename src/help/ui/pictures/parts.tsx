// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The parts the help's pictures are drawn from: a window, the frame's two rows,
 * the tree, a panel, a list, a button. They wear the kit's own classes where
 * the kit has one (the frame's rows, a card, a mark) and the tokens everywhere,
 * and say the app's own words for its controls, so a renamed control is renamed
 * here too and a picture never shows a screen that is gone.
 */
import type { ReactNode } from 'react'
import { useStrings } from '../../../i18n/LanguageContext'
import type { StringKey } from '../../../i18n/strings'
import '../../../widgets/kit/Frame.css'
import '../../../widgets/kit/Card.css'
import '../../../widgets/kit/Mark.css'
import './pictures.css'

/** One of the app's own words, by its key. */
export function Say({ k }: { k: StringKey }) {
  const { t } = useStrings()
  return <>{t(k)}</>
}

/**
 * A window: the frame's two rows over what the screen shows. `crop` cuts the
 * picture to what the screen shows, below the rows every picture repeats.
 * `height` `auto` is as tall as what it shows: nothing at its foot is cut.
 */
export function Screen({ trail, tabs, on, children, tree, height = 300, crop }: {
  trail: readonly string[]; tabs?: readonly ReactNode[]; on?: number; children: ReactNode; tree?: ReactNode; height?: number | 'auto'; crop?: boolean
}) {
  return (
    <div className="hp-window" style={{ height }}>
      <div className="kit-frame__row kit-frame__row--one hp-row">
        <span className="hp-glyph">‹</span><span className="hp-glyph">›</span><span className="hp-glyph hp-glyph--tree" />
        <span className="hp-trail">{trail.map((name, at) => <span key={at} data-last={at === trail.length - 1 || undefined}>{name}</span>)}</span>
        <span className="kit-frame__grow" />
        <span className="kit-frame__find hp-find"><span><Say k="frame.find" /></span><span className="kit-frame__kbd">⌘K</span></span>
        <span className="kit-frame__grow" />
        <span className="hp-glyph">↶</span><span className="hp-glyph">↷</span>
        <span className="hp-status"><span className="hp-dot" /> <Say k="frame.yourWork" /></span>
        <span className="hp-word"><Say k="frame.agent" /></span>
        <span className="hp-word">?</span>
      </div>
      <div className="kit-frame__row kit-frame__row--two hp-row">
        <span className="kit-frame__tab" aria-current={on === undefined ? 'page' : undefined}><Say k="frame.home" /></span>
        {(tabs ?? []).map((tab, at) => <span key={at} className="kit-frame__tab" aria-current={at === on ? 'page' : undefined}>{tab}</span>)}
      </div>
      <div className="hp-body">
        {tree}
        <div className="hp-main" data-crop={crop || undefined}>{children}</div>
      </div>
    </div>
  )
}

/** The tree of scopes beside a home. */
export function Tree({ rows, at }: { rows: readonly (readonly [string, number])[]; at: string }) {
  return (
    <div className="hp-tree">
      {rows.map(([name, depth]) => (
        <div key={name} className="hp-tree__row" style={{ paddingLeft: 8 + depth * 14 }} data-on={name === at || undefined}>
          {depth < 2 ? '˅ ' : ''}{name}
        </div>
      ))}
    </div>
  )
}

/** The one panel beside the work: a kind, a name, a line of facts, tabs and rows. */
export function SidePanel({ kind, name, facts, tabs, rows }: {
  kind: ReactNode; name: string; facts?: ReactNode; tabs?: readonly ReactNode[]; rows: readonly (readonly [ReactNode, ReactNode])[]
}) {
  return (
    <div className="hp-panel">
      <div className="hp-panel__kind">{kind}</div>
      <div className="hp-panel__name">{name}</div>
      {facts && <div className="hp-panel__facts">{facts}</div>}
      {tabs && <div className="hp-panel__tabs">{tabs.map((tab, at) => <span key={at} data-on={at === 0 || undefined}>{tab}</span>)}</div>}
      {rows.map(([label, value], at) => <div key={at} className="hp-panel__row"><span>{label}</span><span>{value}</span></div>)}
    </div>
  )
}

/** A heading over rows, as a home and a list draw them. */
export function Rows({ title, rows }: { title?: ReactNode; rows: readonly ReactNode[] }) {
  return (
    <div className="hp-rows">
      {title && <div className="hp-rows__title">{title}</div>}
      {rows.map((row, at) => <div key={at} className="hp-rows__row">{row}</div>)}
    </div>
  )
}

export function Btn({ children, primary }: { children: ReactNode; primary?: boolean }) {
  return <span className="hp-btn" data-primary={primary || undefined}>{children}</span>
}

/** A word in a quiet chip, as a status or a count is drawn. */
export function Chip({ children, tone }: { children: ReactNode; tone?: 'ok' | 'warn' | 'bad' | 'info' | 'accent' }) {
  return <span className="hp-chip" data-tone={tone}>{children}</span>
}

/** A line of the View bar over a view. */
export function ViewBar({ items }: { items: readonly ReactNode[] }) {
  return <div className="hp-viewbar">{items.map((item, at) => <span key={at}>{item}</span>)}</div>
}

