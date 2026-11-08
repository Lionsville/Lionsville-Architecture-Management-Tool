// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { DARK, LIGHT } from '../../widgets/kit/tokens'
import { printObstacles, printSheets, rgbKey } from './printBoard'

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

  it('gives each sheet its own arrowheads, and draws a line left in the dark ink in the light one', () => {
    const live = board()
    const id = `1__color=${DARK['line-ink']}&height=16&type=arrowclosed`
    live.querySelector('.react-flow__viewport')!.insertAdjacentHTML('beforeend',
      `<svg class="react-flow__edges"><svg class="react-flow__marker"><defs><marker id="${id}"><polyline style="stroke: ${DARK['line-ink']}; fill: ${DARK['line-ink']}"></polyline></marker></defs></svg>`
      + `<g class="react-flow__edge"><path class="react-flow__edge-path" marker-end="url('#${id}')" style="stroke: ${DARK['line-ink']}"></path></g>`
      + `<g class="react-flow__edge"><path class="react-flow__edge-path" marker-end="url('#${id}')" style="stroke: #123456"></path></g></svg>`)
    const release = printSheets(live, { zoom: 0.8, parts: [{ x: 0, y: 0, width: 500, height: 400 }, { x: 500, y: 0, width: 500, height: 400 }], small: false }, undefined)
    const sheets = [...document.querySelectorAll('.lv-print-sheet')]
    const ids = sheets.map((sheet) => sheet.querySelector('marker')!.id)
    expect(new Set([id, ...ids]).size).toBe(3)
    sheets.forEach((sheet, at) => {
      const [own, other] = [...sheet.querySelectorAll<SVGPathElement>('.react-flow__edge-path')]
      expect(own!.getAttribute('marker-end')).toBe(`url('#${ids[at]}')`)
      expect(rgbKey(own!.style.stroke)).toBe(rgbKey(LIGHT['line-ink']))
      expect(rgbKey(sheet.querySelector<SVGElement>('marker polyline')!.style.fill)).toBe(rgbKey(LIGHT['line-ink']))
      // A line's own colour is its own.
      expect(rgbKey(other!.style.stroke)).toBe('18,52,86')
    })
    // The screen's board keeps its ids and its ink.
    expect(live.querySelector('marker')!.id).toBe(id)
    expect(rgbKey(live.querySelector<SVGPathElement>('.react-flow__edge-path')!.style.stroke)).toBe(rgbKey(DARK['line-ink']))
    release()
  })

  it('measures what a cut must keep clear of on a copy it takes away again', () => {
    const live = board()
    expect(printObstacles(live)).toEqual([])
    expect(document.querySelectorAll('.lv-board')).toHaveLength(1)
  })
})

describe('a colour as r,g,b', () => {
  it('reads hex and rgb alike, and nothing else', () => {
    expect(rgbKey('#464E58')).toBe('70,78,88')
    expect(rgbKey('rgb(70, 78, 88)')).toBe('70,78,88')
    expect(rgbKey('var(--line-ink)')).toBe('')
    expect(rgbKey('rgba(70, 78, 88, 0.5)')).toBe('')
  })
})
