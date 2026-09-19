/**
 * One list, two renderers, and the filtering between them.
 *
 * What is worth pinning is not the vocabulary but the rule: an item that
 * cannot work is not offered, and the web is never handed a submenu it has no
 * list for. The renderers themselves are tested where they draw.
 */
import { describe, expect, it } from 'vitest'
import {
  EDIT_ITEMS, FILE_MENU, HELP_MENU, PREFERENCES_ITEM, SETTINGS_ITEM, THEME_ITEMS, commandsIn, offered, preferencesPlacement,
} from './menu'

const labels = (entries: ReturnType<typeof offered>) =>
  entries.map((entry) => (entry.kind === 'item' ? entry.label : `<${entry.kind}>`))

describe('offered', () => {
  it('carries the whole list on a desktop that can do everything', () => {
    expect(labels(offered(FILE_MENU, 'desktop', { history: true, folders: true, scope: true }))).toEqual([
      'menu.openFolder', '<recentFolders>', '<separator>',
      'menu.open', 'menu.save', 'menu.exportWorkingFile', '<separator>',
      'menu.snapshot', 'menu.history', '<separator>',
      'menu.connectAgent',
    ])
  })

  it('gives the web the same items, minus the submenu only main can fill', () => {
    const web = labels(offered(FILE_MENU, 'web', { history: true, folders: true, scope: true }))
    expect(web).not.toContain('<recentFolders>')
    expect(web).toEqual(
      labels(offered(FILE_MENU, 'desktop', { history: true, folders: true, scope: true }))
        .filter((label) => label !== '<recentFolders>'),
    )
  })

  it('offers nothing about history on a machine that cannot keep one', () => {
    const entries = labels(offered(FILE_MENU, 'web', { history: false, folders: true, scope: true }))
    expect(entries).not.toContain('menu.snapshot')
    expect(entries).not.toContain('menu.history')
    // The section that emptied leaves no rule behind, and no doubled one
    // before what follows it.
    expect(entries[entries.length - 1]).not.toBe('<separator>')
    expect(entries.filter((label) => label === '<separator>').length).toBe(2)
  })

  it('offers no folder to a tab whose browser cannot give one', () => {
    const entries = labels(offered(FILE_MENU, 'web', { history: false, folders: false, scope: true }))
    expect(entries[0]).toBe('menu.open')
  })

  it('never doubles a separator', () => {
    const entries = labels(offered(FILE_MENU, 'web', { history: false, folders: false, scope: true }))
    for (let at = 1; at < entries.length; at += 1) {
      expect(entries[at] === '<separator>' && entries[at - 1] === '<separator>').toBe(false)
    }
  })
})

describe('the vocabulary', () => {
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
  const nothing = { history: true, folders: true, scope: false }

  it('leaves out Open…, Save and Save a Copy…, and keeps the folder and its history', () => {
    const entries = labels(offered(FILE_MENU, 'web', nothing))
    expect(entries).not.toContain('menu.open')
    expect(entries).not.toContain('menu.save')
    expect(entries).not.toContain('menu.exportWorkingFile')
    expect(entries).toEqual([
      'menu.openFolder', '<separator>', 'menu.snapshot', 'menu.history', '<separator>', 'menu.connectAgent',
    ])
  })

  it('keeps the manual and drops the shortcut overlay, which is the canvas’s', () => {
    expect(labels(offered(HELP_MENU, 'web', nothing))).toEqual(['menu.userManual'])
    expect(labels(offered(HELP_MENU, 'web', { ...nothing, scope: true }))).toEqual(['menu.userManual', 'menu.shortcuts'])
  })

  it('makes every Edit item one that needs a scope, with the accelerator the key had', () => {
    for (const spec of Object.values(EDIT_ITEMS)) expect(spec.needs).toEqual(['scope'])
    expect(EDIT_ITEMS.undo.accelerator).toBe('CmdOrCtrl+Z')
    // No chord on these two: a menu accelerator fires whether or not the
    // page handled the key, and Delete and ⌘A are the canvas's and a field's.
    expect(EDIT_ITEMS.delete.accelerator).toBeUndefined()
    expect(EDIT_ITEMS.selectAll.accelerator).toBeUndefined()
    expect(EDIT_ITEMS.selectAll.command).toEqual({ type: 'selectAll' })
  })
})
