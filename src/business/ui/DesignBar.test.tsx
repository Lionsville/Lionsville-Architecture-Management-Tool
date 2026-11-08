// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/** The design bar's overlap count is a way to the blocks: one may lie under the other, where nothing shows it. */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { renderShell } from '../../app/testing/renderShell'
import { translator } from '../../i18n'
import { DesignBar } from './PosterDesign'

afterEach(cleanup)

describe('the design bar', () => {
  it('finds the blocks that overlap on a press', () => {
    const onShowOverlap = vi.fn()
    const places = { blocks: [{ id: 'a', x: 0, y: 0, width: 100, height: 100 }, { id: 'b', x: 50, y: 50, width: 100, height: 100 }, { id: 'c', x: 400, y: 0, width: 50, height: 50 }], waiting: [] }
    renderShell(<DesignBar actions={{} as never} places={places as never} onPaperLayout={vi.fn()} onAddArea={vi.fn()} onNote={vi.fn()} onPicture={vi.fn()} onShowOverlap={onShowOverlap} t={translator('en')} />)
    fireEvent.click(screen.getByTestId('poster-overlaps'))
    expect(onShowOverlap).toHaveBeenCalledWith(['a', 'b'])
  })
})
