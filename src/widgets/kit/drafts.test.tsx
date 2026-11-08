// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useState } from 'react'
import { act, cleanup, fireEvent, screen } from '@testing-library/react'
import { renderShell } from '../../app/testing/renderShell'
import { DraftQuestion, draftHeld, leaveWithDrafts, useDraft } from './drafts'

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
})
