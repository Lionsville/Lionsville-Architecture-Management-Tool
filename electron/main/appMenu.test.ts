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
const reopen: HostCommand = { type: 'reopen', key: '/work/architecture' }

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
    menu.sendCommand(save)
    menu.commandsHeard()
    expect(commands()).toEqual([reopen, save])
  })

  it('holds no more than a bounded few for a window that never listens', async () => {
    const menu = await fresh()
    for (let pressed = 0; pressed < menu.HELD_AT_MOST + 10; pressed += 1) menu.sendCommand(save)
    menu.commandsHeard()
    expect(commands()).toHaveLength(menu.HELD_AT_MOST)
  })
})
