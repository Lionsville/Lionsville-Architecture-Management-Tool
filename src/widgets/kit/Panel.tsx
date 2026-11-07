// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The one panel: the right column, one at a time, for whatever is selected and
 * for the tools with no place of their own. A reader and an inspector are the
 * same thing here, so there is one anatomy to learn: identity (a kind, a name
 * that wraps, one line of facts), tabs, rows, a foot.
 *
 * Docked and not modal: the list or the canvas stays live beside it, so it takes
 * no focus and traps none. Only the body scrolls, because the name has to stay
 * readable while the rows below it go by. The foot shows help for the field in
 * focus, or the last change with its Undo: help is said where it is wanted, and
 * is not five lines of permanent grey text.
 *
 * A name is pressed to edit only where `onRename` is handed in, so a reader sees
 * the same layout without the affordance.
 */
import { createContext, useContext, useLayoutEffect, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { useStrings } from '../../i18n/LanguageContext'
import { BackIcon, CloseIcon, ForwardIcon } from '../icons'
import { PressName } from './PressName'
import { Tabs } from './Tabs'
import type { TabItem } from './Tabs'
import './Panel.css'

/**
 * A column that holds whichever panel is up, and keeps what outlives each of
 * them: how wide it is, and folding it away. A Panel drawn in one takes these from
 * here, so a screen hands a panel in without knowing it is docked, and says so
 * (`claim`) so that the column need not draw any chrome of its own around it.
 */
export type PanelDock = {
  readonly width: number
  readonly onCollapse: (collapsed: boolean) => void
  /** The stable name of the column, for a panel that has none of its own. */
  readonly dataGuide?: string
  readonly claim: () => () => void
}

const PanelDockContext = createContext<PanelDock | undefined>(undefined)
export const PanelDockProvider = PanelDockContext.Provider

export type PanelUndo = { readonly word: string; readonly onUndo: () => void }

export type PanelProps = {
  readonly kind: string
  readonly kindIcon?: ReactNode
  readonly name: string
  /** Refused words come back as the sentence to say; what was typed stays on the field. */
  readonly onRename?: (name: string) => string | void
  /** A new value opens the name for typing: F2, and *Rename* on a card's menu. */
  readonly renameRequest?: number
  /** One line in words: *Live · 6 lines · 1 plan*. */
  readonly facts?: ReactNode
  /** Where this is really kept, or anything else said once: *Kept at … Open it there*. */
  readonly status?: ReactNode
  /** The links and the ⋯ at the end of the identity row. */
  readonly actions?: ReactNode
  readonly onClose?: () => void
  readonly collapsed?: boolean
  readonly onCollapse?: (collapsed: boolean) => void
  readonly tabs?: readonly TabItem[]
  readonly tab?: string
  readonly onTab?: (tab: string) => void
  /** 520 instead of 320, for long records. A width dragged on the seam wins over both. */
  readonly wide?: boolean
  readonly width?: number
  /** Help for the field in focus. While there is some, it is what the foot says. */
  readonly help?: ReactNode
  readonly undo?: PanelUndo
  /** A way to read more, always there beside whatever the foot is saying. */
  readonly helpLink?: { readonly label: string; readonly onPress: () => void }
  readonly loading?: boolean
  readonly children?: ReactNode
  readonly dataGuide?: string
}

/** Shared with a record's title, so a name is changed the same way wherever it stands. */
export function PanelName({ name, onRename, renameRequest, unheaded = false }: {
  readonly name: string
  /** Standing inside a heading of its own, such as a record's title. */
  readonly unheaded?: boolean
  readonly onRename?: PanelProps['onRename']
  readonly renameRequest?: number
}) {
  return (
    <PressName
      name={name} onRename={onRename} renameRequest={renameRequest} heading={unheaded ? 'span' : 'h2'}
      classes={{ heading: 'kit-panel__name', press: 'kit-panel__namePress', field: 'kit-panel__nameField', refused: 'kit-panel__refused' }}
    />
  )
}

export function Panel({
  kind, kindIcon, name, onRename, renameRequest, facts, status, actions, onClose, collapsed, onCollapse: ownCollapse, tabs, tab, onTab, wide, width: ownWidth,
  help, undo, helpLink, loading, children, dataGuide: ownGuide,
}: PanelProps) {
  const { t } = useStrings()
  const dock = useContext(PanelDockContext)
  const claim = dock?.claim
  useLayoutEffect(() => claim?.(), [claim])
  const onCollapse = ownCollapse ?? dock?.onCollapse
  const width = ownWidth ?? dock?.width
  const dataGuide = ownGuide ?? dock?.dataGuide
  const style = width ? ({ '--kit-panel-w': `${width}px` } as CSSProperties) : undefined
  if (collapsed && onCollapse) {
    return (
      <aside className="kit-panel" data-collapsed="" aria-label={name} data-guide={dataGuide}>
        <button type="button" className="kit-panel__icon" aria-label={t('kit.panel.expand')} aria-expanded={false} onClick={() => onCollapse(false)}><BackIcon /></button>
      </aside>
    )
  }
  const footSays = help ?? (undo && (
    <>
      {undo.word}{' '}
      <button type="button" className="kit-panel__link" onClick={undo.onUndo}>{t('kit.panel.undo')}</button>
    </>
  ))
  return (
    <aside className="kit-panel" data-wide={wide || undefined} style={style} aria-label={name} data-guide={dataGuide}>
      <div className="kit-panel__identity">
        <div className="kit-panel__kindRow">
          {kindIcon && <span className="kit-panel__kindIcon" aria-hidden="true">{kindIcon}</span>}
          <span className="kit-panel__kind">{kind}</span>
          <span className="kit-panel__actions">
            {actions}
            {onCollapse && <button type="button" className="kit-panel__icon" aria-label={t('kit.panel.collapse')} aria-expanded onClick={() => onCollapse(true)}><ForwardIcon /></button>}
            {onClose && <button type="button" className="kit-panel__icon" aria-label={t('common.close')} onClick={onClose}><CloseIcon /></button>}
          </span>
        </div>
        <PanelName name={name} onRename={onRename} renameRequest={renameRequest} />
        {facts && <div className="kit-panel__facts">{facts}</div>}
        {status && <div className="kit-panel__status">{status}</div>}
      </div>
      {tabs && tabs.length > 0 && tab !== undefined && onTab && (
        <div className="kit-panel__tabs">
          <Tabs items={tabs} value={tab} onChange={onTab} label={name} />
        </div>
      )}
      <div className="kit-panel__body" tabIndex={0} role="region" aria-label={name} aria-busy={loading || undefined}>
        {loading ? <div className="kit-panel__skeleton" aria-hidden="true"><span /><span /><span /></div> : children}
      </div>
      {(footSays || helpLink) && (
        <div className="kit-panel__foot">
          <div className="kit-panel__footSays" aria-live="polite">{footSays}</div>
          {helpLink && <button type="button" className="kit-panel__link" onClick={helpLink.onPress}>{helpLink.label}</button>}
        </div>
      )}
    </aside>
  )
}

/** A word that goes somewhere or does something, in a row or a foot: *Open the page*. */
export function PanelLink({ children, onPress, 'data-testid': testId, 'data-guide': guide }: {
  readonly children: ReactNode
  readonly onPress: () => void
  readonly 'data-testid'?: string
  readonly 'data-guide'?: string
}) {
  return <button type="button" className="kit-panel__link" data-testid={testId} data-guide={guide} onClick={onPress}>{children}</button>
}

/** A section of rows: a heading, and an aside where there is something to say about the lot (*4 of 4*). */
export function PanelSection({ title, aside, children }: { readonly title?: string; readonly aside?: ReactNode; readonly children: ReactNode }) {
  return (
    <section className="kit-panel__section">
      {title && (
        <div className="kit-panel__sectionHead">
          <h3>{title}</h3>
          {aside && <span className="kit-panel__sectionAside">{aside}</span>}
        </div>
      )}
      {children}
    </section>
  )
}
