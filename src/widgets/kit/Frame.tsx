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
import { useMemo, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { useStrings } from '../../i18n/LanguageContext'
import { SeamResizer } from '../SeamResizer'
import { useSeamWidth } from '../useSeamWidth'
import { PlaceHostContext } from './placeHost'
import type { PlaceHost } from './placeHost'
import { px, textScale } from './tokens'
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
  /** Space the window keeps at the start of row one, for its own controls, in px. */
  readonly controlsInset?: number
  /** Row one is the surface the window is dragged by. */
  readonly draggable?: boolean
  readonly children: ReactNode
}

/** The docked tree and the seam that gives it more room. */
function DockedTree({ children }: { readonly children: ReactNode }) {
  const { t } = useStrings()
  // Grows with the text, and never past what leaves the work beside it room.
  const fallback = Math.min(px('panel-w-tree') * textScale(), TREE_MAX)
  const [width, setWidth] = useSeamWidth('frame.tree', fallback)
  return (
    <>
      <aside className="kit-frame__tree" data-testid="frame-tree" style={{ width }}>{children}</aside>
      <SeamResizer orientation="vertical" region="before" value={width} min={TREE_MIN} max={TREE_MAX} defaultValue={fallback} onChange={setWidth} label={t('kit.frame.treeWidth')} />
    </>
  )
}

export function Frame({ rowOne, rowTwoStart, rowTwoEnd, band, tree, panel, pageUp, controlsInset = 0, draggable = false, accented = false, panelName, children }: FrameProps) {
  const [page, setPage] = useState<HTMLElement | null>(null)
  const [views, setViews] = useState<HTMLElement | null>(null)
  const host = useMemo<PlaceHost>(() => ({ page, views, pageUp }), [page, views, pageUp])
  const barStyle = {
    ...(controlsInset > 0 ? { paddingInlineStart: `${8 + controlsInset}px` } : {}),
    ...(draggable ? { WebkitAppRegion: 'drag' } : {}),
  } as CSSProperties
  return (
    <PlaceHostContext.Provider value={host}>
      <div className="kit-frame" data-testid="frame" data-panel={panelName}>
        {accented && <div className="kit-frame__accent" data-testid="frame-accent" />}
        <div className="kit-frame__row kit-frame__row--one" data-testid="shell-toolbar" data-draggable={draggable || undefined} style={barStyle}>{rowOne}</div>
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
            {children}
            <div className="kit-frame__pages" ref={setPage} data-testid="frame-pages" />
          </main>
          {panel && <aside className="kit-frame__panel" data-testid="frame-panel">{panel}</aside>}
        </div>
      </div>
    </PlaceHostContext.Provider>
  )
}
