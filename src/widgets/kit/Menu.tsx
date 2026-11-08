// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Rare acts on one thing. Common acts are visible, and a place is not a menu item.
 *
 * MUI's menu underneath, for its keyboard, its focus and its positioning; screens
 * hand the kit a list of entries.
 *
 * **Final acts go last, after a line**: mark an entry `final` and it goes there,
 * wherever the caller listed it, so no screen can put *Delete* beside *Copy
 * address*.
 *
 * **An entry that cannot run stays, with its reason**, so people learn the rule
 * before pressing. It can be reached with the arrows, because a reason only a
 * mouse can reach is no use, and pressing it does nothing and leaves the menu up.
 *
 * **Nothing opens under the pointer**: a menu with no room below its button opens
 * above it rather than sliding up over it, where its last entry, the final one,
 * would sit under the pointer, and the second press of a double-click on the
 * button selects nothing.
 *
 * **A submenu goes one level down and no further**: the type has no way to say a
 * second. The arrows go in and come back, and an arrow in the submenu must stop
 * there: React sends it on through the portal to the menu above, which would take
 * the focus back.
 */
import { useEffect, useId, useRef, useState } from 'react'
import type { KeyboardEvent, MouseEvent, ReactNode } from 'react'
import MenuItem from '@mui/material/MenuItem'
import { useStrings } from '../../i18n/LanguageContext'
import { CaretIcon, CheckIcon, MoreIcon } from '../icons'
import { Button, IconButton } from './Button'
import { SurfaceMenu as MuiMenu } from './Surface'
import type { ButtonVariant } from './Button'
import './Menu.css'

type Act = {
  label: string
  /** Why it cannot run now. It stays in the list, with this under it. */
  refused?: string
  /** An act with no way back: drawn in the danger ink, and placed last after a line. */
  final?: boolean
  /** What it does in full, said on hover: the label stays its name. */
  hint?: string
  'data-guide'?: string
  'data-testid'?: string
  /** Somewhere outside this window: the row is a link as well as a press. */
  href?: string
}

export type MenuAct = Act & {
  onSelect: () => void
  /** Shown at the end of the row, as a key cap. The key itself is the screen's. */
  shortcut?: string
  /** A line under the word, where a hover would have said it and a menu has none to wait for. */
  detail?: string
  /** A choice that is on or off, for a menu of settings. */
  checked?: boolean
  /** With `checked`: one of a group, of which one is on (an order, a size), said as a radio. */
  radio?: boolean
  /** What holds a refused choice, line by line, drawn under it. Each is a way to the thing to clear. */
  holds?: readonly MenuHold[]
}

/** A line under a refused choice: what holds it, going to where it is cleared. */
export type MenuHold = { label: string; ok?: boolean; hint?: string; onSelect?: () => void }

export type MenuEntry =
  | MenuAct
  | (Act & { items: readonly (MenuAct | MenuSpacer)[] })
  | MenuSpacer

/** A line between groups, or a heading over one. */
export type MenuSpacer = { line: true } | { heading: string }

const isLine = (entry: MenuEntry): entry is { line: true } => 'line' in entry

/** A choice with a state is a checkbox, or a radio where it is one of a group; anything else a plain item. */
function roleOf(act: MenuAct | undefined): 'menuitem' | 'menuitemcheckbox' | 'menuitemradio' {
  if (act?.checked === undefined) return 'menuitem'
  return act.radio ? 'menuitemradio' : 'menuitemcheckbox'
}
const isHeading = (entry: MenuEntry): entry is { heading: string } => 'heading' in entry
/** The room a submenu takes beside its row: about the width of a menu. */
const SUBMENU_ROOM = 240

const isSubmenu = (entry: MenuEntry): entry is Act & { items: readonly (MenuAct | MenuSpacer)[] } => 'items' in entry

/** The list as it is drawn: final acts moved to the end behind one line. */
export function orderedEntries(entries: readonly MenuEntry[]): readonly MenuEntry[] {
  const isFinal = (entry: MenuEntry) => !isLine(entry) && !isHeading(entry) && entry.final === true
  const finals = entries.filter(isFinal)
  if (finals.length === 0) return entries
  const others = entries.filter((entry) => !isFinal(entry))
  const last = others.at(-1)
  return others.length === 0 ? finals : [...others, ...(last && isLine(last) ? [] : [{ line: true } as const]), ...finals]
}

