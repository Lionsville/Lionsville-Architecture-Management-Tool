// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * One list, two renderers, and the filtering between them.
 *
 * What is worth pinning is not the vocabulary but the rule: an item that
 * cannot work is not offered, and the web is never handed a submenu it has no
 * list for. The renderers themselves are tested where they draw.
 */
import { describe, expect, it } from 'vitest'
import {
  acceleratorMatches,
  EDIT_ITEMS, FILE_MENU, HELP_MENU, PREFERENCES_ITEM, SETTINGS_ITEM, THEME_ITEMS, commandsIn, goMenu, offered, preferencesPlacement,
  swipeCommand, titleCase, ZOOM_ALIASES, ZOOM_ITEMS } from './menu'
import { EN } from './strings/en'

const labels = (entries: ReturnType<typeof offered>) =>
  entries.map((entry) => (entry.kind === 'item' ? entry.label : `<${entry.kind}>`))

describe('offered', () => {
  it('carries the whole list on a desktop that can do everything', () => {
    expect(labels(offered(FILE_MENU, 'desktop', { history: true, connect: true, scope: true }))).toEqual([
      'menu.connect', '<recent>', '<separator>',
      'menu.open', 'menu.save', 'menu.exportWorkingFile', 'menu.shareLink', '<separator>',
      'menu.snapshot', 'menu.history', '<separator>',
      'menu.connectAgent',
    ])
  })

  it('gives the web the same items, minus the submenu only main can fill', () => {
    const web = labels(offered(FILE_MENU, 'web', { history: true, connect: true, scope: true }))
    expect(web).not.toContain('<recent>')
    expect(web).toEqual(
      labels(offered(FILE_MENU, 'desktop', { history: true, connect: true, scope: true }))
        .filter((label) => label !== '<recent>'),
    )
  })

  it('offers nothing about history on a machine that cannot keep one', () => {
    const entries = labels(offered(FILE_MENU, 'web', { history: false, connect: true, scope: true }))
    expect(entries).not.toContain('menu.snapshot')
    expect(entries).not.toContain('menu.history')
    // The section that emptied leaves no rule behind, and no doubled one
    // before what follows it.
    expect(entries[entries.length - 1]).not.toBe('<separator>')
    expect(entries.filter((label) => label === '<separator>').length).toBe(2)
  })

  it('offers no folder to a tab whose browser cannot give one', () => {
    const entries = labels(offered(FILE_MENU, 'web', { history: false, connect: false, scope: true }))
    expect(entries[0]).toBe('menu.open')
  })

  it('never doubles a separator', () => {
    const entries = labels(offered(FILE_MENU, 'web', { history: false, connect: false, scope: true }))
    for (let at = 1; at < entries.length; at += 1) {
      expect(entries[at] === '<separator>' && entries[at - 1] === '<separator>').toBe(false)
    }
  })
})

describe('the vocabulary', () => {
  it('is said in sentence case, and the menu bar says it in Title Case', () => {
    // The table is the web's and every button's; the desktop's menu bar
    // renders it through `titleCase`, and these are the labels it has always
    // carried there.
    const bar: Record<string, string> = {
      'menu.connect': 'Open a Folder…', 'menu.openRecent': 'Open Recent Folder', 'menu.noRecent': 'No Recent Folders',
      'menu.open': 'Open a File…', 'menu.save': 'Save', 'menu.exportWorkingFile': 'Save a Copy…',
      'menu.shareLink': 'Share with a Link…', 'menu.snapshot': 'Take a Snapshot…', 'menu.history': 'History…',
      'menu.connectAgent': 'Connect an Agent…', 'menu.preferences': 'Preferences…', 'menu.settings': 'Settings…',
      'menu.checkForUpdates': 'Check for Updates…', 'menu.undo': 'Undo', 'menu.redo': 'Redo', 'menu.editDelete': 'Delete',
      'menu.editSelectAll': 'Select All', 'menu.userManual': 'Lionsville Architect Help',
      'menu.zoomIn': 'Zoom In', 'menu.zoomOut': 'Zoom Out', 'menu.zoomActual': 'Actual Size', 'menu.shortcuts': 'Keyboard Shortcuts…',
      'menu.back': 'Back', 'menu.forward': 'Forward', 'menu.getDesktopApp': 'Get the Desktop App',
    }
    for (const [key, title] of Object.entries(bar)) {
      const said = EN[key as keyof typeof EN]
      expect(titleCase(said), key).toBe(title)
    }
    expect(EN['menu.exportWorkingFile']).toBe('Save a copy…')
    expect(titleCase('a word first')).toBe('A Word First')
  })

  it('sends a distinct command from every item', () => {
    const commands = commandsIn(FILE_MENU).map((command) => command.type)
    expect(new Set(commands).size).toBe(commands.length)
  })

  it('names the theme three ways and nothing else', () => {
    expect(THEME_ITEMS.map((held) => held.mode)).toEqual(['light', 'dark', 'system'])
  })

  it('puts preferences where the platform does, under the same command', () => {
    expect(preferencesPlacement('darwin')).toBe('appMenu')
    expect(preferencesPlacement('win32')).toBe('fileMenu')
    expect(preferencesPlacement('linux')).toBe('fileMenu')
    expect(SETTINGS_ITEM.command).toEqual(PREFERENCES_ITEM.command)
    expect(SETTINGS_ITEM.label).not.toBe(PREFERENCES_ITEM.label)
  })
})

