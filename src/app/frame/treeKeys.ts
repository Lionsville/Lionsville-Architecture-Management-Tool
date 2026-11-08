// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The scope tree as one Tab stop, the treeview pattern: ↑ ↓ Home End move, →
 * opens a folded scope or goes to its first child, ← folds it or goes to the
 * scope above, Enter opens a scope's home, Shift+F10 or the menu key opens its
 * ⋯, and typing a name's first letters goes to it. Three Tab stops a row made
 * a tree of fifty scopes a hundred and fifty presses long.
 *
 * Read off the rows the tree drew (`role="treeitem"`, `aria-level`,
 * `aria-expanded`), so the rows stay plain and the order is the one on screen.
 */
import { useEffect, useLayoutEffect, useRef } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent, RefObject } from 'react'
import { fold } from '../../model/textSearch'

const ITEM = '[role="treeitem"]'

const items = (tree: HTMLElement): HTMLElement[] => Array.from(tree.querySelectorAll<HTMLElement>(ITEM))
const level = (item: HTMLElement): number => Number(item.getAttribute('aria-level') ?? '1')

function moveTo(tree: HTMLElement, item: HTMLElement | undefined): void {
  if (!item) return
  for (const one of items(tree)) one.tabIndex = one === item ? 0 : -1
  item.focus()
  item.scrollIntoView?.({ block: 'nearest' })
}

/** Where ← goes from a row that is not open: the nearest row above it at a lower level. */
function parentOf(all: readonly HTMLElement[], at: number): HTMLElement | undefined {
  const own = level(all[at])
  for (let index = at - 1; index >= 0; index -= 1) if (level(all[index]) < own) return all[index]
  return undefined
}

/** A press on the row's own control, found in the row: its fold, or its ⋯. */
function press(item: HTMLElement, selector: string): boolean {
  const control = item.querySelector<HTMLElement>(selector)
  if (!control) return false
  control.click()
  return true
}

function arrowTarget(key: string, all: readonly HTMLElement[], at: number): HTMLElement | undefined {
  if (key === 'ArrowDown') return all[Math.min(at + 1, all.length - 1)]
  if (key === 'ArrowUp') return all[Math.max(at - 1, 0)]
  if (key === 'Home') return all[0]
  if (key === 'End') return all[all.length - 1]
  return undefined
}

/** → and ←: fold or unfold where there is something to fold, else move along the branch. */
function sideways(key: string, all: readonly HTMLElement[], at: number): HTMLElement | 'pressed' | undefined {
  const item = all[at]
  const open = item.getAttribute('aria-expanded')
  if (key === 'ArrowRight') {
    if (open === 'false') return press(item, '.kit-tree__fold') ? 'pressed' : undefined
    const next = all[at + 1]
    return open === 'true' && next && level(next) > level(item) ? next : undefined
  }
  if (open === 'true') return press(item, '.kit-tree__fold') ? 'pressed' : undefined
  return parentOf(all, at)
}

/**
 * The tree's keys, on the element that holds every row. After each render the
 * one Tab stop is put back where it was, or on the scope that is open, or on
 * the first row.
 */
export function useTreeKeys(tree: RefObject<HTMLElement | null>): (event: ReactKeyboardEvent) => void {
  const typed = useRef({ text: '', at: 0 })
  useLayoutEffect(() => {
    const whole = tree.current
    if (!whole) return
    const all = items(whole)
    if (all.length === 0) return
    const kept = all.find((one) => one.tabIndex === 0 && one.isConnected)
    const stop = kept ?? all.find((one) => one.getAttribute('aria-current') === 'page') ?? all[0]
    for (const one of all) one.tabIndex = one === stop ? 0 : -1
  })
  // A row focused by a click is where the arrows go on from.
  useEffect(() => {
    const whole = tree.current
    if (!whole) return undefined
    const onFocus = (event: FocusEvent) => {
      const item = (event.target as HTMLElement | null)?.closest<HTMLElement>(ITEM)
      if (item && whole.contains(item)) for (const one of items(whole)) one.tabIndex = one === item ? 0 : -1
    }
    whole.addEventListener('focusin', onFocus)
    return () => whole.removeEventListener('focusin', onFocus)
  }, [tree])
  return (event) => {
    const whole = tree.current
    const item = (event.target as HTMLElement).closest<HTMLElement>(ITEM)
    // Keys typed in a menu the ⋯ opened, or anywhere but on a row, are not the tree's.
    if (!whole || !item || event.target !== item) return
    const all = items(whole)
    const at = all.indexOf(item)
    if ((event.key === 'F10' && event.shiftKey) || event.key === 'ContextMenu') {
      if (press(item, '.kit-tree__menu button')) event.preventDefault()
      return
    }
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); item.click(); return }
    const moved = arrowTarget(event.key, all, at)
      ?? (event.key === 'ArrowLeft' || event.key === 'ArrowRight' ? sideways(event.key, all, at) : undefined)
    if (moved !== undefined) {
      event.preventDefault()
      if (moved !== 'pressed') moveTo(whole, moved)
      return
    }
    if (event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey && event.key !== ' ') {
      const now = Date.now()
      const text = (now - typed.current.at < 600 ? typed.current.text : '') + fold(event.key)
      typed.current = { text, at: now }
      const order = [...all.slice(at + (text.length === 1 ? 1 : 0)), ...all.slice(0, at + (text.length === 1 ? 1 : 0))]
      const found = order.find((one) => fold(one.dataset.name ?? one.getAttribute('aria-label') ?? '').startsWith(text))
      if (found) { event.preventDefault(); moveTo(whole, found) }
    }
  }
}
