// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV
// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest'
import { applyTray } from './PosterTray'
import type { TrayWork } from './PosterTray'
import type { PosterActions } from './PosterDesign'

function work(over: Partial<TrayWork> = {}) {
  const actions = { team: vi.fn(), cover: vi.fn(), hand: vi.fn() } as unknown as PosterActions
  const say = vi.fn()
  const held: TrayWork = {
    model: { name: '', elements: [], relations: [], diagrams: [] } as unknown as TrayWork['model'],
    laidOut: { actors: [], areas: [], unitsNotDrawn: 0, unmapped: [] },
    actions, say, t: (key, values) => `${key}${values ? ` ${JSON.stringify(values)}` : ''}`,
    coverageAt: () => ({ supportedBy: [], assignedTo: [], coverage: 'uncovered' }),
    ...over,
  }
  return { held, actions, say }
}

describe('what the tray does to what it lands on', () => {
  it('labels with a unit by id and with a typed name by name, on all it is given', () => {
    const { held, actions } = work()
    applyTray(held, 'team', { id: 'u', name: 'Unit' }, ['a', 'b'], false)
    expect(actions.team).toHaveBeenCalledWith(['a', 'b'], { id: 'u' })
    applyTray(held, 'team', { name: 'Typed' }, ['a'], false)
    expect(actions.team).toHaveBeenCalledWith(['a'], { name: 'Typed' })
  })

  it('refuses an application on a block in words, and writes nothing', () => {
    const { held, actions, say } = work()
    applyTray(held, 'application', { id: 'app', name: 'App' }, ['area'], true)
    expect(actions.cover).not.toHaveBeenCalled()
    expect(say).toHaveBeenCalledWith('sheet.poster.appOnBlock')
  })

  it('says so when the application already covers it, and adds nothing', () => {
    const { held, actions, say } = work({ coverageAt: () => ({ supportedBy: ['app'], assignedTo: [], coverage: 'covered' as const }) })
    applyTray(held, 'application', { id: 'app', name: 'App' }, ['a'], false)
    expect(actions.cover).not.toHaveBeenCalled()
    expect(say.mock.calls[0][0]).toContain('sheet.poster.appAlready')
  })

  it('hands to a subscope, but never what another scope keeps, with the panel\'s words', () => {
    const { held, actions, say } = work({ ownerOf: (id) => (id === 'kept' ? { label: 'Above' } : undefined) })
    applyTray(held, 'subscope', { id: 'x/y', name: 'Y' }, ['kept', 'own'], false)
    expect(actions.hand).toHaveBeenCalledWith(['own'], 'x/y')
    applyTray(held, 'subscope', { id: 'x/y', name: 'Y' }, ['kept'], false)
    expect(say.mock.calls.at(-1)?.[0]).toContain('standIn.definedIn')
  })
})