/**
 * With nothing open, the items about the open scope are not offered on the
 * web — and disabled on the desktop, which reads the same `needs`. They did
 * nothing in silence before, which reads as broken.
 */
describe('with no scope open', () => {
  const nothing = { history: true, connect: true, scope: false }

  it('leaves out Save, and keeps Open…, Save a Copy…, the link, the folder and its history', () => {
    // Save is the open scope's. Open… and Save a Copy… are the working set's
    // (ADR-0023): the organisation's home is the screen the file is named
    // after, and it has to be able to write it.
    const entries = labels(offered(FILE_MENU, 'web', nothing))
    expect(entries).not.toContain('menu.save')
    expect(entries).toEqual([
      'menu.connect', '<separator>', 'menu.open', 'menu.exportWorkingFile', 'menu.shareLink', '<separator>',
      'menu.snapshot', 'menu.history', '<separator>', 'menu.connectAgent',
    ])
  })

  it('keeps the manual and the sheet of keys, which is on every screen', () => {
    expect(labels(offered(HELP_MENU, 'web', nothing))).toEqual(['menu.userManual', 'menu.shortcuts'])
    expect(labels(offered(HELP_MENU, 'web', { ...nothing, scope: true }))).toEqual(['menu.userManual', 'menu.shortcuts'])
  })

  it('makes Delete and Select All need a scope, and Undo and Redo none, with the accelerator the key had', () => {
    // A home has steps of its own to take back (a scope's settings).
    expect(EDIT_ITEMS.undo.needs).toBeUndefined()
    expect(EDIT_ITEMS.redo.needs).toBeUndefined()
    expect(EDIT_ITEMS.delete.needs).toEqual(['scope'])
    expect(EDIT_ITEMS.selectAll.needs).toEqual(['scope'])
    expect(EDIT_ITEMS.undo.accelerator).toBe('CmdOrCtrl+Z')
    // No chord on these two: a menu accelerator fires whether or not the
    // page handled the key, and Delete and ⌘A are the canvas's and a field's.
    expect(EDIT_ITEMS.delete.accelerator).toBeUndefined()
    expect(EDIT_ITEMS.selectAll.accelerator).toBeUndefined()
    expect(EDIT_ITEMS.selectAll.command).toEqual({ type: 'selectAll' })
  })
})

