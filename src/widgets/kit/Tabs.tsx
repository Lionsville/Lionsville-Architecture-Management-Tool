// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Two to six sections of one thing. A place is not a tab: places are in row two.
 *
 * On by its edge and not by a fill. The arrows move and choose at once, because
 * what a tab shows is already drawn and costs nothing to look at; only the tab
 * that is on is in the tab order. The value goes in the address, which is the
 * screen's to do with `onChange`.
 *
 * Give `id` where a `TabPanel` follows, so the two name each other. A section
 * with nothing does not show: leave it out, or say `hidden` where the list is a
 * table of its own.
 */
import { useRef } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import { rovedIndex } from './roving'
import './Tabs.css'

export type TabItem<V extends string = string> = {
  value: V
  label: string
  /** Only where the number matters. */
  count?: number
  hidden?: boolean
  /** Where a screen's tabs each have a stable name of their own. */
  guide?: string
  testId?: string
}

export type TabsProps<V extends string = string> = {
  /** What the tabs are of, for a screen reader. */
  label: string
  items: readonly TabItem<V>[]
  value: V
  onChange: (value: V) => void
  id?: string
  'data-guide'?: string
}

const tabId = (id: string, value: string) => `${id}-tab-${value}`
const panelId = (id: string, value: string) => `${id}-panel-${value}`

export function Tabs<V extends string = string>({ label, items, value, onChange, id, 'data-guide': guide }: TabsProps<V>) {
  const shown = items.filter((item) => !item.hidden)
  const refs = useRef(new Map<string, HTMLButtonElement>())
  const on = Math.max(0, shown.findIndex((item) => item.value === value))

  const onKeyDown = (event: KeyboardEvent, index: number) => {
    const next = rovedIndex(event.key, index, shown.length)
    if (next === undefined) return
    event.preventDefault()
    const item = shown[next]
    if (!item) return
    refs.current.get(item.value)?.focus()
    onChange(item.value)
  }

  return (
    <div className="kit-tabs" role="tablist" aria-label={label} data-guide={guide}>
      {shown.map((item, index) => (
        <button
          key={item.value}
          ref={(element) => { if (element) refs.current.set(item.value, element); else refs.current.delete(item.value) }}
          type="button"
          role="tab"
          id={id ? tabId(id, item.value) : undefined}
          aria-controls={id ? panelId(id, item.value) : undefined}
          aria-selected={index === on}
          tabIndex={index === on ? 0 : -1}
          className="kit-tabs__tab"
          data-guide={item.guide}
          data-testid={item.testId}
          onClick={() => { if (item.value !== value) onChange(item.value) }}
          onKeyDown={(event) => onKeyDown(event, index)}
        >
          {item.label}
          {item.count !== undefined && <>{' '}<span className="kit-tabs__count">{item.count}</span></>}
        </button>
      ))}
    </div>
  )
}

/** What the tab named `value` of the tabs named `id` shows. Draw the one that is on. */
export function TabPanel({ id, value, children }: { id: string; value: string; children: ReactNode }) {
  return <div role="tabpanel" id={panelId(id, value)} aria-labelledby={tabId(id, value)}>{children}</div>
}
