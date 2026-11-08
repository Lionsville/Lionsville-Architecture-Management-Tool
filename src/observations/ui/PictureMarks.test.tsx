// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/** The dashed card for records the map does not draw keeps its hint inside it, in every language. */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup } from '@testing-library/react'
import { renderShell } from '../../app/testing/renderShell'
import { translator } from '../../i18n'
import { PICTURE_SIZE } from '../graph'
import type { PictureNode } from '../graph'
import { RecordMark } from './PictureMarks'

afterEach(() => cleanup())

describe('the card for records not drawn', () => {
  it.each(['en', 'nl', 'de'] as const)('wraps its hint inside the card in %s', (language) => {
    const node = { kind: 'more', more: 'pile', count: 12, key: 'pile', lane: 0, x: 0, y: 0 } as unknown as PictureNode
    const { container } = renderShell(
      <svg><RecordMark node={node} size="large" selected={false} matched={false} openEnd={false} fill="none" s={translator(language)} /></svg>,
      { language },
    )
    const lines = [...container.querySelectorAll('tspan')].map((line) => line.textContent ?? '')
    expect(lines.join(' ')).toBe(translator(language)('observation.mapPileHint'))
    // A character of the hint's type takes at most 5.6 px: no line runs past the card's margins.
    for (const line of lines) expect(line.length * 5.6).toBeLessThanOrEqual(PICTURE_SIZE.large.width - 24)
    expect(44 + 16 * (lines.length - 1)).toBeLessThan(PICTURE_SIZE.large.height)
  })
})