describe('the Go menu (ADR-0033)', () => {
  it('is Back and Forward, on the platform’s own keys', () => {
    expect(goMenu('darwin').map((item) => [item.command.type, item.accelerator])).toEqual([['back', 'Cmd+['], ['forward', 'Cmd+]']])
    for (const platform of ['win32', 'linux']) {
      expect(goMenu(platform).map((item) => [item.command.type, item.accelerator])).toEqual([['back', 'Alt+Left'], ['forward', 'Alt+Right']])
    }
  })

  it('is the desktop’s alone, needs nothing open, and the web is offered none of it', () => {
    for (const item of goMenu('darwin')) {
      expect(item.on).toEqual(['desktop'])
      expect(item.needs).toBeUndefined()
    }
    expect(offered(goMenu('linux'), 'web', { history: true, connect: true, scope: true })).toEqual([])
    expect(offered(goMenu('linux'), 'desktop', { history: false, connect: false, scope: false })).toHaveLength(2)
  })

  it('takes no chord another menu item takes', () => {
    const others = [...FILE_MENU, ...HELP_MENU, ...Object.values(EDIT_ITEMS), PREFERENCES_ITEM]
      .flatMap((entry) => (entry.kind === 'item' && entry.accelerator ? [entry.accelerator] : []))
    for (const platform of ['darwin', 'win32']) {
      for (const item of goMenu(platform)) expect(others).not.toContain(item.accelerator)
    }
  })

  it('reads a swipe to the left as Back and one to the right as Forward', () => {
    expect(swipeCommand('left')).toEqual({ type: 'back' })
    expect(swipeCommand('right')).toEqual({ type: 'forward' })
    expect(swipeCommand('up')).toBeUndefined()
    expect(swipeCommand('down')).toBeUndefined()
  })
})

describe('Share with a link…', () => {
  const share = FILE_MENU.find((entry) => entry.kind === 'item' && entry.command.type === 'share')

  it('is offered on both hosts with nothing open and nothing kept, and carries no key', () => {
    expect(share).toMatchObject({ label: 'menu.shareLink', on: ['desktop', 'web'] })
    expect(share?.kind === 'item' ? share.needs : 'none').toBeUndefined()
    expect(share?.kind === 'item' ? share.accelerator : 'none').toBeUndefined()
    const nothing = { history: false, connect: false, scope: false }
    expect(labels(offered(FILE_MENU, 'web', nothing))).toContain('menu.shareLink')
  })
})

describe('the zoom items', () => {
  it('are commands, with every key that says them, so the renderer can tell a canvas from the window', () => {
    const keys = [...ZOOM_ITEMS, ...ZOOM_ALIASES].map((spec) => spec.accelerator)
    expect(keys).toEqual(expect.arrayContaining(['CmdOrCtrl+0', 'CmdOrCtrl+Plus', 'CmdOrCtrl+-', 'CmdOrCtrl+=', 'CmdOrCtrl+numadd', 'CmdOrCtrl+numsub', 'CmdOrCtrl+num0']))
    for (const spec of [...ZOOM_ITEMS, ...ZOOM_ALIASES]) expect(spec.command.type).toBe('zoom')
    expect(new Set(keys).size).toBe(keys.length)
    expect(ZOOM_ITEMS.map((spec) => spec.command)).toEqual([
      { type: 'zoom', how: 'home' }, { type: 'zoom', how: 'in' }, { type: 'zoom', how: 'out' },
    ])
  })
})

describe('an accelerator heard where there is no menu bar', () => {
  const press = (key: string, over: Partial<{ metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; altKey: boolean }> = {}) =>
    ({ key, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, ...over })

  it('is ⌘ on a Mac and Ctrl elsewhere, and never the other', () => {
    expect(acceleratorMatches('CmdOrCtrl+O', press('o', { metaKey: true }), true)).toBe(true)
    expect(acceleratorMatches('CmdOrCtrl+O', press('o', { ctrlKey: true }), true)).toBe(false)
    expect(acceleratorMatches('CmdOrCtrl+O', press('o', { ctrlKey: true }), false)).toBe(true)
    expect(acceleratorMatches('CmdOrCtrl+O', press('o'), false)).toBe(false)
  })

  it('tells ⌘O from ⇧⌘O, and reads the comma and the shifted letter', () => {
    expect(acceleratorMatches('CmdOrCtrl+O', press('O', { metaKey: true, shiftKey: true }), true)).toBe(false)
    expect(acceleratorMatches('CmdOrCtrl+Shift+O', press('O', { metaKey: true, shiftKey: true }), true)).toBe(true)
    expect(acceleratorMatches('CmdOrCtrl+,', press(',', { metaKey: true }), true)).toBe(true)
    expect(acceleratorMatches('CmdOrCtrl+Plus', press('+', { metaKey: true }), true)).toBe(true)
  })
})
