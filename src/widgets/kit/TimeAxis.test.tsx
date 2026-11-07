// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { axeFindings } from '../../app/testing/axe'
import { LanguageProvider } from '../../i18n/LanguageContext'
import { TimeAxis, TimeAxisGroup, TimeAxisRow, TimeBar, TimeMilestones } from './TimeAxis'
import type { TimeAxisProps } from './TimeAxis'
import { openingView } from './timeScale'
import type { AxisView } from './timeScale'

afterEach(cleanup)

const TODAY = '2026-11-07'

/** The ruler has a width in a browser; here it needs telling. */
function widen(width = 960) {
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(width)
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    const left = this.getAttribute('role') === 'group' && this.classList.contains('kit-time__ruler') ? 300 : 0
    return { left, width, top: 0, height: 40, right: left + width, bottom: 40, x: left, y: 0, toJSON: () => ({}) }
  })
}

function Axis(props: Partial<TimeAxisProps> & { onView?: (view: AxisView) => void }) {
  const [view, setView] = useState<AxisView>(props.view ?? openingView(TODAY))
  return (
    <TimeAxis
      today={TODAY}
      dates={['2025-01-01', '2028-12-31']}
      {...props}
      view={view}
      onViewChange={(next) => { setView(next); props.onView?.(next) }}
    >
      {props.children ?? (
        <>
          <TimeAxisGroup label="Plans" count={2} />
          <TimeAxisRow label="TR-0001 Retire the rater" aside="0 of 11 moved">
            <TimeBar from="2026-01-01" to="2027-06-30" name="Running" tone="running" />
            <TimeMilestones items={[{ id: 'a', day: '2026-10-01', label: 'New prices live' }]} />
          </TimeAxisRow>
        </>
      )}
    </TimeAxis>
  )
}

describe('the ruler', () => {
  it('opens on twelve months at Months, says the window and marks today once', () => {
    widen()
    render(<Axis />)
    expect(screen.getByRole('button', { name: 'Aug 2026 to Jul 2027' })).toBeTruthy()
    expect(screen.getByRole('radio', { name: 'Months' }).getAttribute('aria-checked')).toBe('true')
    expect(screen.getByText('Aug 2026')).toBeTruthy()
    expect(screen.getByText('Jan 2027')).toBeTruthy()
    expect(document.querySelectorAll('.kit-time__todaymark')).toHaveLength(1)
    expect(document.querySelector('[data-line="today"]')).toBeTruthy()
  })

  it('offers all four scales, and keeps the middle on each', () => {
    widen()
    const onView = vi.fn()
    render(<Axis onView={onView} />)
    for (const [word, unit] of [['Quarters', /^Q/], ['Years', /^\d{4}$/]] as const) {
      fireEvent.click(screen.getByRole('radio', { name: word }))
      expect(screen.getByRole('radio', { name: word }).getAttribute('aria-checked')).toBe('true')
      expect(document.querySelector('.kit-time__cell')?.textContent).toMatch(unit)
    }
    fireEvent.click(screen.getByRole('radio', { name: 'Weeks' }))
    expect(onView.mock.lastCall?.[0].days).toBe(84)
  })

  it('comes back to today, and fits everything with a date', () => {
    widen()
    const onView = vi.fn()
    render(<Axis onView={onView} view={{ start: '2020-01-01', days: 365 }} />)
    fireEvent.click(screen.getByRole('button', { name: 'Today' }))
    expect(onView).toHaveBeenLastCalledWith(openingView(TODAY))
    fireEvent.click(screen.getByRole('button', { name: 'Fit' }))
    const fitted = onView.mock.lastCall?.[0] as AxisView
    expect(fitted.start < '2025-01-01').toBe(true)
    expect(fitted.days).toBeGreaterThan(1460)
  })

  it('does nothing on Fit with nothing that has a date', () => {
    widen()
    const onView = vi.fn()
    render(<Axis onView={onView} dates={[]} />)
    fireEvent.click(screen.getByRole('button', { name: 'Fit' }))
    expect(onView).not.toHaveBeenCalled()
  })

  it('takes a first and a last day, and says when they run backwards rather than move', () => {
    widen()
    const onView = vi.fn()
    render(<Axis onView={onView} />)
    fireEvent.click(screen.getByRole('button', { name: 'Aug 2026 to Jul 2027' }))
    const from = screen.getByLabelText('From')
    fireEvent.change(from, { target: { value: '2027-01-01' } })
    expect(onView).toHaveBeenLastCalledWith({ start: '2027-01-01', days: expect.any(Number) })
    const calls = onView.mock.calls.length
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-12-01' } })
    expect(screen.getByRole('alert').textContent).toBe('The last day comes before the first.')
    expect(onView.mock.calls.length).toBe(calls)
  })
})

