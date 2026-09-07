/**
 * One File menu, not two.
 *
 * The bug this pins shipped: our File menu was inserted beside Electron's
 * instead of over it, so the bar carried a second File menu holding nothing but
 * Close Window.
 */
import { describe, expect, it } from 'vitest'
import { fileMenuSlot } from './menuLayout'

/** The default macOS menu bar, with the roles spelled as Electron returns them. */
const macDefaults = [
  { role: 'appmenu' }, { role: 'filemenu' }, { role: 'editmenu' },
  { role: 'viewmenu' }, { role: 'windowmenu' },
]

describe('fileMenuSlot', () => {
  it('takes the place of the default File menu', () => {
    expect(fileMenuSlot(macDefaults, 'darwin')).toEqual({ index: 1, replace: true })
  })

  it('takes it on Windows and Linux too, where it is first', () => {
    const defaults = [{ role: 'filemenu' }, { role: 'editmenu' }, { role: 'help' }]
    expect(fileMenuSlot(defaults, 'win32')).toEqual({ index: 0, replace: true })
  })

  it('matches the role Electron hands back, not the one the constructor took', () => {
    // Electron lower-cases it. `fileMenu` is what the type union spells and what
    // a reader would compare against; it must not be what decides.
    expect(fileMenuSlot([{ role: 'appmenu' }, { role: 'fileMenu' }], 'darwin'))
      .toEqual({ index: 1, replace: true })
  })

  it('goes after the app menu on macOS when there is none to replace', () => {
    expect(fileMenuSlot([{ role: 'appmenu' }, { role: 'editmenu' }], 'darwin'))
      .toEqual({ index: 1, replace: false })
  })

  it('goes first where there is no app menu and none to replace', () => {
    expect(fileMenuSlot([{ role: 'editmenu' }], 'linux'))
      .toEqual({ index: 0, replace: false })
  })

  it('survives a menu whose items have no roles at all', () => {
    expect(fileMenuSlot([{}, {}], 'darwin')).toEqual({ index: 1, replace: false })
  })
})
