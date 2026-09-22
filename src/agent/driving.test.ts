// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The driving session (ADR-0019): which calls start one, what Stop does to
 * the next call and to the one in flight, and how a session ends.
 */
import { describe, expect, it } from 'vitest'
import { Driving, drives } from './driving'
import { TOOLS } from './tools'

describe('what drives', () => {
  it('is every write, every see-tool but the report, and moving the app', () => {
    expect(drives('element.add')).toBe(true)
    expect(drives('diagram.render')).toBe(true)
    expect(drives('focus')).toBe(true)
    expect(drives('app.open')).toBe(true)
    expect(drives('session.start')).toBe(true)
  })

  it('is no read, not the layout report, and not asking where the app is', () => {
    for (const tool of TOOLS) if (tool.tier === 'read') expect(drives(tool.name), tool.name).toBe(false)
    expect(drives('diagram.inspect')).toBe(false)
    expect(drives('app.current')).toBe(false)
    expect(drives('views.list')).toBe(false)
    expect(drives('session.end')).toBe(false)
  })
})

describe('a driving session', () => {
  const clock = () => '2026-09-19T10:00:00.000Z'

  it('starts on the first driving call, named after the client, and counts the calls', () => {
    const driving = new Driving(clock)
    expect(driving.current()).toEqual({})
    expect(driving.admit('element.add', 'Claude Code')).toBeUndefined()
    expect(driving.current().session).toEqual({ client: 'Claude Code', since: clock(), calls: 1 })
    driving.admit('focus', 'Claude Code')
    expect(driving.current().session?.calls).toBe(2)
  })

  it('takes a purpose from session.start without restarting the count', () => {
    const driving = new Driving(clock)
    driving.admit('element.add', 'Claude Code')
    driving.admit('session.start', 'Claude Code')
    driving.start('Claude Code', 'Tidying the retail board')
    expect(driving.current().session).toMatchObject({ purpose: 'Tidying the retail board', calls: 2, since: clock() })
  })

  it('ends when the agent says so or the client goes, leaving no mark', () => {
    const driving = new Driving(clock)
    driving.admit('element.add', undefined)
    driving.end('agent')
    expect(driving.current()).toEqual({})
    driving.admit('element.add', undefined)
    driving.end('client')
    expect(driving.current()).toEqual({})
    // Nothing to end is nothing.
    driving.end('agent')
    expect(driving.current()).toEqual({})
  })

  it('remembers the person\'s Stop: every driving call is refused until session.start', () => {
    const driving = new Driving(clock)
    const stops: number[] = []
    driving.onStop(() => stops.push(1))
    driving.admit('element.add', 'Claude Code')
    driving.end('person')
    expect(stops).toEqual([1])
    expect(driving.current()).toEqual({ stopped: { at: clock(), client: 'Claude Code' } })
    expect(driving.admit('element.add', 'Claude Code')).toBe('agent.stopped')
    expect(driving.admit('app.open', 'Claude Code')).toBe('agent.stopped')
    expect(driving.admit('session.start', 'Claude Code')).toBeUndefined()
    expect(driving.current().stopped).toBeUndefined()
    expect(driving.current().session).toMatchObject({ client: 'Claude Code', calls: 1 })
  })

  it('tells a listener about every change, and stops telling one that left', () => {
    const driving = new Driving(clock)
    let changes = 0
    const off = driving.onChange(() => { changes += 1 })
    driving.admit('element.add', undefined)
    expect(changes).toBe(2)
    off()
    driving.end('agent')
    expect(changes).toBe(2)
  })
})
