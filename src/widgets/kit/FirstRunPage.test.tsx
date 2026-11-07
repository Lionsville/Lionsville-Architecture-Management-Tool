// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { FirstRunPage, FirstRunWay } from './FirstRunPage'

afterEach(() => cleanup())

describe('FirstRunPage', () => {
  it('offers one way forward per intent, with what it says under them', () => {
    render(
      <FirstRunPage brand="App" title="Where to start" intro="A sentence." foot={<p>Where it is kept.</p>} tools={<button type="button">Language</button>}>
        <FirstRunWay title="Start your own"><button type="button">Start</button></FirstRunWay>
        <FirstRunWay title="Look around" body="Try anything."><button type="button">Open</button></FirstRunWay>
      </FirstRunPage>,
    )
    expect(screen.getByRole('heading', { level: 1, name: 'Where to start' })).toBeDefined()
    expect(screen.getAllByRole('heading', { level: 2 }).map((one) => one.textContent)).toEqual(['Start your own', 'Look around'])
    expect(screen.getByText('Where it is kept.')).toBeDefined()
    expect(screen.getByRole('button', { name: 'Language' })).toBeDefined()
  })
})
