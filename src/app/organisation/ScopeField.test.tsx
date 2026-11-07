// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { translator } from '../../i18n'
import { ScopeField } from './ScopeField'
import type { ScopeSummary } from '../../projects/scope'
import { renderShell } from '../testing/renderShell'

afterEach(() => cleanup())

const s = translator('en')

/** A landscape filed in a folder that is no scope of its own: `acme` is not listed. */
const tree: ScopeSummary = {
  path: '', name: 'Organisation', diagrams: 0, children: [
    { path: 'acme/rail', name: 'Rail', diagrams: 1, children: [] },
    { path: 'globex', name: 'Globex', diagrams: 0, children: [] },
  ],
}

describe('ScopeField', () => {
  it('shows an address the listing does not hold, by its path, and chosen', () => {
    const onChange = vi.fn()
    renderShell(
      <ScopeField tree={tree} value="acme" onChange={onChange} label="Filed under" excluding="acme/rail" s={s} />,
    )
    expect((screen.getByLabelText('Filed under') as HTMLSelectElement).value).toBe('acme')
    const options = screen.getAllByRole('option')
    expect(options.map((one) => one.textContent?.trim())).toEqual(['Organisation', 'acme', 'Globex'])
    fireEvent.change(screen.getByLabelText('Filed under'), { target: { value: 'globex' } })
    expect(onChange).toHaveBeenCalledWith('globex')
  })

  it('adds nothing when the address is listed', () => {
    renderShell(<ScopeField tree={tree} value="globex" onChange={vi.fn()} label="Filed under" s={s} />)
    expect(screen.getAllByRole('option').map((one) => one.textContent?.trim()))
      .toEqual(['Organisation', 'Rail', 'Globex'])
  })
})
