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
  HOOK_CHANNEL_PREFIX, desktopHooks, isHookChannel, registerDesktopHook,
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
