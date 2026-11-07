// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV
// @vitest-environment jsdom

/**
 * The help page as a person reads it: the document in the language asked for,
 * the place the address names, the search and its keys, the language changed
 * in place — and axe over all of it.
 */
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { axeFindings } from '../../app/testing/axe'
import { HelpApp } from './HelpApp'

beforeAll(() => {
  // jsdom draws nothing, so it scrolls nothing either.
  Element.prototype.scrollIntoView = function scrollIntoView() {}
})

afterEach(() => {
  cleanup()
  history.replaceState(null, '', '/help/')
})

const opened = async () => {
  await screen.findByRole('heading', { level: 2, name: 'Getting started' }, { timeout: 10_000 })
}

describe('the help page', () => {
  it('reads as one document with its contents beside it, and axe finds nothing', async () => {
    render(<HelpApp initial="en" />)
    await opened()
    expect(screen.getByRole('navigation', { name: 'Contents' })).toBeTruthy()
    expect(screen.getByRole('heading', { level: 3, name: 'Go back' })).toBeTruthy()
    expect(document.title).toContain('Help')
    expect(await axeFindings(document.body)).toEqual([])
  }, 60_000)

  it('opens at the section its address names, with the focus on its heading', async () => {
    history.replaceState(null, '', '/help/?lang=de#frame.back')
    render(<HelpApp initial="de" />)
    await waitFor(() => expect(document.activeElement?.textContent).toBe('Zurück'), { timeout: 10_000 })
    expect(document.documentElement.lang).toBe('de')
    const contents = within(screen.getByRole('navigation', { name: 'Inhalt' }))
    expect(contents.getByRole('link', { name: 'Zurück' }).getAttribute('aria-current')).toBe('location')
  }, 30_000)

  it('searches as you type, goes to the first hit on Enter and clears on Escape', async () => {
    render(<HelpApp initial="en" />)
    await opened()
    fireEvent.keyDown(window, { key: '/' })
    const search = screen.getByTestId('help-search')
    expect(document.activeElement).toBe(search)
    fireEvent.change(search, { target: { value: 'go back' } })
    expect(await screen.findByRole('link', { name: 'Go back' })).toBeTruthy()
    expect(screen.getByText(/places say “go back”|One place says “go back”/)).toBeTruthy()
    fireEvent.change(search, { target: { value: 'zzqqxx' } })
    expect(screen.getByText(/zzqqxx/)).toBeTruthy()
    fireEvent.keyDown(search, { key: 'Escape' })
    expect((search as HTMLInputElement).value).toBe('')
    fireEvent.change(search, { target: { value: 'go back' } })
    act(() => { fireEvent.keyDown(search, { key: 'Enter' }) })
    expect(location.hash).toBe('#frame.back')
    expect((search as HTMLInputElement).value).toBe('')
  }, 30_000)

  it('changes language in place, and says so in the address', async () => {
    render(<HelpApp initial="en" />)
    await opened()
    fireEvent.change(screen.getByTestId('help-language'), { target: { value: 'nl' } })
    await screen.findByRole('heading', { level: 2, name: 'Beginnen' }, { timeout: 10_000 })
    expect(document.documentElement.lang).toBe('nl')
    expect(new URL(location.href).searchParams.get('lang')).toBe('nl')
  }, 30_000)
})
