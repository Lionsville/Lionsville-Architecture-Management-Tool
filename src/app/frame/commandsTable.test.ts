// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import { commandsTable, keyCap } from './commandsTable'

const everything = { history: true, connect: true, scope: true }

describe('the one table of commands', () => {
  it('holds what the menu bar holds, Back and the theme among it', () => {
    const types = commandsTable(everything, 'darwin').map((row) => row.command.type)
    for (const type of ['connect', 'open', 'save', 'export', 'share', 'snapshot', 'history', 'connectAgent', 'undo', 'redo', 'back', 'forward', 'theme', 'zoom', 'preferences', 'manual', 'shortcuts']) {
      expect(types, type).toContain(type)
    }
  })

  it('offers with nothing open only what works with nothing open, the sheet of keys included', () => {
    const types = commandsTable({ history: true, connect: false, scope: false }, 'linux').map((row) => row.command.type)
    expect(types).not.toContain('save')
    expect(types).not.toContain('selectAll')
    // A home's own steps are taken back with nothing open.
    expect(types).toContain('undo')
    expect(types).toContain('shortcuts')
    expect(types).toContain('export')
  })

  it('offers the example to look around, from any screen, only where it can be visited', () => {
    const row = commandsTable({ history: false, connect: false, scope: false, example: true }, 'darwin').find((one) => one.command.type === 'example')
    expect(row).toMatchObject({ group: 'help', label: 'menu.visitExample' })
    expect(commandsTable({ ...everything, example: false }, 'darwin').some((one) => one.command.type === 'example')).toBe(false)
  })

  it('gives every row a name of its own', () => {
    const ids = commandsTable(everything, 'darwin').map((row) => row.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('says a key as the platform says it', () => {
    expect(keyCap('CmdOrCtrl+Shift+E', true)).toBe('⇧⌘E')
    expect(keyCap('CmdOrCtrl+Shift+E', false)).toBe('Ctrl+Shift+E')
    expect(keyCap('CmdOrCtrl+Shift+E', false, 'de')).toBe('Strg+Umschalt+E')
    expect(keyCap('Alt+Left', false)).toBe('Alt+←')
    expect(keyCap('CmdOrCtrl+Plus', true)).toBe('⌘+')
  })
})
