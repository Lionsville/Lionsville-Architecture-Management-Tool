// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import { isSheetReading } from './sheetReading'

describe('a map as a reading of the sheet', () => {
  it('is one wherever the scope has a sheet, and a view of its own where it has none', () => {
    expect(isSheetReading({ kind: 'map' }, [{ kind: 'sheet' }, { kind: 'map' }])).toBe(true)
    expect(isSheetReading({ kind: 'map' }, [{ kind: 'map' }, { kind: 'layer7' }])).toBe(false)
    expect(isSheetReading({ kind: 'sheet' }, [{ kind: 'sheet' }])).toBe(false)
  })
})
