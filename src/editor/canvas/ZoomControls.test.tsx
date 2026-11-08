// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * The board's dock says where Fit stops at the text size the person reads at:
 * the drawing is framed larger at a larger size, its floor with it, and the
 * hint said the floor at 100% while the pill said 90%.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { renderShell } from '../../app/testing/renderShell'
import { fitFloorAt } from './fitAll'
import { ZoomControls } from './ZoomControls'

afterEach(() => {
  cleanup()
  delete document.documentElement.dataset.textSize
})

describe('the board’s dock at a text size', () => {
  it('scales where Fit stops with the text, never past the ceiling', () => {
    expect(fitFloorAt(1)).toBeCloseTo(0.6)
    expect(fitFloorAt(1.5)).toBeCloseTo(0.9)
    expect(fitFloorAt(10)).toBeLessThanOrEqual(fitFloorAt(100))
  })

  it('says in Fit’s hint the floor at the text size', async () => {
    document.documentElement.dataset.textSize = '150'
    renderShell(<ReactFlowProvider><ZoomControls /></ReactFlowProvider>)
    fireEvent.mouseOver(screen.getByTestId('zoom-fit'))
    expect((await screen.findByRole('tooltip')).textContent).toContain('90%')
  })
})
