// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/** Empty, held, offline and unreadable are told apart, and only empty offers to begin. */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, screen } from '@testing-library/react'
import { axeFindings } from '../../app/testing/axe'
import { renderShell } from '../../app/testing/renderShell'
import { PageState, pageStateOf } from './PageState'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

const FACTS = { reachable: true, answered: true, readable: true, count: 3 }

describe('which state is true', () => {
  it('is nothing to say when there is content', () => {
    expect(pageStateOf(FACTS)).toBeNull()
  })

  it('is empty only after an answer that could be read', () => {
    expect(pageStateOf({ ...FACTS, count: 0 })).toBe('empty')
    expect(pageStateOf({ ...FACTS, count: 0, answered: false })).toBe('loading')
    expect(pageStateOf({ ...FACTS, count: 0, reachable: false })).toBe('offline')
    expect(pageStateOf({ ...FACTS, count: 0, readable: false })).toBe('unreadable')
    expect(pageStateOf({ ...FACTS, count: 0, held: true })).toBe('held')
  })

  it('does not call a server that went away empty, whatever it answered before', () => {
    expect(pageStateOf({ reachable: false, answered: true, readable: true, count: 0 })).toBe('offline')
    expect(pageStateOf({ reachable: false, answered: false, readable: false, count: 0 })).toBe('offline')
  })
})

describe('loading', () => {
  it('says nothing for a second, then a skeleton, past ten seconds words and a way out', () => {
    vi.useFakeTimers()
    const onPress = vi.fn()
    const { container } = renderShell(<PageState state="loading" wayOut={{ label: 'Back to the home', onPress }} />)
    expect(container.querySelector('[data-state="loading"]')?.hasAttribute('data-quiet')).toBe(true)
    expect(screen.queryByRole('status')).toBeNull()
    act(() => { vi.advanceTimersByTime(1_000) })
    expect(screen.getByRole('status').getAttribute('aria-busy')).toBe('true')
    expect(container.querySelector('.kit-state__skeleton')).toBeTruthy()
    expect(screen.queryByRole('button')).toBeNull()
    act(() => { vi.advanceTimersByTime(9_000) })
    expect(screen.getByText('This is taking longer than it should.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Back to the home' }))
    expect(onPress).toHaveBeenCalled()
  })

  it('goes straight to the skeleton for a page that has already waited', () => {
    renderShell(<PageState state="loading" waited={2_000} />)
    expect(screen.getByRole('status')).toBeTruthy()
  })
})

describe('the others', () => {
  it('empty says what this is for and offers one first step', () => {
    const onPress = vi.fn()
    renderShell(<PageState state="empty" title="No decisions here yet" body="A decision record says what was chosen." action={{ label: 'New decision', onPress }} />)
    expect(screen.getByText('No decisions here yet')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'New decision' }))
    expect(onPress).toHaveBeenCalled()
  })

  it('empty offers nothing to a person who cannot do it', () => {
    renderShell(<PageState state="empty" title="No decisions here yet" />)
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('held says what it waits for, with the address, and offers nothing', () => {
    renderShell(<PageState state="held" title="Waiting to be let in" address="architecture.example" />)
    expect(screen.getByRole('status').textContent).toContain('architecture.example')
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('offline says who did not answer and that nothing is lost, and can try now', () => {
    const onRetry = vi.fn()
    renderShell(<PageState state="offline" where="architecture.example" retryIn={12} onRetry={onRetry} />)
    const said = screen.getByRole('alert').textContent
    expect(said).toContain('Cannot reach the server')
    expect(said).toContain('architecture.example did not answer. Nothing of yours is lost. Trying again in 12 s.')
    fireEvent.click(screen.getByRole('button', { name: 'Try now' }))
    expect(onRetry).toHaveBeenCalled()
  })

  it('unreadable says what, and that nothing was changed', () => {
    renderShell(<PageState state="unreadable" what="This scope" onRetry={() => undefined} />)
    expect(screen.getByRole('alert').textContent).toContain('This scope could not be read')
    expect(screen.getByRole('alert').textContent).toContain('What is kept has not been changed.')
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy()
  })

  it('takes its smaller form in a panel', () => {
    const { container } = renderShell(<PageState state="empty" title="T" compact />)
    expect(container.querySelector('[data-compact]')).toBeTruthy()
  })

  it('passes axe, in every state', async () => {
    renderShell(
      <>
        <PageState state="loading" waited={2_000} />
        <PageState state="held" title="H" address="a.example" />
        <PageState state="empty" title="E" action={{ label: 'New', onPress: () => undefined }} />
        <PageState state="offline" onRetry={() => undefined} />
        <PageState state="unreadable" />
      </>,
    )
    expect(await axeFindings()).toEqual([])
  })
})
