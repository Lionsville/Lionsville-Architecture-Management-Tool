// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { axeFindings } from '../../app/testing/axe'
import { renderShell } from '../../app/testing/renderShell'
import { matching, Picker, PickerAt } from './Picker'
import type { PickerOption } from './Picker'

afterEach(cleanup)

const OPTIONS: PickerOption[] = [
  { id: 'tariff', label: 'Tariff Engine', detail: 'Application, Billing' },
  { id: 'tarra', label: 'Tarra Lindqvist', detail: 'Dock crew lead' },
  { id: 'star', label: 'Star Tracker', detail: 'Application' },
  { id: 'dock', label: 'Dock Planner', detail: 'tar pit' },
  { id: 'muller', label: 'Jonas Müller' },
]

const field = () => screen.getByRole('combobox', { name: 'Owner' })
const type = (text: string) => fireEvent.change(field(), { target: { value: text } })
const names = () => screen.getAllByRole('option').map((option) => option.querySelector('.kit-picker__name')?.textContent)

describe('matching', () => {
  it('finds a start, then inside a name, then in the detail', () => {
    expect(matching(OPTIONS, 'tar').map((option) => option.id)).toEqual(['tariff', 'tarra', 'star', 'dock'])
  })

  it('ignores case and accents, and space around the words', () => {
    expect(matching(OPTIONS, '  MULLER ').map((option) => option.id)).toEqual(['muller'])
  })

  it('gives all of them for nothing typed', () => {
    expect(matching(OPTIONS, '')).toHaveLength(OPTIONS.length)
  })
})

describe('Picker', () => {
  it('shows results that tell two apart, and picks with a press', async () => {
    const picked = vi.fn()
    renderShell(<Picker label="Owner" options={OPTIONS} onPick={picked} data-guide="owner" />)
    type('tar')
    expect(names()).toEqual(['Tariff Engine', 'Tarra Lindqvist', 'Star Tracker', 'Dock Planner'])
    expect(screen.getAllByRole('option')[0]?.textContent).toContain('Application, Billing')
    expect(document.querySelector('[data-guide="owner"]')).toBeTruthy()
    expect(await axeFindings()).toEqual([])
    fireEvent.click(screen.getAllByRole('option')[1] as Element)
    expect(picked).toHaveBeenCalledWith(OPTIONS[1])
    expect((field() as HTMLInputElement).value).toBe('')
  })

  it('walks by the arrows with the focus in the field, wrapping, and Enter picks', () => {
    const picked = vi.fn()
    renderShell(<Picker label="Owner" options={OPTIONS} onPick={picked} autoFocus />)
    expect(document.activeElement).toBe(field())
    type('tar')
    const activeName = () => document.getElementById(field().getAttribute('aria-activedescendant') ?? '')?.querySelector('.kit-picker__name')?.textContent
    expect(activeName()).toBe('Tariff Engine')
    fireEvent.keyDown(field(), { key: 'ArrowDown' })
    expect(activeName()).toBe('Tarra Lindqvist')
    fireEvent.keyDown(field(), { key: 'ArrowUp' })
    fireEvent.keyDown(field(), { key: 'ArrowUp' })
    expect(activeName()).toBe('Dock Planner')
    expect(document.activeElement).toBe(field())
    fireEvent.keyDown(field(), { key: 'Enter' })
    expect(picked).toHaveBeenCalledWith(OPTIONS[3])
  })

  it('offers to name a new one, in the words given or its own', () => {
    const made = vi.fn()
    const view = renderShell(<Picker label="Owner" options={OPTIONS} onPick={() => {}} onCreate={made} createLabel={(name) => `New application “${name}”`} />)
    type('tar')
    fireEvent.click(screen.getByRole('option', { name: 'New application “tar”' }))
    expect(made).toHaveBeenCalledWith('tar')
    view.unmount()
    renderShell(<Picker label="Owner" options={OPTIONS} onPick={() => {}} onCreate={made} />)
    type('zebra')
    expect(screen.getByRole('option', { name: 'Add “zebra”' })).toBeTruthy()
    fireEvent.keyDown(field(), { key: 'Enter' })
    expect(made).toHaveBeenLastCalledWith('zebra')
  })

  it('does not offer a new one with nothing typed or with that very name there', () => {
    renderShell(<Picker label="Owner" options={OPTIONS} onPick={() => {}} onCreate={() => {}} />)
    expect(screen.queryByRole('option', { name: /Add/ })).toBeNull()
    type('tariff engine')
    expect(screen.queryByRole('option', { name: /Add/ })).toBeNull()
  })

  it('says when nothing matches and there is nothing to offer', async () => {
    renderShell(<Picker label="Owner" options={OPTIONS} onPick={() => {}} />)
    type('zebra')
    expect(screen.getByText('Nothing by that name.')).toBeTruthy()
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(field().getAttribute('aria-expanded')).toBe('false')
    fireEvent.keyDown(field(), { key: 'ArrowDown' })
    fireEvent.keyDown(field(), { key: 'Enter' })
    expect(await axeFindings()).toEqual([])
  })

  it('asks Did you mean where the screen can say', () => {
    const picked = vi.fn()
    renderShell(<Picker label="Owner" options={OPTIONS} onPick={picked} onCreate={() => {}} didYouMean={() => OPTIONS[1]} />)
    type('Tara Lindkvist')
    expect(screen.getByText('Did you mean')).toBeTruthy()
    expect(names()).toEqual(['Tarra Lindqvist', 'Add “Tara Lindkvist”'])
    fireEvent.keyDown(field(), { key: 'Enter' })
    expect(picked).toHaveBeenCalledWith(OPTIONS[1])
  })

  it('shows what was recent with nothing typed, and says to type where nothing was', async () => {
    const view = renderShell(<Picker label="Owner" options={OPTIONS} onPick={() => {}} recent={[OPTIONS[0] as PickerOption]} />)
    expect(screen.getByText('Recent')).toBeTruthy()
    expect(names()).toEqual(['Tariff Engine'])
    expect(await axeFindings()).toEqual([])
    view.unmount()
    renderShell(<Picker label="Owner" options={OPTIONS} onPick={() => {}} recent={[]} />)
    expect(screen.getByText('Type to search.')).toBeTruthy()
    type('muller')
    expect(names()).toEqual(['Jonas Müller'])
  })

  it('takes no typing where nothing may be picked, and says why', async () => {
    renderShell(<Picker label="Owner" options={OPTIONS} onPick={() => {}} refusal="Only an administrator can assign this." />)
    expect(screen.getByText('Only an administrator can assign this.')).toBeTruthy()
    expect(field().hasAttribute('disabled')).toBe(true)
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(await axeFindings()).toEqual([])
  })

  it('keeps a refused option in the list, saying why, and will not pick it', () => {
    const picked = vi.fn()
    renderShell(<Picker label="Owner" options={[{ id: 'x', label: 'Tariff', detail: 'App', refused: 'Already here' }]} onPick={picked} />)
    const option = screen.getByRole('option')
    expect(option.getAttribute('aria-disabled')).toBe('true')
    expect(option.textContent).toContain('Already here')
    expect(option.textContent).not.toContain('App')
    fireEvent.click(option)
    fireEvent.keyDown(field(), { key: 'Enter' })
    expect(picked).not.toHaveBeenCalled()
  })

  it('groups under headings', async () => {
    renderShell(<Picker label="Owner" options={[{ id: 'a', label: 'A', group: 'Units' }, { id: 'b', label: 'B', group: 'Units' }, { id: 'c', label: 'C', group: 'People' }]} onPick={() => {}} />)
    expect(screen.getByText('Units')).toBeTruthy()
    expect(screen.getByText('People')).toBeTruthy()
    expect(document.querySelectorAll('.kit-picker__heading')).toHaveLength(2)
    expect(await axeFindings()).toEqual([])
  })

  it('never draws a dropdown of 300 flat rows', () => {
    const many = Array.from({ length: 300 }, (_, index) => ({ id: `n${index}`, label: `Name ${index}` }))
    renderShell(<Picker label="Owner" options={many} onPick={() => {}} />)
    expect(screen.getAllByRole('option')).toHaveLength(50)
    expect(screen.getByText('250 more. Keep typing to narrow it down.')).toBeTruthy()
  })

  it('says it in the language that is on', () => {
    renderShell(<Picker label="Owner" options={OPTIONS} onPick={() => {}} recent={[]} />, { language: 'nl' })
    expect(screen.getByText('Typ om te zoeken.')).toBeTruthy()
  })
})

