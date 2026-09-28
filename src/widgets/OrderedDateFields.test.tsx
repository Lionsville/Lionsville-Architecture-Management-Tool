// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * A day typed out of order stays where it was typed, marked, with the reason
 * under it, and is not written; a day that fits is written and clears it.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createTheme, ThemeProvider } from '@mui/material/styles'
import { OrderedDateFields } from './OrderedDateFields'

afterEach(() => cleanup())

type Phase = 'live' | 'retired'
const inOrder = (dates: Partial<Record<Phase, string>> | undefined) => !dates?.live || !dates.retired || dates.live <= dates.retired

function mount(values: Partial<Record<Phase, string>> | undefined) {
  const onChange = vi.fn()
  render(
    <ThemeProvider theme={createTheme()}>
      <OrderedDateFields<Phase>
        keys={['live', 'retired']} values={values} label={(key) => key}
        accepts={inOrder} refusal="Runs backwards" onChange={onChange}
      />
    </ThemeProvider>,
  )
  return onChange
}

describe('OrderedDateFields', () => {
  it('keeps a day that runs backwards in its field with the reason, writes nothing, and clears once a day fits', () => {
    const onChange = mount({ live: '2027-05-01' })
    const retired = screen.getByLabelText('retired') as HTMLInputElement
    fireEvent.change(retired, { target: { value: '2027-01-01' } })
    expect(onChange).not.toHaveBeenCalled()
    expect(retired.value).toBe('2027-01-01')
    expect(retired.getAttribute('aria-invalid')).toBe('true')
    expect(screen.getByText('Runs backwards')).toBeTruthy()
    fireEvent.change(retired, { target: { value: '2027-09-01' } })
    expect(onChange).toHaveBeenLastCalledWith({ live: '2027-05-01', retired: '2027-09-01' })
    expect(screen.queryByText('Runs backwards')).toBeNull()
  })

  it('takes a key off rather than leaving it empty, and nothing at all when the last one goes', () => {
    const onChange = mount({ live: '2027-05-01' })
    fireEvent.change(screen.getByLabelText('live'), { target: { value: '' } })
    expect(onChange).toHaveBeenLastCalledWith(undefined)
  })
})
