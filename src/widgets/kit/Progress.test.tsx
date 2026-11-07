// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { Progress } from './Progress'

afterEach(() => cleanup())

describe('how far a long piece of work has got', () => {
  it('says how far, under its name', () => {
    render(<Progress value={12} max={67} label="Copying" />)
    const bar = screen.getByRole<HTMLProgressElement>('progressbar', { name: 'Copying' })
    expect(bar.value).toBe(12)
    expect(bar.max).toBe(67)
  })

  it('claims no number before there is one, and never past the end', () => {
    render(<Progress label="Starting" />)
    expect(screen.getByRole('progressbar', { name: 'Starting' }).hasAttribute('value')).toBe(false)
    cleanup()
    render(<Progress value={70} max={67} label="Done" />)
    expect(screen.getByRole<HTMLProgressElement>('progressbar', { name: 'Done' }).value).toBe(67)
  })
})