describe('moving along it', () => {
  it('zooms on ⌘ or Ctrl with the wheel, about the day under the pointer', () => {
    widen()
    const onView = vi.fn()
    const { container } = render(<Axis onView={onView} view={{ start: '2027-01-01', days: 400 }} />)
    fireEvent.wheel(container.querySelector('.kit-time')!, { deltaY: -120, ctrlKey: true, clientX: 300 })
    const zoomed = onView.mock.lastCall?.[0] as AxisView
    expect(zoomed.days).toBeLessThan(400)
    // The pointer was at the ruler's left edge, so the first day stays.
    expect(zoomed.start).toBe('2027-01-01')
  })

  it('scrolls on Shift and the wheel and on a sideways swipe, and lets a plain wheel go to the page', () => {
    widen(1000)
    const onView = vi.fn()
    const { container } = render(<Axis onView={onView} view={{ start: '2027-01-01', days: 100 }} />)
    const axis = container.querySelector('.kit-time')!
    expect(fireEvent.wheel(axis, { deltaY: 100, shiftKey: true })).toBe(false)
    expect(onView).toHaveBeenLastCalledWith({ start: '2027-01-11', days: 100 })
    fireEvent.wheel(axis, { deltaX: 100 })
    expect(onView).toHaveBeenLastCalledWith({ start: '2027-01-21', days: 100 })
    onView.mockClear()
    expect(fireEvent.wheel(axis, { deltaY: 100 })).toBe(true)
    expect(onView).not.toHaveBeenCalled()
  })

  it('keeps a swipe’s small pieces until they come to a day', () => {
    widen(1000)
    const onView = vi.fn()
    const { container } = render(<Axis onView={onView} view={{ start: '2027-01-01', days: 100 }} />)
    const axis = container.querySelector('.kit-time')!
    fireEvent.wheel(axis, { deltaX: 6 })
    expect(onView).not.toHaveBeenCalled()
    fireEvent.wheel(axis, { deltaX: 6 })
    expect(onView).toHaveBeenLastCalledWith({ start: '2027-01-02', days: 100 })
  })

  it('takes ⌘ + − 0 and ⇧ 1 like every canvas, and the arrows on the ruler', () => {
    widen(1000)
    const onView = vi.fn()
    const { container } = render(<Axis onView={onView} view={{ start: '2020-01-01', days: 400 }} />)
    fireEvent.pointerEnter(container.querySelector('.kit-time')!, { clientX: 800 })
    fireEvent.keyDown(document.body, { key: '=', metaKey: true })
    expect(onView.mock.lastCall?.[0].days).toBe(320)
    fireEvent.keyDown(document.body, { key: '0', ctrlKey: true })
    expect(onView.mock.lastCall?.[0].start).not.toBe('2020-01-01')
    fireEvent.keyDown(document.body, { key: '!', code: 'Digit1', shiftKey: true })
    expect(onView.mock.lastCall?.[0].days).toBeGreaterThan(1460)
    const before = onView.mock.lastCall?.[0] as AxisView
    fireEvent.keyDown(screen.getByRole('group', { name: /Time ruler/ }), { key: 'ArrowRight' })
    expect((onView.mock.lastCall?.[0] as AxisView).start > before.start).toBe(true)
  })
})

