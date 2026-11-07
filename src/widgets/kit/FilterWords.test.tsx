// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/** Filters at rest are one button; what is on is said in words, each with its way off. */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { useState } from 'react'
import { axeFindings } from '../../app/testing/axe'
import { renderShell } from '../../app/testing/renderShell'
import { FilterWords } from './FilterWords'
import type { FilterField, FilterWordsProps } from './FilterWords'

afterEach(() => cleanup())

const FIELDS: FilterField[] = [
  { id: 'life', label: 'Lifecycle', options: [{ value: 'live', label: 'Live', count: 9 }, { value: 'retiring', label: 'Retiring' }] },
  { id: 'owner', label: 'Owner', options: [{ value: 'none', label: 'Nobody', word: 'No owner' }] },
]

function Host(props: Partial<FilterWordsProps>) {
  const [find, setFind] = useState('')
  const [filters, setFilters] = useState<Readonly<Record<string, readonly string[]>>>({})
  return <FilterWords find={find} onFind={setFind} fields={FIELDS} filters={filters} onFilters={setFilters} {...props} />
}

describe('filter words', () => {
  it('says an option\'s heading once, and a long list narrows to what was typed', async () => {
    const long: FilterField = {
      id: 'about', label: 'About', narrow: true,
      options: [
        { value: 'a', label: 'Billing', group: 'With records' }, { value: 'b', label: 'Bookings', group: 'With records' },
        { value: 'c', label: 'Customs', group: 'With none' },
      ],
    }
    renderShell(<Host fields={[long]} />)
    fireEvent.click(screen.getByRole('button', { name: 'Filter' }))
    const panel = await screen.findByRole('dialog', { name: 'Filter' })
    expect(within(panel).getAllByText('With records')).toHaveLength(1)
    fireEvent.change(within(panel).getByRole('searchbox'), { target: { value: 'cus' } })
    expect(within(panel).queryByText('Billing')).toBeNull()
    expect(within(panel).getByText('Customs')).toBeTruthy()
  })

  it('at rest is the field and the button, with nothing on', () => {
    renderShell(<Host />)
    expect(screen.getByRole('searchbox', { name: 'Find in this list' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Filter' })).toBeTruthy()
    expect(screen.queryByText('Showing')).toBeNull()
    expect(screen.queryByRole('button', { name: /View/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /Group/ })).toBeNull()
  })

  it('opens one panel, puts the focus in it, says counts only where there are any, and Esc brings it back', async () => {
    renderShell(<Host />)
    screen.getByRole('button', { name: 'Filter' }).focus()
    fireEvent.click(screen.getByRole('button', { name: 'Filter' }))
    const panel = screen.getByRole('dialog', { name: 'Filter' })
    expect(document.activeElement).toBe(within(panel).getByRole('checkbox', { name: /Live/ }))
    expect(within(panel).getByText('9')).toBeTruthy()
    fireEvent.keyDown(panel, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Filter' }))
  })

  it('says what is on in words, each with a named way off, then Clear', async () => {
    renderShell(<Host />)
    fireEvent.click(screen.getByRole('button', { name: 'Filter' }))
    fireEvent.click(screen.getByRole('checkbox', { name: /Retiring/ }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Nobody' }))
    fireEvent.keyDown(screen.getByRole('dialog', { name: 'Filter' }), { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(screen.getByRole('button', { name: 'Filter · 2' })).toBeTruthy()
    expect(screen.getByText('Showing')).toBeTruthy()
    expect(screen.getByText('No owner')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Stop filtering on Lifecycle: Retiring' }))
    expect(screen.queryByText('Retiring')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }))
    expect(screen.queryByText('Showing')).toBeNull()
  })

  it('takes a field out of the state when its last value goes, so the address stays short', () => {
    const onFilters = vi.fn()
    renderShell(<Host filters={{ life: ['live'] }} onFilters={onFilters} />)
    fireEvent.click(screen.getByRole('button', { name: /Stop filtering/ }))
    expect(onFilters).toHaveBeenCalledWith({})
  })

  it('clears the find on Esc only while there is something in it', () => {
    const onFind = vi.fn()
    const outer = vi.fn()
    const { rerender } = renderShell(<div onKeyDown={outer}><FilterWords find="abc" onFind={onFind} /></div>)
    fireEvent.keyDown(screen.getByRole('searchbox'), { key: 'Escape' })
    expect(onFind).toHaveBeenCalledWith('')
    expect(outer).not.toHaveBeenCalled()
    rerender(<div onKeyDown={outer}><FilterWords find="" onFind={onFind} /></div>)
    fireEvent.keyDown(screen.getByRole('searchbox'), { key: 'Escape' })
    expect(outer).toHaveBeenCalledTimes(1)
  })

  it('groups by one choice, none being one of them, and says it on the button', () => {
    const onGroup = vi.fn()
    renderShell(<Host groups={[{ id: 'kept', label: 'Kept in' }]} group="kept" onGroup={onGroup} />)
    fireEvent.click(screen.getByRole('button', { name: /Group: Kept in/ }))
    fireEvent.click(screen.getByRole('radio', { name: 'None' }))
    expect(onGroup).toHaveBeenCalledWith(null)
  })

  it('turns columns on and off, sets the density and resets, under View', () => {
    const onColumns = vi.fn()
    const onDensity = vi.fn()
    const onReset = vi.fn()
    renderShell(
      <Host columns={[{ id: 'a', label: 'Vendor' }, { id: 'b', label: 'Owner' }]} shownColumns={['a']} onColumns={onColumns} density="normal" onDensity={onDensity} onReset={onReset} />,
    )
    fireEvent.click(screen.getByRole('button', { name: /View/ }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Owner' }))
    expect(onColumns).toHaveBeenCalledWith(['a', 'b'])
    fireEvent.click(screen.getByRole('checkbox', { name: 'Vendor' }))
    expect(onColumns).toHaveBeenLastCalledWith([])
    fireEvent.click(screen.getByRole('radio', { name: 'Compact' }))
    expect(onDensity).toHaveBeenCalledWith('compact')
    fireEvent.click(screen.getByText('Reset this list'))
    expect(onReset).toHaveBeenCalled()
  })

  it('says how many are shown only when the list is narrowed', () => {
    const { rerender } = renderShell(<Host shown={{ count: 44, total: 44 }} />)
    expect(screen.queryByRole('status')).toBeNull()
    rerender(<Host shown={{ count: 3, total: 44 }} />)
    expect(screen.getByRole('status').textContent).toBe('3 of 44')
  })

  it('passes axe, at rest with words on and with a panel open', async () => {
    renderShell(<Host filters={{ life: ['live'] }} groups={[{ id: 'k', label: 'Kept' }]} onGroup={() => undefined} onColumns={() => undefined} columns={[{ id: 'a', label: 'A' }]} />)
    expect(await axeFindings()).toEqual([])
    fireEvent.click(screen.getByRole('button', { name: /Filter/ }))
    expect(await axeFindings()).toEqual([])
  })

  it('says on the line what is on and is no value of a list, each with its own way off, and Clear lets go of those too', () => {
    const onRemove = vi.fn()
    const onClear = vi.fn()
    renderShell(<FilterWords find="" onFind={() => {}} fields={FIELDS} onFilters={() => {}} filterGuide="x.filter" words={[{ id: 'text', word: 'Cause: batch', label: 'Cause', onRemove }]} onClear={onClear} />)
    expect(screen.getByRole('button', { name: /^Filter/ }).textContent).toContain('1')
    expect(screen.getByRole('button', { name: /^Filter/ }).getAttribute('data-guide')).toBe('x.filter')
    expect(screen.getByText('Cause: batch')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Stop filtering on Cause: Cause: batch' }))
    expect(onRemove).toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }))
    expect(onClear).toHaveBeenCalled()
  })
})

describe('a bar over a short fixed list', () => {
  it('has no Find with noFind, only what else it offers', () => {
    renderShell(<FilterWords noFind find="" onFind={() => {}} groups={[{ id: 'a', label: 'A' }]} group={null} onGroup={() => {}} />)
    expect(screen.queryByRole('searchbox')).toBeNull()
    expect(screen.getByRole('button', { name: /Group/ })).toBeTruthy()
  })
})
