// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom

import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, within } from '@testing-library/react'
import { axeFindings } from '../../app/testing/axe'
import { renderShell } from '../../app/testing/renderShell'
import { DateInput, monthWeeks, typedDay } from './DateInput'
import { DateField } from './Field'

afterEach(() => cleanup())

function Live({ onChange, onBlur, start = '2026-11-08', max }: { onChange?: (day: string) => void; onBlur?: () => void; start?: string; max?: string }) {
  const [day, setDay] = useState(start)
  return <DateInput aria-label="Live from" value={day} max={max} onBlur={onBlur} onChange={(next) => { setDay(next); onChange?.(next) }} />
}

const box = () => screen.getByRole('textbox', { name: 'Live from' }) as HTMLInputElement

describe('typedDay', () => {
  it('reads a day written out or in the language\'s order, and nothing else', () => {
    expect(typedDay('2026-11-08')).toBe('2026-11-08')
    expect(typedDay('8-11-2026', 'nl')).toBe('2026-11-08')
    expect(typedDay('08.11.2026', 'de')).toBe('2026-11-08')
    expect(typedDay('8/11/2026', 'en')).toBe('2026-11-08')
    expect(typedDay('2026-02-30')).toBeUndefined()
    expect(typedDay('2026-11')).toBeUndefined()
    expect(typedDay('31/2/2026', 'en')).toBeUndefined()
    expect(typedDay('8.11.26', 'de')).toBeUndefined()
  })
})

describe('monthWeeks', () => {
  it('starts a week on Sunday where the locale does', () => {
    expect(monthWeeks('2026-11-08', 7)[0]).toEqual(['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07'])
  })

  it('lays a month out in weeks from Monday, the days around it filling the first and the last', () => {
    const weeks = monthWeeks('2026-11-08')
    expect(weeks[0]).toEqual(['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01'])
    expect(weeks.at(-1)).toEqual(['2026-11-30', '2026-12-01', '2026-12-02', '2026-12-03', '2026-12-04', '2026-12-05', '2026-12-06'])
    expect(weeks.every((week) => week.length === 7)).toBe(true)
  })
})

describe('DateInput', () => {
  it('is the kit\'s box, never the browser\'s date field', async () => {
    renderShell(<DateField label="Live from" value="2026-11-08" onChange={() => {}} />)
    expect(box().type).toBe('text')
    expect(box().value).toBe('08/11/2026')
    expect(document.querySelector('input[type="date"]')).toBeNull()
    expect(await axeFindings()).toEqual([])
  })

  it('says a day once it is one, an empty box as none, and puts back the day held when left half-typed', () => {
    const chose = vi.fn()
    const left = vi.fn()
    renderShell(<Live onChange={chose} onBlur={left} />)
    fireEvent.change(box(), { target: { value: '2026-12' } })
    expect(chose).not.toHaveBeenCalled()
    fireEvent.blur(box())
    expect(box().value).toBe('08/11/2026')
    expect(left).toHaveBeenCalledTimes(1)
    fireEvent.change(box(), { target: { value: '1/12/2026' } })
    expect(chose).toHaveBeenLastCalledWith('2026-12-01')
    fireEvent.change(box(), { target: { value: '' } })
    expect(chose).toHaveBeenLastCalledWith('')
  })

  it('opens a calendar on the day held, walked by the keys, and takes a day', async () => {
    const chose = vi.fn()
    const left = vi.fn()
    renderShell(<Live onChange={chose} onBlur={left} max="2026-11-20" />)
    fireEvent.click(screen.getByRole('button', { name: 'Choose a day' }))
    const calendar = screen.getByRole('dialog')
    expect(within(calendar).getByText('November 2026')).toBeTruthy()
    expect(document.activeElement?.getAttribute('aria-label')).toMatch(/^8 Nov/)
    expect((within(calendar).getByRole('button', { name: /^21 Nov/ }) as HTMLButtonElement).disabled).toBe(true)
    expect(await axeFindings()).toEqual([])
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowRight' })
    expect(document.activeElement?.getAttribute('aria-label')).toMatch(/^9 Nov/)
    fireEvent.keyDown(document.activeElement!, { key: 'PageUp' })
    expect(within(calendar).getByText('October 2026')).toBeTruthy()
    fireEvent.click(document.activeElement!)
    expect(chose).toHaveBeenCalledWith('2026-10-09')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(left).not.toHaveBeenCalled()
  })
})

describe('DateInput in the app\'s language', () => {
  it.each([
    ['nl', '08-11-2026', '9-11-2026', 'dd-mm-jjjj', 'november 2026', 'ma'],
    ['de', '08.11.2026', '9.11.2026', 'TT.MM.JJJJ', 'November 2026', 'Mo'],
    ['en', '08/11/2026', '9/11/2026', 'dd/mm/yyyy', 'November 2026', 'Mon'],
  ] as const)('%s shows, takes and lays out a day as the language does, not the machine', (language, shown, typed, placeholder, month, monday) => {
    const chose = vi.fn()
    renderShell(<Live onChange={chose} />, { language })
    expect(box().value).toBe(shown)
    expect(box().placeholder).toBe(placeholder)
    fireEvent.change(box(), { target: { value: typed } })
    expect(chose).toHaveBeenLastCalledWith('2026-11-09')
    fireEvent.change(box(), { target: { value: '2026-11-10' } })
    expect(chose).toHaveBeenLastCalledWith('2026-11-10')
    fireEvent.click(screen.getAllByRole('button')[0]!)
    const calendar = screen.getByRole('dialog')
    expect(within(calendar).getByText(month)).toBeTruthy()
    expect(within(calendar).getAllByRole('columnheader')[0]!.textContent?.toLowerCase().startsWith(monday.toLowerCase())).toBe(true)
  })
})
