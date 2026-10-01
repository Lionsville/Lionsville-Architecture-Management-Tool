// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A problem said as the facts the app had, and the offer a notice carries
 * where the open source's provider gave an action on one.
 */
import { describe, expect, it } from 'vitest'
import type { Screen } from '../agent/screen'
import { ShellError } from '../platform/errors'
import { problemOf, problemOffer } from './problem'
import type { Problem } from './problem'

const AT = new Date('2026-10-01T09:30:00.000Z')
const ON_A_BOARD: Screen = { open: { path: 'acme/landscape', name: 'Landscape', view: { id: 'd1', name: 'L7', kind: 'layer7' } } }

describe('problemOf', () => {
  it('says an error by its kind, its message and its stack', () => {
    const cause = new TypeError('cannot read the thing')
    const problem = problemOf({ where: 'editor', cause }, AT, ON_A_BOARD)
    expect(problem).toEqual({
      where: 'editor', name: 'TypeError', message: 'cannot read the thing', stack: cause.stack,
      at: '2026-10-01T09:30:00.000Z', screen: ON_A_BOARD,
    })
  })

  it('says a refusal by its key and the command refused, with nothing thrown', () => {
    expect(problemOf({ where: 'session.dispatch', key: 'command.taken', command: 'element.create' }, AT)).toEqual({
      where: 'session.dispatch', key: 'command.taken', command: 'element.create', at: '2026-10-01T09:30:00.000Z',
    })
  })

  it('takes the key a refusal carries where none was said', () => {
    const problem = problemOf({ where: 'openScopeAt', cause: new ShellError('shell.scopeMoved') }, AT)
    expect(problem.key).toBe('shell.scopeMoved')
    expect(problem.name).toBe('ShellError')
    // A key that was said wins over the one the cause carries: it is what the person read.
    expect(problemOf({ where: 'x', key: 'picker.loadFailed', cause: new ShellError('shell.scopeMoved') }, AT).key)
      .toBe('picker.loadFailed')
  })

  it('says what a thrown value that is not an error says of itself, and nothing it does not', () => {
    expect(problemOf({ where: 'window', cause: 'gone' }, AT).message).toBe('gone')
    expect(problemOf({ where: 'window', cause: { message: 'refused' } }, AT).message).toBe('refused')
    const bare = problemOf({ where: 'window', cause: 42 }, AT)
    expect(bare).toEqual({ where: 'window', at: '2026-10-01T09:30:00.000Z' })
  })
})

describe('problemOffer', () => {
  it('is nothing where no provider offered an action', () => {
    expect(problemOffer(undefined, (key) => key, () => undefined)).toBeUndefined()
  })

  it('carries the provider\'s words, and hands it the problem as it was when it happened', () => {
    const handed: Problem[] = []
    let screen: Screen = ON_A_BOARD
    let now = AT
    const offer = problemOffer(
      { labelKey: 'elsewhere.tell', run: (problem) => handed.push(problem) },
      (key) => `«${key}»`, () => screen, () => now,
    )!
    const action = offer({ where: 'session.dispatch', key: 'command.taken', command: 'element.create' })!
    expect(action.label).toBe('«elsewhere.tell»')
    // The person moves on and presses it later: the problem is still the moment it happened.
    screen = { home: { path: '', name: 'Acme' } }
    now = new Date('2026-10-01T10:00:00.000Z')
    expect(handed).toEqual([])
    action.onClick()
    expect(handed).toEqual([{
      where: 'session.dispatch', key: 'command.taken', command: 'element.create',
      at: '2026-10-01T09:30:00.000Z', screen: ON_A_BOARD,
    }])
  })

  it('asks whether the action can be taken each time a problem happens, and offers nothing while it cannot', () => {
    const handed: Problem[] = []
    let can = false
    let asked = 0
    const offer = problemOffer(
      { labelKey: 'elsewhere.tell', run: (problem) => handed.push(problem), available: () => { asked += 1; return can } },
      (key) => key, () => undefined, () => AT,
    )!
    // Made while the action cannot be taken yet: nothing is asked until a problem happens.
    expect(asked).toBe(0)
    expect(offer({ where: 'app' })).toBeUndefined()
    expect(asked).toBe(1)
    can = true
    const action = offer({ where: 'session.dispatch', key: 'command.taken' })!
    expect(asked).toBe(2)
    expect(action.label).toBe('elsewhere.tell')
    // Pressed after it stopped being available: the offer made is still the person's to take.
    can = false
    action.onClick()
    expect(handed).toEqual([{ where: 'session.dispatch', key: 'command.taken', at: '2026-10-01T09:30:00.000Z' }])
  })
})
