// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import { chartRoom, fitZoom } from './useChartZoom'

const pane = { width: 1194, height: 800 }
// The key at the pane's bottom right, as `roomsFor` offers it: a column at the right, or a row along the bottom.
const column = { top: 8, right: 250, bottom: 8, left: 8 }
const row = { top: 8, right: 8, bottom: 150, left: 8 }

describe('the room a chart is framed in', () => {
  it('takes the row under a chart wider than the pane, so its middle is the middle of the pane', () => {
    // The whole organisation, which Fit holds at the floor.
    expect(chartRoom(pane, { width: 4000, height: 700 }, [column, row])).toBe(row)
  })

  it('takes the column beside a chart taller than wide', () => {
    expect(chartRoom(pane, { width: 600, height: 1600 }, [row, column])).toBe(column)
  })

  it('takes the room that frames it largest before the one that shows most of it', () => {
    const drawing = { width: 1100, height: 700 }
    const room = chartRoom(pane, drawing, [column, row])
    const size = (one: typeof row) => ({ width: pane.width - one.left - one.right, height: pane.height - one.top - one.bottom })
    expect(fitZoom(size(room), drawing)).toBeGreaterThanOrEqual(fitZoom(size(room === row ? column : row), drawing))
  })
})
