// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { renderShell } from '../../app/testing/renderShell'
import { Clamped } from './Clamped'

afterEach(() => { cleanup(); vi.restoreAllMocks() })

const tall = (px: number) => vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(px)

describe('a long text', () => {
  it('is drawn whole, with nothing to press, where it fits or nearly does', () => {
    tall(240)
    renderShell(<Clamped>Words</Clamped>)
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('opens on a press and folds again', () => {
    tall(2000)
    renderShell(<Clamped testId="text">Words</Clamped>)
    const folded = () => screen.getByTestId('text').querySelector('[data-folded]')
    expect(folded()).not.toBeNull()
    const press = screen.getByRole('button', { name: 'Show all' })
    expect(press.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(press)
    expect(folded()).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Show less' }))
    expect(folded()).not.toBeNull()
  })

  it('opens when the focus goes into it', () => {
    tall(2000)
    renderShell(<Clamped testId="text"><a href="#there">A link</a></Clamped>)
    expect(screen.getByTestId('text').querySelector('[data-folded]')).not.toBeNull()
    fireEvent.focus(screen.getByRole('link'))
    expect(screen.getByTestId('text').querySelector('[data-folded]')).toBeNull()
  })
})
