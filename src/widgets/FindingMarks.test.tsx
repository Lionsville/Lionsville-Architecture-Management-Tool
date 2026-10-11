// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * A finding marked as intended, on screen: *Mark as intended…* asks why, and
 * may be left without a reason; *Accepted (N)* is folded, each mark with its
 * reason and its day, and *Take back* where the screen can take it back —
 * folded for the session where the shell keeps the folds, and open under a
 * heading where a page has nothing to fold it from.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { axeFindings } from '../app/testing/axe'
import { renderShell } from '../app/testing/renderShell'
import { CHECK_MARK_WORDS } from '../model/checkMarks'
import { AcceptedFindings, MarkAsIntended } from './FindingMarks'
import type { AcceptedFinding } from './FindingMarks'
import { SessionMemoryContext } from './sessionMemory'
import type { SessionMemory } from './sessionMemory'

afterEach(() => cleanup())

const SENTENCE = 'Integration Platform and Billing declare As a service, and no interface runs between them.'

describe('Mark as intended…', () => {
  it('asks why, says what a mark does, and makes it with the reason given on Enter', async () => {
    const onMark = vi.fn()
    renderShell(<MarkAsIntended words={CHECK_MARK_WORDS} sentence={SENTENCE} onMark={onMark} />)
    fireEvent.click(screen.getByRole('button', { name: 'Mark as intended…' }))
    const dialog = await screen.findByRole('dialog', { name: 'Mark as intended' })
    expect(within(dialog).getByTestId('finding-mark-sentence').textContent).toBe(SENTENCE)
    expect(dialog.textContent).toContain('listed under Accepted, where anybody can take it back')
    const reason = within(dialog).getByRole('textbox', { name: 'Why it is meant to be so' })
    expect(document.activeElement).toBe(reason)
    expect(await axeFindings()).toEqual([])
    fireEvent.change(reason, { target: { value: '  A batch file, not modelled  ' } })
    fireEvent.keyDown(reason, { key: 'Enter' })
    expect(onMark).toHaveBeenCalledWith('A batch file, not modelled')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('makes a mark with no reason, and Cancel makes none', async () => {
    const onMark = vi.fn()
    renderShell(<MarkAsIntended words={CHECK_MARK_WORDS} sentence={SENTENCE} onMark={onMark} />)
    fireEvent.click(screen.getByRole('button', { name: 'Mark as intended…' }))
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Cancel' }))
    expect(onMark).not.toHaveBeenCalled()
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    fireEvent.click(screen.getByRole('button', { name: 'Mark as intended…' }))
    fireEvent.click(await screen.findByTestId('finding-mark-confirm'))
    expect(onMark).toHaveBeenCalledWith('')
  })

  it('names the finding it marks where it sits on the finding\'s line', () => {
    renderShell(<MarkAsIntended inline words={CHECK_MARK_WORDS} sentence={SENTENCE} onMark={vi.fn()} />)
    expect(screen.getByRole('button', { name: `Mark as intended… ${SENTENCE}` })).toBeTruthy()
  })
})

const ITEMS: AcceptedFinding[] = [
  { key: 'a', sentence: SENTENCE, reason: 'A batch file, not modelled', on: '2026-10-11' },
  { key: 'b', sentence: 'Integration Platform and Service declare As a service, and no interface runs between them.', on: '2026-10-02' },
]

describe('Accepted (N)', () => {
  it('says nothing where nothing was marked', () => {
    renderShell(<AcceptedFindings items={[]} words={CHECK_MARK_WORDS} />)
    expect(screen.queryByTestId('findings-accepted')).toBeNull()
  })

  it('is folded, and unfolded lists each mark with its reason, its day and Take back where it may be', async () => {
    const back = vi.fn()
    renderShell(<AcceptedFindings items={[{ ...ITEMS[0]!, onTakeBack: back }, ITEMS[1]!]} words={CHECK_MARK_WORDS} />)
    const toggle = screen.getByRole('button', { name: 'Accepted (2)' })
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryAllByTestId('accepted-finding')).toHaveLength(0)
    fireEvent.click(toggle)
    expect(screen.getAllByTestId('accepted-reason').map((one) => one.textContent)).toEqual([
      '“A batch file, not modelled” · marked 11 Oct 2026', 'No reason given · marked 2 Oct 2026',
    ])
    // Only the first may be taken back here.
    expect(screen.getAllByRole('button', { name: /^Take back/ })).toHaveLength(1)
    expect(await axeFindings()).toEqual([])
    fireEvent.click(screen.getByRole('button', { name: `Take back: ${SENTENCE}` }))
    expect(back).toHaveBeenCalledOnce()
  })

  it('is kept open for the session where the shell keeps the folds', () => {
    const kept = new Map<string, ReadonlySet<string>>()
    const memory: SessionMemory = { keep: (key, held) => kept.set(key, held), recall: (key) => kept.get(key) }
    const list = () => (
      <SessionMemoryContext.Provider value={memory}>
        <AcceptedFindings items={ITEMS} words={CHECK_MARK_WORDS} remember="map" />
      </SessionMemoryContext.Provider>
    )
    renderShell(list())
    fireEvent.click(screen.getByRole('button', { name: 'Accepted (2)' }))
    cleanup()
    renderShell(list())
    expect(screen.getByRole('button', { name: 'Accepted (2)' }).getAttribute('aria-expanded')).toBe('true')
  })

  it('is open under a heading where a page has nothing to fold it from', () => {
    renderShell(<AcceptedFindings unfolded items={ITEMS} words={CHECK_MARK_WORDS} />)
    expect(screen.getByRole('heading', { name: 'Accepted (2)' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Accepted (2)' })).toBeNull()
    expect(screen.getAllByTestId('accepted-finding')).toHaveLength(2)
  })
})
