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
 * **A submenu goes one level down and no further**: the type has no way to say a
 * second. The arrows go in and come back, and an arrow in the submenu must stop
 * there: React sends it on through the portal to the menu above, which would take
 * the focus back.
 */
import { useId, useRef, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import MuiMenu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import { useStrings } from '../../i18n/LanguageContext'
import { CaretIcon, CheckIcon, MoreIcon } from '../icons'
import { Button, IconButton } from './Button'
import type { ButtonVariant } from './Button'
import './Menu.css'

type Act = {
  label: string
  /** Why it cannot run now. It stays in the list, with this under it. */
  refused?: string
  /** An act with no way back: drawn in the danger ink, and placed last after a line. */
  final?: boolean
  'data-guide'?: string
}

export type MenuAct = Act & {
  onSelect: () => void
  /** Shown at the end of the row, as a key cap. The key itself is the screen's. */
  shortcut?: string
  /** A choice that is on or off, for a menu of settings. */
  checked?: boolean
}

export type MenuEntry =
  | MenuAct
  | (Act & { items: readonly (MenuAct | MenuSpacer)[] })
  | MenuSpacer

/** A line between groups, or a heading over one. */
export type MenuSpacer = { line: true } | { heading: string }

const isLine = (entry: MenuEntry): entry is { line: true } => 'line' in entry
const isHeading = (entry: MenuEntry): entry is { heading: string } => 'heading' in entry
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

export function Menu({ open, anchorEl, label, items, onClose, placement = 'below', nested = false }: MenuProps) {
  const [sub, setSub] = useState<{ index: number; anchor: HTMLElement } | null>(null)
  const descriptionBase = useId()
  const beside = placement === 'beside'

  const ordered = orderedEntries(items)
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
        disableRipple
        role={checkable ? 'menuitemcheckbox' : 'menuitem'}
        aria-checked={checkable ? act.checked : undefined}
        aria-disabled={refused || undefined}
        aria-describedby={refused ? reasonId : undefined}
        aria-haspopup={submenu ? 'menu' : undefined}
        aria-expanded={submenu ? sub?.index === index : undefined}
        onClick={(event) => {
          if (refused) return
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
          {checkable && <span className="kit-menu__check">{act.checked && <CheckIcon size={14} />}</span>}
          <span className="kit-menu__label">{entry.label}</span>
          {' '}
          {act?.shortcut && <kbd className="kit-menu__key">{act.shortcut}</kbd>}
          {submenu && <span className="kit-menu__more"><CaretIcon size={12} /></span>}
        </span>
        {refused && ' '}
        {refused && <span className="kit-menu__reason" id={reasonId}>{entry.refused}</span>}
      </MenuItem>
    )
  }

  return (
    <>
      <MuiMenu
        open={open}
        anchorEl={anchorEl}
        onClose={() => { setSub(null); onClose() }}
        anchorOrigin={beside ? { vertical: 'top', horizontal: 'right' } : { vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
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
        {ordered.map((entry, index) => {
          if (isLine(entry)) return <li key={index} className="kit-menu__line" role="separator" />
          if (isHeading(entry)) return <li key={index} className="kit-menu__heading" role="presentation">{entry.heading}</li>
          return rowOf(entry, index)
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

function useAnchored() {
  const anchor = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  return { anchor, open, toggle: () => setOpen((was) => !was), close: () => setOpen(false) }
}

export type MenuButtonProps = {
  /** The button's word. */
  label: string
  /** What the menu is of, where the button's word says something else: what is on, say. */
  menuLabel?: string
  items: readonly MenuEntry[]
  variant?: ButtonVariant
  size?: 'normal' | 'small'
  'data-guide'?: string
}

/** A word that opens a menu. */
export function MenuButton({ label, menuLabel, items, variant = 'plain', size, 'data-guide': guide }: MenuButtonProps) {
  const { anchor, open, toggle, close } = useAnchored()
  return (
    <>
      <Button
        ref={anchor} variant={variant} size={size} data-guide={guide} aria-haspopup="menu" aria-expanded={open}
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
}

/** The one ⋯ per item. Never two on a row. */
export function MoreMenu({ items, label, size, 'data-guide': guide }: MoreMenuProps) {
  const { t } = useStrings()
  const { anchor, open, toggle, close } = useAnchored()
  const name = label ?? t('kit.menu.more')
  return (
    <>
      <IconButton
        ref={anchor} label={name} size={size} data-guide={guide} aria-haspopup="menu" aria-expanded={open}
        onClick={toggle}
      >
        <MoreIcon />
      </IconButton>
      <Menu open={open} anchorEl={anchor.current} label={name} items={items} onClose={close} />
    </>
  )
}
