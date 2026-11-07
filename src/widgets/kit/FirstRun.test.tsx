// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { FirstRunPage, StructurePicture } from './FirstRun'

afterEach(() => cleanup())

describe('FirstRunPage', () => {
  it('says what this is and offers each choice under its own name', () => {
    render(<FirstRunPage title="Map it" body="A tree of scopes." choices={[
      { id: 'own', title: 'Start your own', body: 'Name it.', children: <button type="button">Start</button> },
      { id: 'example', title: 'Look around', body: 'An example.', children: <button type="button">Copy</button> },
    ]} />)
    expect(screen.getByRole('heading', { level: 1, name: 'Map it' })).toBeTruthy()
    expect(within(screen.getByRole('region', { name: 'Start your own' })).getByRole('button', { name: 'Start' })).toBeTruthy()
    expect(within(screen.getByRole('region', { name: 'Look around' })).getByRole('button', { name: 'Copy' })).toBeTruthy()
  })

  it('draws the structure as one picture to a screen reader', () => {
    render(<StructurePicture label="A tree" top="Yours" middle={['A team']} kept={['Views']} />)
    expect(screen.getByRole('img', { name: 'A tree' }).textContent).toBe('YoursA teamViews')
  })
})
