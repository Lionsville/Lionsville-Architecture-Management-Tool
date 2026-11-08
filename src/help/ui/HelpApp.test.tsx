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

  it('lists a task a control\'s label already says under Other things you can do, and opens it when it is gone to', async () => {
    history.replaceState(null, '', '/help/?lang=en#obs-delete')
    render(<HelpApp initial="en" />)
    await waitFor(() => expect(document.activeElement?.textContent).toBe('Delete a record'), { timeout: 10_000 })
    expect((document.getElementById('obs-delete') as HTMLDetailsElement).open).toBe(true)
    expect((document.getElementById('obs-copy-link') as HTMLDetailsElement).open).toBe(false)
    const contents = within(screen.getByRole('navigation', { name: 'Contents' }))
    expect(contents.queryByRole('link', { name: 'Delete a record' })).toBeNull()
    expect(contents.getByRole('link', { name: 'Other things you can do' }).getAttribute('aria-current')).toBe('location')
    // Still found by a search, by its name.
    fireEvent.change(screen.getByTestId('help-search'), { target: { value: 'copy a link to a record' } })
    expect(await screen.findByRole('link', { name: 'Copy a link to a record' })).toBeTruthy()
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

  it('goes to a hit in the folded reference on Enter, and the page stays', async () => {
    render(<HelpApp initial="en" />)
    await opened()
    const search = screen.getByTestId('help-search') as HTMLInputElement
    fireEvent.change(search, { target: { value: 'future diagram' } })
    await waitFor(() => expect(document.querySelector('#help-hits a')).toBeTruthy())
    const first = document.querySelector('#help-hits a') as HTMLAnchorElement
    const id = first.getAttribute('href')?.slice(1) ?? ''
    expect(id).toContain('~')
    act(() => { fireEvent.keyDown(search, { key: 'Enter' }) })
    await act(async () => { window.dispatchEvent(new HashChangeEvent('hashchange')); await Promise.resolve() })
    expect(location.hash).toBe(`#${id}`)
    expect(search.value).toBe('')
    await waitFor(() => expect(document.activeElement?.id).toBe(id))
    expect(document.activeElement?.closest('details')?.open).toBe(true)
    expect(screen.getByRole('heading', { level: 2, name: 'Getting started' })).toBeTruthy()
  }, 30_000)

  it('opens on Getting started, the tasks before the reference, and a place in the reference unfolded', async () => {
    history.replaceState(null, '', '/help/?lang=en#board~2')
    render(<HelpApp initial="en" />)
    await waitFor(() => expect(document.activeElement?.tagName).toBe('H4'), { timeout: 10_000 })
    const headings = screen.getAllByRole('heading', { level: 2 }).map((one) => one.textContent)
    expect(headings[0]).toBe('Getting started')
    expect(headings.at(-1)).toBe('Reference: how it works')
    expect(document.activeElement?.closest('details')?.open).toBe(true)
    const contents = within(screen.getByRole('navigation', { name: 'Contents' }))
    const links = contents.getAllByRole('link').map((one) => one.textContent)
    expect(links[0]).toBe('Getting started')
    expect(links.indexOf('Reference: how it works')).toBeGreaterThan(links.indexOf('Working with an agent'))
    expect(contents.getByRole('link', { name: document.activeElement?.textContent ?? '' }).getAttribute('aria-current')).toBe('location')
  }, 30_000)

  it('opens at a place in the folded reference in another language, as a live switch of the app\'s language reloads it', async () => {
    history.replaceState(null, '', '/help/?lang=nl#board~2')
    render(<HelpApp initial="nl" />)
    await waitFor(() => expect(document.activeElement?.id).toBe('board~2'), { timeout: 10_000 })
    expect(document.activeElement?.closest('details')?.open).toBe(true)
    expect(screen.getByRole('heading', { level: 2, name: 'Beginnen' })).toBeTruthy()
  }, 30_000)

  it('changes language in place, and says so in the address', async () => {
    render(<HelpApp initial="en" />)
    await opened()
    fireEvent.change(screen.getByTestId('help-language'), { target: { value: 'nl' } })
    await screen.findByRole('heading', { level: 2, name: 'Beginnen' }, { timeout: 10_000 })
    expect(document.documentElement.lang).toBe('nl')
    expect(new URL(location.href).searchParams.get('lang')).toBe('nl')
  }, 30_000)

  it('leaves the search when the language changes or a place is chosen', async () => {
    render(<HelpApp initial="en" />)
    await opened()
    const search = screen.getByTestId('help-search') as HTMLInputElement
    fireEvent.change(search, { target: { value: 'zzqqxx' } })
    fireEvent.change(screen.getByTestId('help-language'), { target: { value: 'de' } })
    expect(search.value).toBe('')
    fireEvent.change(search, { target: { value: 'zzqqxx' } })
    act(() => { location.hash = '#frame.back'; window.dispatchEvent(new HashChangeEvent('hashchange')) })
    expect(search.value).toBe('')
  }, 30_000)
})
