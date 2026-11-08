// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The frame: two rows that never change, a band under them when the window is
 * in a state a person must not miss, and everything else a place in one main
 * column (decision 1). The tree docks at its start and a panel at its end, and
 * a page takes the column over the view rather than opening over the window.
 *
 * The docked tree is as wide as its person dragged it to and never as wide as
 * what it holds: a long name is cut, on hover and to a screen reader whole.
 *
 * It knows no scope and no model. What the rows hold is handed in, and where a
 * page or a view's tabs go is said to whoever asks through {@link PlaceHostContext}.
 */
import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useStrings } from '../../i18n/LanguageContext'
import { SeamResizer } from '../SeamResizer'
import { useSeamWidth } from '../useSeamWidth'
import { PlaceHostContext } from './placeHost'
import type { PlaceHost } from './placeHost'
import { px, textScale } from './tokens'
import { WINDOW_BAR } from './windowArea'
import './Frame.css'

/** Enough for a name and its number, and never so much that the page beside it is what gives way. */
const TREE_MIN = 220
const TREE_MAX = 560

export type FrameProps = {
  /** Wear a thin band of the accent above the rows: an environment somebody gave a colour, told apart at a glance. */
  accented?: boolean
  /** Which panel is up, for what gives way to it. */
  panelName?: string | undefined
  readonly rowOne: ReactNode
  /** What comes before the view's tabs, and what comes after them. */
  readonly rowTwoStart: ReactNode
  readonly rowTwoEnd: ReactNode
  readonly band?: ReactNode
  readonly tree?: ReactNode
  readonly panel?: ReactNode
  /** Is a page up over the view? */
  readonly pageUp: boolean
  readonly children: ReactNode
}

/**
 * The text scale on the root, followed as a person changes it: what the tree's
 * width is measured in.
 */
function useTextScale(): number {
  const [scale, setScale] = useState(textScale)
  useEffect(() => {
    if (typeof MutationObserver === 'undefined') return undefined
    const watch = new MutationObserver(() => setScale(textScale()))
    watch.observe(document.documentElement, { attributes: true, attributeFilter: ['data-text-size'] })
    return () => watch.disconnect()
  }, [])
  return scale
}

function useWindowWidth(): number {
  const [width, setWidth] = useState(() => window.innerWidth)
  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return width
}

/** At most this share of the window, so at a large text size in a small window the work keeps the most of it. */
const TREE_SHARE = 0.35

/**
 * The docked tree and the seam that gives it more room.
 *
 * Its width is kept in the text's own measure — what it would be at 100 % —
 * so it grows and comes back with the text size, the person's drag included,
 * and never past {@link TREE_SHARE} of the window unless its least is more.
 */
function DockedTree({ children }: { readonly children: ReactNode }) {
  const { t } = useStrings()
  const scale = useTextScale()
  const room = useWindowWidth()
  const [base, setBase] = useSeamWidth('frame.tree', px('panel-w-tree'))
  const min = TREE_MIN * scale
  const max = Math.max(min, Math.min(TREE_MAX * scale, room * TREE_SHARE))
  const width = Math.round(Math.min(Math.max(base * scale, min), max))
  const fallback = Math.min(Math.max(px('panel-w-tree') * scale, min), max)
  return (
    <>
      <aside className="kit-frame__tree" data-testid="frame-tree" style={{ width }}>{children}</aside>
      <SeamResizer orientation="vertical" region="before" value={width} min={min} max={max} defaultValue={fallback} onChange={(next) => setBase(next / scale)} label={t('kit.frame.treeWidth')} />
    </>
  )
}

export function Frame({ rowOne, rowTwoStart, rowTwoEnd, band, tree, panel, pageUp, accented = false, panelName, children }: FrameProps) {
  const [page, setPage] = useState<HTMLElement | null>(null)
  const [views, setViews] = useState<HTMLElement | null>(null)
  const host = useMemo<PlaceHost>(() => ({ page, views, pageUp }), [page, views, pageUp])
  return (
    <PlaceHostContext.Provider value={host}>
      <div className="kit-frame" data-testid="frame" data-panel={panelName}>
        {accented && <div className="kit-frame__accent" data-testid="frame-accent" />}
        {/* Row one stands at the top of the window: it keeps clear of the window's own controls and moves it (`windowArea`). */}
        <div className={`kit-frame__row kit-frame__row--one ${WINDOW_BAR}`} data-testid="shell-toolbar">{rowOne}</div>
        <nav className="kit-frame__row kit-frame__row--two" data-testid="frame-places">
          {rowTwoStart}
          <div className="kit-frame__views" ref={setViews} data-testid="frame-views" />
          <div className="kit-frame__grow" />
          {rowTwoEnd}
        </nav>
        {band}
        <div className="kit-frame__body">
          {tree && <DockedTree>{tree}</DockedTree>}
          <main className="kit-frame__main">
            {/* The view in a layer of its own, so nothing a canvas floats over itself is ever stacked against a page. */}
            <div className="kit-frame__view" data-testid="frame-view">{children}</div>
            <div className="kit-frame__pages" ref={setPage} data-testid="frame-pages" />
          </main>
          {panel && <aside className="kit-frame__panel" data-testid="frame-panel" tabIndex={-1}>{panel}</aside>}
        </div>
      </div>
    </PlaceHostContext.Provider>
  )
}
