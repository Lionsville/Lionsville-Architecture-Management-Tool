// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV
// @vitest-environment jsdom

/**
 * A picture cut to the part its words are about, at the size it is drawn, and
 * the whole of it on a press: the reviewer read the pictures' words at seven
 * pixels, as shapes.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { translator } from '../../i18n'
import { HelpFigure } from './HelpFigure'

afterEach(() => cleanup())

describe('a figure', () => {
  it('shows the whole picture on a press, and closes', () => {
    const Picture = () => <div data-crop=""><span>Views here</span></div>
    render(<HelpFigure Picture={Picture} caption="A scope's home" t={translator('en')} width={560} />)
    const press = screen.getByRole('button', { name: "Show the whole picture: A scope's home" })
    const whole = document.querySelector('dialog') as HTMLDialogElement
    expect(whole.open).toBe(false)
    fireEvent.click(press)
    expect(whole.hasAttribute('open')).toBe(true)
    // jsdom lays nothing out, so nothing is enlarged; how much is, is `fitScale`'s and the browser suite's.
    expect((whole.querySelector('.help-screen') as HTMLElement).style.width).toBe('560px')
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(whole.hasAttribute('open')).toBe(false)
  })
})
