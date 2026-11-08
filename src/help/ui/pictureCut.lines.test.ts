// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV
// @vitest-environment jsdom

/**
 * The lines of text a picture shows, read off a layout: here a layout written
 * down box by box, since jsdom lays nothing out. What a browser's layout gives
 * in three languages and two text sizes is `HelpFigure.browser.test`.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { textLines } from './pictureCut'

type Rect = { left: number; top: number; width: number; height: number }

const domRect = ({ left, top, width, height }: Rect) =>
  ({ left, top, width, height, x: left, y: top, right: left + width, bottom: top + height, toJSON: () => ({}) }) as DOMRect

/**
 * A picture at (100, 50), 300 by 200, holding: a plain line; a line in a box
 * that hides what overflows it, inside another that does too, so it is cut by
 * both; a line in that box ended with an ellipsis; a line wholly outside its
 * box; a line over the picture's top edge; and a text of white space only.
 */
function laidOut() {
  document.body.innerHTML = `
    <div id="picture">
      <span id="plain">Views here</span>
      <div id="outer"><div id="inner"><span id="cut">A long line the box cuts</span><span id="ellipsed">A line ended…</span><span id="gone">Below the box</span></div></div>
      <span id="over">Over the top</span>
      <span id="space">   </span>
    </div>`
  const picture = document.getElementById('picture')!
  Object.defineProperty(picture, 'scrollWidth', { value: 300 })
  Object.defineProperty(picture, 'scrollHeight', { value: 200 })
  const boxes: Record<string, Rect> = {
    picture: { left: 100, top: 50, width: 300, height: 200 },
    outer: { left: 110, top: 80, width: 200, height: 60 },
    inner: { left: 110, top: 80, width: 150, height: 100 },
  }
  const lines: Record<string, Rect> = {
    plain: { left: 110, top: 60, width: 80, height: 16 },
    cut: { left: 110, top: 90, width: 220, height: 16 },
    ellipsed: { left: 110, top: 110, width: 220, height: 16 },
    gone: { left: 110, top: 160, width: 80, height: 16 },
    over: { left: 110, top: 44, width: 80, height: 16 },
    space: { left: 110, top: 200, width: 10, height: 16 },
  }
  const hides = new Set(['outer', 'inner'])
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    return domRect(boxes[this.id] ?? { left: 0, top: 0, width: 0, height: 0 })
  })
  const rects = vi.fn(function (this: Range) {
    const rect = lines[(this.startContainer as Text).parentElement?.id ?? '']
    return (rect ? [domRect(rect)] : []) as unknown as DOMRectList
  })
  Object.defineProperty(Range.prototype, 'getClientRects', { value: rects, configurable: true })
  const computed = window.getComputedStyle.bind(window)
  vi.spyOn(window, 'getComputedStyle').mockImplementation((element) => {
    const style = computed(element)
    const hidden = hides.has(element.id) ? 'hidden' : 'visible'
    return { ...style, overflowX: hidden, overflowY: hidden, textOverflow: element.id === 'ellipsed' ? 'ellipsis' : 'clip' } as CSSStyleDeclaration
  })
  return picture
}

afterEach(() => {
  vi.restoreAllMocks()
  delete (Range.prototype as { getClientRects?: unknown }).getClientRects
  document.body.innerHTML = ''
})

describe('the lines a picture shows', () => {
  it('are each line as it is seen, from the picture\'s top left', () => {
    const lines = textLines(laidOut())
    // The plain line whole; white space is no line.
    expect(lines[0]).toEqual({ x: 10, y: 10, width: 80, height: 16 })
    expect(lines).toHaveLength(4)
  })

  it('count a line a box hides part of for the part that shows, marked as cut', () => {
    // Inside both boxes: the narrower one's 150 px of it.
    expect(textLines(laidOut())[1]).toEqual({ x: 10, y: 40, width: 150, height: 16, clipped: true })
  })

  it('do not mark a line the app ends with an ellipsis, which says there is more as the app says it', () => {
    expect(textLines(laidOut())[2]).toEqual({ x: 10, y: 60, width: 150, height: 16 })
  })

  it('leave out a line its box hides wholly, and cut one over the picture\'s own edge at that edge', () => {
    const lines = textLines(laidOut())
    expect(lines.some((line) => line.y === 110)).toBe(false)
    expect(lines[3]).toEqual({ x: 10, y: 0, width: 80, height: 10, clipped: true })
  })
})
