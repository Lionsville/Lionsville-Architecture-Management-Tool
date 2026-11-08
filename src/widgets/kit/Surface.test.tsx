// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom

import { useState } from 'react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import MuiMenuItem from '@mui/material/MenuItem'
import MuiSelect from '@mui/material/Select'
import { renderShell } from '../../app/testing/renderShell'
import { MoreMenu } from './Menu'
import { SurfaceMenu, SurfacePopover, SurfacePopper } from './Surface'
import { Tooltip } from './Tooltip'

afterEach(cleanup)

/** A row with a handler for every press and key, the way a row, a card or a tab has some of them. */
function Row({ heard, children }: { heard: (name: string) => void; children: ReactNode }) {
  const on = (name: string) => () => heard(name)
  return (
    <div
      data-testid="row" onClick={on('click')} onDoubleClick={on('dblclick')} onContextMenu={on('contextmenu')} onMouseDown={on('mousedown')} onMouseUp={on('mouseup')}
      onPointerDown={on('pointerdown')} onPointerUp={on('pointerup')} onTouchStart={on('touchstart')} onKeyDown={on('keydown')}
    >
      {children}
    </div>
  )
}

/** Where the pointer is for a press: away from where a test's other presses are, which are all at 0,0. */
const FIRST = { detail: 1, clientX: 300, clientY: 300 }

const pressAll = (element: Element) => {
  fireEvent.pointerDown(element)
  fireEvent.mouseDown(element)
  fireEvent.pointerUp(element)
  fireEvent.mouseUp(element)
  fireEvent.touchStart(element)
  fireEvent.contextMenu(element)
  fireEvent.keyDown(element, { key: 'ArrowDown' })
  fireEvent.doubleClick(element)
  fireEvent.click(element, FIRST)
}

describe('a press inside a surface', () => {
  it('runs the item and fires nothing on the row the menu stands in, whichever part of the press it is', () => {
    const heard = vi.fn()
    const moved = vi.fn()
    renderShell(<Row heard={heard}><MoreMenu items={[{ label: 'Move to…', onSelect: moved }]} /></Row>)
    const more = screen.getByRole('button', { name: 'More' })
    fireEvent.click(more)
    // The ⋯ is the row's neighbour and not the row: its press stays its own.
    expect(heard).not.toHaveBeenCalled()
    pressAll(screen.getByRole('menuitem', { name: 'Move to…' }))
    expect(moved).toHaveBeenCalledOnce()
    expect(heard).not.toHaveBeenCalled()
  })

  it('takes Enter on an item as the item, and not as the row', () => {
    const heard = vi.fn()
    const moved = vi.fn()
    renderShell(<Row heard={heard}><MoreMenu items={[{ label: 'Move to…', onSelect: moved }]} /></Row>)
    fireEvent.click(screen.getByRole('button', { name: 'More' }))
    fireEvent.keyDown(screen.getByRole('menuitem', { name: 'Move to…' }), { key: 'Enter' })
    expect(moved).toHaveBeenCalledOnce()
    expect(heard).not.toHaveBeenCalled()
  })

  it('does not reach a listener on the document going up, and does reach one going down', () => {
    const up = vi.fn()
    const down = vi.fn()
    document.addEventListener('click', up)
    document.addEventListener('click', down, true)
    renderShell(<MoreMenu items={[{ label: 'Move to…', onSelect: () => {} }]} />)
    fireEvent.click(screen.getByRole('button', { name: 'More' }))
    up.mockClear()
    down.mockClear()
    fireEvent.click(screen.getByRole('menuitem', { name: 'Move to…' }), { detail: 1, clientX: 500, clientY: 500 })
    document.removeEventListener('click', up)
    document.removeEventListener('click', down, true)
    expect(up).not.toHaveBeenCalled()
    expect(down).toHaveBeenCalledOnce()
  })

  it('stops the same way on a popover, a popper, a tooltip and a Select of MUI', async () => {
    const heard = vi.fn()
    const box = document.createElement('div')
    document.body.append(box)
    renderShell(
      <Row heard={heard}>
        <SurfacePopover open anchorEl={box}><button type="button">In the popover</button></SurfacePopover>
        <SurfacePopper open anchorEl={box}><button type="button">In the popper</button></SurfacePopper>
      </Row>,
    )
    pressAll(screen.getByRole('button', { hidden: true, name: 'In the popover' }))
    pressAll(screen.getByRole('button', { hidden: true, name: 'In the popper' }))
    expect(heard).not.toHaveBeenCalled()
    cleanup()
    box.remove()

    renderShell(<Row heard={heard}><Tooltip title="What it is"><button type="button">Word</button></Tooltip></Row>)
    fireEvent.mouseOver(screen.getByRole('button', { name: 'Word' }))
    const tip = await screen.findByRole('tooltip')
    heard.mockClear()
    pressAll(tip)
    expect(heard).not.toHaveBeenCalled()
    cleanup()

    renderShell(<Row heard={heard}><MuiSelect open value="a"><MuiMenuItem value="a">First</MuiMenuItem></MuiSelect></Row>)
    heard.mockClear()
    fireEvent.click(screen.getByRole('option', { name: 'First' }))
    expect(heard).not.toHaveBeenCalled()
  })
})