describe('Picker in a popup', () => {
  it('opens on focus, closes on leaving, and a press does not take the focus away', async () => {
    const picked = vi.fn()
    renderShell(<Picker label="Owner" options={OPTIONS} onPick={picked} posture="popup" />)
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(field().getAttribute('aria-expanded')).toBe('false')
    fireEvent.focus(field())
    expect(screen.getByRole('listbox')).toBeTruthy()
    expect(field().getAttribute('aria-expanded')).toBe('true')
    expect(await axeFindings()).toEqual([])
    const option = screen.getAllByRole('option')[0] as Element
    expect(fireEvent.mouseDown(option)).toBe(false)
    fireEvent.click(option)
    expect(picked).toHaveBeenCalledOnce()
    expect(screen.queryByRole('listbox')).toBeNull()
    fireEvent.focus(field())
    fireEvent.blur(field())
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('opens by the arrow, and Escape puts the list away and stops there', () => {
    const outer = vi.fn()
    const escaped = vi.fn()
    renderShell(<div onKeyDown={outer}><Picker label="Owner" options={OPTIONS} onPick={() => {}} posture="popup" onEscape={escaped} /></div>)
    fireEvent.keyDown(field(), { key: 'ArrowDown' })
    expect(screen.getByRole('listbox')).toBeTruthy()
    outer.mockClear()
    fireEvent.keyDown(field(), { key: 'Escape' })
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(outer).not.toHaveBeenCalled()
    expect(escaped).not.toHaveBeenCalled()
    fireEvent.keyDown(field(), { key: 'Escape' })
    expect(outer).toHaveBeenCalled()
    expect(escaped).toHaveBeenCalledOnce()
  })
})

describe('PickerAt', () => {
  it('appears with the focus in the field, closes on a pick, and on Escape', async () => {
    const picked = vi.fn()
    const closed = vi.fn()
    const made = vi.fn()
    renderShell(<PickerAt open at={{ x: 100, y: 200 }} label="Owner" options={OPTIONS} onPick={picked} onCreate={made} onClose={closed} />)
    await waitFor(() => expect(document.activeElement).toBe(field()))
    expect(await axeFindings()).toEqual([])
    type('tar')
    fireEvent.keyDown(field(), { key: 'Enter' })
    expect(picked).toHaveBeenCalledWith(OPTIONS[0])
    expect(closed).toHaveBeenCalledOnce()
    type('zebra')
    fireEvent.keyDown(field(), { key: 'Enter' })
    expect(made).toHaveBeenCalledWith('zebra')
    closed.mockClear()
    fireEvent.keyDown(field(), { key: 'Escape' })
    expect(closed).toHaveBeenCalledOnce()
  })
})
