// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom

import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, within } from '@testing-library/react'
import { axeFindings } from '../../app/testing/axe'
import { renderShell } from '../../app/testing/renderShell'
import { Select } from './Select'
import type { SelectOption } from './Select'
import { focusLeaves } from './Surface'

afterEach(() => cleanup())

const OPTIONS: SelectOption[] = [
  { value: '', label: 'All units' },
  { value: 'north', label: 'Depot North', group: 'Depots' },
  { value: 'south', label: 'Depot South', group: 'Depots' },
  { value: 'office', label: 'Head office' },
]

function Live({ onChange, onBlur }: { onChange?: (value: string) => void; onBlur?: () => void }) {
  const [value, setValue] = useState('')
  return <Select aria-label="Unit" options={OPTIONS} value={value} onBlur={onBlur} onChange={(next) => { setValue(next); onChange?.(next) }} />
}

const box = () => screen.getByRole('combobox', { name: 'Unit' })
const list = () => screen.getByRole('listbox', { name: 'Unit' })

describe('Select', () => {
  it('is a button naming the choice, with no browser select under it', async () => {
    renderShell(<Live />)
    expect(box().tagName).toBe('BUTTON')
    expect(box().textContent).toBe('All units')
    expect((box() as HTMLButtonElement).value).toBe('')
    expect(document.querySelector('select')).toBeNull()
    expect(await axeFindings()).toEqual([])
  })

  it('opens a list of the choices, the one held ticked, under its headings, and takes one', async () => {
    const chose = vi.fn()
    renderShell(<Live onChange={chose} />)
    const held = box()
    fireEvent.click(held)
    expect(held.getAttribute('aria-expanded')).toBe('true')
    expect(within(list()).getAllByRole('option').map((one) => one.textContent)).toEqual(['All units', 'Depot North', 'Depot South', 'Head office'])
    expect(within(list()).getByRole('option', { name: 'All units' }).getAttribute('aria-selected')).toBe('true')
    expect(within(list()).getByText('Depots')).toBeTruthy()
    expect(await axeFindings()).toEqual([])
    fireEvent.click(within(list()).getByRole('option', { name: 'Depot South' }))
    expect(chose).toHaveBeenCalledWith('south')
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(held.textContent).toBe('Depot South')
  })

  it('says nothing when the choice taken is the one held', () => {
    const chose = vi.fn()
    renderShell(<Live onChange={chose} />)
    fireEvent.click(box())
    fireEvent.click(within(list()).getByRole('option', { name: 'All units' }))
    expect(chose).not.toHaveBeenCalled()
  })

  it('is walked by the keys a select has: arrows, a letter, Enter, and Escape leaves it as it was', () => {
    const chose = vi.fn()
    renderShell(<Live onChange={chose} />)
    fireEvent.keyDown(box(), { key: 'ArrowDown' })
    expect(document.activeElement).toBe(list())
    fireEvent.keyDown(list(), { key: 'ArrowDown' })
    expect(list().getAttribute('aria-activedescendant')).toBe(within(list()).getByRole('option', { name: 'Depot North' }).id)
    fireEvent.keyDown(list(), { key: 'h' })
    expect(list().getAttribute('aria-activedescendant')).toBe(within(list()).getByRole('option', { name: 'Head office' }).id)
    fireEvent.keyDown(list(), { key: 'End' })
    fireEvent.keyDown(list(), { key: 'Home' })
    fireEvent.keyDown(list(), { key: 'Escape' })
    expect(chose).not.toHaveBeenCalled()
    fireEvent.keyDown(box(), { key: 'Enter' })
    fireEvent.keyDown(list(), { key: 'ArrowDown' })
    fireEvent.keyDown(list(), { key: 'Enter' })
    expect(chose).toHaveBeenCalledWith('north')
  })

  it('does not count its own list taking the focus as leaving, to itself or to what holds it', () => {
    const left = vi.fn()
    const owner = vi.fn()
    renderShell(<div onBlur={(event) => { if (focusLeaves(event)) owner() }}><Live onBlur={left} /><Select aria-label="Other" options={OPTIONS} value="" onChange={() => {}} /></div>)
    box().focus()
    fireEvent.click(screen.getByRole('combobox', { name: 'Other' }))
    expect(left).toHaveBeenCalledTimes(1)
    expect(owner).not.toHaveBeenCalled()
  })
})
