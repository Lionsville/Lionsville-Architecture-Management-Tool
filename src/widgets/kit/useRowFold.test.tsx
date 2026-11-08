// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { pastItsEnd, useRowFold } from './useRowFold'

let width = 400
/** What the row's contents ask for, with so many of them folded: each folded one gives back 100. */
let needs = (folded: number) => 700 - folded * 100
let folded = 0
let watcher: (() => void) | undefined

function Row({ again }: { again?: unknown }) {
  const fold = useRowFold(4, again)
  folded = fold.folded
  return <div data-testid="row"><span ref={fold.anchor} hidden /><output>{fold.folded}</output></div>
}

function measured() {
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(() => width)
  vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockImplementation(() => needs(folded))
  vi.stubGlobal('ResizeObserver', class { constructor(look: () => void) { watcher = look } observe() {} disconnect() {} })
}

describe('a row that folds', () => {
  afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); width = 400; folded = 0; needs = (count) => 700 - count * 100 })

  it('folds until the rest fits, and no more', () => {
    measured()
    render(<Row />)
    expect(screen.getByRole('status').textContent).toBe('3')
  })

  it('takes one back when it is given more room', () => {
    measured()
    render(<Row />)
    width = 620
    act(() => watcher?.())
    expect(screen.getByRole('status').textContent).toBe('1')
  })

  it('stops at what it may fold', () => {
    measured()
    needs = () => 2000
    render(<Row />)
    expect(screen.getByRole('status').textContent).toBe('4')
  })

  it('looks again from the start when the language or the text size changes', () => {
    measured()
    const { rerender } = render(<Row again="100" />)
    needs = (count) => 500 - count * 100
    rerender(<Row again="125" />)
    expect(screen.getByRole('status').textContent).toBe('1')
  })

  it('measures nothing on a render that changes nothing in the row', () => {
    measured()
    const asked = vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockImplementation(() => needs(folded))
    const { rerender } = render(<Row again="100" />)
    const before = asked.mock.calls.length
    rerender(<Row again="100" />)
    rerender(<Row again="100" />)
    expect(asked.mock.calls.length).toBe(before)
  })
})

describe('a row whose last control runs into its end padding', () => {
  afterEach(() => { cleanup(); vi.restoreAllMocks() })

  /** A row 0–600 with 8 px of end padding, its last control ending at `last`, read through a box-less wrapper. */
  function rowEndingAt(last: number): HTMLElement {
    const row = document.createElement('nav')
    row.style.paddingRight = '8px'
    row.innerHTML = '<button>Home</button><div style="display: contents"><button>Roadmap</button><button id="more">More</button></div>'
    document.body.append(row)
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
      const right = this === row ? 600 : this.id === 'more' ? last : 100
      return { right, left: 0, top: 0, bottom: 0, width: right, height: 0, x: 0, y: 0, toJSON: () => ({}) } as DOMRect
    })
    return row
  }

  it('overflows though its scroll width says it fits: More would sit cut against the edge', () => {
    expect(pastItsEnd(rowEndingAt(600))).toBe(true)
    expect(pastItsEnd(rowEndingAt(596))).toBe(true)
  })

  it('fits while the last control ends at the padding', () => {
    expect(pastItsEnd(rowEndingAt(592))).toBe(false)
  })

  it('folds one more for it', () => {
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(() => 600)
    vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockImplementation(() => 600)
    let ends = 600
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
      const right = this.getAttribute('data-testid') === 'row' ? 600 : this.tagName === 'OUTPUT' ? ends : 0
      return { right, left: 0, top: 0, bottom: 0, width: right, height: 0, x: 0, y: 0, toJSON: () => ({}) } as DOMRect
    })
    function Folding() {
      const fold = useRowFold(4, undefined)
      ends = 600 - fold.folded * 100
      return <div data-testid="row" style={{ paddingRight: 8 }}><span ref={fold.anchor} hidden /><output>{fold.folded}</output></div>
    }
    render(<Folding />)
    expect(screen.getByRole('status').textContent).toBe('1')
  })
})
