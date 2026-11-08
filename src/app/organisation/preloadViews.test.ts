// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import type { DesignDiagram } from '../../model/types'
import { kindsToPreload } from './preloadViews'

const view = (kind: DesignDiagram['kind']) => ({ id: kind, kind, name: kind, members: [] }) as unknown as DesignDiagram

describe('what a home fetches while it is idle', () => {
  it('is the pages of the kinds of view it lists, and the observations where it keeps any', () => {
    expect(kindsToPreload({ diagrams: [view('sheet'), view('chart'), view('sheet'), view('layer7')], observations: [] })).toEqual(['sheet', 'chart'])
    expect(kindsToPreload({ diagrams: [], observations: [{} as never] })).toEqual(['observations'])
    expect(kindsToPreload({ diagrams: [view('layer7'), view('container')] })).toEqual([])
  })
})
