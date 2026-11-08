// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV
// @vitest-environment jsdom

/**
 * A picture cut to the part its words are about, at the size it is drawn, and
 * the whole of it on a press: the reviewer read the pictures' words at seven
 * pixels, as shapes.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { translator } from '../../i18n'
import { HelpFigure, measureCut } from './HelpFigure'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  delete (Range.prototype as { getClientRects?: unknown }).getClientRects
})

describe('a figure', () => {
  it('shows the whole picture on a press, and closes', () => {
    const Picture = () => <div data-crop=""><span>Views here</span></div>
    render(<HelpFigure Picture={Picture} caption="A scope's home" t={translator('en')} width={560} />)
    const press = screen.getByRole('button', { name: "Show the whole picture: A scope's home" })
    const whole = document.querySelector('dialog') as HTMLDialogElement
    expect(whole.open).toBe(false)
    fireEvent.click(press)
    expect(whole.hasAttribute('open')).toBe(true)
    // jsdom lays nothing out, so nothing is enlarged; how much is, is `fitScale`'s and the browser suite's.
    expect((whole.querySelector('.help-screen') as HTMLElement).style.width).toBe('560px')
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(whole.hasAttribute('open')).toBe(false)
  })
})

describe('the cut of a picture laid out whole', () => {
  /** A picture at (100, 50), 400 by 300, with no lines of text in it; each element's box by its id. */
  function picture(html: string, boxes: Record<string, [number, number, number, number]>) {
    const at = document.createElement('div')
    at.id = 'picture'
    at.innerHTML = html
    document.body.append(at)
    Object.defineProperty(at, 'scrollWidth', { value: 400 })
    Object.defineProperty(at, 'scrollHeight', { value: 300 })
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
      const [left, top, width, height] = boxes[this.id] ?? [0, 0, 0, 0]
      return { left, top, width, height, x: left, y: top, right: left + width, bottom: top + height, toJSON: () => ({}) } as DOMRect
    })
    Object.defineProperty(Range.prototype, 'getClientRects', { value: () => [], configurable: true })
    return at
  }

  it('is nothing where nothing was laid out', () => {
    expect(measureCut(picture('<span data-crop id="a"></span>', { a: [110, 60, 50, 20] }))).toBeUndefined()
  })

  it('is the parts marked to be cut to, at their edge, out to the picture\'s own where no line lies beyond', () => {
    const at = picture('<span data-crop id="a"></span><span data-crop id="b"></span><span data-mark id="ring"></span>', {
      picture: [100, 50, 400, 300], a: [110, 60, 50, 20], b: [200, 100, 50, 20], ring: [300, 200, 10, 10],
    })
    expect(measureCut(at)).toEqual({ x: 0, y: 0, width: 400, height: 300 })
  })

  it('is the ring a step draws, with room round it, where nothing is marked to be cut to, and no wider than its column', () => {
    const at = picture('<span data-mark id="ring"></span>', { picture: [100, 50, 400, 300], ring: [300, 200, 10, 10] })
    // Four px round the ring each way; the picture's own edges would be wider than the column gives.
    expect(measureCut(at, 100)).toEqual({ x: 196, y: 0, width: 18, height: 300 })
  })

  it('is nothing where the picture marks nothing', () => {
    expect(measureCut(picture('<span></span>', { picture: [100, 50, 400, 300] }))).toBeUndefined()
  })
})
