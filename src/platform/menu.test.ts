/**
 * One list, two renderers, and the filtering between them.
 *
 * What is worth pinning is not the vocabulary but the rule: an item that
 * cannot work is not offered, and the web is never handed a submenu it has no
 * list for. The renderers themselves are tested where they draw.
 */
import { describe, expect, it } from 'vitest'
import {
  FILE_MENU, PREFERENCES_ITEM, SETTINGS_ITEM, THEME_ITEMS, commandsIn, offered, preferencesPlacement,
} from './menu'

const labels = (entries: ReturnType<typeof offered>) =>
  entries.map((entry) => (entry.kind === 'item' ? entry.label : `<${entry.kind}>`))

describe('offered', () => {
  it('carries the whole list on a desktop that can do everything', () => {
    expect(labels(offered(FILE_MENU, 'desktop', { history: true, folders: true }))).toEqual([
      'menu.openFolder', '<recentFolders>', '<separator>',
      'menu.open', 'menu.save', 'menu.exportWorkingFile', 'menu.exportInterchange', '<separator>',
      'menu.snapshot', 'menu.history', '<separator>',
      'menu.connectAgent',
    ])
  })

  it('gives the web the same items, minus the submenu only main can fill', () => {
    const web = labels(offered(FILE_MENU, 'web', { history: true, folders: true }))
    expect(web).not.toContain('<recentFolders>')
    expect(web).toEqual(
      labels(offered(FILE_MENU, 'desktop', { history: true, folders: true }))
        .filter((label) => label !== '<recentFolders>'),
    )
  })

  it('offers nothing about history on a machine that cannot keep one', () => {
    const entries = labels(offered(FILE_MENU, 'web', { history: false, folders: true }))
    expect(entries).not.toContain('menu.snapshot')
    expect(entries).not.toContain('menu.history')
    // The section that emptied leaves no rule behind, and no doubled one
    // before what follows it.
    expect(entries[entries.length - 1]).not.toBe('<separator>')
    expect(entries.filter((label) => label === '<separator>').length).toBe(2)
  })

  it('offers no folder to a tab whose browser cannot give one', () => {
    const entries = labels(offered(FILE_MENU, 'web', { history: false, folders: false }))
    expect(entries[0]).toBe('menu.open')
  })

  it('never doubles a separator', () => {
    const entries = labels(offered(FILE_MENU, 'web', { history: false, folders: false }))
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