export type MenuProps = {
  open: boolean
  anchorEl: HTMLElement | null
  /** What the menu is of, for a screen reader. */
  label: string
  items: readonly MenuEntry[]
  onClose: () => void
  placement?: 'below' | 'beside'
  /** Stop keys here, for a menu inside a menu. */
  nested?: boolean
}

/** The menus open now, each by the way it closes. */
const openMenus = new Set<() => void>()

/**
 * Close every menu that is open: what a key equivalent does to a native menu
 * when it runs one of the menu's commands, so the menu does not stand over
 * the dialog the command opened.
 */
export function closeMenus(): void {
  for (const close of [...openMenus]) close()
}

export function Menu({ open, anchorEl, label, items, onClose, placement = 'below', nested = false }: MenuProps) {
  const [sub, setSub] = useState<{ index: number; anchor: HTMLElement } | null>(null)
  const closing = useRef(onClose)
  closing.current = onClose
  useEffect(() => {
    if (!open) return undefined
    const close = () => { setSub(null); closing.current() }
    openMenus.add(close)
    return () => { openMenus.delete(close) }
  }, [open])
  const descriptionBase = useId()
  const beside = placement === 'beside'

  const ordered = orderedEntries(items)
  const ticks = items.some((entry) => 'checked' in entry && entry.checked !== undefined)
  const opened = sub ? ordered[sub.index] : undefined

  const rowOf = (entry: Exclude<MenuEntry, MenuSpacer>, index: number): ReactNode => {
    const refused = entry.refused !== undefined && entry.refused !== ''
    const reasonId = `${descriptionBase}-${index}`
    const submenu = isSubmenu(entry)
    const act = submenu ? undefined : entry
    const checkable = act?.checked !== undefined
    return (
      <MenuItem
        key={index}
        className="kit-menu__item"
        data-final={entry.final || undefined}
        data-refused={refused || undefined}
        data-guide={entry['data-guide']}
        data-testid={entry['data-testid']}
        title={entry.hint}
        {...(entry.href ? { component: 'a' as const, href: entry.href, target: '_blank', rel: 'noreferrer' } : {})}
        disableRipple
        role={roleOf(act)}
        aria-checked={checkable ? act.checked : undefined}
        aria-disabled={refused || undefined}
        aria-describedby={refused ? reasonId : undefined}
        aria-haspopup={submenu ? 'menu' : undefined}
        aria-expanded={submenu ? sub?.index === index : undefined}
        onClick={(event) => {
          // The second press of a double-click on the button, landing on what opened under it.
          if (refused || event.detail > 1) return
          if (submenu) { setSub({ index, anchor: event.currentTarget }); return }
          onClose()
          act?.onSelect()
        }}
        onKeyDown={(event: KeyboardEvent<HTMLLIElement>) => {
          if (submenu && !refused && event.key === 'ArrowRight') {
            event.preventDefault()
            setSub({ index, anchor: event.currentTarget })
          }
        }}
      >
        <span className="kit-menu__row">
          {/* Every row keeps the room a tick takes where any row has one, so the words line up. */}
          {(checkable || ticks) && <span className="kit-menu__check">{act?.checked && <CheckIcon size={14} />}</span>}
          <span className="kit-menu__label">{entry.label}</span>
          {' '}
          {act?.shortcut && <kbd className="kit-menu__key">{act.shortcut}</kbd>}
          {submenu && <span className="kit-menu__more"><CaretIcon size={12} /></span>}
        </span>
        {act?.detail && <span className="kit-menu__reason">{act.detail}</span>}
        {refused && ' '}
        {refused && <span className="kit-menu__reason" id={reasonId}>{entry.refused}</span>}
      </MenuItem>
    )
  }

  const above = !beside && open && opensAbove(anchorEl, ordered.length)
  // A menu beside one at the window's right edge opens to its left rather than over it.
  const toLeft = beside && anchorEl instanceof HTMLElement && anchorEl.getBoundingClientRect().right + SUBMENU_ROOM > window.innerWidth
  return (
    <>
      <MuiMenu
        open={open}
        anchorEl={anchorEl}
        onClose={() => { setSub(null); onClose() }}
        anchorOrigin={beside ? { vertical: 'top', horizontal: toLeft ? 'left' : 'right' } : { vertical: above ? 'top' : 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: above ? 'bottom' : 'top', horizontal: beside && toLeft ? 'right' : 'left' }}
        slotProps={{
          paper: { className: 'kit-menu' },
          list: { 'aria-label': label, disabledItemsFocusable: true, dense: true },
        }}
        // Only when nested: an `onKeyDown` of undefined would replace MUI's own, and Escape with it.
        {...(nested
          ? {
              onKeyDown: (event: KeyboardEvent) => {
                if (event.key === 'ArrowLeft') onClose()
                event.stopPropagation()
              },
            }
          : {})}
      >
        {ordered.flatMap((entry, index) => {
          if (isLine(entry)) return [<li key={index} className="kit-menu__line" role="separator" />]
          if (isHeading(entry)) return [<li key={index} className="kit-menu__heading" role="presentation">{entry.heading}</li>]
          const holds = isSubmenu(entry) ? undefined : entry.holds
          return [rowOf(entry, index), ...(holds ?? []).map((hold, at) => (
            <MenuItem
              key={`${index}-${at}`} className="kit-menu__item kit-menu__hold" disableRipple data-ok={hold.ok || undefined}
              aria-disabled={hold.onSelect ? undefined : true} title={hold.hint}
              onClick={() => { if (!hold.onSelect) return; onClose(); hold.onSelect() }}
            >
              <span className="kit-menu__holdmark" aria-hidden="true">{hold.ok ? '✓' : '▲'}</span>
              <span className="kit-menu__label">{hold.label}</span>
            </MenuItem>
          ))]
        })}
      </MuiMenu>
      {opened && isSubmenu(opened) && sub && (
        <Menu
          open
          nested
          placement="beside"
          anchorEl={sub.anchor}
          label={opened.label}
          items={opened.items.map((item) => ('onSelect' in item
            ? { ...item, onSelect: () => { setSub(null); onClose(); item.onSelect() } }
            : item))}
          onClose={() => setSub(null)}
        />
      )}
    </>
  )
}

