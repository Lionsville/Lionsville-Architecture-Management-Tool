// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV
// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest'
import { PRINT_PAPERS, printMarginMm, printPage, printScale } from './printPage'

afterEach(() => { document.body.innerHTML = ''; document.head.innerHTML = '' })

describe('a page on paper', () => {
  it('has a margin in proportion to the sheet, and never under 8 mm', () => {
    expect(printMarginMm(PRINT_PAPERS.A0)).toBeCloseTo(1189 / 60)
    expect(printMarginMm(PRINT_PAPERS.A4)).toBe(8)
  })

  it('fits by whichever side runs out first', () => {
    const wide = printScale({ width: 1860, height: 400 }, PRINT_PAPERS.A2)
    const tall = printScale({ width: 400, height: 5000 }, PRINT_PAPERS.A2)
    const px = (mm: number) => mm * 96 / 25.4
    const margin = printMarginMm(PRINT_PAPERS.A2)
    expect(wide).toBeCloseTo(px(594 - 2 * margin) / 1860)
    expect(tall).toBeCloseTo(px(420 - 2 * margin) / 5000)
  })

  it('puts a scaled copy under the body, asks for the size of the sheet, and leaves the page where it was', () => {
    const page = document.createElement('div')
    page.textContent = 'the page'
    page.style.transform = 'translate(9px, 9px) scale(0.5)'
    const parent = document.body.appendChild(document.createElement('main'))
    parent.append(page)
    const held = printPage(page, { width: 1860, height: 1000 }, PRINT_PAPERS.A0)
    expect(held.node.parentElement).toBe(document.body)
    expect(held.node.textContent).toBe('the page')
    expect((held.node.firstElementChild as HTMLElement).style.transform).toMatch(/^scale\(/)
    expect(page.style.transform).toBe('translate(9px, 9px) scale(0.5)')
    expect(document.head.textContent).toContain('size: 1189mm 841mm')
  })

  it('draws in the light theme whatever the window is in, so a print does not come out night blue', () => {
    const held = printPage(document.createElement('div'), { width: 10, height: 10 }, PRINT_PAPERS.A4)
    expect(held.node.style.getPropertyValue('--ink')).toBe('#171f28')
  })

  it('takes everything away again', () => {
    const held = printPage(document.createElement('div'), { width: 10, height: 10 }, PRINT_PAPERS.A4)
    held.release()
    expect(document.querySelector('.print-page')).toBeNull()
    expect(document.head.querySelector('style')).toBeNull()
  })
})
