// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useState } from 'react'
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderShell } from '../../app/testing/renderShell'
import { DraftArea, DraftQuestion, draftHeld, leaveWithDrafts, useDraft, useDraftSurface, watchDrafts } from './drafts'
import type { DraftSurface } from './drafts'

afterEach(() => cleanup())

function Box({ start = '' }: { start?: string }) {
  const [text, setText] = useState(start)
  useDraft(text.trim() !== '')
  return <textarea aria-label="Write a comment" value={text} onChange={(event) => setText(event.target.value)} />
}

describe('leaving with a draft', () => {
  it('leaves at once where nothing is written', () => {
    renderShell(<><DraftQuestion /><Box /></>)
    const go = vi.fn()
    act(() => leaveWithDrafts(go))
    expect(go).toHaveBeenCalledTimes(1)
  })

  it('asks first where something is written, and Keep writing stays', () => {
    renderShell(<><DraftQuestion /><Box start="Who owns this?" /></>)
    expect(draftHeld()).toBe(true)
    const go = vi.fn()
    act(() => leaveWithDrafts(go))
    expect(go).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Keep writing' }))
    expect(go).not.toHaveBeenCalled()
    expect((screen.getByLabelText('Write a comment') as HTMLTextAreaElement).value).toBe('Who owns this?')
  })

  it('leaves on Leave and drop it', () => {
    renderShell(<><DraftQuestion /><Box start="Who owns this?" /></>)
    const go = vi.fn()
    act(() => leaveWithDrafts(go))
    fireEvent.click(screen.getByTestId('draft-leave'))
    expect(go).toHaveBeenCalledTimes(1)
  })

  it('lets go of the draft when the box goes', () => {
    const { unmount } = renderShell(<Box start="Who owns this?" />)
    expect(draftHeld()).toBe(true)
    unmount()
    expect(draftHeld()).toBe(false)
  })

  it('asks one question in one order: Keep writing, focused, then Leave and drop it in the danger ink', () => {
    renderShell(<><DraftQuestion /><Box start="Who owns this?" /></>)
    act(() => leaveWithDrafts(() => {}))
    const answers = within(screen.getByTestId('draft-question')).getAllByRole('button').map((one) => one.textContent)
    expect(answers.slice(-2)).toEqual(['Keep writing', 'Leave and drop it'])
    expect(document.activeElement?.textContent).toBe('Keep writing')
  })
})

describe('Keep writing', () => {
  it('puts the focus back in the box written in, which an Escape had left', async () => {
    renderShell(<><DraftQuestion /><Box /><button type="button">Elsewhere</button></>)
    const box = screen.getByLabelText('Write a comment')
    box.focus()
    fireEvent.input(box, { target: { value: 'Who owns this?' } })
    fireEvent.change(box, { target: { value: 'Who owns this?' } })
    screen.getByRole('button', { name: 'Elsewhere' }).focus()
    act(() => leaveWithDrafts(() => {}))
    fireEvent.click(screen.getByRole('button', { name: 'Keep writing' }))
    await waitFor(() => expect(document.activeElement).toBe(box))
  })

  it('leaves the focus where it was on Leave and drop it', async () => {
    renderShell(<><DraftQuestion /><Box /><button type="button">Elsewhere</button></>)
    const box = screen.getByLabelText('Write a comment')
    fireEvent.input(box, { target: { value: 'Who owns this?' } })
    fireEvent.change(box, { target: { value: 'Who owns this?' } })
    const elsewhere = screen.getByRole('button', { name: 'Elsewhere' })
    elsewhere.focus()
    act(() => leaveWithDrafts(() => {}))
    fireEvent.click(screen.getByTestId('draft-leave'))
    await waitFor(() => expect(document.activeElement).toBe(elsewhere))
  })
})

describe('whether a draft is held, for a host that closes the window', () => {
  it('is said at once, as a box starts and stops holding one, and when one is left', () => {
    const said: boolean[] = []
    const stop = watchDrafts((holding) => { said.push(holding) })
    const { unmount } = renderShell(<><DraftQuestion /><Box start="Who owns this?" /></>)
    act(() => leaveWithDrafts(() => undefined))
    fireEvent.click(screen.getByTestId('draft-leave'))
    unmount()
    stop()
    expect(said).toEqual([false, true, false, false])
  })
})

describe('a surface left on its own', () => {
  /** A page with a comment on it, and a plan over it: two surfaces, the plan's handed out to be left. */
  function Stacked({ onPlan }: { onPlan: (plan: DraftSurface) => void }) {
    const page = useDraftSurface()
    const plan = useDraftSurface()
    onPlan(plan)
    return (
      <>
        <DraftQuestion />
        <DraftArea surface={page}><Box start="Draft two" /></DraftArea>
        <DraftArea surface={plan}><p>The plan</p></DraftArea>
      </>
    )
  }

  it('does not ask where the draft is on another surface, and the draft stays guarded', () => {
    let plan: DraftSurface | undefined
    renderShell(<Stacked onPlan={(held) => { plan = held }} />)
    const go = vi.fn()
    act(() => leaveWithDrafts(go, undefined, plan))
    expect(go).toHaveBeenCalledTimes(1)
    expect(screen.queryByTestId('draft-question')).toBeNull()
    // The next way out of the place still asks: nothing was forgotten.
    const away = vi.fn()
    act(() => leaveWithDrafts(away))
    expect(away).not.toHaveBeenCalled()
    expect(screen.getByTestId('draft-question')).toBeTruthy()
  })

  it('drops only the drafts of the surface that goes on Leave and drop it', () => {
    function Two({ onSurface }: { onSurface: (preview: DraftSurface) => void }) {
      const preview = useDraftSurface()
      onSurface(preview)
      return (
        <>
          <DraftQuestion />
          <Box start="The form's title" />
          <DraftArea surface={preview}><Box start="A comment" /></DraftArea>
        </>
      )
    }
    let preview: DraftSurface | undefined
    renderShell(<Two onSurface={(held) => { preview = held }} />)
    const go = vi.fn()
    act(() => leaveWithDrafts(go, undefined, preview))
    fireEvent.click(screen.getByTestId('draft-leave'))
    expect(go).toHaveBeenCalledTimes(1)
    // The form beside the preview is still written and still held.
    expect(draftHeld()).toBe(true)
    expect(draftHeld(preview)).toBe(false)
    const away = vi.fn()
    act(() => leaveWithDrafts(away))
    expect(away).not.toHaveBeenCalled()
  })

  it('asks about a draft on a surface held inside the one that goes', () => {
    function Nested({ onPage }: { onPage: (page: DraftSurface) => void }) {
      const page = useDraftSurface()
      onPage(page)
      return (
        <>
          <DraftQuestion />
          <DraftArea surface={page}><Inner /></DraftArea>
        </>
      )
    }
    function Inner() {
      const record = useDraftSurface()
      return <DraftArea surface={record}><Box start="A comment" /></DraftArea>
    }
    let page: DraftSurface | undefined
    renderShell(<Nested onPage={(held) => { page = held }} />)
    const go = vi.fn()
    act(() => leaveWithDrafts(go, undefined, page))
    expect(go).not.toHaveBeenCalled()
    expect(screen.getByTestId('draft-question')).toBeTruthy()
  })
})
