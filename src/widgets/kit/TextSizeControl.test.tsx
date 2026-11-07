// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { axeFindings } from '../../app/testing/axe'
import { renderShell } from '../../app/testing/renderShell'
import { TextSizeControl } from './TextSizeControl'

const STEPS = [90, 100, 125] as const

describe('the text size control', () => {
  afterEach(cleanup)

  it('has nothing an accessibility check finds', async () => {
    const { container } = renderShell(<TextSizeControl size={150} steps={STEPS} normal={100} onChoose={vi.fn()} />)
    expect(await axeFindings(container)).toEqual([])
  })

  it('moves a step each way and shows where it is', () => {
    const onChoose = vi.fn()
    renderShell(<TextSizeControl size={100} steps={STEPS} normal={100} onChoose={onChoose} />)
    expect(screen.getByRole('group', { name: 'Text size' })).toBeTruthy()
    expect(screen.getByTestId('text-size-now').textContent).toContain('100%')
    fireEvent.click(screen.getByTestId('text-larger'))
    expect(onChoose).toHaveBeenLastCalledWith(125)
    fireEvent.click(screen.getByTestId('text-smaller'))
    expect(onChoose).toHaveBeenLastCalledWith(90)
  })

  it('refuses at an end, with its reason, and stays in the tab order', () => {
    const onChoose = vi.fn()
    renderShell(<TextSizeControl size={125} steps={STEPS} normal={100} onChoose={onChoose} />)
    const larger = screen.getByTestId('text-larger')
    expect(larger.getAttribute('aria-disabled')).toBe('true')
    expect(larger.getAttribute('aria-label')).toBe('Larger text')
    expect(larger.hasAttribute('disabled')).toBe(false)
    fireEvent.click(larger)
    expect(onChoose).not.toHaveBeenCalled()
    expect(screen.getByTestId('text-smaller').getAttribute('aria-disabled')).toBeNull()
  })

  it('goes back to the default from the size it is at', () => {
    const onChoose = vi.fn()
    renderShell(<TextSizeControl size={125} steps={STEPS} normal={100} onChoose={onChoose} />)
    fireEvent.click(screen.getByTestId('text-size-now'))
    fireEvent.click(screen.getByTestId('text-size-reset'))
    expect(onChoose).toHaveBeenLastCalledWith(100)
  })
})
