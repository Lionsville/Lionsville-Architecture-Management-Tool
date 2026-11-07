// @vitest-environment jsdom
// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV
import { afterEach } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'

import { describe, expect, it, vi } from 'vitest'
import { axeFindings } from '../../app/testing/axe'
import { renderShell } from '../../app/testing/renderShell'
import { GuideDock, GuideRing } from './GuideDock'
import { keptOnScreen } from './guidePlace'

afterEach(cleanup)

const dock = (props: Partial<Parameters<typeof GuideDock>[0]> = {}) => (
  <GuideDock name="Finding your way" position="Step 2 of 6" title="The tree" why="Every scope is listed here." act="Press a name." {...props} />
)

describe('the guide dock', () => {
  it('says where, why and what to do, holds nothing and passes axe', async () => {
    const { container } = renderShell(dock())
    expect(screen.getByRole('dialog', { name: 'The tree' }).getAttribute('aria-modal')).toBe('false')
    expect(screen.getByTestId('learn-act').textContent).toBe('Press a name.')
    expect(await axeFindings(container)).toEqual([])
  })

  it('keeps the rest behind Tell me more', () => {
    renderShell(dock({ more: 'And the rest of it.' }))
    expect(screen.queryByText('And the rest of it.')).toBeNull()
    fireEvent.click(screen.getByTestId('learn-more'))
    expect(screen.getByText('And the rest of it.')).toBeTruthy()
  })

  it('draws only what it is handed, and says each press', () => {
    const onNext = vi.fn()
    renderShell(dock({ onNext }))
    expect(screen.queryByTestId('learn-back')).toBeNull()
    expect(screen.queryByTestId('learn-skip')).toBeNull()
    fireEvent.click(screen.getByTestId('learn-next'))
    expect(onNext).toHaveBeenCalledOnce()
  })

  it('moves by the arrows of its grip', () => {
    const onMoved = vi.fn()
    renderShell(dock({ onMoved }))
    fireEvent.keyDown(screen.getByTestId('learn-grip'), { key: 'ArrowLeft' })
    expect(onMoved).toHaveBeenCalledWith({ x: -16, y: 0 })
  })

  it('rings one target, and draws no line where there is no dock to draw it from', () => {
    renderShell(<GuideRing target={{ left: 10, top: 10, width: 100, height: 20 }} />)
    expect(screen.getByTestId('learn-spotlight')).toBeTruthy()
    expect(screen.getByText('Press here')).toBeTruthy()
    expect(document.querySelector('.kit-guide-line')).toBeNull()
  })

  it('stays on the screen', () => {
    expect(keptOnScreen({ x: 5000, y: -5000 }, { width: 340, height: 200 }, { width: 1000, height: 800 })).toEqual({ x: 16, y: -568 })
  })
})
