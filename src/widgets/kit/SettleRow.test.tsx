// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { axeFindings } from '../../app/testing/axe'
import { renderShell } from '../../app/testing/renderShell'
import { SettleRow } from './SettleRow'

afterEach(() => cleanup())

const row = { label: 'Name', first: 'Dispatch', second: 'Dispatch hub', firstName: 'Bram', secondName: 'You', chosen: null }

describe('a value two people left differently', () => {
  it('shows both and picks neither until somebody does', () => {
    const onChoose = vi.fn()
    renderShell(<SettleRow {...row} onChoose={onChoose} />)
    const radios = screen.getAllByRole('radio') as HTMLInputElement[]
    expect(radios.map((one) => one.checked)).toEqual([false, false])
    fireEvent.click(screen.getByRole('radio', { name: 'Name: You: Dispatch hub' }))
    expect(onChoose).toHaveBeenCalledWith('second')
  })

  it('has no choice to make where the two may not be picked apart', () => {
    renderShell(<SettleRow {...row} />)
    expect(screen.queryAllByRole('radio')).toEqual([])
    expect(screen.getByText('Dispatch hub')).toBeTruthy()
  })

  it('passes axe', async () => {
    const { container } = renderShell(<SettleRow {...row} onChoose={() => undefined} />)
    expect(await axeFindings(container)).toEqual([])
  })
})
