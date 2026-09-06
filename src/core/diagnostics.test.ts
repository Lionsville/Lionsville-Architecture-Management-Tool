import { describe, expect, it } from 'vitest'
import {
  describeCause, formatDiagnostic, formatDiagnostics, pushBounded, RING_SIZE,
} from './diagnostics'
import type { DiagnosticEntry } from './diagnostics'

const entry = (over: Partial<DiagnosticEntry> = {}): DiagnosticEntry => ({
  at: '2026-09-06T10:00:00.000Z', level: 'error', where: 'boot', message: 'shell.crashed', ...over,
})

describe('describeCause', () => {
  it('gives an Error as name and message', () => {
    expect(describeCause(new TypeError('nope'))).toBe('TypeError: nope')
  })

  it('reads a message off a thrown object that is not an Error', () => {
    expect(describeCause({ message: 'quota exceeded' })).toBe('quota exceeded')
  })

  it('stringifies anything else, because `throw "oops"` is legal', () => {
    expect(describeCause('oops')).toBe('oops')
    expect(describeCause(42)).toBe('42')
  })

  it('has nothing to say about nothing', () => {
    expect(describeCause(undefined)).toBeUndefined()
    expect(describeCause(null)).toBeUndefined()
  })
})

describe('formatDiagnostic', () => {
  it('is one line: when, how bad, where, and what', () => {
    expect(formatDiagnostic(entry())).toBe('2026-09-06T10:00:00.000Z ERROR boot: shell.crashed')
  })

  it('appends the cause when there was one', () => {
    expect(formatDiagnostic(entry({ cause: new Error('no storage') })))
      .toBe('2026-09-06T10:00:00.000Z ERROR boot: shell.crashed — Error: no storage')
  })
})

describe('formatDiagnostics', () => {
  it('joins the entries oldest first, one per line', () => {
    const text = formatDiagnostics([entry({ message: 'first' }), entry({ message: 'second' })])
    expect(text.split('\n').map((line) => line.split(': ')[1])).toEqual(['first', 'second'])
  })

  it('says so rather than handing over an empty clipboard', () => {
    expect(formatDiagnostics([])).toBe('No diagnostics recorded.')
  })
})

describe('pushBounded', () => {
  it('keeps the newest and drops the oldest', () => {
    expect(pushBounded([1, 2, 3], 4, 3)).toEqual([2, 3, 4])
  })

  it('leaves a list under the limit alone', () => {
    expect(pushBounded([1], 2, 3)).toEqual([1, 2])
  })

  it('keeps 200 by default — enough to send, small enough to read', () => {
    let held: number[] = []
    for (let i = 0; i < RING_SIZE + 5; i += 1) held = pushBounded(held, i)
    expect(held).toHaveLength(RING_SIZE)
    expect(held[0]).toBe(5)
  })
})
