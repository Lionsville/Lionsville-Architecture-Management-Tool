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
import { HelpFigure, cutTo } from './HelpFigure'

afterEach(() => cleanup())

const rect = (left: number, top: number, width: number, height: number) => ({ left, top, width, height }) as DOMRect

describe('the part a picture is cut to', () => {
  it('is the part, with room for a ring round it, inside the picture', () => {
    expect(cutTo(rect(100, 50, 560, 230), rect(250, 110, 300, 60), { width: 560, height: 230 })).toEqual({ x: 150, y: 60, width: 300, height: 60 })
    expect(cutTo(rect(100, 50, 560, 230), rect(250, 110, 300, 60), { width: 560, height: 230 }, 4)).toEqual({ x: 146, y: 56, width: 308, height: 68 })
    // A part at the picture's edge is not cut past it.
    expect(cutTo(rect(0, 0, 560, 230), rect(0, 200, 560, 60), { width: 560, height: 230 }, 4)).toEqual({ x: 0, y: 196, width: 560, height: 34 })
  })

  it('is nothing where nothing could be measured, and the picture is shown whole', () => {
    expect(cutTo(rect(0, 0, 0, 0), rect(0, 0, 0, 0), { width: 560, height: 230 })).toBeUndefined()
  })
})

describe('a figure', () => {
  it('shows the whole picture on a press, at the width it is drawn, and closes', () => {
    const Picture = () => <div data-crop=""><span>Views here</span></div>
    render(<HelpFigure Picture={Picture} caption="A scope's home" t={translator('en')} width={560} />)
    const press = screen.getByRole('button', { name: "Show the whole picture: A scope's home" })
    const whole = document.querySelector('dialog') as HTMLDialogElement
    expect(whole.open).toBe(false)
    fireEvent.click(press)
    expect(whole.hasAttribute('open')).toBe(true)
    expect((whole.querySelector('.help-screen') as HTMLElement).style.width).toBe('560px')
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(whole.hasAttribute('open')).toBe(false)
  })
})
