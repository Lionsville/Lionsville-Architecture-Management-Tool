// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LinkLine, Section } from './Section'

afterEach(() => cleanup())

describe('Section and LinkLine', () => {
  it('heads a part of a page', () => {
    render(<Section title="Views here"><p>one</p></Section>)
    expect(screen.getByRole('heading', { level: 2, name: 'Views here' })).toBeTruthy()
  })

  it('stands without a label under what it is about, and says which one is on screen', () => {
    const { container } = render(<LinkLine className="mine" links={[{ label: 'Principles', onPress: vi.fn(), current: true }, { label: 'Topics', onPress: vi.fn() }]} />)
    expect(container.textContent).toBe('Principles · Topics')
    expect(container.querySelector('p.mine')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Principles' }).getAttribute('aria-current')).toBe('page')
    expect(screen.getByRole('button', { name: 'Topics' }).hasAttribute('aria-current')).toBe(false)
  })

  it('keeps every word a press away, and says nothing with nothing to name', () => {
    const onPress = vi.fn()
    const { container, rerender } = render(<LinkLine label="Nothing here yet:" links={[{ label: 'Documentation', onPress, 'data-testid': 'one' }, { label: 'Building blocks', onPress: vi.fn() }]} />)
    fireEvent.click(screen.getByTestId('one'))
    expect(onPress).toHaveBeenCalledOnce()
    expect(container.textContent).toBe('Nothing here yet: Documentation · Building blocks')
    rerender(<LinkLine label="Nothing here yet:" links={[]} />)
    expect(container.textContent).toBe('')
  })
})
