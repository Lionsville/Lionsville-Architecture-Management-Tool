// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { printSheets } from './printBoard'

function board(): HTMLElement {
  const element = document.createElement('div')
  element.className = 'lv-board'
  element.dataset.guide = 'board.canvas'
  element.dataset.distance = 'far'
  element.innerHTML = '<div class="react-flow"><div class="react-flow__viewport" style="transform: translate(0px, 0px) scale(0.3)"><div class="kit-card" data-testid="card">A</div></div></div>'
  document.body.append(element)
  return element
}

afterEach(() => { document.body.innerHTML = ''; document.head.innerHTML = '' })

describe('the sheets a board prints on', () => {
  it('copies the board once a sheet, in the form that says names, framed on its part, and asks for landscape', () => {
    const live = board()
    const release = printSheets(live, { zoom: 0.8, parts: [{ x: 0, y: 0, width: 500, height: 400 }, { x: 500, y: 0, width: 500, height: 400 }], small: true }, 'Too large')
    const copies = [...document.querySelectorAll<HTMLElement>('.lv-print-sheet .lv-board')]
    expect(copies).toHaveLength(2)
    expect(copies.every((copy) => copy.dataset.distance === 'middle' && copy.dataset.guide === undefined)).toBe(true)
    expect(copies[1]!.querySelector<HTMLElement>('.react-flow__viewport')!.style.transform).toBe('translate(-400px, 0px) scale(0.8)')
    expect(document.querySelectorAll('[data-testid="card"]')).toHaveLength(1)
    expect(document.querySelector('.lv-print-sheet__note')?.textContent).toBe('Too large')
    expect(document.head.textContent).toContain('size: landscape')
    // The board on the screen is left as it was.
    expect(live.dataset.distance).toBe('far')
    release()
    expect(document.querySelector('.lv-print-sheets')).toBeNull()
    expect(document.head.textContent).not.toContain('landscape')
  })
})
