// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The registry, which this build leaves empty.
 *
 * That emptiness is worth a case of its own: the seam is meant to cost nothing
 * where nobody uses it, and a hook that crept in here would be a channel this
 * app opens without saying so.
 */
import { describe, expect, it } from 'vitest'
import type { DesktopHook, DesktopSide } from './desktopHook'
import {
  HOOK_CHANNEL_PREFIX, desktopHooks, hookOrigins, isHookChannel, registerDesktopHook,
} from './desktopHook'

function nothing(): DesktopSide {
  return {
    channels: { handle: () => {}, removeHandler: () => {} },
    secrets: {
      read: async () => undefined,
      write: async () => {},
      remove: async () => {},
    },
  }
}

function counting(id: string): DesktopHook & { runs: () => number } {
  let runs = 0
  return { id, registerChannels: () => { runs += 1 }, runs: () => runs }
}

describe('the desktop hooks', () => {
  it('has none, because this build registers none', () => {
    expect(desktopHooks().filter((hook) => !hook.id.startsWith('test.'))).toEqual([])
  })

  it('keeps one that is registered, in the order it was', () => {
    const first = counting('test.first')
    const second = counting('test.second')
    registerDesktopHook(first)
    registerDesktopHook(second)
    const mine = desktopHooks().filter((hook) => hook.id.startsWith('test.'))
    expect(mine.map((hook) => hook.id)).toEqual(['test.first', 'test.second'])
  })

  it('ignores the same id twice, so registering per test case is safe', () => {
    const first = counting('test.twice')
    const again = counting('test.twice')
    registerDesktopHook(first)
    registerDesktopHook(again)
    expect(desktopHooks().filter((hook) => hook.id === 'test.twice')).toHaveLength(1)
    for (const hook of desktopHooks()) hook.registerChannels(nothing())
    expect(first.runs()).toBe(1)
    expect(again.runs()).toBe(0)
  })
})

/**
 * Where the page may reach, which is the one part of the desktop's
 * Content-Security-Policy a hook has a say in (`electron/main/csp.ts` folds
 * these in and drops what is not an origin).
 */
describe('hookOrigins', () => {
  it('has none, because this build registers no hook that names one', () => {
    expect(hookOrigins().filter((named) => !named.origin.startsWith('https://test.'))).toEqual([])
  })

  it('gathers what the hooks name, in the order they registered', () => {
    registerDesktopHook({
      ...counting('test.reaches'),
      origins: () => [{ origin: 'https://test.one' }],
    })
    registerDesktopHook({
      ...counting('test.pictures'),
      origins: () => [{ origin: 'https://test.two', pictures: true }],
    })
    const mine = hookOrigins().filter((named) => named.origin.startsWith('https://test.'))
    expect(mine).toEqual([
      { origin: 'https://test.one' },
      { origin: 'https://test.two', pictures: true },
    ])
  })

  /**
   * Asked at every document rather than read once, so a hook that has since
   * learnt where it was pointed is read again at the next load.
   */
  it('asks again each time, rather than remembering the first answer', () => {
    let pointed = 'https://test.before'
    registerDesktopHook({
      ...counting('test.moves'),
      origins: () => [{ origin: pointed }],
    })
    expect(hookOrigins().map((named) => named.origin)).toContain('https://test.before')
    pointed = 'https://test.after'
    expect(hookOrigins().map((named) => named.origin)).toContain('https://test.after')
    expect(hookOrigins().map((named) => named.origin)).not.toContain('https://test.before')
  })

  /** One hook that throws is not a window with no document. */
  it('skips a hook that throws and still asks the rest', () => {
    registerDesktopHook({
      ...counting('test.throws'),
      origins: () => { throw new Error('not yet') },
    })
    expect(hookOrigins().map((named) => named.origin)).toContain('https://test.one')
  })
})

/**
 * The name every channel a hook registers has to have. It is the preload's
 * whole test for whether the page may call something
 * (`electron/preload/index.ts`), so what counts as one is decided here and
 * nowhere else.
 */
describe('isHookChannel', () => {
  it('is a channel under the prefix, and nothing else', () => {
    expect(HOOK_CHANNEL_PREFIX).toBe('hook:')
    expect(isHookChannel('hook:somewhere:sign-in')).toBe(true)
    expect(isHookChannel('hook:')).toBe(true)
    // The app's own channels, the near misses, and what is not a string at all.
    for (const held of ['files:read', 'agent:answer', 'app:command', 'hooks:x', 'Hook:x', ' hook:x', '', 7, undefined, null, {}]) {
      expect(isHookChannel(held)).toBe(false)
    }
  })
})
