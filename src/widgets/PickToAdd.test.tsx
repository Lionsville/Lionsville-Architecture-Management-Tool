// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * One thing picked out of a long list: the *+* opens a field that takes the
 * cursor, the list is grouped and narrows as a person types, Enter picks,
 * Escape puts it away and gives the *+* the focus back.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { axeFindings } from '../app/testing/axe'
import { renderShell } from '../app/testing/renderShell'
import { PickToAdd, pickMatches } from './PickToAdd'
import type { PickOption } from './PickToAdd'

afterEach(() => cleanup())

const OPTIONS: PickOption[] = [
  { id: 'shipping', label: 'Shipping', group: 'Domain', note: 'filed in Shipping' },
  { id: 'parcels', label: 'Parcel & Freight', group: 'Cluster', note: 'filed in Shipping' },
  { id: 'data', label: 'Data & Integration', group: 'Cluster', note: 'filed in the organisation' },
  { id: 'webshop', label: 'Webshop', group: 'Team', note: 'serves one domain', disabled: true },
]

function mount(onPick = vi.fn()) {
  renderShell(<PickToAdd options={OPTIONS} label="+ Unit" field="Find a unit" nothing="No unit by that name" onPick={onPick} testId="pick" />)
  return onPick
}

describe('picking one thing to add', () => {
  it('opens a field in place of the +, its list grouped in the order given, each row saying where', async () => {
    mount()
    fireEvent.click(screen.getByRole('button', { name: '+ Unit' }))
    const field = screen.getByRole('combobox', { name: 'Find a unit' })
    expect(document.activeElement).toBe(field)
    const list = await screen.findByRole('listbox')
    expect(within(list).getAllByRole('option').map((one) => one.textContent)).toEqual([
      'Shippingfiled in Shipping', 'Parcel & Freightfiled in Shipping', 'Data & Integrationfiled in the organisation',
      'Webshopserves one domain',
    ])
    expect(list.textContent).toMatch(/^Domain.*Cluster.*Team/)
    expect(within(list).getByRole('option', { name: /Webshop/ }).getAttribute('aria-disabled')).toBe('true')
    expect(await axeFindings()).toEqual([])
  })

  it('narrows as a person types, by the name or where it is, and picks with the keyboard', async () => {
    const onPick = mount()
    fireEvent.click(screen.getByRole('button', { name: '+ Unit' }))
    const field = screen.getByRole('combobox', { name: 'Find a unit' })
    fireEvent.change(field, { target: { value: 'organisation' } })
    await waitFor(() => expect(screen.getAllByRole('option').map((one) => one.textContent)).toEqual(['Data & Integrationfiled in the organisation']))
    fireEvent.keyDown(field, { key: 'ArrowDown' })
    fireEvent.keyDown(field, { key: 'Enter' })
    expect(onPick).toHaveBeenCalledWith('data')
    expect(screen.queryByRole('combobox')).toBeNull()
  })

  it('matches word by word, in any order, across the name and where it is', async () => {
    expect(pickMatches(OPTIONS, 'shipping parcel').map((one) => one.id)).toEqual(['parcels'])
    expect(pickMatches(OPTIONS, 'parcel shipping').map((one) => one.id)).toEqual(['parcels'])
    expect(pickMatches(OPTIONS, 'data org').map((one) => one.id)).toEqual(['data'])
    expect(pickMatches(OPTIONS, '  ').map((one) => one.id)).toEqual(['shipping', 'parcels', 'data', 'webshop'])
    expect(pickMatches(OPTIONS, 'parcel nowhere')).toEqual([])
    mount()
    fireEvent.click(screen.getByRole('button', { name: '+ Unit' }))
    fireEvent.change(screen.getByRole('combobox', { name: 'Find a unit' }), { target: { value: 'freight parcel' } })
    await waitFor(() => expect(screen.getAllByRole('option').map((one) => one.textContent)).toEqual(['Parcel & Freightfiled in Shipping']))
  })

  it('says so where nothing matches, and Escape puts the field away with the focus back on the +', async () => {
    const onPick = mount()
    fireEvent.click(screen.getByRole('button', { name: '+ Unit' }))
    const field = screen.getByRole('combobox', { name: 'Find a unit' })
    fireEvent.change(field, { target: { value: 'nothing like it' } })
    expect(await screen.findByText('No unit by that name')).toBeTruthy()
    fireEvent.keyDown(field, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('combobox')).toBeNull())
    expect(document.activeElement).toBe(screen.getByRole('button', { name: '+ Unit' }))
    expect(onPick).not.toHaveBeenCalled()
  })
})
