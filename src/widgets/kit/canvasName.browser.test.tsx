// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A name on a canvas breaks between its words and never inside one, measured in
 * a browser (`vitest.browser.config.ts`, `npm run test:browser`): jsdom lays out
 * nothing, and whether a word fits its line is the font's business.
 *
 * Every word of the example's landscape actors and platforms fits the narrowest chip they
 * are drawn in at the zoom's floor, so none of them is even ellipsised there; and a
 * word too long for any chip ends in an ellipsis, whole, rather than going on
 * as a second line.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'
import type { Root } from 'react-dom/client'
import example from '../../adapters/folder/format/examples/acme-logistics.json'
import { NODE_SIZES } from '../../model/placement'
import { Card } from './Card'
import { tokenVariables } from './tokens'
import { ZOOM_FLOOR } from './zoom'
import './fonts/fonts.css'

type Named = { kind?: string; name?: string }

/** The example's elements, from every scope it ships but the organisation's own, whose actors are its units and drawn on the chart. */
function exampleElements(): Named[] {
  return Object.entries(example as Record<string, unknown>)
    .filter(([path]) => path.endsWith('/model.json'))
    .flatMap(([, held]) => {
      const model = (typeof held === 'string' ? JSON.parse(held) : held) as { elements?: Named[] }
      return model.elements ?? []
    })
}

let root: Root | undefined
let host: HTMLElement | undefined
afterEach(() => {
  root?.unmount()
  host?.remove()
  root = undefined
  host = undefined
})

async function drawn(names: readonly string[], width: number): Promise<HTMLElement> {
  host = document.createElement('div')
  for (const [name, value] of Object.entries({ ...tokenVariables('light'), '--canvas-zoom': String(ZOOM_FLOOR) })) host.style.setProperty(name, value)
  host.style.fontFamily = 'var(--font-ui)'
  document.body.append(host)
  root = createRoot(host)
  flushSync(() => {
    root!.render(<>{names.map((name) => <Card key={name} name={name} style={{ width, boxSizing: 'border-box' }} />)}</>)
  })
  await document.fonts.ready
  return host
}

const cut = (word: Element) => word.scrollWidth > word.clientWidth + 0.5

describe('a name on a canvas', () => {
  it("keeps every word of the example's chips whole at the floor", async () => {
    const elements = exampleElements()
    const actors = elements.filter((one) => one.kind === 'actor').map((one) => one.name ?? '')
    const platforms = elements.filter((one) => one.kind === 'platform' || one.kind === 'platformService').map((one) => one.name ?? '')
    expect(actors.length).toBeGreaterThan(0)
    expect(platforms.length).toBeGreaterThan(0)
    for (const [names, width] of [[actors, NODE_SIZES.actor.width], [platforms, NODE_SIZES.managementTool.width]] as const) {
      const page = await drawn(names, width)
      const words = [...page.querySelectorAll('.kit-name__word')]
      const longest = words.reduce((most, word) => Math.max(most, word.scrollWidth), 0)
      expect(longest, `the longest word of ${names.join(', ')}`).toBeGreaterThan(0)
      expect(words.filter(cut).map((word) => word.textContent)).toEqual([])
      root?.unmount()
      host?.remove()
    }
  })

  it('ends a word too long for its line in an ellipsis, whole, and breaks only at a space', async () => {
    const page = await drawn(['Warehouse Superlongcompoundwordthatnochipholds'], NODE_SIZES.actor.width)
    const words = [...page.querySelectorAll('.kit-name__word')]
    expect(words.map((word) => word.textContent)).toEqual(['Warehouse', 'Superlongcompoundwordthatnochipholds'])
    expect(cut(words[1]!)).toBe(true)
    expect(getComputedStyle(words[1]!).textOverflow).toBe('ellipsis')
    // One line each: the long word did not run on as a line of its own pieces.
    const [first, second] = words.map((word) => word.getBoundingClientRect())
    expect(second!.top).toBeGreaterThan(first!.top)
    expect(second!.height).toBeCloseTo(first!.height, 0)
  })
})
