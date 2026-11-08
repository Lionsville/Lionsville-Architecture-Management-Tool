// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { holdOnScreen, setHostOwnsZoomKeys, steppedZoomTarget, useCanvasZoom, zoomCanvasInUse } from './useCanvasZoom'
import type { ZoomTarget } from './useCanvasZoom'

function Canvas({ target, wheel, plainKeys }: { target: ZoomTarget; wheel?: boolean; plainKeys?: boolean }) {
  const ref = useCanvasZoom(target, { wheel, plainKeys })
  return <div ref={ref} data-testid="canvas"><button>inside</button><input aria-label="field" /></div>
}

const spy = () => ({ go: vi.fn(), by: vi.fn() })
const over = () => fireEvent.pointerEnter(screen.getByTestId('canvas'), { clientX: 30, clientY: 40 })

afterEach(() => { cleanup(); setHostOwnsZoomKeys(false) })

describe('one zoom behaviour', () => {
  it('leaves the keys alone until the pointer or the focus is on the canvas', () => {
    const target = spy()
    render(<Canvas target={target} />)
    const away = fireEvent.keyDown(document.body, { key: '=', metaKey: true })
    expect(away).toBe(true)
    expect(target.go).not.toHaveBeenCalled()
  })

  it('takes ⌘ + − 0 over the canvas, so the browser does not zoom the page', () => {
    const target = spy()
    render(<Canvas target={target} />)
    over()
    expect(fireEvent.keyDown(document.body, { key: '=', metaKey: true })).toBe(false)
    expect(target.go).toHaveBeenLastCalledWith('in', expect.objectContaining({ x: 30, y: 40 }))
    fireEvent.keyDown(document.body, { key: '-', ctrlKey: true })
    expect(target.go).toHaveBeenLastCalledWith('out', expect.anything())
    fireEvent.keyDown(document.body, { key: '0', metaKey: true })
    expect(target.go).toHaveBeenLastCalledWith('home', expect.anything())
  })

  it('takes them with the focus in the canvas and the pointer elsewhere', () => {
    const target = spy()
    render(<Canvas target={target} />)
    act(() => screen.getByRole('button', { name: 'inside' }).focus())
    fireEvent.keyDown(document.body, { key: '-', metaKey: true })
    expect(target.go).toHaveBeenCalledWith('out', undefined)
  })

  it('takes ⇧ 1 and the keys boards have, but not while somebody types', () => {
    const target = spy()
    render(<Canvas target={target} />)
    over()
    fireEvent.keyDown(document.body, { key: '!', code: 'Digit1', shiftKey: true })
    expect(target.go).toHaveBeenLastCalledWith('fit', expect.anything())
    target.go.mockClear()
    fireEvent.keyDown(screen.getByLabelText('field'), { key: '=' })
    expect(target.go).not.toHaveBeenCalled()
  })

  it('leaves the plain keys to a canvas whose keymap has them', () => {
    const target = spy()
    render(<Canvas target={target} plainKeys={false} />)
    over()
    fireEvent.keyDown(document.body, { key: '=' })
    expect(target.go).not.toHaveBeenCalled()
    fireEvent.keyDown(document.body, { key: '=', metaKey: true })
    expect(target.go).toHaveBeenCalledOnce()
  })

  it('leaves ⌘ + − 0 to the menu bar where the host owns them: a menu accelerator fires whatever the page did', () => {
    setHostOwnsZoomKeys(true)
    const target = spy()
    render(<Canvas target={target} />)
    over()
    expect(fireEvent.keyDown(document.body, { key: '=', metaKey: true })).toBe(true)
    expect(target.go).not.toHaveBeenCalled()
    // ⇧ 1 is on no menu.
    fireEvent.keyDown(document.body, { key: '!', code: 'Digit1', shiftKey: true })
    expect(target.go).toHaveBeenCalledWith('fit', expect.anything())
  })

  it('answers the menu when a canvas is in use, and says so when none is', () => {
    const target = spy()
    render(<Canvas target={target} />)
    expect(zoomCanvasInUse('in')).toBe(false)
    over()
    expect(zoomCanvasInUse('in')).toBe(true)
    expect(target.go).toHaveBeenCalledWith('in', expect.anything())
    fireEvent.pointerLeave(screen.getByTestId('canvas'))
    expect(zoomCanvasInUse('out')).toBe(false)
  })

  it('leaves the keys to a dialog holding the focus', () => {
    const target = spy()
    render(<><Canvas target={target} /><div role="dialog" aria-modal="true"><button>ok</button></div></>)
    over()
    act(() => screen.getByRole('button', { name: 'ok' }).focus())
    fireEvent.keyDown(document.body, { key: '=', metaKey: true })
    expect(target.go).not.toHaveBeenCalled()
    expect(zoomCanvasInUse('in')).toBe(false)
  })

  it('still takes them for a canvas inside the dialog holding the focus, as on a page drawn as one', () => {
    const target = spy()
    render(<div role="dialog" aria-modal="true"><button>ok</button><Canvas target={target} /></div>)
    over()
    act(() => screen.getByRole('button', { name: 'ok' }).focus())
    fireEvent.keyDown(document.body, { key: '=', metaKey: true })
    expect(target.go).toHaveBeenCalledOnce()
  })

  it('zooms on ⌘ or Ctrl with the wheel, and lets a plain wheel scroll', () => {
    const target = spy()
    render(<Canvas target={target} />)
    const canvas = screen.getByTestId('canvas')
    expect(fireEvent.wheel(canvas, { deltaY: -120, ctrlKey: true, clientX: 5, clientY: 6 })).toBe(false)
    expect(target.by).toHaveBeenCalledWith(expect.closeTo(1.1), expect.objectContaining({ x: 5, y: 6 }))
    target.by.mockClear()
    expect(fireEvent.wheel(canvas, { deltaY: -120 })).toBe(true)
    expect(target.by).not.toHaveBeenCalled()
  })

  it('leaves the wheel to a canvas that zooms on it by itself', () => {
    const target = spy()
    render(<Canvas target={target} wheel={false} />)
    expect(fireEvent.wheel(screen.getByTestId('canvas'), { deltaY: -120, ctrlKey: true })).toBe(true)
    expect(target.by).not.toHaveBeenCalled()
  })

  it('follows a pinch in Safari, whose gestures say a scale since they began', () => {
    const target = spy()
    render(<Canvas target={target} />)
    const canvas = screen.getByTestId('canvas')
    const gesture = (type: string, scale: number) => {
      const event = Object.assign(new Event(type, { cancelable: true }), { scale, clientX: 1, clientY: 2 })
      canvas.dispatchEvent(event)
      return event
    }
    expect(gesture('gesturestart', 1).defaultPrevented).toBe(true)
    gesture('gesturechange', 1.5)
    expect(target.by).toHaveBeenLastCalledWith(1.5, expect.anything())
    gesture('gesturechange', 3)
    expect(target.by).toHaveBeenLastCalledWith(2, expect.anything())
  })

  it('sends the menu and ⌘ + − 0 to the one canvas on screen after a press on its rows outside it, but not past a dialog', () => {
    const target = spy()
    const shown = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      const on = this.dataset.testid === 'canvas'
      return { x: 0, y: 0, left: 0, top: 0, right: on ? 800 : 0, bottom: on ? 600 : 0, width: on ? 800 : 0, height: on ? 600 : 0, toJSON: () => ({}) } as DOMRect
    })
    render(<><button>row three</button><Canvas target={target} /><Canvas target={spy()} /></>)
    act(() => screen.getByRole('button', { name: 'row three' }).focus())
    // Two canvases, one on screen: the menu's zoom is that one's, and so is the chord, though neither pointer nor focus is in it.
    const [one, other] = screen.getAllByTestId('canvas')
    other.dataset.testid = 'hidden'
    expect(zoomCanvasInUse('in')).toBe(true)
    expect(target.go).toHaveBeenLastCalledWith('in', undefined)
    expect(fireEvent.keyDown(document.body, { key: '-', metaKey: true })).toBe(false)
    expect(target.go).toHaveBeenLastCalledWith('out', undefined)
    // The plain keys stay the canvas's own, for when it is in use.
    target.go.mockClear()
    fireEvent.keyDown(document.body, { key: '=' })
    expect(target.go).not.toHaveBeenCalled()
    expect(one).toBeDefined()
    shown.mockRestore()
  })

  it('leaves the menu to the window where two canvases are on screen and neither is in use', () => {
    const shown = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ x: 0, y: 0, left: 0, top: 0, right: 400, bottom: 300, width: 400, height: 300, toJSON: () => ({}) } as DOMRect)
    render(<><Canvas target={spy()} /><Canvas target={spy()} /></>)
    expect(zoomCanvasInUse('in')).toBe(false)
    shown.mockRestore()
  })

  it('stops listening when the canvas goes', () => {
    const target = spy()
    const { unmount } = render(<Canvas target={target} />)
    over()
    unmount()
    expect(zoomCanvasInUse('in')).toBe(false)
    fireEvent.keyDown(document.body, { key: '=', metaKey: true })
    expect(target.go).not.toHaveBeenCalled()
  })
})

