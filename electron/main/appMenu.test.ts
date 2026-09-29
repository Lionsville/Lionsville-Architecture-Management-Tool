// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The commands main sends the window, with Electron stood in for: held until
 * the window says it listens, then sent once each and in order; straight
 * through after that; and never more than a bounded few held for a window
 * that never listens. The file keeps its state in module variables, so every
 * case imports a fresh copy.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { HostCommand } from '../../src/platform/hostCommands'

const sent = vi.hoisted(() => [] as unknown[])

vi.mock('electron', () => ({
  Menu: { setApplicationMenu: vi.fn(), buildFromTemplate: vi.fn() },
  MenuItem: vi.fn(),
  webContents: {
    getAllWebContents: () => [{
      isDestroyed: () => false,
      isFocused: () => true,
      send: (channel: string, command: unknown) => { sent.push({ channel, command }) },
    }],
  },
}))

const save: HostCommand = { type: 'save' }
const undo: HostCommand = { type: 'undo' }
const reopen: HostCommand = { type: 'reopen', key: '/work/architecture' }
const connect: HostCommand = { type: 'connect' }

/** A window's contents, as far as holding commands for it goes: its events, raised by the test. */
function contents() {
  const listeners = new Map<string, ((details: unknown) => void)[]>()
  return {
    on: (event: string, listener: (details: unknown) => void) => {
      listeners.set(event, [...listeners.get(event) ?? [], listener])
    },
    raise: (event: string, details: unknown = {}) => { for (const listener of listeners.get(event) ?? []) listener(details) },
  }
}

async function fresh() {
  vi.resetModules()
  return import('./appMenu')
}

const commands = () => sent.map((one) => (one as { command: HostCommand }).command)

beforeEach(() => { sent.length = 0 })

describe('the commands main sends the window', () => {
  it('holds a command sent before the window listens, and sends it once, after', async () => {
    const menu = await fresh()
    menu.sendCommand(reopen)
    expect(sent).toEqual([])
    menu.commandsHeard()
    expect(sent).toEqual([{ channel: 'app:command', command: reopen }])
    menu.commandsHeard()
    expect(commands()).toEqual([reopen])
  })

  it('sends a command straight through once the window listens', async () => {
    const menu = await fresh()
    menu.commandsHeard()
    menu.sendCommand(save)
    expect(commands()).toEqual([save])
  })

  it('keeps the order of the commands it held', async () => {
    const menu = await fresh()
    menu.sendCommand(reopen)
    menu.sendCommand(connect)
    menu.commandsHeard()
    expect(commands()).toEqual([reopen, connect])
  })

  it('holds only a way somewhere: a command about the scope that was open is not run into the next one', async () => {
    const menu = await fresh()
    menu.sendCommand(undo)
    menu.sendCommand(reopen)
    menu.sendCommand(save)
    menu.commandsHeard()
    expect(commands()).toEqual([reopen])
  })

  it('holds no more than a bounded few for a window that never listens', async () => {
    const menu = await fresh()
    for (let pressed = 0; pressed < menu.HELD_AT_MOST + 10; pressed += 1) menu.sendCommand(connect)
    menu.commandsHeard()
    expect(commands()).toHaveLength(menu.HELD_AT_MOST)
  })

  it('holds again after the page reloads, until the reloaded page listens', async () => {
    const menu = await fresh()
    const window = contents()
    menu.holdUntilHeard(window as never)
    menu.commandsHeard()
    // What a reload is heard as: begun, then a new document committed.
    window.raise('did-start-navigation', { isMainFrame: true, isSameDocument: false })
    window.raise('did-navigate')
    menu.sendCommand(reopen)
    expect(sent).toEqual([])
    expect(menu.commandsListened()).toBe(false)
    menu.commandsHeard()
    expect(commands()).toEqual([reopen])
  })

  it('holds again once the renderer is gone, and for a window made anew', async () => {
    const menu = await fresh()
    const window = contents()
    menu.holdUntilHeard(window as never)
    menu.commandsHeard()
    window.raise('render-process-gone')
    menu.sendCommand(connect)
    expect(sent).toEqual([])
    menu.commandsHeard()
    menu.holdUntilHeard(contents() as never)
    menu.sendCommand(reopen)
    expect(commands()).toEqual([connect])
  })

  it('goes on sending where the page only moved within itself', async () => {
    const menu = await fresh()
    const window = contents()
    menu.holdUntilHeard(window as never)
    menu.commandsHeard()
    window.raise('did-start-navigation', { isMainFrame: true, isSameDocument: true })
    window.raise('did-navigate-in-page')
    menu.sendCommand(save)
    expect(commands()).toEqual([save])
  })

  it('goes on sending after a navigation out of the app that was refused, as the page that listened stays', async () => {
    const menu = await fresh()
    const window = contents()
    menu.holdUntilHeard(window as never)
    menu.commandsHeard()
    // A file dropped beside a drop zone: begun, then refused at will-navigate, so nothing commits.
    window.raise('did-start-navigation', { isMainFrame: true, isSameDocument: false })
    window.raise('will-navigate', { preventDefault: () => undefined })
    menu.sendCommand(undo)
    expect(commands()).toEqual([undo])
    expect(menu.commandsListened()).toBe(true)
  })

  it('holds again once the window is destroyed', async () => {
    const menu = await fresh()
    const window = contents()
    menu.holdUntilHeard(window as never)
    menu.commandsHeard()
    window.raise('destroyed')
    expect(menu.commandsListened()).toBe(false)
    menu.sendCommand(reopen)
    expect(sent).toEqual([])
  })
})
