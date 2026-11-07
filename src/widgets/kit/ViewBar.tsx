// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Row three on any view: the same words in the same order on every kind, a
 * reading switch if it has one, then Add, Arrange, Show, Colour, Day, and at the
 * right Find, Export, ⋯. A control a kind lacks is absent. The order is here and
 * not in the screens, so no view can draw its own.
 *
 * Each slot takes a control already made; `ViewBarMenu` and `ViewBarButton` are
 * the two it is made of. What a reader may not change a screen does not pass in.
 */
import type { ComponentProps, ReactNode } from 'react'
import { useStrings } from '../../i18n/LanguageContext'
import { Button } from './Button'
import { MenuButton } from './Menu'
import type { MenuEntry } from './Menu'
import './ViewBar.css'

export type ViewBarProps = {
  reading?: ReactNode
  add?: ReactNode
  arrange?: ReactNode
  show?: ReactNode
  colour?: ReactNode
  day?: ReactNode
  find?: ReactNode
  exportAs?: ReactNode
  more?: ReactNode
  /** What this bar is of, for a screen reader. */
  label?: string
  /** It stands in a row that is already a bar, and draws no bar of its own. */
  flush?: boolean
  'data-guide'?: string
}

export function ViewBar({ reading, add, arrange, show, colour, day, find, exportAs, more, label, flush, 'data-guide': guide }: ViewBarProps) {
  const { t } = useStrings()
  return (
    <div className="kit-viewbar" data-flush={flush || undefined} role="group" aria-label={label ?? t('kit.viewbar.label')} data-guide={guide}>
      <div className="kit-viewbar__start">{reading}{add}{arrange}{show}{colour}{day}</div>
      <div className="kit-viewbar__end">{find}{exportAs}{more}</div>
    </div>
  )
}

/** A word on the bar that opens a menu. `on` is a state away from the plain one: its label says it, in the accent. */
export function ViewBarMenu({ label, menuLabel, items, on, 'data-guide': guide }: {
  label: string
  menuLabel?: string
  items: readonly MenuEntry[]
  on?: boolean
  'data-guide'?: string
}) {
  return (
    <span className="kit-viewbar__item" data-on={on || undefined}>
      <MenuButton variant="quiet" label={label} menuLabel={menuLabel} items={items} data-guide={guide} />
    </span>
  )
}

/** A word on the bar that acts at once. */
export function ViewBarButton({ on, children, ...rest }: Omit<ComponentProps<typeof Button>, 'variant' | 'children'> & { on?: boolean; children: ReactNode }) {
  return (
    <span className="kit-viewbar__item" data-on={on || undefined}>
      <Button variant="quiet" {...rest}>{children}</Button>
    </span>
  )
}
