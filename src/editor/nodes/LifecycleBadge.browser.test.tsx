// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The phase word holds its size on screen at every zoom, measured in a browser
 * (`npm run test:browser`): jsdom lays out nothing. In a box's corner, which
 * holds its size by a zoom of its own, the word was sized for the zoom a second
 * time and stood 1.7 times too large over a boundary's type at 60 %.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'
import type { Root } from 'react-dom/client'
import type { ReactNode } from 'react'
import { tokenVariables } from '../../widgets/kit/tokens'
import { ZOOM_FLOOR } from '../../widgets/kit/zoom'
import { Zone } from '../../widgets/kit/Zone'
import { LifecycleBadge, lifecycleWord } from './LifecycleBadge'
import { t } from '../../i18n'
import '../../widgets/kit/fonts/fonts.css'
import '../canvas/board.css'

let root: Root | undefined
let host: HTMLElement | undefined
afterEach(() => {
  root?.unmount()
  host?.remove()
})

/** Drawn as React Flow draws a board: the canvas scaled by the zoom, and the zoom said to the CSS. */
async function onBoard(zoom: number, children: ReactNode): Promise<HTMLElement> {
  host = document.createElement('div')
  for (const [name, value] of Object.entries({ ...tokenVariables('light'), '--canvas-zoom': String(zoom) })) host.style.setProperty(name, value)
  host.style.fontFamily = 'var(--font-ui)'
  document.body.append(host)
  root = createRoot(host)
  flushSync(() => {
    root!.render(
      <div className="lv-board" style={{ transform: `scale(${zoom})`, transformOrigin: '0 0' }}>
        <div style={{ position: 'relative', width: 400, height: 300 }}>{children}</div>
      </div>,
    )
  })
  await document.fonts.ready
  return host
}

const height = (element: Element) => element.getBoundingClientRect().height

describe('the phase word', () => {
  it('is the same size on screen in a corner, beside a type, and at every zoom', async () => {
    const heights: number[] = []
    for (const zoom of [ZOOM_FLOOR, 1, 1.6]) {
      const page = await onBoard(zoom, (
        <>
          <LifecycleBadge lifecycle="planned" show />
          <Zone kind="boundary" className="lv-boundary" name="Planned app" aside={<>{'[Application]'}{lifecycleWord('planned', (key) => t('en', key))}</>} />
        </>
      ))
      const [corner, head] = [...page.querySelectorAll('.lv-life')]
      expect(height(corner!), `in the corner at ${zoom}`).toBeCloseTo(height(head!), 0)
      heights.push(height(head!))
      root?.unmount()
      host?.remove()
    }
    expect(Math.max(...heights) - Math.min(...heights)).toBeLessThan(1)
  })
})
