// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CaretIcon, iconSize, SearchIcon } from './icons'

describe('an icon follows the text size', () => {
  it('says its size as a number the style sheet draws in rem, and keeps its pixels as attributes', () => {
    const { container } = render(<><CaretIcon size={12} /><SearchIcon size={14} /></>)
    const [caret, glass] = [...container.querySelectorAll('svg')]
    expect(caret.classList.contains('kit-icon')).toBe(true)
    expect(caret.style.getPropertyValue('--icon-size')).toBe('12')
    expect(caret.getAttribute('width')).toBe('12')
    expect(glass.style.getPropertyValue('--icon-size')).toBe('14')
  })

  it('is drawn in rem outside a drawing and in px inside one', () => {
    const css = readFileSync('src/widgets/icons.css', 'utf8')
    expect(css).toMatch(/\.kit-icon \{[^}]*calc\(var\(--icon-size\) \* var\(--icon-unit, 0\.0625rem\)\)/)
    expect(css).toMatch(/\.react-flow__viewport[^{]*\{ --icon-unit: 1px; \}/)
    expect(iconSize(16)).toMatchObject({ width: 16, height: 16, className: 'kit-icon' })
  })
})