describe('a press outside a surface', () => {
  const Open = ({ onClose, heard }: { onClose: () => void; heard: (name: string) => void }) => {
    const [open, setOpen] = useState(true)
    return (
      <Row heard={heard}>
        <SurfaceMenu open={open} anchorEl={document.body} onClose={() => { setOpen(false); onClose() }}><MuiMenuItem>One</MuiMenuItem></SurfaceMenu>
      </Row>
    )
  }
  const backdrop = () => document.querySelector('.MuiBackdrop-root') as Element

  it('closes it and does nothing else, with the first button', async () => {
    const closed = vi.fn()
    const heard = vi.fn()
    renderShell(<Open onClose={closed} heard={heard} />)
    pressAll(backdrop())
    expect(closed).toHaveBeenCalledOnce()
    expect(heard).not.toHaveBeenCalled()
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
  })

  it('closes it and keeps the browser\'s menu away, with the second', () => {
    const closed = vi.fn()
    const heard = vi.fn()
    renderShell(<Open onClose={closed} heard={heard} />)
    expect(fireEvent.contextMenu(backdrop())).toBe(false)
    expect(closed).toHaveBeenCalledOnce()
    expect(heard).not.toHaveBeenCalled()
  })

  it('leaves a field in a popover its own menu, for paste', () => {
    renderShell(<SurfacePopover open anchorEl={document.body}><input aria-label="A day" /></SurfacePopover>)
    expect(fireEvent.contextMenu(screen.getByRole('textbox', { hidden: true, name: 'A day' }))).toBe(true)
  })
})

describe('the second press of a double press', () => {
  const beneath = vi.fn()
  const Page = ({ acted }: { acted: () => void }) => (
    <>
      <button type="button" onClick={beneath}>Beneath</button>
      <MoreMenu items={[{ label: 'Act', onSelect: acted }]} />
    </>
  )

  it('is dropped where the first was, and not elsewhere, and only for as long as two presses count as one', () => {
    vi.useFakeTimers()
    try {
      beneath.mockClear()
      const acted = vi.fn()
      renderShell(<Page acted={acted} />)
      fireEvent.click(screen.getByRole('button', { name: 'More' }))
      fireEvent.click(screen.getByRole('menuitem', { name: 'Act' }), { detail: 1, clientX: 10, clientY: 10 })
      expect(acted).toHaveBeenCalledOnce()
      const under = screen.getByRole('button', { hidden: true, name: 'Beneath' })

      fireEvent.click(under, { detail: 2, clientX: 12, clientY: 9 })
      expect(beneath).not.toHaveBeenCalled()
      fireEvent.click(under, { detail: 1, clientX: 200, clientY: 200 })
      expect(beneath).toHaveBeenCalledOnce()
      vi.advanceTimersByTime(600)
      fireEvent.click(under, { detail: 1, clientX: 10, clientY: 10 })
      expect(beneath).toHaveBeenCalledTimes(2)
    } finally {
      vi.useRealTimers()
    }
  })

  it('does not run an item a second time while the menu goes', () => {
    const acted = vi.fn()
    renderShell(<MoreMenu items={[{ label: 'Act', onSelect: acted }]} />)
    fireEvent.click(screen.getByRole('button', { name: 'More' }))
    const item = screen.getByRole('menuitem', { name: 'Act' })
    fireEvent.click(item, { detail: 1, clientX: 10, clientY: 10 })
    // Pressed elsewhere on it, so past the drop: it is the closing menu that refuses.
    fireEvent.click(item, { detail: 1, clientX: 60, clientY: 40 })
    expect(acted).toHaveBeenCalledOnce()
  })

  it('has no second press after a key', () => {
    const beneathKey = vi.fn()
    const add = vi.spyOn(window, 'addEventListener')
    renderShell(<><button type="button" onClick={beneathKey}>Under</button><MoreMenu items={[{ label: 'Act', onSelect: () => {} }]} /></>)
    fireEvent.click(screen.getByRole('button', { name: 'More' }))
    add.mockClear()
    fireEvent.keyDown(screen.getByRole('menuitem', { name: 'Act' }), { key: 'Enter' })
    expect(add.mock.calls.filter(([type]) => type === 'mousedown')).toEqual([])
    add.mockRestore()
  })
})

describe('a popover that grows after it opened', () => {
  it('moves up to keep its foot inside the window, and does not move as it shrinks again', async () => {
    const watchers: (() => void)[] = []
    vi.stubGlobal('ResizeObserver', class { constructor(heard: () => void) { watchers.push(heard) } observe() {} disconnect() {} })
    const tall = { height: 60 }
    const height = vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (this: HTMLElement) {
      return this.classList.contains('MuiPopover-paper') ? tall.height : 0
    })
    const rect = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this.dataset.testid === 'anchor') return { top: 580, bottom: 600, left: 20, right: 120, width: 100, height: 20, x: 20, y: 580, toJSON: () => ({}) }
      const top = parseFloat(this.style.top) || 0
      return { top, bottom: top + tall.height, left: 0, right: 0, width: 0, height: tall.height, x: 0, y: top, toJSON: () => ({}) }
    })
    try {
      function Grows() {
        const [at, setAt] = useState<HTMLElement | null>(null)
        return (
          <>
            <button type="button" data-testid="anchor" ref={setAt}>Open</button>
            {at && <SurfacePopover open anchorEl={at} anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}><p>Fields</p></SurfacePopover>}
          </>
        )
      }
      renderShell(<Grows />)
      const paper = await waitFor(() => document.querySelector<HTMLElement>('.MuiPopover-paper') as HTMLElement)
      await waitFor(() => expect(paper.style.top).toBe('600px'))
      // A part folds out: 300 px under the anchor's 600 runs past a 768 px window's foot.
      tall.height = 300
      watchers.forEach((heard) => heard())
      expect(paper.style.top).toBe(`${window.innerHeight - 16 - 300}px`)
      // Shrinking again leaves it where it is.
      tall.height = 100
      watchers.forEach((heard) => heard())
      expect(paper.style.top).toBe(`${window.innerHeight - 16 - 300}px`)
    } finally {
      height.mockRestore()
      rect.mockRestore()
      vi.unstubAllGlobals()
    }
  })
})
