// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV
// @vitest-environment jsdom

/**
 * `?` and F1 on every screen: heard before any screen's own keymap, kept from
 * whoever is typing, and the help opened at the place the screen is.
 */
import { cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { helpKeyOf, helpPlaceOf, takesText, useHelpKeys } from './helpKeys'

const press = (key: string, target: EventTarget = document.body, more: KeyboardEventInit = {}) => {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...more })
  target.dispatchEvent(event)
  return event
}

afterEach(() => { cleanup(); document.body.innerHTML = '' })

describe('which key is the help\'s', () => {
  it('reads ? as the shortcuts, F1 and ⌘? as the help here', () => {
    const plain = { shiftKey: true, metaKey: false, ctrlKey: false, altKey: false }
    expect(helpKeyOf({ key: '?', ...plain })).toBe('shortcuts')
    expect(helpKeyOf({ key: 'F1', ...plain, shiftKey: false })).toBe('help')
    expect(helpKeyOf({ key: '?', ...plain, metaKey: true })).toBe('help')
    expect(helpKeyOf({ key: '/', ...plain, ctrlKey: true })).toBe('help')
    expect(helpKeyOf({ key: '/', ...plain, shiftKey: false })).toBeUndefined()
    expect(helpKeyOf({ key: '?', ...plain, altKey: true })).toBeUndefined()
  })

  it('leaves a key to what is being written, and to a list\'s type-ahead', () => {
    const field = document.body.appendChild(document.createElement('input'))
    const box = document.body.appendChild(document.createElement('input'))
    box.type = 'checkbox'
    const menu = document.body.appendChild(document.createElement('div'))
    menu.setAttribute('role', 'menu')
    const item = menu.appendChild(document.createElement('button'))
    expect(takesText(field)).toBe(true)
    expect(takesText(box)).toBe(false)
    expect(takesText(item)).toBe(true)
    expect(takesText(document.body)).toBe(false)
  })
})

describe('the place the help opens at', () => {
  it('is the page, its tab, the view up, or a frame\'s panel', () => {
    expect(helpPlaceOf(undefined)).toBe('start')
    expect(helpPlaceOf({ home: { path: '', name: 'Acme' } })).toBe('home.read')
    expect(helpPlaceOf({ page: { page: 'roadmap' } })).toBe('roadmap')
    expect(helpPlaceOf({ page: { page: 'operating', tab: 'roles' } })).toBe('operating.rolesList')
    expect(helpPlaceOf({ open: { path: 'a', name: 'A', view: { id: 'v', name: 'V', kind: 'layer7' } } })).toBe('board')
    expect(helpPlaceOf({ open: { path: 'a', name: 'A', view: { id: 'v', name: 'V', kind: 'sheet' } } }, 'poster')).toBe('poster')
    expect(helpPlaceOf({ home: { path: '', name: 'Acme' }, panel: 'activity' })).toBe('frame.activity')
  })
})

describe('the keys, heard on the window', () => {
  it('? asks the frame for its sheet, F1 opens the help here, and a board below hears neither', () => {
    const send = vi.fn()
    renderHook(() => useHelpKeys({ send, place: () => 'decisions', framed: true }))
    const board = vi.fn()
    document.addEventListener('keydown', board, true)
    press('?')
    press('F1')
    expect(send.mock.calls).toEqual([[{ type: 'shortcuts' }], [{ type: 'manual', section: 'decisions' }]])
    expect(board).not.toHaveBeenCalled()
    document.removeEventListener('keydown', board, true)
  })

  it('works from a button in row one or a dialog that is up, and not from a field', () => {
    const send = vi.fn()
    renderHook(() => useHelpKeys({ send, place: () => 'board', framed: true }))
    const dialog = document.body.appendChild(document.createElement('div'))
    dialog.setAttribute('role', 'dialog')
    const button = dialog.appendChild(document.createElement('button'))
    press('?', button)
    const field = document.body.appendChild(document.createElement('textarea'))
    expect(press('?', field).defaultPrevented).toBe(false)
    expect(send).toHaveBeenCalledTimes(1)
  })

  it('opens the help\'s own list of keys where there is no frame to show the sheet', () => {
    const send = vi.fn()
    renderHook(() => useHelpKeys({ send, place: () => 'start', framed: false }))
    press('?')
    expect(send).toHaveBeenCalledWith({ type: 'manual', section: 'frame.shortcutsSheet' })
  })
})
