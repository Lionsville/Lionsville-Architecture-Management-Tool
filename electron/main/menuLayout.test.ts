// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * One File menu, not two.
 *
 * The bug this pins shipped: our File menu was inserted beside Electron's
 * instead of over it, so the bar carried a second File menu holding nothing but
 * Close Window.
 */
import { describe, expect, it } from 'vitest'
import { fileMenuSlot, goMenuSlot, helpMenuTail, replacingSlot } from './menuLayout'

/** The default macOS menu bar, with the roles spelled as Electron returns them. */
const macDefaults = [
  { role: 'appmenu' }, { role: 'filemenu' }, { role: 'editmenu' },
  { role: 'viewmenu' }, { role: 'windowmenu' },
]

describe('fileMenuSlot', () => {
  it('takes the place of the default File menu on every platform, whatever its roles say', () => {
    expect(fileMenuSlot(macDefaults, 'darwin')).toEqual({ index: 1, replace: true })
    const defaults = [{ role: 'filemenu' }, { role: 'editmenu' }, { role: 'help' }]
    expect(fileMenuSlot(defaults, 'win32')).toEqual({ index: 0, replace: true })
    // Electron lower-cases it. `fileMenu` is what the type union spells and what
    // a reader would compare against; it must not be what decides.
    expect(fileMenuSlot([{ role: 'appmenu' }, { role: 'fileMenu' }], 'darwin'))
      .toEqual({ index: 1, replace: true })
    expect(fileMenuSlot([{}, {}], 'darwin')).toEqual({ index: 1, replace: false })
  })

  it('goes after the app menu on macOS with none to replace, and first where there is no app menu', () => {
    expect(fileMenuSlot([{ role: 'appmenu' }, { role: 'editmenu' }], 'darwin'))
      .toEqual({ index: 1, replace: false })
    expect(fileMenuSlot([{ role: 'editmenu' }], 'linux'))
      .toEqual({ index: 0, replace: false })
  })

})

describe('replacingSlot', () => {
  it('takes the place of the default Edit and Help menus, and goes last where there is none', () => {
    expect(replacingSlot(macDefaults, 'editmenu')).toEqual({ index: 2, replace: true })
    expect(replacingSlot([{ role: 'filemenu' }, { role: 'editMenu' }, { role: 'help' }], 'help'))
      .toEqual({ index: 2, replace: true })
    expect(replacingSlot([{ role: 'filemenu' }, { role: 'Help' }], 'editmenu'))
      .toEqual({ index: 2, replace: false })
  })
})

describe('goMenuSlot (ADR-0033)', () => {
  it('goes after View, as on every Mac', () => {
    expect(goMenuSlot(macDefaults)).toBe(4)
    expect(goMenuSlot([{ role: 'filemenu' }, { role: 'viewMenu' }, { role: 'help' }])).toBe(2)
  })

  it('goes before Window or Help where there is no View, and last where there is neither', () => {
    expect(goMenuSlot([{ role: 'filemenu' }, { role: 'windowmenu' }, { role: 'help' }])).toBe(1)
    expect(goMenuSlot([{ role: 'filemenu' }, { role: 'help' }])).toBe(1)
    expect(goMenuSlot([{ role: 'filemenu' }])).toBe(1)
  })
})

/**
 * And what Help ends with, which is not always an item.
 *
 * *Check for Updates…* used to be drawn whatever the build had decided about
 * updates, and to call a check the process had already decided not to make. A
 * build composed from this one may keep its own updates, and then the item
 * reaches a release page that is not its own.
 */
describe('helpMenuTail', () => {
  it('ends Help with the rule and the item where this build offers a check', () => {
    expect(helpMenuTail(true)).toEqual([{ kind: 'separator' }, { kind: 'checkForUpdates' }])
  })

  /** Both, or neither: a Help menu ending in a rule with nothing under it is the
      shape a conditional at the end of the menu ships. */
  it('ends it where it always ended where this build offers none', () => {
    expect(helpMenuTail(false)).toEqual([])
  })
})
