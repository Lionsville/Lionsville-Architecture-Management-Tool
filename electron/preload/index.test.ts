/**
 * The one door in the preload that is not a channel of ours.
 *
 * Everything else here is `ipcRenderer.invoke` behind a typed contract, and the
 * file says out loud that it validates nothing — a check on that side of the
 * boundary is a check the caller can skip, and main does it again anyway.
 * `invokeHook` is the exception and the reason is the opposite case: the page
 * has no `ipcRenderer`, so this door is the only way it can name a channel at
 * all, and main answering a `handle` cannot tell who called. If the prefix
 * stopped being checked here, one generic door would become a way to call
 * `files:remove` with a path of the caller's choosing, and nothing downstream
 * would notice. So it is pinned.
 */
import { describe, expect, it, vi } from 'vitest'
import { HOOK_CHANNEL_PREFIX } from '../../src/platform/desktopHook'
import type { HookInvoke } from '../../src/platform/desktopHook'

/**
 * Enough of Electron for a doorway: what it was handed to expose, and what it
 * was asked to invoke. Hoisted, because the mock factory runs before this
 * file's own top level does.
 */
const electron = vi.hoisted(() => ({
  exposed: undefined as Record<string, unknown> | undefined,
  invoked: [] as { channel: string; args: unknown[] }[],
}))

vi.mock('electron', () => ({
  contextBridge: {
    exposeInMainWorld: (_name: string, api: Record<string, unknown>) => { electron.exposed = api },
  },
  ipcRenderer: {
    invoke: (channel: string, ...args: unknown[]) => {
      electron.invoked.push({ channel, args })
      return Promise.resolve('answered')
    },
    on: () => {},
    off: () => {},
  },
}))

/** The bridge as the page would find it on `window.desktop`. */
async function bridge(): Promise<{ invokeHook: HookInvoke }> {
  await import('./index')
  return electron.exposed as unknown as { invokeHook: HookInvoke }
}

describe('invokeHook', () => {
  it('passes a hook’s own channel through, arguments and answer alike', async () => {
    const { invokeHook } = await bridge()
    const answer = await invokeHook(`${HOOK_CHANNEL_PREFIX}somewhere:sign-in`, { name: 'A. Author' }, 2)
    expect(answer).toBe('answered')
    expect(electron.invoked.at(-1)).toEqual({
      channel: 'hook:somewhere:sign-in',
      args: [{ name: 'A. Author' }, 2],
    })
  })

  it('refuses a channel that is not a hook’s, and invokes nothing at all', async () => {
    const { invokeHook } = await bridge()
    const before = electron.invoked.length
    for (const channel of ['files:remove', 'agent:newToken', 'app:command', '', 'hook', 'hooks:x']) {
      await expect(invokeHook(channel)).rejects.toThrow(/not a hook channel/)
    }
    expect(electron.invoked).toHaveLength(before)
  })
})