/** A row's height in a dense menu, and the paper's padding: enough to tell whether a list fits below its button. */
const ROW = 34
const PAPER = 16

/** Whether the list fits under its button, or would have to slide up over it; then it opens above, if there is more room there. */
export function opensAbove(anchor: HTMLElement | null, rows: number): boolean {
  if (!anchor || typeof window === 'undefined') return false
  const box = anchor.getBoundingClientRect()
  const below = window.innerHeight - box.bottom
  return below < rows * ROW + PAPER && box.top > below
}

function useAnchored() {
  const anchor = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  // The press is the ⋯'s, and not the row's it stands in.
  const toggle = (event: MouseEvent) => { event.stopPropagation(); setOpen((was) => !was) }
  return { anchor, open, toggle, close: () => setOpen(false) }
}

export type MenuButtonProps = {
  /** The button's word. */
  label: string
  /** What the menu is of, where the button's word says something else: what is on, say. */
  menuLabel?: string
  items: readonly MenuEntry[]
  variant?: ButtonVariant
  size?: 'normal' | 'small'
  /** Its name in full, where its word alone says too little out of its place: a percentage, say. */
  'aria-label'?: string
  'data-guide'?: string
  'data-testid'?: string
}

/** A word that opens a menu. */
export function MenuButton({ label, menuLabel, items, variant = 'plain', size, 'aria-label': name, 'data-guide': guide, 'data-testid': testId }: MenuButtonProps) {
  const { anchor, open, toggle, close } = useAnchored()
  return (
    <>
      <Button
        ref={anchor} variant={variant} size={size} aria-label={name} data-guide={guide} data-testid={testId} aria-haspopup="menu" aria-expanded={open}
        onClick={toggle}
      >
        {label}
        <CaretIcon size={12} />
      </Button>
      <Menu open={open} anchorEl={anchor.current} label={menuLabel ?? label} items={items} onClose={close} />
    </>
  )
}

export type MoreMenuProps = {
  items: readonly MenuEntry[]
  /** What it is more of, when the row holds more than one thing. */
  label?: string
  size?: 'normal' | 'small'
  'data-guide'?: string
  /** -1 where the row it sits in is the one Tab stop and opens it by key (a tree's Shift+F10). */
  tabIndex?: number
}

/** The one ⋯ per item. Never two on a row. */
export function MoreMenu({ items, label, size, 'data-guide': guide, tabIndex }: MoreMenuProps) {
  const { t } = useStrings()
  const { anchor, open, toggle, close } = useAnchored()
  const name = label ?? t('kit.menu.more')
  return (
    <>
      <IconButton
        ref={anchor} label={name} size={size} data-guide={guide} aria-haspopup="menu" aria-expanded={open}
        {...(tabIndex !== undefined ? { tabIndex } : {})}
        onClick={toggle}
      >
        <MoreIcon />
      </IconButton>
      <Menu open={open} anchorEl={anchor.current} label={name} items={items} onClose={close} />
    </>
  )
}