describe('the day the board shows', () => {
  it('is a slider with a date, on the ruler', () => {
    widen()
    const onDay = vi.fn()
    render(<Axis day="2027-04-01" onDayChange={onDay} />)
    const handle = screen.getByRole('slider', { name: 'The day the board shows' })
    expect(handle.getAttribute('aria-valuetext')).toBe('1 Apr 2027')
    expect(screen.getByText('Board shows 1 Apr 2027')).toBeTruthy()
    fireEvent.keyDown(handle, { key: 'ArrowRight' })
    expect(onDay).toHaveBeenLastCalledWith('2027-04-02')
    fireEvent.keyDown(handle, { key: 'Escape' })
    expect(onDay).toHaveBeenLastCalledWith(undefined)
    fireEvent.keyDown(handle, { key: 'Home' })
    expect(onDay).toHaveBeenLastCalledWith('2026-08-01')
  })

  it('stops being a look when it lands on today', () => {
    widen()
    const onDay = vi.fn()
    render(<Axis day="2026-11-06" onDayChange={onDay} />)
    fireEvent.keyDown(screen.getByRole('slider'), { key: 'ArrowRight' })
    expect(onDay).toHaveBeenLastCalledWith(undefined)
  })

  it('follows the pointer, and sits on today until it is dragged', () => {
    widen(1000)
    const onDay = vi.fn()
    render(<Axis view={{ start: '2026-10-01', days: 100 }} onDayChange={onDay} />)
    const handle = screen.getByRole('slider')
    expect(handle.getAttribute('aria-valuetext')).toBe('7 Nov 2026')
    expect(handle.dataset.looking).toBeUndefined()
    fireEvent.pointerMove(handle, { buttons: 1, clientX: 300 + 500 })
    expect(onDay).toHaveBeenLastCalledWith('2026-11-20')
  })

  it('pins to the edge it went past while it is out of view; a press brings it back and keeps the scale', () => {
    widen()
    const onView = vi.fn()
    render(<Axis onView={onView} day="2029-04-01" onDayChange={vi.fn()} view={{ start: '2026-01-01', days: 730 }} />)
    expect(screen.queryByRole('slider')).toBeNull()
    const pin = screen.getByRole('button', { name: 'Scroll back to 1 Apr 2029' })
    expect(pin.textContent).toBe('Board 1 Apr 2029 ›')
    expect(pin.dataset.side).toBe('after')
    fireEvent.click(pin)
    expect(onView.mock.lastCall?.[0].days).toBe(730)
    expect(screen.getByRole('slider').getAttribute('aria-valuetext')).toBe('1 Apr 2029')
    expect(screen.queryByRole('button', { name: /Scroll back/ })).toBeNull()
  })

  it('has no handle on an axis that moves nothing behind it', () => {
    widen()
    render(<Axis />)
    expect(screen.queryByRole('slider')).toBeNull()
  })
})

