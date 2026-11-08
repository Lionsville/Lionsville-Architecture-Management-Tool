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
import { useRef, useState } from 'react'
import type { ComponentProps, ReactNode } from 'react'
import { SurfacePopover as Popover } from './Surface'
import { useStrings } from '../../i18n/LanguageContext'
import { Button } from './Button'
import { CaretIcon } from '../icons'
import { MenuButton } from './Menu'
import type { MenuEntry } from './Menu'
import { WINDOW_BAR } from './windowArea'
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
  /** It stands at the top of the window, as a view in full window does: it keeps clear of the window's controls and moves it. */
  windowBar?: boolean
  'data-guide'?: string
}

export function ViewBar({ reading, add, arrange, show, colour, day, find, exportAs, more, label, flush, windowBar, 'data-guide': guide }: ViewBarProps) {
  const { t } = useStrings()
  return (
    <div className={windowBar ? `kit-viewbar ${WINDOW_BAR}` : 'kit-viewbar'} data-flush={flush || undefined} role="group" aria-label={label ?? t('kit.viewbar.label')} data-guide={guide}>
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

/**
 * A word on the bar that opens a panel: acts with what each moves, and the settings
 * they run under, together in one place where a menu's rows would not hold them.
 * A press inside leaves it up, since a setting is rarely changed alone; an act closes it.
 */
export function ViewBarPanel({ label, on, busy, 'data-guide': guide, children }: {
  label: string
  on?: boolean
  /** The word acts at once while a pass is running, and the panel stays shut: it is the Cancel. */
  busy?: { label: string; onPress?: () => void }
  'data-guide'?: string
  children: (close: () => void) => ReactNode
}) {
  const anchor = useRef<HTMLSpanElement>(null)
  const [open, setOpen] = useState(false)
  return (
    <span ref={anchor} className="kit-viewbar__item" data-on={on || undefined}>
      <Button
        variant="quiet"
        aria-haspopup={busy ? undefined : 'dialog'}
        aria-expanded={busy ? undefined : open}
        aria-busy={busy ? true : undefined}
        disabled={busy !== undefined && busy.onPress === undefined}
        data-guide={guide}
        onClick={() => { if (busy) busy.onPress?.(); else setOpen(true) }}
      >
        {busy ? busy.label : label}{!busy && <CaretIcon size={10} />}
      </Button>
      <Popover
        open={open && !busy}
        anchorEl={anchor.current}
        onClose={() => setOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        slotProps={{ paper: { className: 'kit-viewbar__panel', role: 'dialog', 'aria-label': label } as never }}
      >
        {children(() => setOpen(false))}
      </Popover>
    </span>
  )
}

/** A word before a control on the bar, as *Levels 1 2 3 All*: said once, read the same on every view. */
export function ViewBarLabelled({ label, children, 'data-testid': testId }: { label: string; children: ReactNode; 'data-testid'?: string }) {
  return (
    <span className="kit-viewbar__labelled" data-testid={testId}>
      <span aria-hidden="true">{label}</span>
      {children}
    </span>
  )
}

/** A heading over a group of a panel's rows. */
export function ViewBarHeading({ children }: { children: ReactNode }) {
  return <div className="kit-viewbar__heading">{children}</div>
}

/** An act in a panel, saying at its end what it moves. */
export function ViewBarAct({ label, says, ...rest }: { label: string; says?: ReactNode } & Omit<ComponentProps<'button'>, 'type' | 'children'>) {
  return (
    <button type="button" className="kit-viewbar__act" {...rest}>
      <span>{label}</span>
      {says && <span className="kit-viewbar__says">{says}</span>}
    </button>
  )
}

/** A setting that is on or off, in words. */
export function ViewBarCheck({ label, checked, onChange, 'data-guide': guide }: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
  'data-guide'?: string
}) {
  return (
    <label className="kit-viewbar__check" data-guide={guide}>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span>{label}</span>
    </label>
  )
}
