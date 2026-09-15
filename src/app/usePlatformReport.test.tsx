// @vitest-environment jsdom
/**
 * The shell's side of a platform's report (ADR-0013, redone).
 *
 * There is almost nothing left to pin, which is the change: the first cut made
 * this a view kind — a diagram record, a tab, a page that had to be created
 * before it could be read, and one per platform for ever. A report is derived
 * from the rows every time it opens, so the only state there is, is which
 * platform is being read. The arithmetic is `model/platformReport.test.ts`'s
 * and the page is `PlatformReportPage.test.tsx`'s.
 */
import { describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { usePlatformReport } from './usePlatformReport'

describe('reading a platform', () => {
  it('opens on a platform and closes to nothing, writing not one thing', () => {
    const { result } = renderHook(() => usePlatformReport())
    expect(result.current.platformId).toBeUndefined()
    act(() => result.current.open('esb'))
    expect(result.current.platformId).toBe('esb')
    // A second platform is simply the next one read: nothing is kept per
    // platform, so nothing can be stale and nothing can be duplicated.
    act(() => result.current.open('kafka'))
    expect(result.current.platformId).toBe('kafka')
    act(() => result.current.close())
    expect(result.current.platformId).toBeUndefined()
  })
})