describe('what runs along it', () => {
  it('says a bar runs on past the window, with a chevron at that end and in words', () => {
    widen()
    render(<Axis />)
    const bar = screen.getByRole('img', { name: 'Running, starts before this window' })
    expect(bar.textContent).toBe('‹Running')
    expect(bar.dataset.tone).toBe('running')
  })

  it('draws nothing for a bar wholly outside the window', () => {
    widen()
    render(<Axis><TimeAxisRow label="Old"><TimeBar from="2001-01-01" to="2002-01-01" name="Gone" tone="gone" /></TimeAxisRow></Axis>)
    expect(screen.queryByRole('img', { name: /Gone/ })).toBeNull()
  })

  it('runs on both ways with no ends', () => {
    widen()
    render(<Axis><TimeAxisRow label="Long"><TimeBar name="Live" tone="live" onOpen={() => {}} /></TimeAxisRow></Axis>)
    expect(screen.getByRole('button', { name: 'Live, runs on past both edges' }).textContent).toBe('‹Live›')
  })

  it('opens what a bar stands for', () => {
    widen()
    const onOpen = vi.fn()
    render(<Axis><TimeAxisRow label="Plan"><TimeBar from="2026-09-01" to="2026-12-01" name="Agreed" tone="agreed" onOpen={onOpen} /></TimeAxisRow></Axis>)
    const bar = screen.getByRole('button', { name: 'Agreed' })
    // The row's name is the keyboard's way to the same thing; the bar is for the pointer.
    expect(bar.tabIndex).toBe(-1)
    fireEvent.click(bar)
    expect(onOpen).toHaveBeenCalledOnce()
  })

  it('merges milestones that would sit on each other, with a count', () => {
    widen(960)
    render(
      <Axis>
        <TimeAxisRow label="Plan">
          <TimeMilestones items={[
            { id: 'a', day: '2026-10-01', label: 'One' },
            { id: 'b', day: '2026-10-02', label: 'Two' },
            { id: 'c', day: '2027-02-01', label: 'Three' },
          ]} />
        </TimeAxisRow>
      </Axis>,
    )
    const merged = screen.getByRole('img', { name: /2 milestones/ })
    expect(merged.textContent).toBe('2')
    expect(merged.getAttribute('aria-label')).toContain('One, 1 Oct 2026; Two, 2 Oct 2026')
    expect(screen.getByRole('img', { name: 'Three, 1 Feb 2027' })).toBeTruthy()
  })

  it('folds a group when it is given how', () => {
    const onToggle = vi.fn()
    render(<Axis><TimeAxisGroup label="Connections" count="3, folded" folded onToggle={onToggle} /></Axis>)
    const fold = screen.getByRole('button', { name: /Connections/ })
    expect(fold.getAttribute('aria-expanded')).toBe('false')
    expect(fold.textContent).toBe('Connections 3, folded▸')
    // The caret is held to the count, so a narrow column never leaves it on a line by itself.
    expect(fold.querySelector('.kit-time__groupnowrap .kit-time__groupcaret')).toBeTruthy()
    fireEvent.click(fold)
    expect(onToggle).toHaveBeenCalledOnce()
  })
})

describe('in another language', () => {
  it('says the ruler, the words and the day in it', () => {
    widen()
    render(<LanguageProvider language="de"><Axis day="2027-04-01" onDayChange={vi.fn()} /></LanguageProvider>)
    expect(screen.getByRole('radio', { name: 'Monate' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Heute' })).toBeTruthy()
    expect(screen.getByText(/Board zeigt 1\. Apr\. 2027/)).toBeTruthy()
  })
})

describe('to a screen reader', () => {
  it('has nothing for axe to find', async () => {
    vi.restoreAllMocks()
    widen()
    render(<main><Axis day="2027-04-01" onDayChange={vi.fn()} /></main>)
    await act(async () => { expect(await axeFindings()).toEqual([]) })
    within(document.body).getByRole('slider')
  })
})

describe('a row and its group', () => {
  it('opens from its name, says it is the one read, and a group carries one switch', () => {
    const onOpen = vi.fn()
    const onChange = vi.fn()
    render(
      <TimeAxis view={{ start: '2026-01-01', days: 365 }} onViewChange={() => undefined} today="2026-06-01" names={{ width: 240, onWidth: () => undefined }}>
        <TimeAxisGroup label="Plans" count="2" switched={{ label: 'Hide', on: false, onChange }} />
        <TimeAxisRow label="A plan" onOpen={onOpen} picked="self" />
      </TimeAxis>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'A plan' }))
    expect(onOpen).toHaveBeenCalled()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Hide' }))
    expect(onChange).toHaveBeenCalledWith(true)
    expect(screen.getByRole('separator')).toBeTruthy()
  })
})