describe('a target over a zoom in the range', () => {
  it('steps, goes home, fits, and holds what the wheel asks to the range', () => {
    const to = vi.fn()
    const fit = vi.fn()
    const target = steppedZoomTarget({ zoom: () => 0.65, to, fit })
    target.go('in')
    expect(to).toHaveBeenLastCalledWith(expect.closeTo(0.7), undefined)
    target.go('home', { x: 1, y: 2 })
    expect(to).toHaveBeenLastCalledWith(1, { x: 1, y: 2 })
    target.go('fit')
    expect(fit).toHaveBeenCalledOnce()
    target.by(0.1)
    expect(to).toHaveBeenLastCalledWith(0.6, undefined)
  })
})

describe('what is drawn holds still when the canvas\'s left edge moves', () => {
  // A tree docked beside a canvas moves its left edge and narrows it; jsdom lays nothing out, so both are told.
  function watched(scrolls = false) {
    const observers: Array<() => void> = []
    vi.stubGlobal('ResizeObserver', class { constructor(tell: () => void) { observers.push(tell) } observe() {} disconnect() {} })
    const element = document.createElement('div')
    let left = 0
    element.getBoundingClientRect = () => ({ left, width: 800 } as DOMRect)
    if (scrolls) {
      Object.defineProperty(element, 'scrollWidth', { value: 2000 })
      Object.defineProperty(element, 'clientWidth', { value: 800 })
    }
    return { element, moveTo: (to: number) => { left = to; observers.forEach((tell) => tell()) } }
  }
  afterEach(() => vi.unstubAllGlobals())

  it('pans a canvas with a viewport of its own back by as much as the edge moved', () => {
    const { element, moveTo } = watched()
    const pan = vi.fn()
    const stop = holdOnScreen(element, () => ({ ...spy(), pan }))
    moveTo(300)
    expect(pan).toHaveBeenLastCalledWith(-300)
    moveTo(0)
    expect(pan).toHaveBeenLastCalledWith(300)
    stop()
  })

  it('scrolls a canvas that scrolls, and leaves one alone whose edge stayed', () => {
    const { element, moveTo } = watched(true)
    element.scrollLeft = 500
    const stop = holdOnScreen(element, () => spy())
    moveTo(0)
    expect(element.scrollLeft).toBe(500)
    moveTo(300)
    expect(element.scrollLeft).toBe(800)
    stop()
  })

  it('passes a pan through a stepped target', () => {
    const pan = vi.fn()
    steppedZoomTarget({ zoom: () => 1, to: vi.fn(), fit: vi.fn(), pan }).pan?.(12)
    expect(pan).toHaveBeenCalledWith(12)
  })
})
