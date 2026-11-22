// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV
// @vitest-environment jsdom

/**
 * A page's tab and look in the frame: the setters stay the same while the
 * frame's value is made again, as it is on every step it looks at, and reach
 * the frame as it is now.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { PlaceTabContext, usePlaceLook, usePlaceTab } from './placeTab'
import type { PlaceTabs } from './placeTab'

afterEach(cleanup)

describe('the setters a page is handed', () => {
  it('stay the same function while the frame is made again, and write to the frame that is there now', () => {
    const seen: unknown[] = []
    function Page() {
      const [, setTab] = usePlaceTab('about', 'blocks')
      const [, setLook] = usePlaceLook('blocks')
      seen.push([setTab, setLook])
      return null
    }
    const frame = (): PlaceTabs => ({ tab: undefined, choose: vi.fn(), chooseLook: vi.fn() })
    const first = frame()
    const view = render(<PlaceTabContext.Provider value={first}><Page /></PlaceTabContext.Provider>)
    const second = frame()
    view.rerender(<PlaceTabContext.Provider value={second}><Page /></PlaceTabContext.Provider>)
    const [[tabA, lookA], [tabB, lookB]] = seen as [[(tab: string) => void, (look: string | undefined) => void], [unknown, unknown]]
    expect(tabB).toBe(tabA)
    expect(lookB).toBe(lookA)
    tabA('used')
    lookA('at=')
    expect(second.choose).toHaveBeenCalledWith('used', 'blocks')
    expect(second.chooseLook).toHaveBeenCalledWith('at=', 'blocks')
    expect(first.choose).not.toHaveBeenCalled()
  })
})
