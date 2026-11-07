// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Every command a person can find in a menu, ⌘K or the sheet of keys has a
 * section in the help that answers for it, on every platform and with every
 * item offered. A command added without one fails here, by its label.
 */
import { describe, expect, it } from 'vitest'
import { CHAPTERS } from '../../help/outline'
import { DESKTOP_APP_LINK, FILE_MENU, HELP_MENU, WEBSITE_LINK, offered } from '../../platform/menu'
import { commandsTable } from './commandsTable'

const claimed = new Set(CHAPTERS.flatMap((chapter) => chapter.sections.flatMap((one) => one.menu ?? [])))
const everything = { history: true, connect: true, scope: true, picture: true }

describe('the help answers for every command', () => {
  it.each(['darwin', 'linux', 'win32'])('in the commands table on %s', (platform) => {
    const rows = commandsTable(everything, platform)
    expect(rows.map((row) => row.label).filter((label) => !claimed.has(label))).toEqual([])
  })

  it('on the desktop\'s File and Help menus, and the ways out to the site', () => {
    const items = [...offered(FILE_MENU, 'desktop', everything), ...offered(HELP_MENU, 'desktop', everything)]
      .flatMap((entry) => (entry.kind === 'item' ? [entry.label] : []))
    const labels = [...items, DESKTOP_APP_LINK.label, WEBSITE_LINK.label, 'menu.checkForUpdates', 'menu.openRecent']
    expect(labels.filter((label) => !claimed.has(label))).toEqual([])
  })
})
