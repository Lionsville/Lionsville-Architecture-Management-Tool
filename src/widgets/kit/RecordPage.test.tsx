// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/** One head, one scroll, a named way back, and an outline only once a record is long. */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, within } from '@testing-library/react'
import { axeFindings } from '../../app/testing/axe'
import { renderShell } from '../../app/testing/renderShell'
import { RecordPage } from './RecordPage'

afterEach(() => cleanup())

const sections = (count: number) => Array.from({ length: count }, (_, index) => ({
  id: `s${index}`, heading: `Section ${index}`, children: <p>Body {index}</p>,
}))

describe('the record page', () => {
  it('says the way back by name, the code, the title and one sentence', () => {
    const onPress = vi.fn()
    renderShell(<RecordPage back={{ label: 'Decisions', onPress }} code="ADR-0001" title="One price source" status="Accepted 10 Feb 2026." sections={sections(1)} />)
    fireEvent.click(screen.getByRole('button', { name: 'Decisions' }))
    expect(onPress).toHaveBeenCalled()
    expect(screen.getByText('ADR-0001')).toBeTruthy()
    expect(screen.getByRole('heading', { level: 1, name: 'One price source' })).toBeTruthy()
    expect(screen.getByText('Accepted 10 Feb 2026.')).toBeTruthy()
  })

  it('keeps its sections in order in one scroll under the head', () => {
    const { container } = renderShell(<RecordPage title="T" sections={sections(3)} band={<div>A band</div>} />)
    const scroll = screen.getByRole('region', { name: 'The record' })
    expect(within(scroll).getAllByRole('heading', { level: 2 }).map((one) => one.textContent)).toEqual(['Section 0', 'Section 1', 'Section 2'])
    expect(container.querySelector('.kit-record__head')?.contains(scroll)).toBe(false)
    expect(scroll.contains(screen.getByText('A band'))).toBe(false)
  })

  it('has an outline only for a long one', () => {
    const { rerender } = renderShell(<RecordPage title="T" sections={sections(3)} />)
    expect(screen.queryByRole('navigation')).toBeNull()
    rerender(<RecordPage title="T" sections={sections(4)} />)
    expect(screen.getByRole('navigation', { name: 'On this page' })).toBeTruthy()
    rerender(<RecordPage title="T" sections={sections(2)} outlineFrom={2} />)
    expect(screen.getByRole('navigation')).toBeTruthy()
  })

  it('goes to a section from the outline, focus and all, and says where you are', () => {
    renderShell(<RecordPage title="T" sections={sections(4)} />)
    const nav = screen.getByRole('navigation')
    const item = within(nav).getByRole('button', { name: 'Section 2' })
    fireEvent.click(item)
    expect(document.activeElement).toBe(screen.getByRole('heading', { level: 2, name: 'Section 2' }))
    expect(item.getAttribute('aria-current')).toBe('location')
    expect(within(nav).getByRole('button', { name: 'Section 0' }).getAttribute('aria-current')).toBeNull()
  })

  it('marks the last section once the scroll reaches its end, short as it is', () => {
    renderShell(<RecordPage title="T" sections={sections(4)} />)
    const scroll = screen.getByRole('region', { name: 'The record' })
    Object.defineProperties(scroll, { scrollHeight: { value: 1000 }, clientHeight: { value: 400 } })
    scroll.scrollTop = 600
    fireEvent.scroll(scroll)
    expect(within(screen.getByRole('navigation')).getByRole('button', { name: 'Section 3' }).getAttribute('aria-current')).toBe('location')
  })

  it('asks before the way back drops a draft on the page', async () => {
    const { DraftQuestion, useDraft } = await import('./drafts')
    const onPress = vi.fn()
    function Draft() { useDraft(true); return null }
    renderShell(<><DraftQuestion /><Draft /><RecordPage back={{ label: 'Roadmap', onPress }} title="T" sections={sections(1)} /></>)
    fireEvent.click(screen.getByRole('button', { name: 'Roadmap' }))
    expect(onPress).not.toHaveBeenCalled()
    fireEvent.click(screen.getByTestId('draft-leave'))
    expect(onPress).toHaveBeenCalledOnce()
  })

  it('passes axe', async () => {
    renderShell(<RecordPage back={{ label: 'Back', onPress: () => undefined }} title="T" code="X" status="S" actions={<button type="button">More</button>} sections={sections(5)} />)
    expect(await axeFindings()).toEqual([])
  })
})

describe('a record with a long outline', () => {
  const sections = [
    { id: 'a', heading: 'First', group: 'Moves', count: 3, children: 'one' },
    { id: 'b', heading: 'Second', group: 'Moves', folded: true, children: 'two' },
    { id: 'c', heading: 'Text', group: 'Document', within: [{ id: 'goal', label: 'Goal', onPress: () => undefined }], children: 'three' },
    { id: 'd', heading: 'Comments', group: 'Around', headless: true, children: 'four' },
  ]

  it('groups its lines, counts them, leaves a folded section out until it is asked for', () => {
    const onSection = vi.fn()
    renderShell(<RecordPage title="A record" sections={sections} onSection={onSection} />)
    const outline = screen.getByRole('navigation')
    expect(within(outline).getByText('Moves')).toBeTruthy()
    expect(within(outline).getByRole('button', { name: 'First3' })).toBeTruthy()
    expect(within(outline).getByRole('button', { name: 'Goal' })).toBeTruthy()
    expect(within(outline).queryByRole('button', { name: 'Text' })).toBeNull()
    expect(screen.queryByRole('region', { name: 'Second' })).toBeNull()
    fireEvent.click(within(outline).getByRole('button', { name: 'Second' }))
    expect(onSection).toHaveBeenCalledWith('b')
  })

  it('does not say a heading a section says itself', () => {
    renderShell(<RecordPage title="A record" sections={sections} />)
    expect(screen.getByRole('region', { name: 'Comments' })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Comments' })).toBeNull()
  })

  it('renames on a press where it may, and is only a heading where it may not', () => {
    const onRename = vi.fn()
    renderShell(<RecordPage title="A record" sections={sections} onRename={onRename} />)
    fireEvent.click(screen.getByRole('button', { name: /A record/ }))
    const field = screen.getByRole('textbox')
    fireEvent.change(field, { target: { value: 'Another' } })
    fireEvent.keyDown(field, { key: 'Enter' })
    expect(onRename).toHaveBeenCalledWith('Another')
  })
})
